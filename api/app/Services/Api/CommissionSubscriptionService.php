<?php

namespace App\Services\Api;

use App\Jobs\SendTemplatedEmail;
use App\Models\CommissionPaymentLog;
use App\Models\Company;
use App\Models\CompanyCommissionCharge;
use App\Models\CustomerOrder;
use App\Models\Gateway;
use App\Models\SaasPlan;
use App\Models\User;
use App\Services\ImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CommissionSubscriptionService
{
    private const WARNING_TEMPLATE_KEY = 'commission_payment_warning';

    private const STORE_DISABLED_TEMPLATE_KEY = 'commission_store_disabled';

    public function registerOrderCharge(CustomerOrder $order): void
    {
        if (!$order->company_id) {
            return;
        }

        $company = Company::query()
            ->with('saasPlan')
            ->where('company_id', $order->company_id)
            ->first();

        if (!$company || !$company->saasPlan || !$company->saasPlan->status || !$company->saasPlan->isCommissionBased()) {
            return;
        }

        CompanyCommissionCharge::query()->updateOrCreate(
            ['order_id' => $order->id],
            [
                'company_id' => $company->company_id,
                'saas_plan_id' => $company->saas_plan_id,
                'order_no' => $order->order_no,
                'base_amount' => $this->resolveCommissionBaseAmount($order, $company->saasPlan),
                'commission_rate' => (float) ($company->saasPlan->commission_rate ?? 0),
                'commission_type' => (string) ($company->saasPlan->commission_type ?: 'percent'),
                'commission_amount' => $this->calculateCommissionAmount($order, $company->saasPlan),
                'status' => 'pending',
                'commission_payment_log_id' => null,
                'charged_at' => now(),
                'paid_at' => null,
                'remarks' => 'Commission accrued from ecommerce order.',
            ]
        );
    }

    public function voidChargesForOrder(string $orderId, string $reason = 'Order was cancelled or reversed.'): void
    {
        CompanyCommissionCharge::query()
            ->where('order_id', $orderId)
            ->whereIn('status', ['pending', 'submitted'])
            ->update([
                'status' => 'void',
                'commission_payment_log_id' => null,
                'remarks' => $reason,
                'updated_at' => now(),
            ]);
    }

    public function getCompanyOverview(User $user): array
    {
        if (!$user->company_id) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No company associated with this user.',
            ];
        }

        $company = Company::query()
            ->with('saasPlan')
            ->where('company_id', $user->company_id)
            ->first();

        if (!$company) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Company not found.',
            ];
        }

        $charges = CompanyCommissionCharge::query()
            ->where('company_id', $company->company_id)
            ->latest('created_at')
            ->limit(20)
            ->get();

        $chargeSummary = CompanyCommissionCharge::query()
            ->where('company_id', $company->company_id)
            ->selectRaw("
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as total_payable,
                SUM(CASE WHEN status = 'submitted' THEN commission_amount ELSE 0 END) as submitted_amount,
                SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_amount
            ")
            ->first();

        $payments = CommissionPaymentLog::query()
            ->with(['gateway:id,name,gateway_type,currency_id', 'currency:id,code'])
            ->where('company_id', $company->company_id)
            ->latest('created_at')
            ->limit(20)
            ->get();

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Commission overview fetched successfully.',
            'data' => [
                'company' => [
                    'company_id' => $company->company_id,
                    'name' => $company->name,
                ],
                'current_plan' => $company->saasPlan,
                'summary' => [
                    'total_payable' => round((float) ($chargeSummary->total_payable ?? 0), 2),
                    'submitted_amount' => round((float) ($chargeSummary->submitted_amount ?? 0), 2),
                    'paid_amount' => round((float) ($chargeSummary->paid_amount ?? 0), 2),
                    'total_orders' => (int) ($chargeSummary->total_orders ?? 0),
                ],
                'charges' => $charges,
                'payments' => $payments,
            ],
        ];
    }

    public function getAvailableSettlementGateways(): \Illuminate\Support\Collection
    {
        return Gateway::query()
            ->with('currency:id,code')
            ->where('status', 1)
            ->where('gateway_type', 'manual')
            ->orderBy('name')
            ->get();
    }

    public function submitCompanyPayment(User $user, array $payload): array
    {
        if (!$user->company_id) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No company associated with this user.',
            ];
        }

        $company = Company::query()
            ->with('saasPlan')
            ->where('company_id', $user->company_id)
            ->first();

        if (!$company || !$company->saasPlan || !$company->saasPlan->isCommissionBased()) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'Current plan is not commission based.',
            ];
        }

        $gateway = Gateway::query()->with('currency:id,code')->find((string) ($payload['gateway_id'] ?? ''));
        if (!$gateway || $gateway->gateway_type !== 'manual' || !$gateway->status) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Settlement gateway not found.',
            ];
        }

        $paymentFields = $payload['payment_fields'] ?? [];
        if (is_string($paymentFields)) {
            $decoded = json_decode($paymentFields, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $paymentFields = $decoded;
            }
        }
        if (!is_array($paymentFields)) {
            $paymentFields = [];
        }

        $storedFiles = $this->storePaymentFiles((array) ($payload['payment_files'] ?? []));
        $errors = $this->validateGatewayPaymentFields($gateway, $paymentFields, $storedFiles);
        if ($errors !== []) {
            return [
                'status' => 0,
                'code' => 422,
                'errors' => $errors,
            ];
        }

        $chargeIds = collect($payload['charge_ids'] ?? [])->map(fn ($id) => (int) $id)->filter()->values()->all();

        $chargesQuery = CompanyCommissionCharge::query()
            ->where('company_id', $company->company_id)
            ->where('status', 'pending');

        if ($chargeIds !== []) {
            $chargesQuery->whereIn('id', $chargeIds);
        }

        $charges = $chargesQuery->get();
        if ($charges->isEmpty()) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No pending commission charges found.',
            ];
        }

        $baseAmount = round((float) $charges->sum('commission_amount'), 2);
        $gatewayCharge = $gateway->charge_type === 'percent'
            ? round($baseAmount * ((float) $gateway->charge / 100), 2)
            : round((float) $gateway->charge, 2);
        $payableAmount = round($baseAmount + $gatewayCharge, 2);

        $paymentLog = DB::transaction(function () use (
            $company,
            $user,
            $gateway,
            $charges,
            $baseAmount,
            $gatewayCharge,
            $payableAmount,
            $paymentFields,
            $storedFiles
        ) {
            $log = CommissionPaymentLog::query()->create([
                'trx' => Str::upper(Str::random(12)),
                'company_id' => $company->company_id,
                'saas_plan_id' => $company->saas_plan_id,
                'user_id' => (string) $user->id,
                'gateway_id' => $gateway->id,
                'gateway_name' => $gateway->name,
                'currency_id' => $gateway->currency_id,
                'amount' => $baseAmount,
                'gateway_charge' => $gatewayCharge,
                'gateway_charge_type' => $gateway->charge_type,
                'payable_amount' => $payableAmount,
                'status' => 'pending',
                'payment_payload' => [
                    'fields' => $paymentFields,
                    'files' => $storedFiles,
                    'charge_ids' => $charges->pluck('id')->values()->all(),
                ],
                'remarks' => 'Commission settlement submitted by company.',
                'submitted_at' => now(),
            ]);

            CompanyCommissionCharge::query()
                ->whereIn('id', $charges->pluck('id')->all())
                ->update([
                    'status' => 'submitted',
                    'commission_payment_log_id' => $log->id,
                    'updated_at' => now(),
                ]);

            return $log->load(['gateway.currency', 'currency']);
        });

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Commission payment submitted successfully.',
            'data' => [
                'payment' => $paymentLog,
            ],
        ];
    }

    public function getBackofficePaymentLogs(array $filters): LengthAwarePaginator
    {
        $perPage = (int) ($filters['perPage'] ?? 20);
        $page = (int) ($filters['page'] ?? 1);
        $keyword = trim((string) ($filters['keyword'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));

        $query = Company::query()
            ->with([
                'saasPlan:id,name,plan_type,commission_rate,commission_type,commission_base',
            ])
            ->whereHas('saasPlan', fn ($builder) => $builder->where('plan_type', 'commission'));

        if ($keyword !== '') {
            $paymentCompanyIds = CommissionPaymentLog::query()
                ->where(function ($paymentQuery) use ($keyword) {
                    $paymentQuery->where('trx', 'like', '%' . $keyword . '%')
                        ->orWhere('gateway_name', 'like', '%' . $keyword . '%');
                })
                ->pluck('company_id')
                ->filter()
                ->unique()
                ->values()
                ->all();

            $query->where(function ($builder) use ($keyword, $paymentCompanyIds) {
                $builder->where('name', 'like', '%' . $keyword . '%')
                    ->orWhere('email', 'like', '%' . $keyword . '%')
                    ->orWhere('phone_number', 'like', '%' . $keyword . '%')
                    ->orWhere('domain', 'like', '%' . $keyword . '%');

                if ($paymentCompanyIds !== []) {
                    $builder->orWhereIn('company_id', $paymentCompanyIds);
                }
            });
        }

        if (in_array($status, ['pending', 'submitted', 'received'], true)) {
            $chargeStatus = match ($status) {
                'received' => 'paid',
                default => $status,
            };

            $companyIds = CompanyCommissionCharge::query()
                ->where('status', $chargeStatus)
                ->pluck('company_id')
                ->filter()
                ->unique()
                ->values()
                ->all();

            $query->whereIn('company_id', $companyIds === [] ? ['__none__'] : $companyIds);
        } elseif ($status === 'disabled') {
            $query->where('status', 0);
        } elseif ($status === 'active') {
            $query->where('status', 1);
        }

        $paginator = $query
            ->orderBy('name')
            ->paginate($perPage, ['*'], 'page', $page);

        $companyIds = collect($paginator->items())
            ->pluck('company_id')
            ->filter()
            ->values();

        $chargeSummary = CompanyCommissionCharge::query()
            ->selectRaw("
                company_id,
                COUNT(*) as orders_count,
                SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending_payable,
                SUM(CASE WHEN status = 'submitted' THEN commission_amount ELSE 0 END) as submitted_payable,
                SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as received_amount
            ")
            ->whereIn('company_id', $companyIds)
            ->groupBy('company_id')
            ->get()
            ->keyBy('company_id');

        $latestLogs = CommissionPaymentLog::query()
            ->with([
                'gateway:id,name,gateway_type,currency_id',
                'currency:id,code',
                'charges:id,commission_payment_log_id,order_no,commission_amount,status',
            ])
            ->whereIn('company_id', $companyIds)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('company_id');

        $pendingCharges = CompanyCommissionCharge::query()
            ->whereIn('company_id', $companyIds)
            ->where('status', 'pending')
            ->orderByDesc('charged_at')
            ->orderByDesc('id')
            ->get(['id', 'company_id', 'order_no', 'commission_amount', 'status', 'charged_at', 'remarks'])
            ->groupBy('company_id');

        $transformed = collect($paginator->items())->map(function (Company $company) use ($chargeSummary, $latestLogs, $pendingCharges) {
            $chargeData = $chargeSummary->get($company->company_id);
            $companyLogGroup = $latestLogs->get($company->company_id, collect());
            $latestPayment = $companyLogGroup->first();
            $reviewablePayment = $companyLogGroup->first(fn (CommissionPaymentLog $log) => in_array((string) $log->status, ['pending', 'rejected'], true))
                ?: $latestPayment;
            $pendingAmount = round((float) ($chargeData->pending_payable ?? 0), 2);
            $submittedAmount = round((float) ($chargeData->submitted_payable ?? 0), 2);
            $receivedAmount = round((float) ($chargeData->received_amount ?? 0), 2);
            $outstandingAmount = round($pendingAmount + $submittedAmount, 2);

            return [
                'company_id' => (string) $company->company_id,
                'company' => [
                    'company_id' => (string) $company->company_id,
                    'name' => (string) ($company->name ?? ''),
                    'email' => $company->email,
                    'phone_number' => $company->phone_number,
                    'domain' => $company->domain,
                    'status' => (int) ($company->status ?? 0),
                ],
                'plan' => $company->saasPlan,
                'orders_count' => (int) ($chargeData->orders_count ?? 0),
                'pending_payable' => $pendingAmount,
                'submitted_payable' => $submittedAmount,
                'received_amount' => $receivedAmount,
                'outstanding_amount' => $outstandingAmount,
                'status' => $this->resolveBackofficeCompanyReceivableStatus($company, $pendingAmount, $submittedAmount, $receivedAmount),
                'latest_payment' => $latestPayment ? $this->formatBackofficePaymentLog($latestPayment) : null,
                'reviewable_payment' => $reviewablePayment ? $this->formatBackofficePaymentLog($reviewablePayment) : null,
                'recent_payments' => $companyLogGroup
                    ->take(5)
                    ->map(fn (CommissionPaymentLog $log) => $this->formatBackofficePaymentLog($log))
                    ->values()
                    ->all(),
                'pending_charges' => collect($pendingCharges->get($company->company_id, collect()))
                    ->take(15)
                    ->map(fn (CompanyCommissionCharge $charge) => [
                        'id' => (int) $charge->id,
                        'order_no' => (string) ($charge->order_no ?? $charge->id),
                        'commission_amount' => round((float) $charge->commission_amount, 2),
                        'status' => (string) $charge->status,
                        'charged_at' => optional($charge->charged_at)?->toIso8601String(),
                        'remarks' => $charge->remarks,
                    ])
                    ->values()
                    ->all(),
            ];
        });

        return new LengthAwarePaginator(
            $transformed,
            $paginator->total(),
            $paginator->perPage(),
            $paginator->currentPage(),
            [
                'path' => request()->url(),
                'query' => request()->query(),
            ]
        );
    }

    public function updateBackofficePaymentStatus(int $id, array $payload): array
    {
        $log = CommissionPaymentLog::query()->with('charges')->find($id);
        if (!$log) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Commission payment not found.',
            ];
        }

        $status = (string) ($payload['status'] ?? 'pending');
        $remarks = isset($payload['remarks']) ? trim((string) $payload['remarks']) : null;

        DB::transaction(function () use ($log, $status, $remarks) {
            $log->status = $status;
            $log->remarks = $remarks ?: $log->remarks;
            $log->approved_at = $status === 'approved' ? now() : null;
            $log->save();

            if ($status === 'approved') {
                CompanyCommissionCharge::query()
                    ->where('commission_payment_log_id', $log->id)
                    ->update([
                        'status' => 'paid',
                        'paid_at' => now(),
                        'remarks' => 'Commission settled and approved by backoffice.',
                        'updated_at' => now(),
                    ]);
            } elseif ($status === 'rejected') {
                CompanyCommissionCharge::query()
                    ->where('commission_payment_log_id', $log->id)
                    ->update([
                        'status' => 'pending',
                        'commission_payment_log_id' => null,
                        'remarks' => $remarks ?: 'Commission settlement rejected by backoffice.',
                        'updated_at' => now(),
                    ]);
            }
        });

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Commission payment updated successfully.',
            'data' => $log->fresh(['company', 'plan', 'gateway.currency', 'currency', 'charges']),
        ];
    }

    public function getBackofficeReceivableSummary(): array
    {
        $pending = (float) CompanyCommissionCharge::query()->where('status', 'pending')->sum('commission_amount');
        $submitted = (float) CompanyCommissionCharge::query()->where('status', 'submitted')->sum('commission_amount');
        $paid = (float) CompanyCommissionCharge::query()->where('status', 'paid')->sum('commission_amount');

        return [
            'pending_receivable' => round($pending, 2),
            'submitted_receivable' => round($submitted, 2),
            'received_amount' => round($paid, 2),
            'active_companies' => Company::query()
                ->whereHas('saasPlan', fn ($query) => $query->where('plan_type', 'commission'))
                ->count(),
        ];
    }

    public function sendBackofficeWarning(string $companyId, ?string $remarks = null): array
    {
        $company = Company::query()
            ->with('saasPlan:id,name,plan_type')
            ->where('company_id', $companyId)
            ->first();

        if (! $company) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Company not found.',
            ];
        }

        if (! $company->email) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'This company does not have an email address configured.',
            ];
        }

        $summary = CompanyCommissionCharge::query()
            ->where('company_id', $company->company_id)
            ->selectRaw("
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = 'submitted' THEN commission_amount ELSE 0 END) as submitted_amount,
                SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_amount
            ")
            ->first();

        $pendingAmount = round((float) ($summary->pending_amount ?? 0), 2);
        $submittedAmount = round((float) ($summary->submitted_amount ?? 0), 2);
        $outstandingAmount = round($pendingAmount + $submittedAmount, 2);

        if ($outstandingAmount <= 0) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'This company has no outstanding commission due.',
            ];
        }

        SendTemplatedEmail::dispatch($company->email, self::WARNING_TEMPLATE_KEY, [
            'name' => (string) ($company->contact_name ?: $company->name ?: 'Company'),
            'company_name' => (string) ($company->name ?: 'Company'),
            'plan_name' => (string) ($company->saasPlan?->name ?: 'Commission plan'),
            'pending_amount' => number_format($pendingAmount, 2),
            'submitted_amount' => number_format($submittedAmount, 2),
            'outstanding_amount' => number_format($outstandingAmount, 2),
            'order_count' => (int) ($summary->total_orders ?? 0),
            'store_domain' => (string) ($company->domain ?: 'Not configured'),
            'remarks' => trim((string) ($remarks ?? '')),
            'sent_at' => now()->format('M d, Y h:i A'),
        ]);

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Commission payment warning email has been queued successfully.',
        ];
    }

    public function disableBackofficeCompanyStore(string $companyId, ?string $remarks = null): array
    {
        $company = Company::query()
            ->with('saasPlan:id,name,plan_type')
            ->where('company_id', $companyId)
            ->first();

        if (! $company) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Company not found.',
            ];
        }

        if ((int) $company->status === 0) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'This store is already disabled.',
            ];
        }

        $company->status = 0;
        $company->save();

        if ($company->email) {
            SendTemplatedEmail::dispatch($company->email, self::STORE_DISABLED_TEMPLATE_KEY, [
                'name' => (string) ($company->contact_name ?: $company->name ?: 'Company'),
                'company_name' => (string) ($company->name ?: 'Company'),
                'plan_name' => (string) ($company->saasPlan?->name ?: 'Commission plan'),
                'store_domain' => (string) ($company->domain ?: 'Not configured'),
                'remarks' => trim((string) ($remarks ?? '')),
                'disabled_at' => now()->format('M d, Y h:i A'),
            ]);
        }

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Store has been disabled successfully.',
            'data' => [
                'company_id' => (string) $company->company_id,
                'status' => (int) $company->status,
            ],
        ];
    }

    private function calculateCommissionAmount(CustomerOrder $order, SaasPlan $plan): float
    {
        $baseAmount = $this->resolveCommissionBaseAmount($order, $plan);
        $rate = (float) ($plan->commission_rate ?? 0);

        if ((string) ($plan->commission_type ?: 'percent') === 'fixed') {
            return round(max($rate, 0), 2);
        }

        return round(max($baseAmount, 0) * max($rate, 0) / 100, 2);
    }

    private function resolveCommissionBaseAmount(CustomerOrder $order, SaasPlan $plan): float
    {
        return match ((string) ($plan->commission_base ?: 'total_amount')) {
            'subtotal' => round((float) ($order->subtotal ?? 0), 2),
            'payable_amount' => round((float) ($order->payable_amount ?? $order->total_amount ?? 0), 2),
            default => round((float) ($order->total_amount ?? 0), 2),
        };
    }

    private function validateGatewayPaymentFields(Gateway $gateway, array $fields, array $storedFiles): array
    {
        $errors = [];
        $parameters = is_array($gateway->parameters) ? $gateway->parameters : [];

        foreach ($parameters as $parameter) {
            if (!is_array($parameter) || empty($parameter['is_required'])) {
                continue;
            }

            $name = (string) ($parameter['name'] ?? '');
            $label = (string) ($parameter['label'] ?? $name);
            $type = (string) ($parameter['type'] ?? 'text');

            if ($name === '') {
                continue;
            }

            if ($type === 'file') {
                if (!array_key_exists($name, $storedFiles) || empty($storedFiles[$name])) {
                    $errors[] = "{$label} is required.";
                }
                continue;
            }

            if (!array_key_exists($name, $fields) || trim((string) $fields[$name]) === '') {
                $errors[] = "{$label} is required.";
            }
        }

        return $errors;
    }

    private function storePaymentFiles(array $files): array
    {
        $stored = [];
        foreach ($files as $key => $file) {
            if (!$file instanceof UploadedFile) {
                continue;
            }

            $stored[(string) $key] = ImageService::upload($file, 'commission-payments', [
                'extensions' => ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
                'mime_types' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
                'max_kb' => 5120,
                'field' => 'payment_files',
            ]);
        }

        return $stored;
    }

    private function resolveBackofficeCompanyReceivableStatus(Company $company, float $pendingAmount, float $submittedAmount, float $receivedAmount): string
    {
        if ((int) ($company->status ?? 0) !== 1) {
            return 'disabled';
        }

        if ($submittedAmount > 0) {
            return 'submitted';
        }

        if ($pendingAmount > 0) {
            return 'pending';
        }

        if ($receivedAmount > 0) {
            return 'received';
        }

        return 'clear';
    }

    private function formatBackofficePaymentLog(CommissionPaymentLog $log): array
    {
        return [
            'id' => (int) $log->id,
            'trx' => (string) ($log->trx ?? ''),
            'gateway_name' => (string) ($log->gateway_name ?? ''),
            'status' => (string) ($log->status ?? 'pending'),
            'payable_amount' => round((float) ($log->payable_amount ?? 0), 2),
            'amount' => round((float) ($log->amount ?? 0), 2),
            'gateway_charge' => round((float) ($log->gateway_charge ?? 0), 2),
            'currency' => $log->currency ? [
                'id' => (int) $log->currency->id,
                'code' => (string) ($log->currency->code ?? ''),
            ] : null,
            'payment_payload' => is_array($log->payment_payload) ? $log->payment_payload : [],
            'remarks' => $log->remarks,
            'submitted_at' => optional($log->submitted_at ?? $log->created_at)?->toIso8601String(),
            'created_at' => optional($log->created_at)?->toIso8601String(),
            'charges' => $log->relationLoaded('charges')
                ? $log->charges->map(fn (CompanyCommissionCharge $charge) => [
                    'id' => (int) $charge->id,
                    'order_no' => (string) ($charge->order_no ?? $charge->id),
                    'commission_amount' => round((float) $charge->commission_amount, 2),
                    'status' => (string) $charge->status,
                ])->values()->all()
                : [],
        ];
    }
}

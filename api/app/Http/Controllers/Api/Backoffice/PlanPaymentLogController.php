<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Jobs\SendTemplatedEmail;
use App\Models\Company;
use App\Models\CompanyETemplateAccess;
use App\Models\PlanPaymentLog;
use App\Services\Api\EcommerceDemoDataSyncService;
use App\Services\Api\ReferralService;
use App\Services\Api\StorefrontHomeBuilderService;
use App\Services\BackofficeCompanyService;
use App\Services\CompanyPlanFeatureService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PlanPaymentLogController extends Controller
{
    private const TEMPLATE_KEYS_BY_STATUS = [
        'approved' => 'payment_accepted',
        'rejected' => 'payment_rejected',
    ];

    private function ensureSuperAdmin()
    {
        $user = auth()->user();

        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return null;
    }

    public function index(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $keyword = trim((string) $request->input('keyword', ''));
        $status = trim((string) $request->input('status', ''));

        $query = PlanPaymentLog::query()->with([
            'company:company_id,name,email,phone_number',
            'plan:id,name,billing_period,price',
            'currency:id,code',
            'gateway:id,name,gateway_type',
        ]);

        // Show:
        // 1) all manual gateway submissions
        // 2) approved automatic gateway payments (for audit/view details)
        $query->where(function ($paymentQuery) {
            $paymentQuery
                ->whereHas('gateway', function ($gatewayQuery) {
                    $gatewayQuery->where('gateway_type', 'manual');
                })
                ->orWhere(function ($approvedAutomaticQuery) {
                    $approvedAutomaticQuery
                        ->where('status', 'approved')
                        ->whereHas('gateway', function ($gatewayQuery) {
                            $gatewayQuery->whereIn('gateway_type', ['automatic', 'autometic']);
                        });
                });
        });

        if ($keyword !== '') {
            $query->where(function ($q) use ($keyword) {
                $q->where('gateway_name', 'like', '%' . $keyword . '%')
                    ->orWhere('company_id', 'like', '%' . $keyword . '%')
                    ->orWhereHas('company', function ($companyQ) use ($keyword) {
                        $companyQ->where('name', 'like', '%' . $keyword . '%')
                            ->orWhere('email', 'like', '%' . $keyword . '%');
                    });
            });
        }

        if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $query->where('status', $status);
        }

        $result = $query
            ->orderByDesc('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $items = collect($result->items())->map(function ($item) {
            $payload = is_array($item->payment_payload) ? $item->payment_payload : [];
            $files = is_array($payload['files'] ?? null) ? $payload['files'] : [];

            $fileUrls = [];
            foreach ($files as $key => $filename) {
                $fileUrls[$key] = url('uploads/plan-payments/' . $filename);
            }

            $item->payment_payload = array_merge($payload, [
                'file_urls' => $fileUrls,
            ]);

            return $item;
        })->values();

        return response()->json([
            'status' => 1,
            'message' => 'Plan payment logs fetched successfully.',
            'data' => $items,
            'meta' => [
                'current_page' => $result->currentPage(),
                'last_page' => $result->lastPage(),
                'per_page' => $result->perPage(),
                'total' => $result->total(),
            ],
        ]);
    }

    public function updateStatus(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'status' => ['required', Rule::in(['pending', 'approved', 'rejected'])],
            'remarks' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $log = PlanPaymentLog::query()->find($id);
        if (!$log) {
            return response()->json([
                'status' => 0,
                'message' => 'Payment log not found.',
            ], 404);
        }

        if (in_array($log->status, ['approved', 'rejected'], true)) {
            return response()->json([
                'status' => 0,
                'message' => 'This payment is already finalized and cannot be updated again.',
                'errors' => ['This payment is already finalized and cannot be updated again.'],
            ], 422);
        }

        $log->status = $request->input('status');
        $log->remarks = $request->input('remarks');
        $log->save();

        if ($log->status === 'approved') {
            $company = Company::query()->where('company_id', $log->company_id)->first();
            if ($company) {
                $payload = is_array($log->payment_payload) ? $log->payment_payload : [];
                $company->loadMissing('saasPlan');
                $hasActivePlan = !empty($company->saas_plan_id)
                    && !empty($company->plan_subscribed_at)
                    && !empty($company->saasPlan)
                    && (bool) ($company->saasPlan->status ?? false);

                if (($payload['purchase_type'] ?? null) !== 'template' || !$hasActivePlan) {
                    $company->saas_plan_id = (int) $log->saas_plan_id;
                    $company->plan_subscribed_at = now();
                }

                if (($payload['purchase_type'] ?? null) === 'template') {
                    CompanyETemplateAccess::query()->updateOrCreate(
                        ['company_id' => $company->company_id, 'template_id' => (int) ($payload['template_id'] ?? 0)],
                        ['plan_payment_log_id' => $log->id, 'amount' => (float) ($payload['template_amount'] ?? 0)]
                    );
                    $company->selected_e_template_id = !empty($payload['template_id'])
                        ? (int) $payload['template_id']
                        : $company->selected_e_template_id;

                    if (!empty($payload['category_id'])) {
                        $company->ecommerce_category_id = (int) $payload['category_id'];
                    }
                }

                if (($payload['purchase_type'] ?? null) === 'plan') {
                    $templatePrices = is_array($payload['template_prices'] ?? null) ? $payload['template_prices'] : [];
                    $templateIds = collect($payload['template_ids'] ?? [])
                        ->filter(fn ($id) => is_numeric($id))
                        ->map(fn ($id) => (int) $id)
                        ->unique()
                        ->values();

                    foreach ($templateIds as $templateId) {
                        CompanyETemplateAccess::query()->updateOrCreate(
                            ['company_id' => $company->company_id, 'template_id' => $templateId],
                            ['plan_payment_log_id' => $log->id, 'amount' => (float) ($templatePrices[(string) $templateId] ?? 0)]
                        );
                    }

                    if ($templateIds->isNotEmpty()) {
                        $company->selected_e_template_id = $templateIds->first();
                        if (!empty($payload['category_id'])) {
                            $company->ecommerce_category_id = (int) $payload['category_id'];
                        }
                        $company->save();
                        app(StorefrontHomeBuilderService::class)->materializeSelectedTemplateForCompany($company);
                    }
                }

                $company->save();
                if (($payload['purchase_type'] ?? null) === 'template') {
                    app(StorefrontHomeBuilderService::class)->materializeSelectedTemplateForCompany($company);
                }
                if (
                    filter_var($payload['seed_demo_data'] ?? false, FILTER_VALIDATE_BOOLEAN)
                    && !empty($company->selected_e_template_id)
                    && !empty($company->ecommerce_category_id)
                ) {
                    app(EcommerceDemoDataSyncService::class)->syncForCompanyAndCategory(
                        (int) $company->ecommerce_category_id,
                        $company->company_id
                    );
                }
                app(CompanyPlanFeatureService::class)->syncCompanyPreferencesToPlan($company->fresh('saasPlan'));
                app(BackofficeCompanyService::class)->ensureDefaultRights($company);
                if (($payload['purchase_type'] ?? null) !== 'template' || !$hasActivePlan) {
                    app(ReferralService::class)->awardActivationRewards($company->fresh(), $log->fresh(), (float) $log->amount);
                }
            }
        }

        if (in_array($log->status, ['approved', 'rejected'], true)) {
            $this->sendStatusMailToCompany($log);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Payment status updated successfully.',
            'data' => $log->fresh(['company:company_id,name,email', 'plan:id,name']),
        ]);
    }

    private function sendStatusMailToCompany(PlanPaymentLog $log): void
    {
        $log->loadMissing(['company:company_id,name,email', 'plan:id,name', 'currency:id,code']);
        $email = $log->company?->email;
        if (!$email) {
            return;
        }

        $templateKey = self::TEMPLATE_KEYS_BY_STATUS[$log->status] ?? null;
        if (!$templateKey) {
            return;
        }

        $companyName = $log->company?->name ?: 'Company';
        $planName = $log->plan?->name ?: 'Selected plan';
        $remarks = trim((string) ($log->remarks ?? ''));
        $currencyCode = $log->currency?->code ?: '';
        $formattedAmount = trim(number_format((float) $log->payable_amount, 2) . ' ' . $currencyCode);

        SendTemplatedEmail::dispatch($email, $templateKey, [
            'name' => $companyName,
            'company_name' => $companyName,
            'plan_name' => $planName,
            'gateway_name' => (string) ($log->gateway_name ?: '-'),
            'payment_id' => (string) ($log->trx ?: $log->id),
            'payment_amount' => $formattedAmount,
            'status' => ucfirst((string) $log->status),
            'remarks' => $remarks,
            'reject_reason' => $remarks,
            'submitted_at' => optional($log->created_at)?->format('M d, Y h:i A'),
            'updated_at' => optional($log->updated_at)?->format('M d, Y h:i A'),
        ]);
    }
}

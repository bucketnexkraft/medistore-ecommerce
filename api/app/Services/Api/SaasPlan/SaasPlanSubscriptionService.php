<?php

namespace App\Services\Api\SaasPlan;

use App\Enums\TemplateTypes;
use App\Factory\PaymentGatewayFactory;
use App\Models\Company;
use App\Models\CompanyETemplateAccess;
use App\Models\ETemplate;
use App\Models\Gateway;
use App\Models\PlanPaymentLog;
use App\Models\SaasPlan;
use App\Models\User;
use App\Notifications\BackofficePlanPaymentSubmitted;
use App\Services\Api\ReferralService;
use App\Services\Api\StorefrontHomeBuilderService;
use App\Services\BackofficeCompanyService;
use App\Services\CompanyPlanFeatureService;
use App\Services\ImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaasPlanSubscriptionService
{
    public function __construct(
        private readonly CompanyPlanFeatureService $companyPlanFeatureService,
        private readonly BackofficeCompanyService $backofficeCompanyService
    )
    {
    }

    public function getAvailablePlansForCompany(?User $user): array
    {
        $plans = SaasPlan::query()->with('includedPlan:id,name,features,included_plan_id')->where('status', true)->orderBy('is_free', 'desc')->orderBy('price')->get();
        $plans->each(function (SaasPlan $plan) {
            $plan->setAttribute('effective_features', $plan->effectiveFeatures());
            $plan->setAttribute('features', $plan->effectiveFeatures());
        });
        $company = $user?->company_id ? Company::query()->with('saasPlan')->where('company_id', $user->company_id)->first() : null;
        if ($company?->saasPlan) {
            $effectiveFeatures = $company->saasPlan->effectiveFeatures();
            $company->saasPlan->setAttribute('effective_features', $effectiveFeatures);
            $company->saasPlan->setAttribute('features', $effectiveFeatures);
        }
        $hasActivePlan = !empty($company?->saas_plan_id)
            && !empty($company?->plan_subscribed_at)
            && !empty($company?->saasPlan)
            && (bool) ($company?->saasPlan?->status ?? false);

        return [
            'plans' => $plans,
            'has_active_plan' => $hasActivePlan,
            'needs_plan_selection' => !empty($user?->company_id) && !$hasActivePlan,
            'selected_plan_id' => $hasActivePlan ? $company?->saas_plan_id : null,
            'selected_plan' => $hasActivePlan ? $company?->saasPlan : null,
        ];
    }

    public function getAvailableGatewaysForCompany()
    {
        return Gateway::query()->with('currency:id,code')->where('status', 1)->orderBy('name')->get();
    }

    public function getTemplateCheckoutOptions(User $user, int $templateId): array
    {
        if (!$user->company_id) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No company associated with this user.',
            ];
        }

        $company = Company::query()->with('saasPlan')->where('company_id', $user->company_id)->first();
        if (!$company) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Company not found.',
            ];
        }

        $template = ETemplate::query()->find($templateId);
        if (!$template) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Template not found.',
            ];
        }

        if (!$this->hasActivePlan($company)) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'Choose a plan before purchasing a template.',
            ];
        }

        $templateAmount = $this->templatePrice($template);
        $plan = $company->saasPlan;
        $subtotal = $templateAmount;
        $gateways = $this->getAvailableGatewaysForCompany();
        $singleGateway = $gateways->count() === 1 ? $gateways->first() : null;
        $singleGatewayIsManual = $singleGateway && (string) $singleGateway->gateway_type === 'manual';

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Template checkout data loaded successfully.',
            'data' => [
                'template' => [
                    'id' => $template->id,
                    'template_name' => $template->template_name,
                    'short_description' => $template->short_description,
                    'price' => $template->price,
                    'template_type' => $template->template_type,
                    'discount_amount' => $template->discount_amount,
                    'discount_type' => $template->discount_type,
                    'payable_price' => round($templateAmount, 2),
                    'image_url' => $template->image_url,
                    'categories' => $template->categories ?? [],
                ],
                'plan' => $plan,
                'category_id' => $company->ecommerce_category_id,
                'gateways' => $gateways,
                'amounts' => [
                    'plan_amount' => 0,
                    'template_amount' => round($templateAmount, 2),
                    'subtotal' => round($subtotal, 2),
                ],
                'gateway_flow' => [
                    'active_gateway_count' => $gateways->count(),
                    'requires_selection' => $subtotal > 0 && $gateways->count() > 1,
                    'auto_redirect' => $subtotal > 0 && $singleGateway && !$singleGatewayIsManual,
                ],
            ],
        ];
    }

    public function purchaseTemplateForCompany(User $user, array $payload): array
    {
        if (!$user->company_id) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No company associated with this user.',
            ];
        }

        $company = Company::query()->with('saasPlan')->where('company_id', $user->company_id)->first();
        if (!$company) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Company not found.',
            ];
        }

        $template = ETemplate::query()->find((int) ($payload['template_id'] ?? 0));
        if (!$template) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Template not found.',
            ];
        }

        if (!$this->hasActivePlan($company)) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'Choose a plan before purchasing a template.',
            ];
        }

        $plan = $company->saasPlan;
        $planAmount = 0.0;
        $templateAmount = $this->templatePrice($template);
        $baseAmount = $planAmount + $templateAmount;
        $singleUseError = $this->singleUseTemplateError($company, collect([$template]));
        if ($singleUseError) {
            return $singleUseError;
        }

        if ($baseAmount <= 0) {
            $this->grantTemplateAccess($company, $template, null, $templateAmount);
            $this->selectTemplateForCompany($company, $template, (int) ($payload['category_id'] ?? 0));

            return [
                'status' => 1,
                'code' => 200,
                'message' => 'Template purchase completed successfully.',
                'data' => [
                    'company' => $company->fresh(['saasPlan', 'selectedETemplate']),
                    'gateway' => null,
                    'payable_amount' => 0,
                    'access_granted' => true,
                    'payment' => [
                        'type' => 'completed',
                        'redirect_url' => '/onboarding/ecommerce-template?plan_payment=success',
                        'payment_log_id' => null,
                    ],
                ],
            ];
        }

        $gateways = $this->getAvailableGatewaysForCompany();
        if ($gateways->isEmpty()) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No active payment gateway is available right now.',
            ];
        }

        $gatewayId = (string) ($payload['gateway_id'] ?? '');
        if ($gatewayId === '' && $gateways->count() === 1) {
            $gatewayId = (string) $gateways->first()->id;
        }

        if ($gatewayId === '') {
            return [
                'status' => 1,
                'code' => 200,
                'message' => 'Please select a payment gateway.',
                'data' => [
                    'needs_gateway_selection' => true,
                    'gateways' => $gateways,
                ],
            ];
        }

        $gateway = $gateways->first(fn ($availableGateway) => (string) $availableGateway->id === $gatewayId);
        if (!$gateway) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Gateway not found.',
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
        $validationErrors = $this->validateGatewayPaymentFields($gateway, $paymentFields, $storedFiles);
        if (!empty($validationErrors)) {
            return [
                'status' => 0,
                'code' => 422,
                'errors' => $validationErrors,
            ];
        }

        $gatewayCharge = 0;
        $payableAmount = $baseAmount;

        $paymentLog = PlanPaymentLog::query()->create([
            'trx' => Str::upper(Str::random(12)),
            'company_id' => $company->company_id,
            'user_id' => $user->id,
            'saas_plan_id' => $company->saas_plan_id,
            'gateway_id' => $gateway->id,
            'gateway_name' => $gateway->name,
            'currency_id' => $gateway->currency_id,
            'amount' => $baseAmount,
            'gateway_charge' => $gatewayCharge,
            'gateway_charge_type' => $gateway->charge_type,
            'payable_amount' => $payableAmount,
            'status' => 'pending',
            'payment_payload' => [
                'purchase_type' => 'template',
                'template_id' => $template->id,
                'template_name' => $template->template_name,
                'template_amount' => round($templateAmount, 2),
                'plan_amount' => round($planAmount, 2),
                'category_id' => (int) ($payload['category_id'] ?? 0) ?: null,
                'fields' => $paymentFields,
                'files' => $storedFiles,
                'frontend_url' => $this->sanitizeFrontendUrl($payload['frontend_url'] ?? null),
            ],
            'remarks' => 'Submitted from template checkout.',
        ]);

        $this->notifyBackofficePlanPaymentSubmitted($company, $plan, $gateway, $paymentLog, $payableAmount);

        $payment = $this->buildGatewayResponse($gateway, $paymentLog, $payableAmount);
        if (($payment['type'] ?? null) === 'failed') {
            return [
                'status' => 0,
                'code' => 422,
                'message' => $payment['message'] ?? 'Gateway is currently unavailable. Please try another option.',
                'data' => ['payment' => $payment],
            ];
        }

        return [
            'status' => 1,
            'code' => 200,
            'message' => $gateway->gateway_type === 'manual'
                ? 'Payment request submitted. Waiting for admin approval.'
                : 'Continue with gateway payment.',
            'data' => [
                'company' => $company->fresh('saasPlan'),
                'template' => $template,
                'plan' => $plan,
                'gateway' => $gateway,
                'payable_amount' => round($payableAmount, 2),
                'access_granted' => false,
                'payment' => $payment,
            ],
        ];
    }

    public function selectPlanForCompany(User $user, array $payload): array
    {
        if (!$user->company_id) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No company associated with this user.',
            ];
        }

        $company = Company::query()->where('company_id', $user->company_id)->first();
        if (!$company) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Company not found.',
            ];
        }

        $plan = SaasPlan::query()->find((int) $payload['plan_id']);

        if (!$plan) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Plan not found.',
            ];
        }

        $selectedTemplates = $this->resolveSelectedTemplates($payload);
        $templateAmount = $selectedTemplates->sum(fn (ETemplate $template) => $this->templatePrice($template));
        $singleUseError = $this->singleUseTemplateError($company, $selectedTemplates);
        if ($singleUseError) {
            return $singleUseError;
        }

        if (($plan->is_free === 'free' || $plan->isCommissionBased()) && $templateAmount <= 0) {
            $company->saas_plan_id = (int) $payload['plan_id'];
            $company->plan_subscribed_at = now();
            $company->save();
            foreach ($selectedTemplates as $template) {
                $this->grantTemplateAccess($company, $template, null, 0);
            }
            if ($selectedTemplates->isNotEmpty()) {
                $this->selectTemplateForCompany($company, $selectedTemplates->first(), (int) ($payload['category_id'] ?? 0));
            }
            $this->companyPlanFeatureService->syncCompanyPreferencesToPlan($company->fresh('saasPlan'));
            $this->backofficeCompanyService->ensureDefaultRights($company);
            app(ReferralService::class)->awardActivationRewards($company->fresh(), null, (float) $plan->price);

            return [
                'status' => 1,
                'code' => 200,
                'message' => 'Plan activated successfully.',
                'data' => [
                    'company' => $company->fresh('saasPlan'),
                    'gateway' => null,
                    'payable_amount' => 0,
                    'access_granted' => true,
                    'payment' => [
                        'type' => 'completed',
                        'redirect_url' => null,
                        'payment_log_id' => null,
                    ],
                ],
            ];
        }

        $gateway = Gateway::query()->with('currency:id,code')->find((string) ($payload['gateway_id'] ?? ''));

        if (!$gateway) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Gateway not found.',
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
        $validationErrors = $this->validateGatewayPaymentFields($gateway, $paymentFields, $storedFiles);
        if (!empty($validationErrors)) {
            return [
                'status' => 0,
                'code' => 422,
                'errors' => $validationErrors,
            ];
        }

        $planAmount = $this->calculatePlanBaseAmount($plan);
        $baseAmount = $planAmount + $templateAmount;
        $gatewayCharge = $gateway->charge_type === 'percent' ? $baseAmount * ((float) $gateway->charge / 100) : (float) $gateway->charge;
        $payableAmount = $baseAmount + $gatewayCharge;

        $paymentLog = PlanPaymentLog::query()->create([
            'trx' => Str::upper(Str::random(12)),
            'company_id' => $company->company_id,
            'user_id' => $user->id,
            'saas_plan_id' => $plan->id,
            'gateway_id' => $gateway->id,
            'gateway_name' => $gateway->name,
            'currency_id' => $gateway->currency_id,
            'amount' => $baseAmount,
            'gateway_charge' => $gatewayCharge,
            'gateway_charge_type' => $gateway->charge_type,
            'payable_amount' => $payableAmount,
            'status' => 'pending',
            'payment_payload' => [
                'purchase_type' => 'plan',
                'template_ids' => $selectedTemplates->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
                'template_amount' => round($templateAmount, 2),
                'template_prices' => $selectedTemplates->mapWithKeys(fn (ETemplate $template) => [
                    (string) $template->id => $this->templatePrice($template),
                ])->all(),
                'category_id' => (int) ($payload['category_id'] ?? 0) ?: null,
                'seed_demo_data' => filter_var($payload['seed_demo_data'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'post_payment_redirect' => $this->sanitizeFrontendPath($payload['post_payment_redirect'] ?? null),
                'fields' => $paymentFields,
                'files' => $storedFiles,
                'frontend_url' => $this->sanitizeFrontendUrl($payload['frontend_url'] ?? null),
            ],
            'remarks' => 'Submitted from company onboarding plan selection.',
        ]);

        $this->notifyBackofficePlanPaymentSubmitted($company, $plan, $gateway, $paymentLog, $payableAmount);

        if ($payableAmount <= 0) {
            $paymentLog->status = 'approved';
            $paymentLog->remarks = 'Free plan activated instantly.';
            $paymentLog->save();

            $company->saas_plan_id = (int) $payload['plan_id'];
            $company->plan_subscribed_at = now();
            $company->save();
            foreach ($selectedTemplates as $template) {
                $this->grantTemplateAccess($company, $template, $paymentLog, $this->templatePrice($template));
            }
            if ($selectedTemplates->isNotEmpty()) {
                $this->selectTemplateForCompany($company, $selectedTemplates->first(), (int) ($payload['category_id'] ?? 0));
            }
            $this->companyPlanFeatureService->syncCompanyPreferencesToPlan($company->fresh('saasPlan'));
            $this->backofficeCompanyService->ensureDefaultRights($company);
            app(ReferralService::class)->awardActivationRewards($company->fresh(), $paymentLog, (float) $paymentLog->amount);

            return [
                'status' => 1,
                'code' => 200,
                'message' => 'Plan activated successfully.',
                'data' => [
                    'company' => $company->fresh('saasPlan'),
                    'gateway' => $gateway,
                    'payable_amount' => round($payableAmount, 2),
                    'access_granted' => true,
                    'payment' => [
                        'type' => 'completed',
                        'redirect_url' => null,
                        'payment_log_id' => $paymentLog->id,
                    ],
                ],
            ];
        }

        $payment = $this->buildGatewayResponse($gateway, $paymentLog, $payableAmount);

        if (($payment['type'] ?? null) === 'failed') {
            return [
                'status' => 0,
                'code' => 422,
                'message' => $payment['message'] ?? 'Gateway is currently unavailable. Please try another option.',
                'data' => [
                    'payment' => $payment,
                ],
            ];
        }

        return [
            'status' => 1,
            'code' => 200,
            'message' => $gateway->gateway_type === 'manual'
                ? 'Payment request submitted. Waiting for admin approval.'
                : 'Continue with gateway payment.',
            'data' => [
                'company' => $company->fresh('saasPlan'),
                'gateway' => $gateway,
                'payable_amount' => round($payableAmount, 2),
                'access_granted' => false,
                'payment' => $payment,
            ],
        ];
    }

    public function getPaymentCheckoutInfo(User $user, int $id): array
    {
        if (!$user->company_id) {
            return [
                'status' => 0,
                'code' => 422,
                'message' => 'No company associated with this user.',
            ];
        }

        $log = PlanPaymentLog::query()
            ->with([
                'gateway.currency:id,code',
                'plan:id,name,billing_period,price',
                'company:company_id,selected_e_template_id,ecommerce_setup_completed_at',
            ])
            ->where('id', $id)
            ->where('company_id', $user->company_id)
            ->first();

        if (!$log) {
            return [
                'status' => 0,
                'code' => 404,
                'message' => 'Payment request not found.',
            ];
        }

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Payment checkout data fetched successfully.',
            'data' => $log,
        ];
    }

    public function getCompanyPaymentOverview(User $user, int $perPage): array
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

        $logs = $this->companyVisiblePaymentLogs($company)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        $latestPayment = $this->companyVisiblePaymentLogs($company)
            ->orderByDesc('created_at')
            ->first();

        return [
            'status' => 1,
            'code' => 200,
            'message' => 'Plan payment data fetched successfully.',
            'data' => [
                'company' => [
                    'company_id' => $company->company_id,
                    'name' => $company->name,
                    'plan_subscribed_at' => optional($company->plan_subscribed_at)->toDateTimeString(),
                ],
                'current_plan' => $company->saasPlan,
                'latest_payment' => $latestPayment,
                'payments' => $logs->items(),
            ],
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ];
    }

    private function grantTemplateAccess(
        Company $company,
        ETemplate $template,
        ?PlanPaymentLog $payment = null,
        float $amount = 0.0
    ): void {
        CompanyETemplateAccess::query()->updateOrCreate(
            [
                'company_id' => $company->company_id,
                'template_id' => $template->id,
            ],
            [
                'plan_payment_log_id' => $payment?->id,
                'amount' => $amount,
            ]
        );
    }

    private function selectTemplateForCompany(
        Company $company,
        ETemplate $template,
        ?int $categoryId = null
    ): void {
        $company->selected_e_template_id = $template->id;
        $company->ecommerce_setup_completed_at = now();

        if (!empty($categoryId)) {
            $company->ecommerce_category_id = $categoryId;
        }

        $company->save();
        app(StorefrontHomeBuilderService::class)->materializeSelectedTemplateForCompany($company);
    }

    private function hasActivePlan(Company $company): bool
    {
        $company->loadMissing('saasPlan');

        return !empty($company->saas_plan_id)
            && !empty($company->plan_subscribed_at)
            && !empty($company->saasPlan)
            && (bool) ($company->saasPlan->status ?? false);
    }

    private function templatePrice(ETemplate $template): float
    {
        if (TemplateTypes::isFreeValue($template->template_type ?? null)) {
            return 0.0;
        }

        $price = max((float) $template->price, 0);
        $discount = max((float) ($template->discount_amount ?? 0), 0);
        $discountValue = ($template->discount_type ?? 'fixed') === 'percent'
            ? $price * min($discount, 100) / 100
            : $discount;

        return round(max($price - $discountValue, 0), 2);
    }

    private function resolveSelectedTemplates(array $payload)
    {
        $ids = $payload['template_ids'] ?? [];
        if (!is_array($ids)) {
            $ids = [$ids];
        }

        $ids = collect($ids)
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return ETemplate::query()
            ->whereIn('id', $ids->all())
            ->get();
    }

    private function singleUseTemplateError(Company $company, $templates): ?array
    {
        $singleUseIds = collect($templates)
            ->filter(fn (ETemplate $template) => TemplateTypes::fromValue($template->template_type ?? null) === TemplateTypes::PremiumSingleUse)
            ->pluck('id')
            ->values();

        if ($singleUseIds->isEmpty()) {
            return null;
        }

        $takenTemplate = CompanyETemplateAccess::query()
            ->whereIn('template_id', $singleUseIds->all())
            ->where('company_id', '!=', $company->company_id)
            ->first();

        if (! $takenTemplate) {
            return null;
        }

        return [
            'status' => 0,
            'code' => 422,
            'message' => 'This premium single-use template has already been purchased by another store.',
        ];
    }

    private function calculatePlanBaseAmount(SaasPlan $plan): float
    {
        if ($plan->is_free === 'free' || $plan->isCommissionBased()) {
            return 0.0;
        }

        $price = (float) $plan->price;
        $discount = (float) $plan->discount_amount;
        $discountValue = $plan->discount_type === 'percent'
            ? $price * ($discount / 100)
            : $discount;
        $afterDiscount = max($price - $discountValue, 0);

        return max($afterDiscount, 0);
    }

    private function sanitizeFrontendUrl(?string $url): ?string
    {
        if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        return rtrim($url, '/');
    }

    private function sanitizeFrontendPath(?string $path): ?string
    {
        if (! is_string($path) || ! str_starts_with($path, '/') || str_starts_with($path, '//')) {
            return null;
        }

        return $path;
    }

    private function companyVisiblePaymentLogs(Company $company)
    {
        return PlanPaymentLog::query()
            ->with(['plan:id,name,billing_period,price', 'gateway:id,name,gateway_type,currency_id', 'currency:id,code'])
            ->where('company_id', $company->company_id)
            ->where(function ($query) {
                $query->where('status', '!=', 'pending')
                    ->orWhereHas('gateway', fn ($gatewayQuery) => $gatewayQuery->where('gateway_type', 'manual'))
                    ->orWhereRaw('LOWER(gateway_name) LIKE ?', ['%bank%']);
            });
    }

    private function validateGatewayPaymentFields(Gateway $gateway, array $fields, array $storedFiles): array
    {
        if ($gateway->gateway_type !== 'manual') {
            return [];
        }

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

            $stored[(string) $key] = ImageService::upload($file, 'plan-payments', [
                'extensions' => ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
                'mime_types' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
                'max_kb' => 5120,
                'field' => 'payment_files',
            ]);
        }

        return $stored;
    }

    private function buildGatewayResponse(Gateway $gateway, PlanPaymentLog $paymentLog, float $payableAmount): array
    {
        if ($gateway->gateway_type === 'manual') {
            return [
                'type' => 'pending',
                'redirect_url' => null,
                'payment_log_id' => $paymentLog->id,
            ];
        }

        try {
            $paymentLog->setRelation('gateway', $gateway->loadMissing('currency'));
            $paymentLog->payable_amount = $payableAmount;
            $response = PaymentGatewayFactory::create($gateway->name)->process($paymentLog, 'plan-payment');

            if (($response['type'] ?? null) === 'redirect' && !empty($response['url'])) {
                return [
                    'type' => 'redirect',
                    'redirect_url' => $response['url'],
                    'payment_log_id' => $paymentLog->id,
                ];
            }
        } catch (ValidationException $exception) {
            $messages = collect($exception->errors())->flatten()->filter()->values();
            $paymentLog->status = 'rejected';
            $paymentLog->remarks = $messages->first() ?: 'Automatic gateway payment could not be initialized.';
            $paymentLog->save();

            return [
                'type' => 'failed',
                'redirect_url' => null,
                'payment_log_id' => $paymentLog->id,
                'message' => $messages->first() ?: 'Gateway is currently unavailable. Please try another option.',
            ];
        } catch (\Throwable $exception) {
            $paymentLog->status = 'rejected';
            $paymentLog->remarks = 'Automatic gateway payment could not be initialized.';
            $paymentLog->save();

            return [
                'type' => 'failed',
                'redirect_url' => null,
                'payment_log_id' => $paymentLog->id,
                'message' => 'Gateway is currently unavailable. Please try another option.',
            ];
        }

        return [
            'type' => 'redirect',
            'redirect_url' => '/plans/payment-checkout/' . $paymentLog->id,
            'payment_log_id' => $paymentLog->id,
        ];
    }

    private function notifyBackofficePlanPaymentSubmitted(
        Company $company,
        SaasPlan $plan,
        Gateway $gateway,
        PlanPaymentLog $paymentLog,
        float $payableAmount
    ): void {
        $superAdmins = User::query()
            ->where('is_super_admin', 1)
            ->orWhereIn('role', User::getSuperAdminRoles())
            ->get();

        if ($superAdmins->isEmpty()) {
            return;
        }

        $payload = [
            'event' => 'plan_payment_submitted',
            'title' => 'New plan payment submitted',
            'message' => sprintf(
                '%s submitted plan payment for %s via %s.',
                (string) ($company->name ?: 'A company'),
                (string) ($plan->name ?: 'a plan'),
                (string) ($gateway->name ?: 'gateway')
            ),
            'payment_log_id' => $paymentLog->id,
            'company_id' => $company->company_id,
            'company_name' => $company->name,
            'plan_name' => $plan->name,
            'gateway_name' => $gateway->name,
            'payable_amount' => round($payableAmount, 2),
            'status' => (string) $paymentLog->status,
            'created_at' => now()->toDateTimeString(),
        ];

        foreach ($superAdmins as $admin) {
            try {
                DB::table('notifications')->insert([
                    'id' => (string) Str::uuid(),
                    'type' => BackofficePlanPaymentSubmitted::class,
                    'notifiable_type' => User::class,
                    'notifiable_id' => (string) $admin->getKey(),
                    'data' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                    'read_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

            } catch (\Throwable $exception) {
                // Silent fail to avoid blocking payment path.
            }
        }
    }
}

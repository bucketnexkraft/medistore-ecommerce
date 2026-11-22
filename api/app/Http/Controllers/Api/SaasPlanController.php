<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSaasPlanRequest;
use App\Http\Requests\UpdateSaasPlanRequest;
use App\Models\SaasPlan;
use App\Services\BackofficePlanService;
use App\Services\Api\SaasPlan\SaasPlanSubscriptionService;
use App\Services\Api\CommissionSubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SaasPlanController extends Controller
{
    public function __construct(
        private BackofficePlanService $backofficePlanService,
        private SaasPlanSubscriptionService $saasPlanSubscriptionService,
        private CommissionSubscriptionService $commissionSubscriptionService
    ) {}

    private function ensureSuperAdmin()
    {
        $user = auth()->user();

        if (!$user || !$user->isSuperAdmin()) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Forbidden. Super admin access required.',
                ],
                403,
            );
        }

        return null;
    }

    public function publicIndex(Request $request)
    {
        $plans = $this->backofficePlanService->list([
            ...$request->all(),
            'status' => 1,
            'perPage' => (int) $request->input('perPage', 50),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Public plans fetched successfully.',
            'data' => $plans->items(),
        ]);
    }

    public function publicGateways()
    {
        return response()->json([
            'status' => 1,
            'message' => 'Public gateways fetched successfully.',
            'data' => $this->saasPlanSubscriptionService->getAvailableGatewaysForCompany(),
        ]);
    }

    public function options(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        return response()->json([
            'status' => 1,
            'message' => 'Plan options fetched successfully.',
            'data' => [
                'plans' => SaasPlan::query()
                    ->with('includedPlan:id,name,features,default_features,included_plan_id')
                    ->orderBy('price')
                    ->get(['id', 'name', 'plan_type', 'features', 'default_features', 'included_plan_id', 'status'])
                    ->each(function (SaasPlan $plan) {
                        $plan->setAttribute('effective_features', $plan->effectiveFeatures());
                        $plan->setAttribute('effective_default_features', $plan->effectiveDefaultFeatures());
                    }),
            ],
        ]);
    }

    public function index(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $plans = $this->backofficePlanService->list($request->all());

        return response()->json([
            'status' => 1,
            'message' => 'Plans fetched successfully.',
            'data' => $plans->items(),
            'pagination' => [
                'current_page' => $plans->currentPage(),
                'last_page' => $plans->lastPage(),
                'per_page' => $plans->perPage(),
                'total' => $plans->total(),
            ],
        ]);
    }

    public function store(StoreSaasPlanRequest $request)
    {
        $plan = $this->backofficePlanService->store($request->validated());

        return response()->json(
            [
                'status' => 1,
                'message' => 'Plan created successfully.',
                'data' => $plan,
            ],
            201,
        );
    }

    public function show($id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $plan = SaasPlan::query()->with('templates')->find($id);
        if (!$plan) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Plan not found.',
                ],
                404,
            );
        }

        return response()->json([
            'status' => 1,
            'message' => 'Plan fetched successfully.',
            'data' => $plan,
        ]);
    }

    public function update(UpdateSaasPlanRequest $request, $id)
    {
        $plan = SaasPlan::query()->with('templates')->find($id);
        if (!$plan) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Plan not found.',
                ],
                404,
            );
        }

        $updated = $this->backofficePlanService->update($plan, $request->validated());

        return response()->json([
            'status' => 1,
            'message' => 'Plan updated successfully.',
            'data' => $updated,
        ]);
    }

    public function destroy($id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $plan = SaasPlan::query()->with('templates')->find($id);
        if (!$plan) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Plan not found.',
                ],
                404,
            );
        }

        $this->backofficePlanService->delete($plan);

        return response()->json([
            'status' => 1,
            'message' => 'Plan deleted successfully.',
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        $plan = SaasPlan::query()->with('templates')->find($id);
        if (!$plan) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Plan not found.',
                ],
                404,
            );
        }

        $updated = $this->backofficePlanService->updateStatus($plan, (bool) $request->boolean('status'));

        return response()->json([
            'status' => 1,
            'message' => 'Plan status updated successfully.',
            'data' => $updated,
        ]);
    }

    public function updateDefault($id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $plan = SaasPlan::query()->with('templates')->find($id);
        if (!$plan) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Plan not found.',
                ],
                404,
            );
        }

        $updated = $this->backofficePlanService->updateDefaultPlan($plan);

        return response()->json([
            'status' => 1,
            'message' => 'Default plan updated successfully.',
            'data' => $updated,
        ]);
    }

    public function availableForCompany(Request $request)
    {
        $data = $this->saasPlanSubscriptionService->getAvailablePlansForCompany(auth()->user());

        return response()->json([
            'status' => 1,
            'message' => 'Plans fetched successfully.',
            'data' => $data['plans'],
            'has_active_plan' => $data['has_active_plan'],
            'needs_plan_selection' => $data['needs_plan_selection'],
            'selected_plan_id' => $data['selected_plan_id'],
            'selected_plan' => $data['selected_plan'],
        ]);
    }

    public function availableGatewaysForCompany(Request $request)
    {
        return response()->json([
            'status' => 1,
            'message' => 'Gateways fetched successfully.',
            'data' => $this->saasPlanSubscriptionService->getAvailableGatewaysForCompany(),
        ]);
    }

    public function selectForCompany(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'plan_id' => [
                'required',
                Rule::exists('saas_plans', 'id')->where(function ($query) {
                    $query->where('status', 1);
                }),
            ],
            'template_ids' => 'nullable|array',
            'template_ids.*' => 'integer|exists:e_templates,id',
            'category_id' => 'nullable|integer|exists:e_categories,id',
            'gateway_id' => [
                'nullable',
                Rule::exists('gateways', 'id')->where(function ($query) {
                    $query->where('status', 1);
                }),
            ],
            'payment_fields' => 'nullable',
            'payment_files' => 'nullable|array',
            'payment_files.*' => 'file|max:5120',
            'seed_demo_data' => ['nullable', 'boolean'],
            'post_payment_redirect' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        $plan = SaasPlan::query()->find((int) $request->input('plan_id'));
        if (!$plan) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Plan not found.',
                ],
                404,
            );
        }

        if (!$plan->isCommissionBased() && $plan->is_free !== 'free' && !$request->filled('gateway_id')) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => ['Please select a payment gateway.'],
                ],
                422,
            );
        }

        $user = auth()->user();
        if (!$user) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'No company associated with this user.',
                ],
                422,
            );
        }

        $result = $this->saasPlanSubscriptionService->selectPlanForCompany($user, [
            ...$validator->validated(),
            'payment_files' => (array) $request->file('payment_files', []),
            'frontend_url' => $this->resolveFrontendUrl($request),
            'post_payment_redirect' => $request->input('post_payment_redirect'),
        ]);

        return response()->json(
            collect($result)->except('code')->all(),
            $result['code'] ?? 200
        );
    }

    public function templateCheckoutOptions(Request $request, int $templateId)
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'No company associated with this user.',
                ],
                422,
            );
        }

        $result = $this->saasPlanSubscriptionService->getTemplateCheckoutOptions($user, $templateId);

        return response()->json(
            collect($result)->except('code')->all(),
            $result['code'] ?? 200
        );
    }

    public function templatePurchase(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'template_id' => [
                'required',
                Rule::exists('e_templates', 'id'),
            ],
            'gateway_id' => [
                'nullable',
                Rule::exists('gateways', 'id')->where(function ($query) {
                    $query->where('status', 1);
                }),
            ],
            'category_id' => 'nullable|integer',
            'payment_fields' => 'nullable',
            'payment_files' => 'nullable|array',
            'payment_files.*' => 'file|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        $user = auth()->user();
        if (!$user) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'No company associated with this user.',
                ],
                422,
            );
        }

        $result = $this->saasPlanSubscriptionService->purchaseTemplateForCompany($user, [
            ...$validator->validated(),
            'payment_files' => (array) $request->file('payment_files', []),
            'frontend_url' => $this->resolveFrontendUrl($request),
        ]);

        return response()->json(
            collect($result)->except('code')->all(),
            $result['code'] ?? 200
        );
    }

    private function resolveFrontendUrl(Request $request): ?string
    {
        $origin = $request->headers->get('origin');
        if (is_string($origin) && filter_var($origin, FILTER_VALIDATE_URL)) {
            return rtrim($origin, '/');
        }

        $referer = $request->headers->get('referer');
        if (is_string($referer) && filter_var($referer, FILTER_VALIDATE_URL)) {
            $parts = parse_url($referer);
            if (!empty($parts['scheme']) && !empty($parts['host'])) {
                $port = !empty($parts['port']) ? ':' . $parts['port'] : '';
                return $parts['scheme'] . '://' . $parts['host'] . $port;
            }
        }

        $configured = env('APP_FRONTEND_URL');
        return is_string($configured) && filter_var($configured, FILTER_VALIDATE_URL)
            ? rtrim($configured, '/')
            : null;
    }

    public function paymentCheckoutInfo(Request $request, int $id)
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'No company associated with this user.',
                ],
                422,
            );
        }

        $result = $this->saasPlanSubscriptionService->getPaymentCheckoutInfo($user, $id);

        return response()->json(
            collect($result)->except('code')->all(),
            $result['code'] ?? 200
        );
    }

    public function companyPaymentOverview(Request $request)
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'No company associated with this user.',
                ],
                422,
            );
        }

        $company = $user->company_id
            ? \App\Models\Company::query()->with('saasPlan')->where('company_id', $user->company_id)->first()
            : null;

        $result = $company?->saasPlan?->isCommissionBased()
            ? $this->commissionSubscriptionService->getCompanyOverview($user)
            : $this->saasPlanSubscriptionService->getCompanyPaymentOverview(
                $user,
                (int) $request->input('perPage', 10)
            );

        return response()->json(
            collect($result)->except('code')->all(),
            $result['code'] ?? 200
        );
    }
}

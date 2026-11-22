<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\ECategory;
use App\Services\Api\EcommerceDemoDataSyncService;
use App\Services\BackofficeCompanyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CompanyController extends Controller
{
    public function __construct(
        private BackofficeCompanyService $backofficeCompanyService,
        private EcommerceDemoDataSyncService $demoDataSyncService
    )
    {
    }

    public function list(Request $request)
    {
        $companies = $this->backofficeCompanyService->paginate($request->all());

        return response()->json([
            'status' => 1,
            'data' => collect($companies->items())
                ->map(fn (Company $company) => $this->backofficeCompanyService->transform($company))
                ->all(),
            'pagination' => [
                'current_page' => $companies->currentPage(),
                'last_page' => $companies->lastPage(),
                'per_page' => $companies->perPage(),
                'total' => $companies->total(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), $this->backofficeCompanyService->validationRules(null, $request->input('business_mode')));

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'msg' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $company = $this->backofficeCompanyService->create($validator->validated());

            return response()->json([
                'status' => 1,
                'msg' => 'Company created successfully',
                'data' => $this->backofficeCompanyService->transform($company),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'status' => 0,
                'msg' => collect($e->errors())->flatten()->first(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'msg' => 'Failed to create company: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function show($id)
    {
        $company = Company::with(['user.roles', 'saasPlan:id,name,billing_period,trial_period'])->find($id);

        if (!$company) {
            return response()->json([
                'status' => 0,
                'msg' => 'Company not found',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'msg' => 'Company retrieved successfully',
            'data' => $this->backofficeCompanyService->transform($company),
        ]);
    }

    /**
     * Update company information only (partial update)
     * This method allows updating specific company fields without requiring all validation
     */
    public function updateCompanyInfo(Request $request, $id)
    {
        $company = Company::find($id);

        if (!$company) {
            return response()->json([
                'status' => 0,
                'msg' => 'Company not found',
            ], 404);
        }

        try {
            $validator = Validator::make($request->all(), [
                'name' => ['sometimes', 'required', 'string', 'max:255'],
                'contact_name' => ['sometimes', 'required', 'string', 'max:255'],
                'phone_number' => ['sometimes', 'required', 'string', 'max:20'],
                'department' => ['nullable', 'string', 'max:255'],
                'vat_no' => ['nullable', 'string', 'max:255'],
                'reg_number' => ['nullable', 'string', 'max:255'],
                'tin_number' => ['nullable', 'string', 'max:255'],
                'bin_number' => ['nullable', 'string', 'max:255'],
                'email' => ['sometimes', 'required', 'email', Rule::unique('company', 'email')->ignore($company->company_id, 'company_id')],
                'address' => ['nullable', 'string'],
                'post_code' => ['nullable', 'string', 'max:255'],
                'city' => ['nullable', 'string', 'max:255'],
                'state' => ['nullable', 'string', 'max:255'],
                'country' => ['nullable', 'string', 'max:255'],
                'website_url' => ['nullable', 'string', 'max:255'],
                'domain' => ['nullable', 'string', 'max:255', Rule::unique('company', 'domain')->ignore($company->company_id, 'company_id')],
                'seed_demo_data' => ['nullable', 'boolean'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'msg' => $validator->errors()->first(),
                    'errors' => $validator->errors(),
                ], 422);
            }

            $company = $this->backofficeCompanyService->updateInfo($company, $validator->validated());

            if ($request->boolean('seed_demo_data')) {
                $categoryId = $this->resolveDemoCategoryId($company);

                if (! $categoryId) {
                    return response()->json([
                        'status' => 0,
                        'msg' => 'No ecommerce category is available for demo data seeding.',
                    ], 422);
                }

                $this->demoDataSyncService->syncForCompanyAndCategory(
                    $categoryId,
                    $company->company_id
                );
            }

            Log::info('CompanyController: Company info updated successfully', [
                'company_id' => $company->company_id,
            ]);

            return response()->json([
                'status' => 1,
                'msg' => 'Company information updated successfully',
                'data' => $company,
            ]);
        } catch (\Exception $e) {
            Log::error('CompanyController: Failed to update company info: ' . $e->getMessage());

            return response()->json([
                'status' => 0,
                'msg' => 'Failed to update company information',
            ], 500);
        }
    }

    private function resolveDemoCategoryId(Company $company): ?int
    {
        if (! empty($company->ecommerce_category_id)) {
            return (int) $company->ecommerce_category_id;
        }

        $template = $company->selectedETemplate()->first();
        if (! $template) {
            return null;
        }

        $templateCategoryIds = collect($template->categories ?? [])
            ->pluck('id')
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->values()
            ->all();

        if (empty($templateCategoryIds)) {
            return null;
        }

        return ECategory::query()
            ->where('status', true)
            ->whereIn('id', $templateCategoryIds)
            ->orderBy('id')
            ->value('id');
    }

    public function checkDomainAvailability(Request $request, $id)
    {
        $company = Company::find($id);

        if (!$company) {
            return response()->json([
                'status' => 0,
                'msg' => 'Company not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'domain' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'msg' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $normalizedDomain = $this->backofficeCompanyService->normalizeDomainInput($request->input('domain'));

        if (!$normalizedDomain) {
            return response()->json([
                'status' => 0,
                'msg' => 'A valid domain is required.',
            ], 422);
        }

        $available = !$this->backofficeCompanyService->domainExists($normalizedDomain, $company->company_id);

        return response()->json([
            'status' => 1,
            'data' => [
                'domain' => $normalizedDomain,
                'available' => $available,
                'message' => $available
                    ? 'Store domain is available.'
                    : 'This store domain is already taken.',
                'suggestions' => $available
                    ? []
                    : $this->backofficeCompanyService->suggestDomains($normalizedDomain, $company->company_id),
            ],
        ]);
    }

    public function validateCustomDomainStore(Request $request, $id)
    {
        $company = Company::find($id);

        if (! $company) {
            return response()->json(['status' => 0, 'msg' => 'Company not found'], 404);
        }

        if (! $request->user()?->isSuperAdmin()
            && (string) $request->user()?->company_id !== (string) $company->company_id) {
            return response()->json(['status' => 0, 'msg' => 'You cannot manage this store.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'store_domain' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 0, 'msg' => $validator->errors()->first()], 422);
        }

        $storeDomain = $this->backofficeCompanyService->normalizeDomainInput($request->input('store_domain'));
        $available = $storeDomain !== null
            && ! $this->backofficeCompanyService->domainExists($storeDomain, $company->company_id);

        return response()->json([
            'status' => 1,
            'data' => [
                'valid' => $available,
                'available' => $available,
                'store_domain' => $storeDomain,
                'message' => $available
                    ? 'This store name is available.'
                    : 'This store name is already being used.',
                'suggestions' => $available || ! $storeDomain
                    ? []
                    : $this->backofficeCompanyService->suggestDomains(
                        $storeDomain,
                        $company->company_id
                    ),
            ],
        ]);
    }

    public function connectCustomDomain(Request $request, $id)
    {
        $company = Company::find($id);

        if (! $company) {
            return response()->json(['status' => 0, 'msg' => 'Company not found'], 404);
        }

        if (! $request->user()?->isSuperAdmin()
            && (string) $request->user()?->company_id !== (string) $company->company_id) {
            return response()->json(['status' => 0, 'msg' => 'You cannot manage this store.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'store_domain' => ['required', 'string', 'max:255'],
            'custom_domain' => [
                'required',
                'string',
                'max:255',
                Rule::unique('company', 'custom_domain')->ignore($company->company_id, 'company_id'),
            ],
            'verification_token' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 0, 'msg' => $validator->errors()->first()], 422);
        }

        $storeDomain = $this->backofficeCompanyService->normalizeDomainInput($request->input('store_domain'));
        $customDomain = $this->backofficeCompanyService->normalizeDomainInput($request->input('custom_domain'));
        if (! $storeDomain || $this->backofficeCompanyService->domainExists($storeDomain, $company->company_id)) {
            return response()->json(['status' => 0, 'msg' => 'This store name is no longer available. Choose another name.'], 422);
        }

        if (! $customDomain) {
            return response()->json(['status' => 0, 'msg' => 'A valid custom domain is required.'], 422);
        }

        if ($this->backofficeCompanyService->domainExists($customDomain, $company->company_id)) {
            return response()->json([
                'status' => 0,
                'msg' => 'This custom domain is already connected to another store.',
            ], 422);
        }

        $rootDomain = preg_replace('/^www\./i', '', $customDomain);
        $txtRecords = @dns_get_record('_storeverify.' . $rootDomain, DNS_TXT) ?: [];
        $cnameRecords = @dns_get_record($customDomain, DNS_CNAME) ?: [];
        $txtVerified = collect($txtRecords)->contains(
            fn (array $record) => str_contains((string) ($record['txt'] ?? ''), (string) $request->input('verification_token'))
        );
        $cnameVerified = collect($cnameRecords)->contains(
            fn (array $record) => rtrim(strtolower((string) ($record['target'] ?? '')), '.') === strtolower($storeDomain)
        );

        if (! $txtVerified || ! $cnameVerified) {
            return response()->json([
                'status' => 0,
                'msg' => 'Server verification failed. Confirm the exact TXT and CNAME records, then try again.',
                'data' => ['txt_verified' => $txtVerified, 'cname_verified' => $cnameVerified],
            ], 422);
        }

        $company->update([
            'domain' => $storeDomain,
            'custom_domain' => $customDomain,
            'custom_domain_verified_at' => now(),
        ]);

        return response()->json([
            'status' => 1,
            'msg' => 'Custom domain connected successfully.',
            'data' => [
                'domain' => $company->domain,
                'custom_domain' => $company->custom_domain,
                'custom_domain_verified_at' => $company->custom_domain_verified_at,
            ],
        ]);
    }

    public function update(Request $request, $id)
    {
        $company = Company::with(['user.roles', 'saasPlan:id,name,billing_period,trial_period'])->find($id);

        if (!$company) {
            return response()->json([
                'status' => 0,
                'msg' => 'Company not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), $this->backofficeCompanyService->validationRules($id, $request->input('business_mode')));

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'msg' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $company = $this->backofficeCompanyService->update($company, $validator->validated());

            return response()->json([
                'status' => 1,
                'msg' => 'Company updated successfully',
                'data' => $this->backofficeCompanyService->transform($company),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'status' => 0,
                'msg' => collect($e->errors())->flatten()->first(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'msg' => 'Failed to update company: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy($id)
    {
        $company = Company::find($id);

        if (!$company) {
            return response()->json([
                'status' => 0,
                'msg' => 'Company not found',
            ], 404);
        }

        try {
            $company->delete();

            return response()->json([
                'status' => 1,
                'msg' => 'Company deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'msg' => 'Failed to delete company: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatus($id)
    {
        $company = Company::find($id);

        if (!$company) {
            return response()->json([
                'status' => 0,
                'msg' => 'Company not found',
            ], 404);
        }

        try {
            $company = $this->backofficeCompanyService->toggleStatus($company);

            return response()->json([
                'status' => 1,
                'msg' => 'Company status updated successfully',
                'data' => $company,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'msg' => 'Failed to update company status: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroyMultiple(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'exists:company,company_id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'msg' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $this->backofficeCompanyService->deleteMany($request->ids);

            return response()->json([
                'status' => 1,
                'msg' => 'Selected companies deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'msg' => 'Failed to delete companies: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatusMultiple(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'exists:company,company_id',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'msg' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $this->backofficeCompanyService->updateManyStatus($request->ids, (int) $request->status);

            return response()->json([
                'status' => 1,
                'msg' => 'Selected companies status updated successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'msg' => 'Failed to update companies status: ' . $e->getMessage(),
            ], 500);
        }
    }

}

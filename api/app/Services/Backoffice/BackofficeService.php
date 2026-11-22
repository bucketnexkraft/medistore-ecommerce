<?php

namespace App\Services\Backoffice;

use App\Data\FeaturePreference;
use App\Models\Company;
use App\Models\CompanyFeaturePreference;
use App\Models\CompanyRight;
use App\Models\Right;
use App\Models\User;
use App\Services\BackofficeCompanyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Tymon\JWTAuth\Facades\JWTAuth;

class BackofficeService
{
    public function __construct(private BackofficeCompanyService $backofficeCompanyService) {}

    public function companyUsers(Request $request, $companyId)
    {
        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterStatus = $request->input('status', '');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        $allowedSortFields = ['first_name', 'last_name', 'email', 'phone', 'status', 'created_at'];
        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }
        $sortOrder = $sortOrder === 'asc' ? 'asc' : 'desc';

        $query = User::with('roles')
            ->where('company_id', $companyId)
            ->where(function ($builder) {
                $builder->whereNull('is_default')
                    ->orWhere('is_default', 0);
            });

        if (! empty($filterText)) {
            $query->where(function ($q) use ($filterText) {
                $q->where('first_name', 'LIKE', "%{$filterText}%")
                    ->orWhere('last_name', 'LIKE', "%{$filterText}%")
                    ->orWhere('email', 'LIKE', "%{$filterText}%")
                    ->orWhere('phone', 'LIKE', "%{$filterText}%");
            });
        }

        if ($filterStatus !== '') {
            $query->where('status', $filterStatus);
        }

        $query->orderBy($sortField, $sortOrder);
        $data = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Company users retrieved successfully!',
            'data' => $data->items(),
            'meta' => [
                'current_page' => $data->currentPage(),
                'per_page' => $data->perPage(),
                'total' => $data->total(),
                'last_page' => $data->lastPage(),
            ],
        ], 200);
    }

    public function companyFeaturePreferences(Request $request, $companyId)
    {
        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $records = CompanyFeaturePreference::query()
            ->where('company_id', $companyId)
            ->get()
            ->keyBy(fn ($item) => FeaturePreference::normalizeStoredValue($item->feature));

        $data = collect(FeaturePreference::options())
            ->map(function (array $option) use ($records) {
                $record = $records->get($option['code']);

                return [
                    'id' => $record?->id,
                    'code' => $option['code'],
                    'name' => $option['name'],
                    'description' => $option['description'],
                    'is_assigned' => $option['is_core'] || (bool) $record,
                    'is_active' => $option['is_core'] || (bool) optional($record)->active,
                    'is_core' => $option['is_core'],
                    'created_at' => $record?->created_at,
                    'updated_at' => $record?->updated_at,
                ];
            })
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Feature preferences retrieved successfully!',
            'data' => $data,
            'assigned_codes' => $data->where('is_assigned', true)->pluck('code')->values(),
        ], 200);
    }

    public function storeCompanyFeaturePreference(Request $request, $companyId)
    {
        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string', Rule::in(FeaturePreference::values())],
            'is_active' => ['required', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        if (FeaturePreference::from($request->input('code'))->isCore() && !$request->boolean('is_active')) {
            return response()->json([
                'status' => 0,
                'message' => 'Core features must remain active.',
            ], 422);
        }

        $preference = CompanyFeaturePreference::create([
            'company_id' => $companyId,
            'feature' => $request->input('code'),
            'active' => (bool) $request->boolean('is_active'),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Feature preference created successfully.',
            'data' => $preference,
        ], 201);
    }

    public function updateCompanyFeaturePreference(Request $request, $companyId, $id)
    {
        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $preference = CompanyFeaturePreference::query()
            ->where('company_id', $companyId)
            ->where('id', $id)
            ->first();

        if (! $preference) {
            return response()->json([
                'status' => 0,
                'message' => 'Feature preference not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string', Rule::in(FeaturePreference::values())],
            'is_active' => ['required', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        if (FeaturePreference::tryFrom($preference->feature)?->isCore()
            && $request->input('code') !== $preference->feature) {
            return response()->json([
                'status' => 0,
                'message' => 'Core features cannot be replaced.',
            ], 422);
        }

        if (FeaturePreference::from($request->input('code'))->isCore() && !$request->boolean('is_active')) {
            return response()->json([
                'status' => 0,
                'message' => 'Core features must remain active.',
            ], 422);
        }

        $preference->update([
            'feature' => $request->input('code'),
            'active' => (bool) $request->boolean('is_active'),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Feature preference updated successfully.',
            'data' => $preference->fresh(),
        ], 200);
    }

    public function deleteCompanyFeaturePreference(Request $request, $companyId, $id)
    {
        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $preference = CompanyFeaturePreference::query()
            ->where('company_id', $companyId)
            ->where('id', $id)
            ->first();

        if (! $preference) {
            return response()->json([
                'status' => 0,
                'message' => 'Feature preference not found.',
            ], 404);
        }

        if (FeaturePreference::tryFrom($preference->feature)?->isCore()) {
            return response()->json([
                'status' => 0,
                'message' => 'Core features cannot be deleted.',
            ], 422);
        }

        $preference->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Feature preference deleted successfully.',
        ], 200);
    }

    public function syncCompanyFeaturePreferences(Request $request, $companyId)
    {
        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'codes' => ['required', 'array'],
            'codes.*' => ['string', Rule::in(FeaturePreference::values())],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $codes = collect($request->input('codes', []))
            ->merge(FeaturePreference::coreValues())
            ->unique()
            ->values();

        DB::transaction(function () use ($companyId, $codes) {
            CompanyFeaturePreference::query()
                ->where('company_id', $companyId)
                ->whereNotIn('feature', $codes)
                ->delete();

            foreach ($codes as $code) {
                if (FeaturePreference::from($code)->isCore()) {
                    CompanyFeaturePreference::updateOrCreate(
                        [
                            'company_id' => $companyId,
                            'feature' => $code,
                        ],
                        ['active' => true]
                    );
                    continue;
                }

                CompanyFeaturePreference::firstOrCreate(
                    [
                        'company_id' => $companyId,
                        'feature' => $code,
                    ],
                    [
                        'active' => true,
                    ]
                );
            }
        });

        return response()->json([
            'status' => 1,
            'message' => 'Company feature preferences updated successfully.',
        ]);
    }

    public function featurePreferenceOptions()
    {
        return response()->json([
            'status' => 1,
            'message' => 'Feature preference options fetched successfully.',
            'data' => FeaturePreference::options(),
        ]);
    }

    public function impersonateCompanyUser(Request $request, $companyId, $userId)
    {
        $impersonator = Auth::user();

        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $targetUser = User::with('roles')
            ->where('id', $userId)
            ->where('company_id', $companyId)
            ->first();

        if (! $targetUser) {
            return response()->json([
                'status' => 0,
                'message' => 'User not found for this company.',
            ], 404);
        }

        if ((string) $targetUser->id === (string) $impersonator->id) {
            return response()->json([
                'status' => 0,
                'message' => 'You are already logged in as this user.',
            ], 422);
        }

        if ((int) $targetUser->status !== 1) {
            return response()->json([
                'status' => 0,
                'message' => 'Only active users can be impersonated.',
            ], 422);
        }

        if ($targetUser->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Impersonating super admins is not allowed.',
            ], 422);
        }

        $token = JWTAuth::fromUser($targetUser);

        return response()->json([
            'status' => 1,
            'message' => 'Impersonation started successfully.',
            'token' => $token,
            'user' => $targetUser,
            'rights' => $targetUser?->roles?->toRightArray() ?? [],
        ], 200);
    }

    public function companyRights(Request $request, $companyId)
    {
        $company = Company::withoutGlobalScopes()->find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $this->backofficeCompanyService->ensureDefaultRights($company);

        $rights = Right::query()
            ->select(['id', 'name', 'module'])
            ->orderBy('module')
            ->orderBy('name')
            ->get();

        $assignedRightIds = CompanyRight::query()
            ->where('company_id', $companyId)
            ->pluck('right_id')
            ->toArray();

        return response()->json([
            'status' => 1,
            'message' => 'Company rights fetched successfully.',
            'data' => [
                'rights' => $rights,
                'assigned_right_ids' => $assignedRightIds,
            ],
        ], 200);
    }

    public function updateCompanyRights(Request $request, $companyId)
    {
        $company = Company::find($companyId);
        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'right_ids' => 'present|array',
            'right_ids.*' => 'required|exists:right,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $rightIds = collect($request->input('right_ids', []))
            ->map(fn ($id) => (string) $id)
            ->unique()
            ->values()
            ->all();

        try {
            $this->backofficeCompanyService->syncRights($company, $rightIds);

            return response()->json([
                'status' => 1,
                'message' => 'Company rights updated successfully.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to update company rights.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

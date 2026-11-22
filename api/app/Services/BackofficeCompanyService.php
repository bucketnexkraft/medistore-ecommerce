<?php

namespace App\Services;

use App\Jobs\SendTemplatedEmail;
use App\Models\Company;
use App\Models\CompanyCommissionCharge;
use App\Models\CompanyETemplateAccess;
use App\Models\CompanyFeaturePreference;
use App\Models\CompanyRight;
use App\Models\Currency;
use App\Models\ECategory;
use App\Models\ETemplate;
use App\Models\PlanPaymentLog;
use App\Models\Product;
use App\Models\Right;
use App\Models\Role;
use App\Models\RoleRight;
use App\Models\SaasPlan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BackofficeCompanyService
{
    private const DOMAIN_SUGGESTION_LIMIT = 4;
    private const DEFAULT_CURRENCY_CODE = 'USD';

    public function ensureCompanyAccessBootstrap(Company $company, ?User $user = null, ?string $fallbackRoleName = null): void
    {
        $company = Company::withoutGlobalScopes()->find($company->company_id) ?? $company;
        $user = $user
            ? User::withoutGlobalScopes()->find($user->id)
            : ($company->user_id ? User::withoutGlobalScopes()->find($company->user_id) : null);

        if (!$user) {
            return;
        }

        if ((string) ($company->type ?? '') === '4' && (string) ($company->user_id ?? '') === (string) $user->id) {
            if ((int) $user->role !== User::ECOMMERCE_COMPANY_ROLE) {
                $user->role = User::ECOMMERCE_COMPANY_ROLE;
                $user->save();
            }

            return;
        }

        if ((string) $user->company_id !== (string) $company->company_id) {
            $user->company_id = $company->company_id;
        }

        if ((string) $company->user_id !== (string) $user->id) {
            $company->user_id = $user->id;
            $company->save();
        }

        $role = null;
        if ($user->role) {
            $role = Role::withoutGlobalScopes()
                ->where('company_id', $company->company_id)
                ->find($user->role);
        }

        if (!$role) {
            $role = Role::withoutGlobalScopes()
                ->where('company_id', $company->company_id)
                ->orderBy('id')
                ->first();
        }

        if (!$role) {
            $role = Role::create([
                'name' => trim($fallbackRoleName ?: 'Administrator'),
                'company_id' => $company->company_id,
            ]);
        }

        if ((int) $user->role !== (int) $role->id) {
            $user->role = $role->id;
        }

        if ($user->isDirty()) {
            $user->save();
        }

        $company->unsetRelation('user');
        $company->load('user.roles');
        $this->ensureDefaultRights($company);
    }

    public function validationRules(?string $excludeId = null, ?string $businessMode = null): array
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:company,email',
            'phone_number' => 'required|string|max:20',
            'contact_name' => 'required|string|max:255',
            'role_name' => 'required|string|max:255',
            'address' => 'nullable|string',
            'domain' => 'nullable|string|max:255|unique:company,domain',
            'status' => 'required|in:0,1',
            'password' => 'required|string|min:8',
            'business_mode' => ['required', Rule::in(['online', 'pos', 'both'])],
            'saas_plan_id' => ['nullable', 'integer', Rule::exists('saas_plans', 'id')->where(fn ($query) => $query->where('status', true))],
            'selected_e_template_id' => ['nullable', 'integer', Rule::exists('e_templates', 'id')],
        ];

        if (in_array($businessMode, ['online', 'both'], true)) {
            $rules['saas_plan_id'] = ['required', 'integer', Rule::exists('saas_plans', 'id')->where(fn ($query) => $query->where('status', true))];
            $rules['selected_e_template_id'] = ['required', 'integer', Rule::exists('e_templates', 'id')];
        }

        if ($excludeId) {
            $rules['email'] = 'required|email|unique:company,email,' . $excludeId . ',company_id';
            $rules['domain'] = 'nullable|string|max:255|unique:company,domain,' . $excludeId . ',company_id';
            $rules['password'] = 'nullable|string|min:8';
        }

        return $rules;
    }

    public function paginate(array $filters): LengthAwarePaginator
    {
        $perPage = (int) ($filters['perPage'] ?? 20);
        $page = (int) ($filters['page'] ?? 1);
        $search = trim((string) ($filters['search'] ?? ''));
        $status = $filters['status'] ?? null;
        $sortField = (string) ($filters['sortField'] ?? 'created_at');
        $sortOrder = (string) ($filters['sortOrder'] ?? 'desc');

        $query = Company::with(['user.roles', 'saasPlan:id,name,billing_period,trial_period']);

        if ($search !== '') {
            $query->where(function ($companyQuery) use ($search) {
                $companyQuery->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('email', 'LIKE', "%{$search}%")
                    ->orWhere('contact_name', 'LIKE', "%{$search}%")
                    ->orWhere('phone_number', 'LIKE', "%{$search}%");
            });
        }

        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }

        $validSortFields = ['name', 'email', 'phone_number', 'created_at'];
        $sortField = in_array($sortField, $validSortFields, true) ? $sortField : 'created_at';
        $sortOrder = $sortOrder === 'asc' ? 'asc' : 'desc';

        return $query->orderBy($sortField, $sortOrder)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function create(array $data): Company
    {
        $company = DB::transaction(function () use ($data) {
            $defaultCurrencyId = Currency::query()
                ->where('code', self::DEFAULT_CURRENCY_CODE)
                ->value('id');

            $company = new Company([
                'name' => $this->normalizeTextValue($data['name']),
                'email' => $this->normalizeTextValue($data['email']),
                'phone_number' => $this->normalizeTextValue($data['phone_number']),
                'contact_name' => $this->normalizeTextValue($data['contact_name']),
                'address' => $this->normalizeTextValue($data['address'] ?? null),
                'domain' => $this->normalizeDomainValue($data['domain'] ?? null),
                'status' => $data['status'],
                ...$this->resolveBusinessSelection($data),
                'slug' => Str::slug((string) $this->normalizeTextValue($data['name'])),
                'currency_id' => $defaultCurrencyId,
            ]);
            $company->company_id = $this->generateCompanyId();

            $role = $this->createOrUpdateAdminRole(
                $company,
                (string) $this->normalizeTextValue($data['role_name'])
            );

            $this->syncRights($company, $this->getAllRightIds());

            $user = UserService::createOrUpdateUserFromBackoffice($company, [
                ...$data,
                'name' => $this->normalizeTextValue($data['name']),
                'email' => $this->normalizeTextValue($data['email']),
                'phone_number' => $this->normalizeTextValue($data['phone_number']),
                'contact_name' => $this->normalizeTextValue($data['contact_name']),
                'address' => $this->normalizeTextValue($data['address'] ?? null),
                'role_name' => $this->normalizeTextValue($data['role_name']),
                'role_id' => $role->id,
            ]);

            $company->user_id = $user?->id;

            if (!$company->user_id) {
                throw ValidationException::withMessages([
                    'user_id' => 'Failed to link the company with its admin user.',
                ]);
            }

            $company->save();

            if ((string) $user->company_id !== (string) $company->company_id) {
                $user->company_id = $company->company_id;
                $user->save();
            }

            return $company->fresh(['user.roles']);
        });

        $this->grantSelectedTemplateAccess($company);

        $user = User::withoutGlobalScopes()->find($company->user_id);
        if ($user?->email) {
            SendTemplatedEmail::dispatch($user->email, 'welcome_email', [
                'name' => trim($user->first_name . ' ' . ($user->last_name ?? '')),
                'first_name' => (string) $user->first_name,
                'last_name' => (string) ($user->last_name ?? ''),
                'company_name' => (string) $company->name,
                'email' => (string) $user->email,
                'phone' => (string) ($user->phone ?? ''),
                'login_url' => rtrim((string) config('app.admin_login_url', rtrim(config('app.url') ?? url('/'), '/') . '/login'), '/'),
            ]);
        }

        return $company;
    }

    private function generateCompanyId(): string
    {
        return substr(uniqid(), 0, 13) . '-comp-' . random_int(10000000000000000, 99999999999999999);
    }

    public function update(Company $company, array $data): Company
    {
        $company = DB::transaction(function () use ($company, $data) {
            $company->update([
                'name' => $this->normalizeTextValue($data['name']),
                'email' => $this->normalizeTextValue($data['email']),
                'phone_number' => $this->normalizeTextValue($data['phone_number']),
                'contact_name' => $this->normalizeTextValue($data['contact_name']),
                'address' => $this->normalizeTextValue($data['address'] ?? null),
                'domain' => $this->normalizeDomainValue($data['domain'] ?? null),
                'status' => $data['status'],
                ...$this->resolveBusinessSelection($data, $company),
                'slug' => Str::slug((string) $this->normalizeTextValue($data['name'])),
            ]);

            $role = $this->createOrUpdateAdminRole(
                $company,
                (string) $this->normalizeTextValue($data['role_name'])
            );

            UserService::createOrUpdateUserFromBackoffice($company, [
                ...$data,
                'name' => $this->normalizeTextValue($data['name']),
                'email' => $this->normalizeTextValue($data['email']),
                'phone_number' => $this->normalizeTextValue($data['phone_number']),
                'contact_name' => $this->normalizeTextValue($data['contact_name']),
                'address' => $this->normalizeTextValue($data['address'] ?? null),
                'role_name' => $this->normalizeTextValue($data['role_name']),
                'role_id' => $role->id,
            ]);

            return $company->fresh(['user.roles']);
        });

        $this->grantSelectedTemplateAccess($company);

        return $company;
    }

    private function resolveBusinessSelection(array $data, ?Company $company = null): array
    {
        $businessMode = (string) ($data['business_mode'] ?? 'online');

        if ($businessMode === 'pos') {
            return [
                'business_mode' => 'pos',
                'saas_plan_id' => null,
                'selected_e_template_id' => null,
                'ecommerce_category_id' => null,
                'ecommerce_setup_completed_at' => null,
                'plan_subscribed_at' => null,
            ];
        }

        $planId = (int) ($data['saas_plan_id'] ?? 0);
        $templateId = (int) ($data['selected_e_template_id'] ?? 0);
        $template = ETemplate::query()->find($templateId);

        if (!$planId || !$template) {
            throw ValidationException::withMessages([
                'selected_e_template_id' => 'A plan and template are required for an online company.',
            ]);
        }

        $categoryIds = collect($template->categories ?? [])
            ->map(fn ($category) => is_array($category) ? ($category['id'] ?? null) : null)
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->values()
            ->all();
        $categoryId = ECategory::query()
            ->where('status', true)
            ->whereIn('id', $categoryIds)
            ->orderBy('id')
            ->value('id');

        if (!$categoryId) {
            throw ValidationException::withMessages([
                'selected_e_template_id' => 'The selected template has no active ecommerce category.',
            ]);
        }

        return [
            'business_mode' => $businessMode,
            'saas_plan_id' => $planId,
            'selected_e_template_id' => $template->id,
            'ecommerce_category_id' => $categoryId,
            'ecommerce_setup_completed_at' => now(),
            'plan_subscribed_at' => $company?->saas_plan_id === $planId && $company?->plan_subscribed_at
                ? $company->plan_subscribed_at
                : now(),
        ];
    }

    private function grantSelectedTemplateAccess(Company $company): void
    {
        if (!$company->selected_e_template_id) {
            return;
        }

        CompanyETemplateAccess::query()->firstOrCreate(
            [
                'company_id' => $company->company_id,
                'template_id' => $company->selected_e_template_id,
            ],
            [
                'amount' => 0,
            ]
        );
    }

    public function syncRights(Company $company, array $rightIds): void
    {
        DB::transaction(function () use ($company, $rightIds) {
            CompanyRight::query()->where('company_id', $company->company_id)->delete();

            foreach ($rightIds as $rightId) {
                CompanyRight::create([
                    'company_id' => $company->company_id,
                    'right_id' => $rightId,
                ]);
            }

            $this->syncAdminRoleRights($company, $rightIds);
        });
    }

    public function updateInfo(Company $company, array $payload): Company
    {
        $allowedFields = [
            'name', 'contact_name', 'phone_number', 'department', 'vat_no',
            'reg_number', 'tin_number', 'bin_number', 'email', 'address',
            'post_code', 'city', 'state', 'country', 'website_url', 'domain',
        ];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $payload)) {
                $updateData[$field] = $field === 'domain'
                    ? $this->normalizeDomainValue($payload[$field])
                    : $this->normalizeTextValue($payload[$field]);
            }
        }

        $company->update($updateData);

        return $company->fresh();
    }

    public function toggleStatus(Company $company): Company
    {
        $company->update([
            'status' => (int) $company->status === 1 ? 0 : 1,
        ]);

        return $company->fresh();
    }

    public function deleteMany(array $ids): void
    {
        Company::whereIn('company_id', $ids)->delete();
    }

    public function updateManyStatus(array $ids, int $status): void
    {
        Company::whereIn('company_id', $ids)->update(['status' => $status]);
    }

    public function normalizeDomainInput(mixed $value): ?string
    {
        return $this->normalizeDomainValue($value);
    }

    public function domainExists(string $domain, ?string $ignoreCompanyId = null): bool
    {
        $normalizedDomain = $this->normalizeDomainValue($domain);

        if (!$normalizedDomain) {
            return false;
        }

        return Company::query()
            ->when($ignoreCompanyId, fn ($query) => $query->where('company_id', '!=', $ignoreCompanyId))
            ->where(function ($query) use ($normalizedDomain) {
                $query
                    ->where('domain', $normalizedDomain)
                    ->orWhere('custom_domain', $normalizedDomain);
            })
            ->exists();
    }

    public function suggestDomains(string $domain, ?string $ignoreCompanyId = null, int $limit = self::DOMAIN_SUGGESTION_LIMIT): array
    {
        $normalizedDomain = $this->normalizeDomainValue($domain);

        if (!$normalizedDomain) {
            return [];
        }

        $segments = explode('.', $normalizedDomain, 2);
        $label = $segments[0] ?? '';
        $baseDomain = $segments[1] ?? '';

        if ($label === '' || $baseDomain === '') {
            return [];
        }

        $suggestions = [];
        $candidates = [
            $label,
            "{$label}-shop",
            "{$label}-store",
            "{$label}-online",
        ];

        for ($index = 2; $index <= 20; $index++) {
            $candidates[] = "{$label}-{$index}";
        }

        foreach ($candidates as $candidateLabel) {
            $candidateDomain = "{$candidateLabel}.{$baseDomain}";

            if (isset($suggestions[$candidateDomain])) {
                continue;
            }

            if ($this->domainExists($candidateDomain, $ignoreCompanyId)) {
                continue;
            }

            $suggestions[$candidateDomain] = $candidateDomain;

            if (count($suggestions) >= $limit) {
                break;
            }
        }

        return array_values($suggestions);
    }

    public function transform(Company $company): array
    {
        $company->loadMissing([
            'saasPlan:id,name,plan_type,billing_period,trial_period,commission_rate,commission_type,commission_base',
            'selectedETemplate:id,template_name',
        ]);

        $data = $company->toArray();
        $latestApprovedPlanPayment = $this->resolveLatestApprovedPlanPayment($company);
        $expiresAt = $this->resolvePlanExpiresAt($company);
        $planStatus = $this->resolvePlanStatus($company, $expiresAt);
        $planType = (string) ($company->saasPlan?->plan_type ?? '');

        $data['role_name'] = $company->user?->resolveRoleName()
            ?? $company->user?->roles?->name
            ?? null;
        $data['plan_name'] = $company->saasPlan?->name;
        $data['plan_type'] = $planType ?: null;
        $data['plan_type_label'] = $this->resolvePlanTypeLabel($company->saasPlan);
        $data['plan_billing_period'] = $planType === 'commission'
            ? null
            : $company->saasPlan?->billing_period;
        $data['plan_billing_label'] = $this->resolvePlanBillingLabel($company->saasPlan);
        $data['plan_trial_period'] = $company->saasPlan?->trial_period;
        $data['plan_subscribed_at'] = $company->plan_subscribed_at?->toDateTimeString();
        $data['plan_expires_at'] = $expiresAt?->toDateTimeString();
        $data['plan_status'] = $planStatus;
        $data['selected_template_name'] = $company->selectedETemplate?->template_name;
        $data['selected_template_id'] = $company->selectedETemplate?->id;
        $data['latest_plan_payment'] = $latestApprovedPlanPayment;
        $data['analysis'] = [
            'total_products' => Product::query()->where('company_id', $company->company_id)->count(),
            'active_products' => Product::query()
                ->where('company_id', $company->company_id)
                ->where('status', 1)
                ->count(),
            'total_users' => User::query()
                ->where('company_id', $company->company_id)
                ->where(fn ($query) => $query->whereNull('is_default')->orWhere('is_default', 0))
                ->count(),
            'active_users' => User::query()
                ->where('company_id', $company->company_id)
                ->where('status', 1)
                ->where(fn ($query) => $query->whereNull('is_default')->orWhere('is_default', 0))
                ->count(),
            'active_feature_preferences' => CompanyFeaturePreference::query()
                ->where('company_id', $company->company_id)
                ->where('active', 1)
                ->count(),
            'pending_commission_amount' => round((float) CompanyCommissionCharge::query()
                ->where('company_id', $company->company_id)
                ->where('status', 'pending')
                ->sum('commission_amount'), 2),
            'paid_commission_amount' => round((float) CompanyCommissionCharge::query()
                ->where('company_id', $company->company_id)
                ->where('status', 'paid')
                ->sum('commission_amount'), 2),
        ];

        return $data;
    }

    public function ensureDefaultRights(Company $company): void
    {
        $allRightIds = $this->getAllRightIds();
        if ($allRightIds === []) {
            return;
        }

        $existingRightIds = CompanyRight::query()
            ->where('company_id', $company->company_id)
            ->pluck('right_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $missingRightIds = array_values(array_diff($allRightIds, $existingRightIds));

        if ($missingRightIds === []) {
            $this->syncAdminRoleRights($company, $existingRightIds);
            return;
        }

        $this->syncRights($company, array_values(array_unique(array_merge($existingRightIds, $missingRightIds))));
    }

    public function resolveRightsForUser(User $user): array
    {
        if ($user->isSuperAdmin()) {
            $user->loadMissing('roles.rights.right');

            return $user?->roles?->toRightArray() ?? [];
        }

        if ((int) $user->role === User::ECOMMERCE_COMPANY_ROLE && !empty($user->company_id)) {
            $company = Company::withoutGlobalScopes()->find($user->company_id);

            if (!$company) {
                return [];
            }

            $this->ensureDefaultRights($company);

            return Right::withoutGlobalScopes()
                ->join('company_rights', 'company_rights.right_id', '=', 'right.id')
                ->where('company_rights.company_id', $company->company_id)
                ->orderBy('right.module')
                ->orderBy('right.name')
                ->get(['right.module', 'right.name'])
                ->map(fn ($right) => [
                    'module' => $right->module,
                    'right' => $right->name,
                    'permission' => 1,
                ])
                ->values()
                ->all();
        }

        $user->loadMissing('roles.rights.right');

        return $user?->roles?->toRightArray() ?? [];
    }

    private function getAllRightIds(): array
    {
        return Right::withoutGlobalScopes()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function createOrUpdateAdminRole(Company $company, string $roleName): Role
    {
        $normalizedRoleName = trim($roleName);
        $existingUser = $company->user_id
            ? User::withoutGlobalScopes()->find($company->user_id)
            : null;
        $currentRoleId = $existingUser?->role;

        $duplicateRole = Role::withoutGlobalScopes()
            ->where('company_id', $company->company_id)
            ->whereRaw('LOWER(name) = ?', [Str::lower($normalizedRoleName)])
            ->when($currentRoleId, fn ($query) => $query->where('id', '!=', $currentRoleId))
            ->first();

        if ($duplicateRole) {
            throw ValidationException::withMessages([
                'role_name' => 'Role name already exists for this company.',
            ]);
        }

        if ($currentRoleId) {
            $role = Role::withoutGlobalScopes()
                ->where('company_id', $company->company_id)
                ->find($currentRoleId);

            if ($role) {
                $role->update(['name' => $normalizedRoleName]);

                return $role;
            }
        }

        return Role::create([
            'name' => $normalizedRoleName,
            'company_id' => $company->company_id,
        ]);
    }

    private function syncAdminRoleRights(Company $company, array $rightIds): void
    {
        $adminRole = $this->resolveAdminRole($company);

        if (!$adminRole) {
            return;
        }

        $selectedRightIds = collect($rightIds)
            ->map(fn ($id) => (int) $id)
            ->all();

        foreach (Right::withoutGlobalScopes()->get(['id']) as $right) {
            RoleRight::updateOrCreate(
                [
                    'role_id' => $adminRole->id,
                    'right_id' => $right->id,
                ],
                [
                    'permission' => in_array((int) $right->id, $selectedRightIds, true) ? 1 : 0,
                ]
            );
        }
    }

    private function resolveAdminRole(Company $company): ?Role
    {
        $company->loadMissing('user.roles');

        if ($company->user?->roles) {
            return $company->user->roles;
        }

        return Role::withoutGlobalScopes()
            ->where('company_id', $company->company_id)
            ->orderBy('id')
            ->first();
    }

    private function normalizeTextValue(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }

        $value = trim($value);

        if (strlen($value) >= 2 && $value[0] === '"' && $value[strlen($value) - 1] === '"') {
            $value = trim(substr($value, 1, -1));
        }

        return $value === '' ? null : $value;
    }

    private function normalizeDomainValue(mixed $value): ?string
    {
        $normalized = $this->normalizeTextValue($value);

        if (! is_string($normalized) || $normalized === '') {
            return null;
        }

        $normalized = Str::lower($normalized);
        $normalized = preg_replace('#^https?://#', '', $normalized);
        $normalized = preg_replace('#/.*$#', '', $normalized);
        $normalized = preg_replace('#:\d+$#', '', $normalized);
        $normalized = preg_replace('#^www\.#', '', $normalized);

        return $normalized !== '' ? $normalized : null;
    }

    private function resolvePlanExpiresAt(Company $company): ?Carbon
    {
        if (!$company->plan_subscribed_at || !$company->saasPlan) {
            return null;
        }

        if ($company->saasPlan->isCommissionBased()) {
            return null;
        }

        return match ($company->saasPlan->billing_period) {
            'yearly' => $company->plan_subscribed_at->copy()->addYear(),
            'monthly' => $company->plan_subscribed_at->copy()->addMonth(),
            default => $company->plan_subscribed_at->copy()->addMonth(),
        };
    }

    private function resolvePlanStatus(Company $company, ?Carbon $expiresAt = null): array
    {
        $expiresAt = $expiresAt ?: $this->resolvePlanExpiresAt($company);

        if (!$company->saasPlan) {
            return [
                'label' => 'No active plan',
                'is_expired' => true,
                'days_left' => null,
            ];
        }

        if ($company->saasPlan->isCommissionBased()) {
            return [
                'label' => 'Commission based',
                'is_expired' => false,
                'days_left' => null,
            ];
        }

        if (!$expiresAt) {
            return [
                'label' => 'Active',
                'is_expired' => false,
                'days_left' => null,
            ];
        }

        if (now()->greaterThan($expiresAt)) {
            return [
                'label' => 'Expired',
                'is_expired' => true,
                'days_left' => 0,
            ];
        }

        return [
            'label' => 'Active',
            'is_expired' => false,
            'days_left' => now()->diffInDays($expiresAt),
        ];
    }

    private function resolvePlanTypeLabel(?SaasPlan $plan): ?string
    {
        if (!$plan) {
            return null;
        }

        return match ((string) $plan->plan_type) {
            'commission' => 'Commission Based',
            'free' => 'Free',
            'paid' => 'Paid',
            default => ucfirst((string) $plan->plan_type),
        };
    }

    private function resolvePlanBillingLabel(?SaasPlan $plan): ?string
    {
        if (!$plan) {
            return null;
        }

        if ($plan->isCommissionBased()) {
            return 'Commission settlement';
        }

        return $plan->billing_period ?: null;
    }

    private function resolveLatestApprovedPlanPayment(Company $company): ?array
    {
        $payment = PlanPaymentLog::query()
            ->with(['plan:id,name,plan_type,billing_period', 'gateway:id,name', 'currency:id,code,symbol'])
            ->where('company_id', $company->company_id)
            ->where('status', 'approved')
            ->latest('created_at')
            ->first();

        if (!$payment) {
            return null;
        }

        return [
            'id' => $payment->id,
            'trx' => $payment->trx,
            'amount' => round((float) ($payment->payable_amount ?? 0), 2),
            'status' => $payment->status,
            'paid_at' => optional($payment->created_at)->toDateTimeString(),
            'gateway_name' => $payment->gateway?->name ?: $payment->gateway_name,
            'currency_code' => $payment->currency?->code,
            'plan_name' => $payment->plan?->name,
            'plan_type' => $payment->plan?->plan_type,
            'billing_period' => $payment->plan?->billing_period,
        ];
    }
}

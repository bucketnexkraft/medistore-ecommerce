<?php

namespace App\Services;

use App\Data\FeaturePreference;
use App\Models\Company;
use App\Models\SaasPlan;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class BackofficePlanService
{
    public function __construct(private readonly CompanyPlanFeatureService $companyPlanFeatureService)
    {
    }

    public function list(array $filters): LengthAwarePaginator
    {
        $perPage = (int) ($filters['perPage'] ?? 20);
        $page = (int) ($filters['page'] ?? 1);
        $search = trim((string) ($filters['search'] ?? ''));
        $status = $filters['status'] ?? null;

        $query = SaasPlan::query()->with('includedPlan:id,name,features,default_features,included_plan_id');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('description', 'LIKE', "%{$search}%");
            });
        }

        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status === 1);
        }

        $plans = $query->orderByDesc('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $plans->getCollection()->each(function (SaasPlan $plan) {
            $plan->setAttribute('effective_features', $plan->effectiveFeatures());
            $plan->setAttribute('effective_default_features', $plan->effectiveDefaultFeatures());
        });

        return $plans;
    }

    public function store(array $data): SaasPlan
    {
        return DB::transaction(function () use ($data) {
            $plan = SaasPlan::create($this->normalizeData($data));
            if ((bool) $plan->is_default) {
                $this->setAsDefaultPlan($plan);
            }
            $this->ensureFallbackDefaultPlan();
            $this->syncCompaniesForPlan($plan);

            return $plan->fresh();
        });
    }

    public function update(SaasPlan $plan, array $data): SaasPlan
    {
        return DB::transaction(function () use ($plan, $data) {
            $normalized = $this->normalizeData($data);
            $this->validateIncludedPlan($plan, $normalized['included_plan_id'] ?? null);
            $plan->update($normalized);

            if ((bool) ($normalized['is_default'] ?? false)) {
                $this->setAsDefaultPlan($plan);
            } elseif ((bool) $plan->is_default) {
                $this->ensureFallbackDefaultPlan();
            }

            $this->syncCompaniesForPlan($plan->fresh());

            return $plan->fresh();
        });
    }

    public function delete(SaasPlan $plan): void
    {
        DB::transaction(function () use ($plan) {
            $wasDefault = (bool) $plan->is_default;
            $plan->delete();

            if ($wasDefault) {
                $this->ensureFallbackDefaultPlan();
            }
        });
    }

    public function updateStatus(SaasPlan $plan, bool $status): SaasPlan
    {
        $plan->status = $status;
        $plan->save();

        $this->syncCompaniesForPlan($plan->fresh());

        return $plan->fresh();
    }

    public function updateDefaultPlan(SaasPlan $plan): SaasPlan
    {
        return DB::transaction(function () use ($plan) {
            $this->setAsDefaultPlan($plan);
            $this->ensureFallbackDefaultPlan();

            return $plan->fresh();
        });
    }

    private function normalizeData(array $data): array
    {
        $defaultFeatures = collect(FeaturePreference::cases())
            ->filter(fn (FeaturePreference $feature) => $feature->defaultActive())
            ->map(fn (FeaturePreference $feature) => $feature->value)
            ->values()
            ->all();
        $normalizedFeatures = collect(array_key_exists('features', $data) ? $data['features'] : $defaultFeatures)
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->merge(FeaturePreference::coreValues())
            ->unique()
            ->values()
            ->all();
        $defaultFeatureInput = array_key_exists('default_features', $data)
            ? $data['default_features']
            : $normalizedFeatures;
        $normalizedDefaultFeatures = collect($defaultFeatureInput)
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->merge(FeaturePreference::coreValues())
            ->unique()
            ->values()
            ->all();

        if (($data['is_free'] ?? 'paid') === 'free') {
            $data['price'] = 0;
            $data['discount_amount'] = 0;
            $data['discount_type'] = 'fixed';
        }

        $planType = (string) ($data['plan_type'] ?? (($data['is_free'] ?? 'paid') === 'free' ? 'free' : 'paid'));
        $data['plan_type'] = $planType;
        $data['included_plan_id'] = !empty($data['included_plan_id'])
            ? (int) $data['included_plan_id']
            : null;

        if ($planType === 'commission') {
            $data['is_free'] = 'paid';
            $data['price'] = 0;
            $data['discount_amount'] = 0;
            $data['discount_type'] = 'fixed';
            $data['billing_period'] = 'monthly';
            $data['trial_period'] = null;
        } elseif ($planType === 'free') {
            $data['is_free'] = 'free';
        } else {
            $data['is_free'] = 'paid';
            $data['commission_rate'] = 0;
        }

        $data['commission_rate'] = (float) ($data['commission_rate'] ?? 0);
        $data['commission_type'] = (string) ($data['commission_type'] ?? 'percent');
        $data['commission_base'] = (string) ($data['commission_base'] ?? 'total_amount');
        $data['discount_type'] = (string) ($data['discount_type'] ?? 'fixed');

        $data['features'] = $normalizedFeatures;
        $effectiveFeatureCodes = collect($normalizedFeatures);
        if (!empty($data['included_plan_id'])) {
            $parent = SaasPlan::query()->find($data['included_plan_id']);
            $effectiveFeatureCodes = $effectiveFeatureCodes
                ->merge($parent?->effectiveFeatures() ?? [])
                ->unique()
                ->values();
        }
        $data['default_features'] = array_values(array_intersect(
            $normalizedDefaultFeatures,
            $effectiveFeatureCodes->all()
        ));

        if (empty($data['trial_period'])) {
            $data['trial_period'] = null;
        }

        $data['is_default'] = (bool) ($data['is_default'] ?? false);

        return $data;
    }

    private function validateIncludedPlan(SaasPlan $plan, ?int $includedPlanId): void
    {
        if (!$includedPlanId) {
            return;
        }

        $visited = [];
        $currentId = $includedPlanId;

        while ($currentId) {
            if ($currentId === (int) $plan->id || in_array($currentId, $visited, true)) {
                throw ValidationException::withMessages([
                    'included_plan_id' => 'A plan cannot include itself or create a circular plan hierarchy.',
                ]);
            }

            $visited[] = $currentId;
            $currentId = SaasPlan::query()->whereKey($currentId)->value('included_plan_id');
        }
    }

    private function setAsDefaultPlan(SaasPlan $plan): void
    {
        if (!$plan?->id) {
            return;
        }

        SaasPlan::query()
            ->where('id', '!=', $plan->id)
            ->update(['is_default' => false]);

        $plan->forceFill(['is_default' => true])->saveQuietly();
    }

    private function ensureFallbackDefaultPlan(): void
    {
        $defaults = SaasPlan::query()
            ->where('is_default', true)
            ->orderByDesc('status')
            ->orderBy('id')
            ->get(['id']);

        if ($defaults->count() === 1) {
            return;
        }

        $fallbackPlan = SaasPlan::query()
            ->orderByRaw('status DESC')
            ->orderBy('id')
            ->first();

        if (!$fallbackPlan) {
            return;
        }

        SaasPlan::query()->update(['is_default' => false]);
        $fallbackPlan->forceFill(['is_default' => true])->saveQuietly();
    }

    private function syncCompaniesForPlan(SaasPlan $plan): void
    {
        if (!$plan?->id) {
            return;
        }

        Company::query()
            ->where('saas_plan_id', $plan->id)
            ->get(['company_id'])
            ->each(function (Company $company) {
                $this->companyPlanFeatureService->syncCompanyPreferencesToPlan(
                    $company->fresh('saasPlan')
                );
            });
    }
}

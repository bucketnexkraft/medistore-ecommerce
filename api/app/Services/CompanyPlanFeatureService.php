<?php

namespace App\Services;

use App\Data\FeaturePreference;
use App\Models\Company;
use App\Models\CompanyFeaturePreference;
use Illuminate\Support\Facades\DB;

class CompanyPlanFeatureService
{
    /**
     * @return array<int, string>
     */
    public function allowedFeatureCodes(?string $companyId): array
    {
        if (!$companyId) {
            return [];
        }

        $company = Company::query()
            ->with('saasPlan:id,features,status,included_plan_id')
            ->where('company_id', $companyId)
            ->first();

        if (!$company || !$company->saasPlan || !$company->saasPlan->status) {
            return [];
        }

        return $this->normalizedPlanFeatures($company->saasPlan->effectiveFeatures());
    }

    public function isFeatureAllowedByPlan(?string $companyId, string $featureCode): bool
    {
        if (!$companyId || !$featureCode || !in_array($featureCode, FeaturePreference::values(), true)) {
            return false;
        }

        return in_array($featureCode, $this->allowedFeatureCodes($companyId), true);
    }

    public function isFeatureAccessible(?string $companyId, string $featureCode): bool
    {
        if (!$this->isFeatureAllowedByPlan($companyId, $featureCode)) {
            return false;
        }

        if (FeaturePreference::tryFrom($featureCode)?->isCore()) {
            return true;
        }

        $company = Company::query()
            ->where('company_id', $companyId)
            ->first();

        if (!$company) {
            return false;
        }

        return (bool) CompanyFeaturePreference::query()
            ->where('company_id', $companyId)
            ->whereIn('feature', FeaturePreference::storedValuesFor($featureCode))
            ->value('active');
    }

    /**
     * @return array<int, string>
     */
    public function effectiveFeatureCodes(?string $companyId): array
    {
        if (!$companyId) {
            return [];
        }

        $company = Company::query()
            ->with('saasPlan:id,features,status,included_plan_id')
            ->where('company_id', $companyId)
            ->first();

        if (!$company || !$company->saasPlan || !$company->saasPlan->status) {
            return [];
        }

        $planFeatures = $this->normalizedPlanFeatures($company->saasPlan->effectiveFeatures());
        if ($planFeatures === []) {
            return [];
        }

        $preferences = CompanyFeaturePreference::query()
            ->where('company_id', $companyId)
            ->get()
            ->keyBy(fn ($item) => FeaturePreference::normalizeStoredValue($item->feature));

        $allowed = [];

        foreach (FeaturePreference::cases() as $option) {
            if (!in_array($option->value, $planFeatures, true)) {
                continue;
            }

            if ($option->isCore()) {
                $allowed[] = $option->value;
                continue;
            }

            $record = $preferences->get($option->value);
            if ($record && (bool) $record->active) {
                $allowed[] = $option->value;
            }
        }

        return $allowed;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function effectivePreferences(?string $companyId): array
    {
        $allowedCodes = $this->effectiveFeatureCodes($companyId);

        return collect(FeaturePreference::cases())
            ->map(function (FeaturePreference $option) use ($allowedCodes) {
                return [
                    'code' => $option->value,
                    'name' => $option->label(),
                    'description' => $option->description(),
                    'is_active' => in_array($option->value, $allowedCodes, true),
                ];
            })
            ->values()
            ->all();
    }

    public function syncCompanyPreferencesToPlan(Company $company): void
    {
        $company->loadMissing('saasPlan:id,features,default_features,status,included_plan_id');

        $allowedFeatures = [];
        $defaultFeatures = [];
        if ($company->saasPlan && $company->saasPlan->status) {
            $allowedFeatures = $this->normalizedPlanFeatures($company->saasPlan->effectiveFeatures());
            $defaultFeatures = $this->normalizedPlanFeatures($company->saasPlan->effectiveDefaultFeatures());
        }

        DB::transaction(function () use ($company, $allowedFeatures, $defaultFeatures) {
            foreach (FeaturePreference::cases() as $option) {
                $isAllowed = in_array($option->value, $allowedFeatures, true);
                $isDefaultActive = $option->isCore() || in_array($option->value, $defaultFeatures, true);
                $preference = CompanyFeaturePreference::query()->firstOrNew([
                    'company_id' => $company->company_id,
                    'feature' => $option->value,
                ]);
                $wasDefaultActive = $preference->is_default_active;

                if ($option->isCore()) {
                    $preference->active = true;
                } elseif (! $preference->exists || $wasDefaultActive === null) {
                    $preference->active = $isDefaultActive;
                } elseif (! $isAllowed) {
                    $preference->active = false;
                } elseif ($isDefaultActive && ! $wasDefaultActive) {
                    $preference->active = true;
                } elseif (! $isDefaultActive && $wasDefaultActive) {
                    $preference->active = false;
                }

                $preference->is_default_active = $isDefaultActive;
                $preference->save();
            }
        });
    }

    /**
     * @param array<int, mixed> $features
     * @return array<int, string>
     */
    private function normalizedPlanFeatures(array $features): array
    {
        return collect($features)
            ->map(static fn ($feature) => FeaturePreference::normalizeStoredValue((string) $feature))
            ->filter(static fn ($feature) => is_string($feature) && in_array($feature, FeaturePreference::values(), true))
            ->unique()
            ->values()
            ->all();
    }
}

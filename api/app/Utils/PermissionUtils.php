<?php

namespace App\Utils;

use App\Data\FeaturePreference;
use App\Models\CompanyFeaturePreference;
use App\Services\CompanyPlanFeatureService;

class PermissionUtils
{
    public static function isFeatureAccessible(?string $companyId, string $featureCode): bool
    {
        if (!$companyId || !$featureCode) {
            return false;
        }

        if (FeaturePreference::tryFrom($featureCode)?->isCore()) {
            return app(CompanyPlanFeatureService::class)->isFeatureAllowedByPlan($companyId, $featureCode);
        }

        return (bool) CompanyFeaturePreference::query()
            ->where('company_id', $companyId)
            ->whereIn('feature', FeaturePreference::storedValuesFor($featureCode))
            ->value('active');
    }
}

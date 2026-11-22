<?php 

namespace App\Traits;

use App\Support\EcommerceCompanyContext;

trait BelongsToCompany
{
    protected static function bootBelongsToCompany()
    {
        static::creating(function ($model) {
            if (empty($model->company_id)) {
                $companyId = EcommerceCompanyContext::currentCompanyId();

                if ($companyId !== null) {
                    $model->company_id = $companyId;
                }
            }
        });

        static::addGlobalScope('company', function ($builder) {
            $companyId = EcommerceCompanyContext::currentCompanyId();

            if ($companyId !== null) {
                $builder->whereRaw(
                    $builder->qualifyColumn('company_id') . ' COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci',
                    [$companyId]
                );
            }
        });
    }
}

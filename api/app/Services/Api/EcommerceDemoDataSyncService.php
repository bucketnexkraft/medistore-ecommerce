<?php

namespace App\Services\Api;

use App\Models\ECategory;
use Database\Seeders\EcommerceDemoDataSeeder;

class EcommerceDemoDataSyncService
{
    public function syncForCategoryId(?int $categoryId): void
    {
        $this->syncForCompanyAndCategory($categoryId, null);
    }

    public function syncForCompanyAndCategory(?int $categoryId, ?string $companyId): void
    {
        if (empty($categoryId)) {
            return;
        }

        $category = ECategory::query()->find($categoryId);

        if (! $category) {
            return;
        }

        app(EcommerceDemoDataSeeder::class)->seedForCategory((string) $category->name, $companyId);
    }
}

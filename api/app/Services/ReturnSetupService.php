<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ReturnSetup;
use Illuminate\Support\Facades\Auth;

class ReturnSetupService
{
    public function normalizeReturnEnabled($value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    }

    public function normalizeReturnDay($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return max(0, (int) $value);
    }

    public function normalizeReturnCondition($value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_array($value)) {
            $normalized = collect($value)
                ->map(function ($item) {
                    if (is_array($item)) {
                        $item = $item['value'] ?? null;
                    }

                    return is_string($item) ? trim($item) : null;
                })
                ->filter()
                ->values()
                ->all();

            return $normalized !== [] ? $normalized : null;
        }

        if (! is_string($value)) {
            return null;
        }

        $decoded = json_decode($value, true);

        if (! is_array($decoded)) {
            return null;
        }

        return $this->normalizeReturnCondition($decoded);
    }

    public function syncForCategory(Category $category, $returnEnabled, $returnDay, $returnCondition): ?ReturnSetup
    {
        return $this->syncScopedRule(
            $category->company_id ?? Auth::user()?->company_id,
            ['category_id' => $category->id],
            $returnEnabled,
            $returnDay,
            $returnCondition
        );
    }

    public function syncForBrand(Brand $brand, $returnEnabled, $returnDay, $returnCondition): ?ReturnSetup
    {
        return $this->syncScopedRule(
            $brand->company_id ?? Auth::user()?->company_id,
            ['brand_id' => $brand->id],
            $returnEnabled,
            $returnDay,
            $returnCondition
        );
    }

    public function syncForProduct(Product $product, $returnEnabled, $returnDay, $returnCondition): ?ReturnSetup
    {
        return $this->syncScopedRule(
            $product->company_id ?? Auth::user()?->company_id,
            ['product_id' => $product->id],
            $returnEnabled,
            $returnDay,
            $returnCondition
        );
    }

    private function syncScopedRule(?string $companyId, array $scope, $returnEnabled, $returnDay, $returnCondition): ?ReturnSetup
    {
        $normalizedReturnEnabled = $this->normalizeReturnEnabled($returnEnabled);
        $normalizedReturnDay = $this->normalizeReturnDay($returnDay);
        $normalizedReturnCondition = $this->normalizeReturnCondition($returnCondition);

        $query = ReturnSetup::withoutGlobalScope('company')
            ->where('company_id', $companyId)
            ->where('brand_id', $scope['brand_id'] ?? null)
            ->where('product_id', $scope['product_id'] ?? null)
            ->where('category_id', $scope['category_id'] ?? null);

        if (! $this->shouldPersist($normalizedReturnEnabled, $normalizedReturnDay, $normalizedReturnCondition)) {
            $query->delete();

            return null;
        }

        $returnSetup = $query->first() ?? new ReturnSetup();
        $returnSetup->company_id = $companyId;
        $returnSetup->brand_id = $scope['brand_id'] ?? null;
        $returnSetup->product_id = $scope['product_id'] ?? null;
        $returnSetup->category_id = $scope['category_id'] ?? null;
        $returnSetup->return_enabled = $normalizedReturnEnabled
            ?? ($normalizedReturnDay !== null || ! empty($normalizedReturnCondition));
        $returnSetup->return_day = $normalizedReturnDay ?? 0;
        $returnSetup->return_condition = $normalizedReturnCondition;
        $returnSetup->save();

        return $returnSetup;
    }

    private function shouldPersist(?bool $returnEnabled, ?int $returnDay, ?array $returnCondition): bool
    {
        return $returnEnabled !== null || $returnDay !== null || ! empty($returnCondition);
    }
}

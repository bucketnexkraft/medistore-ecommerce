<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductBundle;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ProductBundleService
{
    public function syncItems(ProductBundle $bundle, array $items): void
    {
        $normalizedItems = collect($items)
            ->groupBy('product_id')
            ->map(function (Collection $group) {
                return [
                    'product_id' => $group->first()['product_id'],
                    'quantity' => round((float) $group->sum('quantity'), 2),
                ];
            })
            ->values();

        $bundle->bundleItems()->delete();

        foreach ($normalizedItems as $index => $item) {
            $bundle->bundleItems()->create([
                'bundle_uuid' => $bundle->uuid,
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'sort_order' => $index + 1,
            ]);
        }
    }

    public function calculateBundle(ProductBundle $bundle, ?string $warehouseId = null, float $bundleQty = 1, bool $strictPricing = false): array
    {
        $bundle->loadMissing('bundleItems.product');

        if ($bundle->bundleItems->isEmpty()) {
            throw new \RuntimeException('Bundle must contain at least one product.');
        }

        $components = $bundle->bundleItems->map(function ($bundleItem) use ($warehouseId, $strictPricing) {
            $product = $bundleItem->product;

            if (!$product) {
                throw new \RuntimeException("Bundle item product [{$bundleItem->product_id}] was not found.");
            }

            $unitPrice = $this->resolveProductSellingPrice($product->id, $warehouseId, $strictPricing);
            $quantityPerBundle = (float) $bundleItem->quantity;
            $baseTotalPerBundle = round($unitPrice * $quantityPerBundle, 2);

            return [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity_per_bundle' => $quantityPerBundle,
                'unit_price' => $unitPrice,
                'base_total_per_bundle' => $baseTotalPerBundle,
            ];
        })->values();

        $basePricePerBundle = round((float) $components->sum('base_total_per_bundle'), 2);
        $discountPerBundle = $this->resolveDiscountAmount(
            $bundle->discount_type,
            (float) $bundle->discount_value,
            $basePricePerBundle
        );
        $bundlePricePerBundle = round(max($basePricePerBundle - $discountPerBundle, 0), 2);

        $components = $components->map(function (array $component) use ($basePricePerBundle, $discountPerBundle, $bundleQty) {
            $baseShare = $basePricePerBundle > 0
                ? round(($component['base_total_per_bundle'] / $basePricePerBundle) * $discountPerBundle, 2)
                : 0;

            $discountedTotalPerBundle = round(max($component['base_total_per_bundle'] - $baseShare, 0), 2);
            $effectiveUnitPrice = $component['quantity_per_bundle'] > 0
                ? round($discountedTotalPerBundle / $component['quantity_per_bundle'], 4)
                : 0;

            $component['discount_share_per_bundle'] = $baseShare;
            $component['discounted_total_per_bundle'] = $discountedTotalPerBundle;
            $component['effective_unit_price'] = $effectiveUnitPrice;
            $component['required_quantity'] = round($component['quantity_per_bundle'] * $bundleQty, 2);

            return $component;
        })->values();

        return [
            'bundle_id' => $bundle->id,
            'bundle_name' => $bundle->name,
            'bundle_qty' => $bundleQty,
            'discount_type' => $bundle->discount_type,
            'discount_value' => (float) $bundle->discount_value,
            'base_price_per_bundle' => $basePricePerBundle,
            'discount_amount_per_bundle' => $discountPerBundle,
            'bundle_price_per_bundle' => $bundlePricePerBundle,
            'base_total' => round($basePricePerBundle * $bundleQty, 2),
            'discount_total' => round($discountPerBundle * $bundleQty, 2),
            'bundle_total' => round($bundlePricePerBundle * $bundleQty, 2),
            'components' => $components->all(),
        ];
    }

    public function validateBundleStock(ProductBundle $bundle, string $warehouseId, float $bundleQty = 1): array
    {
        $calculation = $this->calculateBundle($bundle, $warehouseId, $bundleQty, true);

        $components = collect($calculation['components'])->map(function (array $component) use ($warehouseId) {
            $availableQty = round((float) InventoryItem::query()
                ->where('warehouse_id', $warehouseId)
                ->where('product_id', $component['product_id'])
                ->where('quantity', '>', 0)
                ->sum('quantity'), 2);

            $component['available_quantity'] = $availableQty;
            $component['in_stock'] = $availableQty >= $component['required_quantity'];

            return $component;
        });

        $failedComponent = $components->firstWhere('in_stock', false);
        if ($failedComponent) {
            throw new \RuntimeException(
                "Insufficient stock for bundle component [{$failedComponent['product_name']}]. Required {$failedComponent['required_quantity']}, available {$failedComponent['available_quantity']}."
            );
        }

        $calculation['components'] = $components->values()->all();
        return $calculation;
    }

    public function deductBundleStock(ProductBundle $bundle, string $warehouseId, float $bundleQty = 1): array
    {
        $stockValidation = $this->validateBundleStock($bundle, $warehouseId, $bundleQty);
        $componentMap = collect($stockValidation['components'])->keyBy('product_id');
        $allocations = [];

        foreach ($stockValidation['components'] as $component) {
            $remainingQty = (float) $component['required_quantity'];

            $stockRows = InventoryItem::query()
                ->where('warehouse_id', $warehouseId)
                ->where('product_id', $component['product_id'])
                ->where('quantity', '>', 0)
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get();

            foreach ($stockRows as $stockRow) {
                if ($remainingQty <= 0) {
                    break;
                }

                $deductQty = min((float) $stockRow->quantity, $remainingQty);
                $remainingQty = round($remainingQty - $deductQty, 2);

                $stockRow->quantity = round((float) $stockRow->quantity - $deductQty, 2);
                $stockRow->save();

                $inventory = Inventory::query()->lockForUpdate()->find($stockRow->inventory_id);
                if ($inventory) {
                    $inventory->quantity = round((float) $inventory->quantity - $deductQty, 2);
                    $inventory->save();
                }

                $componentData = $componentMap[$component['product_id']];

                $allocations[] = [
                    'product_id' => $component['product_id'],
                    'product_name' => $component['product_name'],
                    'inventory_id' => $stockRow->inventory_id,
                    'inventory_item_id' => $stockRow->id,
                    'lot_number' => $stockRow->lot_number,
                    'barcode' => $stockRow->barcode,
                    'variant_id' => $stockRow->variant_id,
                    'qty' => $deductQty,
                    'effective_unit_price' => $componentData['effective_unit_price'],
                    'original_unit_price' => (float) $stockRow->price,
                    'line_total' => round($deductQty * $componentData['effective_unit_price'], 2),
                ];
            }

            if ($remainingQty > 0) {
                throw new \RuntimeException("Stock allocation failed for bundle component [{$component['product_name']}].");
            }
        }

        $stockValidation['allocations'] = $allocations;
        return $stockValidation;
    }

    public function ensureProductsHaveSellingPrices(array $productIds, ?string $warehouseId = null): void
    {
        $missingPrices = collect($productIds)
            ->filter()
            ->unique()
            ->map(function ($productId) use ($warehouseId) {
                $product = Product::withTrashed()->find($productId);

                if (!$product) {
                    return null;
                }

                $price = $this->resolveProductSellingPrice($productId, $warehouseId, false);

                if ($price <= 0) {
                    return $product->name;
                }

                return null;
            })
            ->filter()
            ->values();

        if ($missingPrices->isNotEmpty()) {
            throw new \RuntimeException(
                'Bundle cannot be saved because these products have no selling price: ' . $missingPrices->implode(', ')
            );
        }
    }

    public function estimateAvailableBundleQuantity(ProductBundle $bundle, ?string $warehouseId = null): float
    {
        $bundle->loadMissing('bundleItems.product');

        if ($bundle->bundleItems->isEmpty()) {
            return 0;
        }

        $limits = $bundle->bundleItems->map(function ($bundleItem) use ($warehouseId) {
            $requiredQty = max((float) $bundleItem->quantity, 0);

            if ($requiredQty <= 0) {
                return 0;
            }

            $availableQty = (float) InventoryItem::query()
                ->where('product_id', $bundleItem->product_id)
                ->when($warehouseId, fn ($query) => $query->where('warehouse_id', $warehouseId))
                ->where('quantity', '>', 0)
                ->sum('quantity');

            return floor($availableQty / $requiredQty);
        })->values();

        return (float) max((float) $limits->min(), 0);
    }

    public function getReservedComponentQuantities(?string $companyId = null): Collection
    {
        $companyId = $companyId ?: Auth::user()?->company_id;

        if (!$companyId) {
            return collect();
        }

        return ProductBundle::query()
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->with('bundleItems:id,product_bundle_id,product_id,quantity')
            ->get()
            ->flatMap(fn(ProductBundle $bundle) => $bundle->bundleItems)
            ->groupBy('product_id')
            ->map(fn(Collection $items) => round((float) $items->sum('quantity'), 2));
    }

    public function getReservedComponentQuantity(string $productId, ?string $companyId = null): float
    {
        return (float) ($this->getReservedComponentQuantities($companyId)->get($productId, 0));
    }

    public function getAdjustedAvailableProductQuantity(
        string $productId,
        ?string $warehouseId = null,
        ?string $companyId = null
    ): float {
        $rawQuantity = $this->getRawAvailableProductQuantity($productId, $warehouseId);

        $reservedQuantity = $this->getReservedComponentQuantity($productId, $companyId);

        return max(round($rawQuantity - $reservedQuantity, 2), 0);
    }

    public function getRawAvailableProductQuantity(string $productId, ?string $warehouseId = null): float
    {
        return (float) InventoryItem::query()
            ->where('product_id', $productId)
            ->when($warehouseId, fn($query) => $query->where('warehouse_id', $warehouseId))
            ->where('quantity', '>', 0)
            ->sum('quantity');
    }

    private function resolveProductSellingPrice(string $productId, ?string $warehouseId = null, bool $strict = false): float
    {
        $query = InventoryItem::query()
            ->where('product_id', $productId)
            ->where('price', '>', 0);

        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }

        $inStockRow = (clone $query)
            ->where('quantity', '>', 0)
            ->orderByDesc('created_at')
            ->first();

        $fallbackRow = $inStockRow ?: (clone $query)
            ->orderByDesc('created_at')
            ->first();

        if (!$fallbackRow) {
            if ($strict) {
                $product = Product::withTrashed()->find($productId);
                $productName = $product?->name ?? $productId;
                throw new \RuntimeException("No selling price found for bundled product [{$productName}].");
            }

            return 0;
        }

        return round((float) $fallbackRow->price, 2);
    }

    private function resolveDiscountAmount(string $discountType, float $discountValue, float $basePrice): float
    {
        $discountAmount = $discountType === 'percentage'
            ? ($basePrice * $discountValue / 100)
            : $discountValue;

        return round(min(max($discountAmount, 0), $basePrice), 2);
    }
}

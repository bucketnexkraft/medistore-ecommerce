<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductBarcode;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\ProductBundle;
use App\Models\DiscountSetup;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ProductSearchService
{
    public function __construct(
        private readonly ProductBundleService $productBundleService
    ) {
    }

    public function search(array $input): array
    {
        $query      = trim($input['query'] ?? '');
        $forReturn  = $input['for_return'] ?? true;
        $customerId = $input['customer_id'] ?? null;
        $warehouseId = $input['warehouse_id'] ?? null;
        $channelCode = $input['channel_code'] ?? null;

        if (empty($query)) {
            return $this->error('Search value is required', 400);
        }

        // Default search method
        $searchMethod = 'none';

        // 1. Try barcode search
        $results = $this->searchByBarcode($query, $warehouseId, $channelCode);
        if (!$results->isEmpty()) {
            $searchMethod = 'barcode';
            return $this->success($this->formatResults($results, $warehouseId, $channelCode), 'Success', $searchMethod);
        }

        // 2. Try name/code search
        $results = $this->searchByNameOrCode($query, $warehouseId, $channelCode);
        if (!$results->isEmpty()) {
            $searchMethod = 'name_or_code';
            return $this->success($this->formatResults($results, $warehouseId, $channelCode), 'Success', $searchMethod);
        }

        // 3. Try invoice search only for return flow
        if (!$forReturn) {
            return $this->success([$this->noProductSuggestion()], 'No product found', 'none');
        }

        $searchMethod = 'invoice';
        $invoiceResult = $this->searchByInvoice($query, $customerId);

        // If invoice search returns an error, keep the method as 'invoice' but return error
        // If it succeeds, enhance it with search_method
        if ($invoiceResult['status'] ?? 0 === 1) {
            $invoiceResult['search_method'] = $searchMethod;
        } else {
            $invoiceResult['search_method'] = $searchMethod; // optional: even on error
        }

        return $invoiceResult;

        return $this->success([$this->noProductSuggestion()], 'No product found', 'none');
    }

    // ===================================================================
    // 1. BARCODE SEARCH – ANY barcode (used or not), 1:N or N:N
    // ===================================================================
    private function searchByBarcode(string $barcode, ?string $warehouseId = null, ?string $channelCode = null): Collection
    {
        // 1. Find **all** barcode rows that match (regular or custom)
        $barcodeRows = ProductBarcode::query()
            ->where(function ($query) use ($barcode) {
                $query->where('barcode', $barcode)
                    ->orWhere('custom_barcode', $barcode);
            })
            ->whereHas('inventoryItem', function ($q) use ($warehouseId) {
                if (!empty($warehouseId)) {
                    $q->where('warehouse_id', $warehouseId);
                }
            })
            ->with([
                'inventoryItem' => fn($q) => $q
                    ->with([
                        'product.category',
                        'product.brand',
                        'salesChannels',
                        'inventory' => fn($i) => $i->select('id', 'stock_out_mood')
                    ])
                    ->when(!empty($warehouseId), fn($x) => $x->where('warehouse_id', $warehouseId))
                    ->whereHas('product', fn($pq) => $pq
                        ->whereNull('product.deleted_at')
                        ->where('product.status', 1))
            ])
            ->get();

        // 2. Filter out rows without a valid inventory item
        $validItems = $barcodeRows
            ->pluck('inventoryItem')
            ->filter(fn($item) => $item);

        if ($validItems->isEmpty()) {
            return collect();
        }

        // 3. Use all valid items directly (no picking one, no unique)
        $results = $validItems;

        // Attach the **matched barcode** to each (custom first)
        foreach ($results as $item) {
            $matchedBarcode = $barcodeRows
                ->firstWhere('inventory_item_id', $item->id);

            $item->matched_barcode = $matchedBarcode->use_custom_barcode && $matchedBarcode->custom_barcode
                ? $matchedBarcode->custom_barcode
                : $matchedBarcode->barcode;
        }

        return $results;
    }

    // ===================================================================
    // 2. NAME / CODE SEARCH – Case-insensitive, show all with stock
    // ===================================================================
        private function searchByNameOrCode(string $query, ?string $warehouseId = null, ?string $channelCode = null): Collection
    {
        $query = trim($query);
        if ($query === '') {
            return collect();
        }

        $lower      = strtolower($query);
        $exact      = $lower;
        $startsWith = $lower . '%';
        $contains   = '%' . $lower . '%';
        $hasProductCodeColumn = Schema::hasColumn('product', 'code');
        $hasProductSkuColumn = Schema::hasColumn('product', 'sku');

        // -----------------------------------------------------------------
        // 1. ALWAYS use LIKE (full‑text is optional and can miss partial words)
        // -----------------------------------------------------------------
        $productsQuery = Product::query()
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->where(function ($q) use ($contains, $hasProductCodeColumn, $hasProductSkuColumn) {
                $q->whereRaw('LOWER(name) LIKE ?', [$contains]);

                if ($hasProductCodeColumn) {
                    $q->orWhereRaw('LOWER(code) LIKE ?', [$contains]);
                }

                if ($hasProductSkuColumn) {
                    $q->orWhereRaw('LOWER(sku) LIKE ?', [$contains]);
                }
            })
            ->with([
                'category',
                'brand',
                'inventory' => fn($q) => $q
                    ->select('id', 'product_id', 'quantity', 'alert_quantity')
                    ->when(!empty($warehouseId), fn($x) => $x->where('warehouse_id', $warehouseId))
                    ->orderBy('created_at'),
                'inventory_items' => fn($q) => $q
                    ->select(
                        'id', 'product_id', 'variant_id', 'inventory_id',
                        'quantity', 'price', 'lot_number', 'expiry_date',
                        'warehouse_id', 'alert_quantity'
                    )
                    ->when(!empty($warehouseId), fn($x) => $x->where('warehouse_id', $warehouseId))
                    ->with([
                        'barcodes' => fn($b) => $b->select('barcode', 'custom_barcode', 'use_custom_barcode'),
                        'salesChannels',
                        'inventory' => fn($i) => $i->select('id', 'stock_out_mood'),
                        'product.category',
                        'product.brand'
                    ])
            ]);

        $scoreSql = "
            CASE
                WHEN LOWER(name) = ? THEN 12
                WHEN LOWER(name) LIKE ? THEN 11
                WHEN LOWER(name) LIKE ? THEN 10
        ";
        $scoreBindings = [$exact, $startsWith, $contains];

        if ($hasProductCodeColumn) {
            $scoreSql .= "
                WHEN LOWER(code) = ? THEN 9
                WHEN LOWER(code) LIKE ? THEN 8
                WHEN LOWER(code) LIKE ? THEN 7
            ";
            $scoreBindings[] = $exact;
            $scoreBindings[] = $startsWith;
            $scoreBindings[] = $contains;
        }

        if ($hasProductSkuColumn) {
            $scoreSql .= "
                WHEN LOWER(sku) = ? THEN 6
                WHEN LOWER(sku) LIKE ? THEN 5
                WHEN LOWER(sku) LIKE ? THEN 4
            ";
            $scoreBindings[] = $exact;
            $scoreBindings[] = $startsWith;
            $scoreBindings[] = $contains;
        }

        $scoreSql .= " ELSE 1 END DESC, name ASC";
        $productsQuery->orderByRaw($scoreSql, $scoreBindings);

        $products = $productsQuery->get();

        // -----------------------------------------------------------------
        // 3. Collect all individual items (no grouping, no summing, no picking one)
        // -----------------------------------------------------------------
        $results = collect();

        foreach ($products as $product) {
            if ($product->inventory_items->isEmpty()) {
                $fallbackInventory = $product->inventory->first();
                $fallbackQuantity = $this->productBundleService->getRawAvailableProductQuantity($product->id, $warehouseId);
                $fallbackItem = new InventoryItem([
                    'id' => null,
                    'product_id' => $product->id,
                    'variant_id' => [],
                    'inventory_id' => $fallbackInventory?->id,
                    'quantity' => (float) $fallbackQuantity,
                    'price' => 0,
                    'lot_number' => null,
                    'expiry_date' => null,
                    'warehouse_id' => $warehouseId,
                    'alert_quantity' => (float) ($fallbackInventory?->alert_quantity ?? 0),
                ]);
                $fallbackItem->matched_barcode = $product->code;
                $fallbackItem->setRelation('product', $product);
                $fallbackItem->setRelation('barcodes', collect());
                $fallbackItem->setRelation('inventory', $fallbackInventory);
                $results->push($fallbackItem);
                continue;
            }

            foreach ($product->inventory_items as $item) {
                $bc = $item->barcodes->first();
                $item->matched_barcode = $bc
                    ? ($bc->use_custom_barcode && $bc->custom_barcode ? $bc->custom_barcode : $bc->barcode)
                    : $product->code;

                $results->push($item);
            }
        }

        return $results->values();
    }


    private function hasFullTextIndex(): bool
    {
        try {
            \DB::statement('SHOW INDEX FROM product WHERE Key_name = "product_name_code_fulltext"');
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    // ===================================================================
    // 3. INVOICE RETURN SEARCH
    // ===================================================================
    private function searchByInvoice(string $invoiceNo, ?string $customerId): array
    {
        $invoiceNo = trim($invoiceNo);

        $query = Invoice::with('customer', 'items.product.category', 'items.product.brand', 'items.product.company')
            ->where('type', 'sale')
            ->where(function ($builder) use ($invoiceNo) {
                $builder
                    ->where('invoice_no', $invoiceNo)
                    ->orWhereRaw('LOWER(invoice_no) = ?', [Str::lower($invoiceNo)])
                    ->orWhere('invoice_no', 'LIKE', '%' . $invoiceNo . '%');
            })
            ->latest('id');

        if ($customerId) {
            $query->where('customer_id', $customerId);
        }

        $invoice = $query->first();

        if (!$invoice || $invoice->items->isEmpty()) {
            return $this->success([], 'No product found', 'invoice');
        }

        return $this->formatInvoiceResponse($invoice);
    }

    private function searchBundles(string $query): Collection
    {
        $hasBundleCodeColumn = Schema::hasColumn('product_bundles', 'code');

        $bundles = ProductBundle::query()
            ->where('is_active', 1)
            ->where(function ($builder) use ($query, $hasBundleCodeColumn) {
                $builder->where('name', 'LIKE', '%' . $query . '%');

                if ($hasBundleCodeColumn) {
                    $builder->orWhere('code', 'LIKE', '%' . $query . '%');
                }
            })
            ->with(['bundleItems.product'])
            ->orderBy('name')
            ->limit(20)
            ->get();

        return $bundles->map(function (ProductBundle $bundle) {
            $summary = $this->productBundleService->calculateBundle($bundle, null, 1, false);
            $bundleQty = max((float) ($bundle->bundle_qty ?? 0), 0);
            $componentLimitedBundles = $this->productBundleService->estimateAvailableBundleQuantity($bundle);
            $availableBundles = (float) max(min($bundleQty, $componentLimitedBundles), 0);

            return [
                'id' => 'bundle-' . $bundle->id,
                'bundle_id' => $bundle->id,
                'item_type' => 'bundle',
                'name' => $bundle->name,
                'barcode' => $bundle->getResolvedBarcode(),
                'default_barcode' => $bundle->getResolvedBarcode(),
                'bundle_qty' => $bundleQty,
                'unitPrice' => (float) $summary['bundle_price_per_bundle'],
                'base_price' => (float) $summary['base_price_per_bundle'],
                'discount' => 0,
                'discount_type' => $bundle->discount_type,
                'discount_value' => (float) $bundle->discount_value,
                'tax' => 0,
                'vat' => 0,
                'vat_rate' => 0,
                'tax_rate' => 0,
                'variant' => 'Bundle',
                'stock' => $availableBundles,
                'available_quantity' => $availableBundles,
                'alert_quantity' => null,
                'is_return' => false,
                'components' => collect($summary['components'] ?? [])->map(function (array $component) {
                    return [
                        'product_id' => $component['product_id'],
                        'product_name' => $component['product_name'],
                        'quantity_per_bundle' => (float) $component['quantity_per_bundle'],
                        'unit_price' => $component['unit_price'],
                        'available_quantity' => $this->productBundleService->getRawAvailableProductQuantity($component['product_id']),
                    ];
                })->values()->all(),
            ];
        });
    }

    // ===================================================================
    // HELPER: Pick one item using LIFO/FIFO/RANDOM
    // ===================================================================
    private function pickOneForSale($productId, $variantId, $mood = 'RANDOM'): ?InventoryItem
    {
        $query = InventoryItem::query()
            ->where('product_id', $productId)
            ->where('quantity', '>', 0)
            ->whereHas('product', fn($pq) => $pq->whereNull('product.deleted_at'))
            ->with(['product', 'barcodes', 'inventory' => fn($q) => $q->select('id', 'stock_out_mood')]);

        $variantKey = $this->variantKey($variantId);
        if ($variantKey !== 'null') {
            $query->whereRaw('variant_id = ?', [$variantKey]);
        }

        return match (strtoupper($mood)) {
            'LIFO' => $query->latest('created_at')->first(),
            'FIFO' => $query->oldest('created_at')->first(),
            default => $query->inRandomOrder()->first(),
        };
    }

    // ===================================================================
    // HELPER: Normalize variant JSON
    // ===================================================================
    private function variantKey($variant): string
    {
        if (empty($variant)) return 'null';
        return is_string($variant) ? $variant : json_encode($variant);
    }

    // ===================================================================
    // HELPER: Remove duplicates
    // ===================================================================
    private function uniqueByVariant(Collection $items): Collection
    {
        return $items->unique(fn($i) => $i->product_id . '_' . $this->variantKey($i->variant_id));
    }

    // ===================================================================
    // FORMAT RESULTS
    // ===================================================================
    private function formatResults(Collection $items, ?string $warehouseId = null, ?string $channelCode = null): array
    {
        return $items->map(function (InventoryItem $item) use ($warehouseId, $channelCode) {
            $product = $item->product;

            $barcode = $item->matched_barcode
                ?? ($item->barcodes->first()?->custom_barcode
                    ? $item->barcodes->first()->custom_barcode
                    : $item->barcodes->first()?->barcode)
                ?? $product->code;

            $discount = $this->calculateDiscount($item, $product);
            $channelQuantity = $channelCode
                ? (float) optional($item->salesChannels->firstWhere('channel_code', $channelCode))->quantity
                : null;
            $adjustedAvailableQuantity = $channelCode
                ? min((float) $item->quantity, max((float) $channelQuantity, 0))
                : $this->productBundleService->getAdjustedAvailableProductQuantity($product->id, $warehouseId);

            return [
                'id'                 => $product->id,
                'name'               => $product->name,
                'barcode'            => $barcode,
                'default_barcode'    => $product->code,
                'category'           => $product?->category?->title,
                'brand'              => $product?->brand?->title,
                'company'            => $product?->company?->name,
                'thumbnail'          => $product->thumbnail,
                'images'             => $product->images,
                'status'             => $product->status,

                'inventory_id'       => $item->inventory_id,
                'inventory_item_id'  => $item->id,
                'lot_number'         => $item->lot_number,
                'warehouse_id'       => $item->warehouse_id,
                'expiry_date'        => $item->expiry_date,
                'unitPrice'          => $item->price,
                'tax'                => $item->tax ?? 0,
                'vat'                => $item->vat ?? 0,
                'vat_rate'           => $item->vat_rate ?? 0,
                'tax_rate'           => $item->tax_rate ?? 0,
                'variant'            => $item->formatVariant($item->variant_id ?? []),
                'available_quantity' => $adjustedAvailableQuantity,
                'alert_quantity'     => $item->alert_quantity ?? null,
                'discount_type'      => $discount['type'],
                'discount'           => round($discount['value'], 2),
                'discount_amount'    => round($discount['amount'], 2),
                'stock'              => $adjustedAvailableQuantity,
                'stock_visibility'   => $product->stock_visibility ?? true,
                'stock_visibility_label' => $product->stock_visibility_label,
                'stock_display'      => $product->stockDisplay($adjustedAvailableQuantity),
                'channel_code'       => $channelCode,
                'is_return'          => false,
            ];
        })->values()->toArray();
    }

    // ===================================================================
    // DISCOUNT
    // ===================================================================
    private function calculateDiscount(InventoryItem $item, Product $product): array
    {
        if ($item->discount_type && $item->discount_amount > 0) {
            $type = $this->normalizeDiscountType($item->discount_type);
            $value = (float) $item->discount_amount;
            $amount = $type === 'percent'
                ? ((float) $item->price * ($value / 100))
                : $value;

            return [
                'type' => $type,
                'value' => $value,
                'amount' => min(max($amount, 0), (float) $item->price),
            ];
        }

        $setupQuery = DiscountSetup::query()
            ->where('type', 'discount')
            ->where('is_active', true)
            ->where(function ($query) use ($product, $item) {
                $query->whereJsonContains('products', (string) $product->id)
                    ->orWhere(function ($scopedQuery) use ($product, $item) {
                        $scopedQuery->where(function ($scopeQuery) use ($product) {
                            $scopeQuery->whereJsonContains('categories', (string) $product->category_id);

                            if (!blank($product->brand_id)) {
                                $scopeQuery->orWhereJsonContains('brands', (string) $product->brand_id);
                            }
                        });

                        if (Schema::hasColumn('discount_setup', 'warehouses')) {
                            $scopedQuery->where(function ($warehouseQuery) use ($item) {
                                $warehouseQuery->whereNull('warehouses')
                                    ->orWhereJsonLength('warehouses', 0)
                                    ->orWhereJsonContains('warehouses', (string) $item->warehouse_id);
                            });
                        }
                    });
            });

        $setup = $setupQuery
            ->whereDate('form_date', '<=', now()->toDateString())
            ->whereDate('to_date', '>=', now()->toDateString())
            ->latest('id')
            ->first();

        if (!$setup) {
            return [
                'type' => 'percent',
                'value' => 0,
                'amount' => 0,
            ];
        }

        $type = $this->normalizeDiscountType($setup->discount_type);
        $value = (float) $setup->amount;
        $amount = $type === 'percent'
            ? ((float) $item->price * ($value / 100))
            : $value;

        return [
            'type' => $type,
            'value' => $value,
            'amount' => min(max($amount, 0), (float) $item->price),
        ];
    }

    private function normalizeDiscountType($discountType): string
    {
        $normalizedType = strtolower(trim((string) $discountType));

        return in_array($normalizedType, ['percent', 'percentage'], true) ? 'percent' : 'fixed';
    }

    // ===================================================================
    // INVOICE RESPONSE
    // ===================================================================
    private function formatInvoiceResponse($invoice): array
    {
        $saleItemIds = $invoice->items->pluck('id')->filter()->values();
        $returnedQtyBySaleItem = InvoiceItem::query()
            ->where('type', 'return')
            ->whereIn('original_sale_item_id', $saleItemIds)
            ->selectRaw('original_sale_item_id, SUM(ABS(qty)) as returned_qty')
            ->groupBy('original_sale_item_id')
            ->pluck('returned_qty', 'original_sale_item_id');

        return [
            'status'     => 1,
            'message'    => 'Invoice search results',
            'is_return'  => true,
            'http_code'  => 200,
            'data'       => [[
                'is_return'  => true,
                'invoice_no' => $invoice->invoice_no,
                'invoice' => $invoice,
                'customer'   => $invoice->customer ? [
                    'id'            => $invoice->customer->id,
                    'name'          => trim("{$invoice->customer->first_name} {$invoice->customer->last_name}"),
                    'phone'         => $invoice->customer->phone,
                    'email'         => $invoice->customer->email,
                    'address'       => $invoice->customer->address,
                    'reward_points' => $invoice->customer->total_reword ?? 0,
                ] : null,
                'products' => $invoice->items->map(function ($item) use ($returnedQtyBySaleItem) {
                    $soldQty = (float) abs($item->qty ?? 0);
                    $returnedQty = (float) ($returnedQtyBySaleItem[$item->id] ?? 0);
                    $returnableQty = max($soldQty - $returnedQty, 0);
                    $inventoryItemId = $item->inventory_item_id;

                    if (empty($inventoryItemId) && !empty($item->inventory_id) && !empty($item->product_id)) {
                        $inventoryItemId = InventoryItem::query()
                            ->where('inventory_id', $item->inventory_id)
                            ->where('product_id', $item->product_id)
                            ->when(!empty($item->lot_number), fn ($q) => $q->where('lot_number', $item->lot_number))
                            ->value('id');
                    }

                    return [
                        'sale_item_id'       => $item->id,
                        'id'                 => $item->product->id,
                        'name'               => $item->product->name,
                        'barcode'            => $this->getBarcode($item),
                        'category'           => $item->product?->category?->title,
                        'brand'              => $item->product?->brand?->title,
                        'company'            => $item->product?->company?->name,
                        'thumbnail'          => $item->product->thumbnail,
                        'images'             => $item->product->images,
                        'status'             => $item->product->status,
                        'inventory_id'       => $item->inventory_id,
                        'inventory_item_id'  => $inventoryItemId,
                        'lot_number'         => $item->lot_number,
                        'warehouse_id'       => $item->warehouse_id,
                        'unitPrice'          => $item->unit_price,
                        'tax_rate'           => $item->tax_rate,
                        'vat_rate'           => $item->vat_rate,
                        'tax'                => $item->tax,
                        'vat'                => $item->vat,
                        'discount'           => $item->discount,
                        'available_quantity' => $item->product->inventory_items->sum('quantity'),
                        'stock'              => $returnableQty,
                        'quantity'           => $returnableQty,
                        'max_quantity'       => $returnableQty,
                        'returnable_qty'     => $returnableQty,
                        'totalPrice'         => $item->total,
                        'is_returned'        => $returnableQty <= 0,
                    ];
                })->toArray(),
            ]],
        ];
    }

    private function getBarcode($item)
    {
        $bc = $item->inventoryItem?->barcodes->first();
        return $bc
            ? ($bc->use_custom_barcode && $bc->custom_barcode ? $bc->custom_barcode : $bc->barcode)
            : $item->product->code;
    }

    // ===================================================================
    // RESPONSE HELPERS
    // ===================================================================
    private function success(array $data = [], string $message = 'Success', string $searchMethod = 'none'): array
    {
        return [
            'status'        => 1,
            'message'       => $message,
            'is_return'     => false,
            'http_code'     => 200,
            'search_method' => $searchMethod ?? 'none',
            'data'          => $data,
        ];
    }

    private function error(string $message, int $httpCode = 200): array
    {
        return [
            'status'     => 0,
            'message'    => $message,
            'http_code'  => $httpCode,
        ];
    }

    private function noProductSuggestion(): array
    {
        return [
            'id' => null,
            'item_type' => 'notice',
            'name' => 'No product found',
            'is_selectable' => false,
            'available_quantity' => 0,
            'stock' => 0,
        ];
    }
}

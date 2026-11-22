<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\StockMovement;
use App\Utils\PermissionUtils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

class StockService
{
    public function stockoutList(Request $request): array
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('filterText', '');
        $filterCategory = $request->input('filterCategory', '');
        $filterBrand = $request->input('filterBrand', '');
        $filterStatus = $request->input('status', '');
        $returnableOnly = filter_var($request->input('returnableOnly', false), FILTER_VALIDATE_BOOLEAN);
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');
        $startDate = $request->input('startDate', '');
        $endDate = $request->input('endDate', '');

        $query = InvoiceItem::query();

        if (!empty($filterCategory)) {
            $categoryIds = [$filterCategory];
            $queue = [$filterCategory];
            while (!empty($queue)) {
                $current = array_shift($queue);
                $children = Category::where('ancestor_id', $current)->pluck('id')->toArray();
                $categoryIds = array_merge($categoryIds, $children);
                $queue = array_merge($queue, $children);
            }
            $query->whereHas('product', function ($q) use ($categoryIds) {
                $q->whereIn('category_id', $categoryIds);
            });
        }

        if (!empty($filterBrand)) {
            $query->whereHas('product', function ($q) use ($filterBrand) {
                $q->where('brand_id', $filterBrand);
            });
        }

        if (!empty($filterText)) {
            $hasCodeColumn = Schema::hasColumn('product', 'code');
            $hasSkuColumn = Schema::hasColumn('product', 'sku');

            $query->where(function ($outerQuery) use ($filterText, $hasCodeColumn, $hasSkuColumn) {
                $outerQuery->whereHas('product', function ($q) use ($filterText, $hasCodeColumn, $hasSkuColumn) {
                    $q->where('name', 'LIKE', "%{$filterText}%");

                    if ($hasCodeColumn) {
                        $q->orWhere('code', 'LIKE', "%{$filterText}%");
                    }

                    if ($hasSkuColumn) {
                        $q->orWhere('sku', 'LIKE', "%{$filterText}%");
                    }
                })->orWhereHas('invoice', function ($q) use ($filterText) {
                    $q->where('invoice_no', 'LIKE', "%{$filterText}%");
                });
            });
        }

        if ($startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        } elseif ($startDate) {
            $query->where('date', '>=', $startDate);
        } elseif ($endDate) {
            $query->where('date', '<=', $endDate);
        }

        if ($filterStatus) {
            $query->where('status', $filterStatus);
        }

        $query->where('type', 'sale');

        if ($returnableOnly) {
            $query->whereNotIn('invoice_id', Invoice::query()
                ->where('type', 'return')
                ->whereNotNull('original_invoice_id')
                ->select('original_invoice_id'))
                ->whereNotIn('invoice_id', InvoiceItem::query()
                ->where('type', 'sale')
                ->whereIn('id', InvoiceItem::query()
                    ->where('type', 'return')
                    ->whereNotNull('original_sale_item_id')
                    ->select('original_sale_item_id'))
                ->select('invoice_id'))
                ->whereHas('invoice', function ($invoiceQuery) {
                    $invoiceQuery
                        ->where('type', 'sale')
                        ->whereNull('original_invoice_id');
                });
        }

        $query->with(['product', 'invoice']);
        $query->orderBy($sortField, $sortOrder);
        $stockouts = $query->paginate($perPage, ['*'], 'page', $page);

        $data = $stockouts->map(function ($sale) {
            $alreadyReturnedQty = abs((float) InvoiceItem::query()
                ->where('original_sale_item_id', $sale->id)
                ->where('type', 'return')
                ->sum('qty'));
            $soldQty = abs((float) $sale->qty);
            $returnableQty = max($soldQty - $alreadyReturnedQty, 0);

            return [
                'id' => $sale->id,
                'invoice_id' => $sale->invoice_id,
                'product_id' => $sale->product_id,
                'inventory_id' => $sale->inventory_id,
                'lot_number' => $sale->lot_number,
                'date' => $sale->invoice ? date('d F Y', strtotime($sale->date)) : null,
                'invoice_number' => $sale->invoice->invoice_no ?? null,
                'name' => $sale->product->name ?? null,
                'code' => $sale->product->code ?? null,
                'thumbnail' => $sale->product->thumbnail ?? null,
                'quantity' => $sale->qty,
                'sold_qty' => $soldQty,
                'returned_qty' => $alreadyReturnedQty,
                'returnable_qty' => $returnableQty,
                'is_fully_returned' => $returnableQty <= 0,
                'unit_price' => $sale->unit_price,
                'total' => $sale->total,
                'tax' => $sale->tax,
                'discount' => $sale->discount_amount,
                'discount_amount' => $sale->discount_amount,
                'vat_rate' => $sale->vat_rate ?? 0,
                'vat' => $sale->vat,
                'variant' => collect($sale->variant_id ?? [])
                    ->map(fn ($val, $key) => ucfirst($key) . ': ' . $val)
                    ->implode(', ') ?: 'N/A',
            ];
        });

        $stockouts->setCollection($data);

        return [
            'status' => 1,
            'message' => 'Product fetched successfully',
            'data' => $stockouts->items(),
            'meta' => [
                'current_page' => $stockouts->currentPage(),
                'per_page' => $stockouts->perPage(),
                'total' => $stockouts->total(),
                'last_page' => $stockouts->lastPage(),
            ],
            'others_data' => [],
        ];
    }

    public function movements(Request $request): array
    {
        $companyId = Auth::user()?->company_id;

        if (!PermissionUtils::isFeatureAccessible($companyId, FeaturePreference::STOCK_MOVEMENT_TIMELINE->value)) {
            return [
                'status' => 0,
                'message' => 'Stock movement timeline feature is disabled.',
            ];
        }

        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $search = $request->input('search');
        $type = $request->input('type');
        $productId = $request->input('product_id');
        $inventoryId = $request->input('inventory_id');
        $warehouseId = $request->input('warehouse_id');
        $startDate = $request->input('startDate', '');
        $endDate = $request->input('endDate', '');

        $query = StockMovement::query()
            ->with([
                'product:id,name,code,thumbnail',
                'warehouse:id,name',
                'createdBy:id,first_name,last_name',
            ])
            ->where('company_id', $companyId);

        if ($request->filled('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', function ($productQuery) use ($search) {
                    $productQuery->where('name', 'LIKE', "%{$search}%")
                        ->orWhere('code', 'LIKE', "%{$search}%");
                })
                    ->orWhere('reference_id', 'LIKE', "%{$search}%")
                    ->orWhere('note', 'LIKE', "%{$search}%");
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $type);
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $productId);
        }

        if ($request->filled('inventory_id')) {
            $query->where('inventory_id', $inventoryId);
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($request->filled('startDate')) {
            $query->whereDate('created_at', '>=', $startDate);
        }

        if ($request->filled('endDate')) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        $summaryQuery = clone $query;
        $movements = $query->latest()->paginate($perPage, ['*'], 'page', $page);

        $data = $movements->getCollection()->map(function ($movement) {
            return [
                'id' => $movement->id,
                'type' => $movement->type,
                'quantity_change' => (float) $movement->quantity_change,
                'quantity_before' => $movement->quantity_before !== null ? (float) $movement->quantity_before : null,
                'quantity_after' => $movement->quantity_after !== null ? (float) $movement->quantity_after : null,
                'reference_type' => $movement->reference_type,
                'reference_id' => $movement->reference_id,
                'note' => $movement->note,
                'created_at' => $movement->created_at?->toIso8601String(),
                'product' => [
                    'id' => $movement->product_id,
                    'name' => $movement->product?->name,
                    'code' => $movement->product?->code,
                    'thumbnail' => $movement->product?->thumbnail,
                ],
                'warehouse' => [
                    'id' => $movement->warehouse_id,
                    'name' => $movement->warehouse?->name,
                ],
                'user' => [
                    'id' => $movement->created_by,
                    'name' => trim(($movement->createdBy?->first_name ?? '') . ' ' . ($movement->createdBy?->last_name ?? '')) ?: null,
                ],
            ];
        });

        $movements->setCollection($data);

        $today = now()->toDateString();
        $todaySummary = (clone $summaryQuery)
            ->whereDate('created_at', $today)
            ->selectRaw('type, SUM(quantity_change) as total_quantity')
            ->groupBy('type')
            ->pluck('total_quantity', 'type')
            ->map(fn ($value) => (float) $value)
            ->toArray();

        return [
            'status' => 1,
            'message' => 'Stock movements fetched successfully',
            'data' => $movements->items(),
            'meta' => [
                'current_page' => $movements->currentPage(),
                'per_page' => $movements->perPage(),
                'total' => $movements->total(),
                'last_page' => $movements->lastPage(),
            ],
            'summary' => [
                'added_today' => $todaySummary['added'] ?? 0,
                'sold_today' => abs($todaySummary['sold'] ?? 0),
                'reserved_today' => abs($todaySummary['reserved'] ?? 0),
                'returned_today' => $todaySummary['returned'] ?? 0,
                'adjusted_today' => $todaySummary['adjusted'] ?? 0,
            ],
        ];
    }
}

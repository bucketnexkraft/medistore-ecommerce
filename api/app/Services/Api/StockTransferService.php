<?php

namespace App\Services\Api;

use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Services\StockMovementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class StockTransferService
{
    public function list(Request $request): array
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('filterText', '');
        $fromWarehouse = $request->input('from_warehouse_id', '');
        $toWarehouse = $request->input('to_warehouse_id', '');
        $startDate = $request->input('startDate', '');
        $endDate = $request->input('endDate', '');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        $query = StockTransfer::with(['fromWarehouse:id,name', 'toWarehouse:id,name', 'items.product:id,name,code']);

        if ($filterText !== '') {
            $query->where(function ($q) use ($filterText) {
                $q->where('transfer_no', 'LIKE', "%{$filterText}%")
                    ->orWhereHas('items.product', function ($pq) use ($filterText) {
                        $pq->where('name', 'LIKE', "%{$filterText}%")
                            ->orWhere('code', 'LIKE', "%{$filterText}%");
                    });
            });
        }

        if ($fromWarehouse) {
            $query->where('from_warehouse_id', $fromWarehouse);
        }
        if ($toWarehouse) {
            $query->where('to_warehouse_id', $toWarehouse);
        }
        if ($startDate) {
            $query->whereDate('transfer_date', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('transfer_date', '<=', $endDate);
        }

        $query->orderBy($sortField, $sortOrder);
        $rows = $query->paginate($perPage, ['*'], 'page', $page);

        $data = collect($rows->items())->map(function ($row) {
            $totalQty = $row->items->sum('qty');
            $totalAmount = $row->items->sum('total');
            $totalBeforeQty = $row->items->sum(function ($item) {
                return $item->before_qty !== null ? (float) $item->before_qty : 0;
            });
            $totalAfterQty = $row->items->sum(function ($item) {
                return $item->after_qty !== null ? (float) $item->after_qty : 0;
            });

            return [
                'id' => $row->id,
                'transfer_no' => $row->transfer_no,
                'transfer_date' => $row->transfer_date,
                'from_warehouse' => $row->fromWarehouse?->name,
                'to_warehouse' => $row->toWarehouse?->name,
                'items_count' => $row->items->count(),
                'total_qty' => (float) $totalQty,
                'total_before_qty' => (float) $totalBeforeQty,
                'total_after_qty' => (float) $totalAfterQty,
                'total_amount' => (float) $totalAmount,
                'note' => $row->note,
                'created_at' => $row->created_at,
            ];
        })->values();

        return [
            'status' => 1,
            'message' => 'Stock transfers fetched successfully',
            'data' => $data,
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ];
    }

    public function sourceItems(Request $request): array
    {
        $warehouseId = $request->input('warehouse_id');
        $search = $request->input('search', '');

        $query = InventoryItem::query()
            ->with(['product:id,name,code'])
            ->where('quantity', '>', 0);

        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($search !== '') {
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('code', 'LIKE', "%{$search}%");
            });
        }

        $items = $query->orderBy('created_at')->limit(100)->get()->map(function ($item) {
            return [
                'inventory_item_id' => $item->id,
                'inventory_id' => $item->inventory_id,
                'warehouse_id' => $item->warehouse_id,
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name,
                'product_code' => $item->product?->code,
                'variant' => $item->formatVariant($item->variant_id ?? []),
                'variant_id' => $item->variant_id,
                'lot_number' => $item->lot_number,
                'available_qty' => (float) $item->quantity,
                'unit_price' => (float) ($item->price ?? 0),
                'alert_quantity' => (float) ($item->alert_quantity ?? 0),
            ];
        })->values();

        return [
            'status' => 1,
            'message' => 'Source stock fetched successfully',
            'data' => $items,
        ];
    }

    public function store(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'from_warehouse_id' => 'required|exists:warehouses,id',
            'to_warehouse_id' => 'required|different:from_warehouse_id|exists:warehouses,id',
            'transfer_date' => 'required|date',
            'note' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.inventory_item_id' => 'required|integer|exists:inventory_items,id',
            'items.*.qty' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            $firstError = $validator->errors()->first();
            return [
                'status' => 0,
                'message' => $firstError ?: 'Validation failed',
                'errors' => $validator->errors(),
            ];
        }

        DB::beginTransaction();
        try {
            $hasTransferAuditColumns = Schema::hasColumn('stock_transfer_items', 'before_qty')
                && Schema::hasColumn('stock_transfer_items', 'after_qty');

            $transfer = StockTransfer::create([
                'company_id' => Auth::user()?->company_id,
                'transfer_no' => $this->generateTransferNo(),
                'from_warehouse_id' => $request->from_warehouse_id,
                'to_warehouse_id' => $request->to_warehouse_id,
                'transfer_date' => $request->transfer_date,
                'note' => $request->note,
                'created_by' => Auth::id(),
            ]);

            foreach ($request->items as $row) {
                $qty = (float) $row['qty'];
                $sourceItem = InventoryItem::query()->lockForUpdate()->findOrFail($row['inventory_item_id']);

                if ((string) $sourceItem->warehouse_id !== (string) $request->from_warehouse_id) {
                    throw new \RuntimeException("Selected stock item does not belong to source warehouse.");
                }

                if ((float) $sourceItem->quantity < $qty) {
                    throw new \RuntimeException("Insufficient quantity for product {$sourceItem->product_id}. Available: {$sourceItem->quantity}");
                }

                $sourceInventory = Inventory::query()->lockForUpdate()->findOrFail($sourceItem->inventory_id);
                $beforeQty = (float) $sourceItem->quantity;

                // Deduct from source
                $sourceBefore = (float) $sourceInventory->quantity;
                $sourceItem->quantity = round((float) $sourceItem->quantity - $qty, 2);
                $sourceItem->save();
                $afterQty = (float) $sourceItem->quantity;
                $sourceInventory->quantity = round(max((float) $sourceInventory->quantity - $qty, 0), 2);
                $sourceInventory->save();

                // Add to destination inventory summary
                $destInventory = Inventory::query()
                    ->lockForUpdate()
                    ->firstOrCreate(
                        [
                            'warehouse_id' => $request->to_warehouse_id,
                            'product_id' => $sourceItem->product_id,
                            'company_id' => Auth::user()?->company_id,
                        ],
                        [
                            'quantity' => 0,
                            'alert_quantity' => $sourceItem->alert_quantity ?? 5,
                            'stock_out_mood' => 'FIFO',
                        ]
                    );
                $destBefore = (float) $destInventory->quantity;
                $destInventory->quantity = round((float) $destInventory->quantity + $qty, 2);
                $destInventory->save();

                // Keep transfer lines auditable by creating destination stock line
                $destItem = new InventoryItem();
                $destItem->inventory_id = $destInventory->id;
                $destItem->company_id = Auth::user()?->company_id;
                $destItem->warehouse_id = $request->to_warehouse_id;
                $destItem->product_id = $sourceItem->product_id;
                $destItem->lot_number = $sourceItem->lot_number;
                $destItem->expiry_date = $sourceItem->expiry_date;
                $destItem->quantity = $qty;
                $destItem->variant_id = $sourceItem->variant_id;
                $destItem->segmentations = $sourceItem->segmentations;
                $destItem->price = $sourceItem->price ?? 0;
                $destItem->purchase_price = $sourceItem->purchase_price ?? 0;
                $destItem->stock_out_mood = $sourceItem->stock_out_mood ?? 'FIFO';
                $destItem->alert_quantity = $sourceItem->alert_quantity ?? 5;
                $destItem->save();

                $transferItem = StockTransferItem::create([
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => $sourceItem->product_id,
                    'from_inventory_id' => $sourceInventory->id,
                    'from_inventory_item_id' => $sourceItem->id,
                    'to_inventory_id' => $destInventory->id,
                    'to_inventory_item_id' => $destItem->id,
                    'lot_number' => $sourceItem->lot_number,
                    'variant_id' => $sourceItem->variant_id,
                    'qty' => $qty,
                    'unit_price' => (float) ($sourceItem->price ?? 0),
                    'total' => round($qty * (float) ($sourceItem->price ?? 0), 2),
                ] + ($hasTransferAuditColumns ? [
                    'before_qty' => $beforeQty,
                    'after_qty' => $afterQty,
                ] : []));

                app(StockMovementService::class)->record([
                    'company_id' => Auth::user()?->company_id,
                    'product_id' => $sourceItem->product_id,
                    'inventory_id' => $sourceInventory->id,
                    'inventory_item_id' => $sourceItem->id,
                    'warehouse_id' => $request->from_warehouse_id,
                    'type' => StockMovementService::TYPE_TRANSFERRED_OUT,
                    'quantity_change' => -1 * $qty,
                    'quantity_before' => $sourceBefore,
                    'quantity_after' => (float) $sourceInventory->quantity,
                    'reference_type' => StockMovementService::REF_STOCK_TRANSFER,
                    'reference_id' => $transferItem->id,
                    'note' => "Transfer {$transfer->transfer_no}",
                ]);

                app(StockMovementService::class)->record([
                    'company_id' => Auth::user()?->company_id,
                    'product_id' => $sourceItem->product_id,
                    'inventory_id' => $destInventory->id,
                    'inventory_item_id' => $destItem->id,
                    'warehouse_id' => $request->to_warehouse_id,
                    'type' => StockMovementService::TYPE_TRANSFERRED_IN,
                    'quantity_change' => $qty,
                    'quantity_before' => $destBefore,
                    'quantity_after' => (float) $destInventory->quantity,
                    'reference_type' => StockMovementService::REF_STOCK_TRANSFER,
                    'reference_id' => $transferItem->id,
                    'note' => "Transfer {$transfer->transfer_no}",
                ]);
            }

            DB::commit();

            return [
                'status' => 1,
                'message' => 'Stock transfer completed successfully',
                'data' => [
                    'id' => $transfer->id,
                    'transfer_no' => $transfer->transfer_no,
                ],
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            return [
                'status' => 0,
                'message' => 'Failed to create stock transfer',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function report(Request $request): array
    {
        $fromDate = $request->input('startDate');
        $toDate = $request->input('endDate');
        $fromWarehouse = $request->input('from_warehouse_id');
        $toWarehouse = $request->input('to_warehouse_id');

        $query = StockTransfer::query()
            ->with(['fromWarehouse:id,name', 'toWarehouse:id,name', 'items.product:id,name,code'])
            ->orderByDesc('transfer_date');

        if ($fromDate) {
            $query->whereDate('transfer_date', '>=', $fromDate);
        }
        if ($toDate) {
            $query->whereDate('transfer_date', '<=', $toDate);
        }
        if ($fromWarehouse) {
            $query->where('from_warehouse_id', $fromWarehouse);
        }
        if ($toWarehouse) {
            $query->where('to_warehouse_id', $toWarehouse);
        }

        $rows = $query->get();
        $data = $rows->map(function ($row) {
            return [
                'transfer_no' => $row->transfer_no,
                'transfer_date' => $row->transfer_date,
                'from_warehouse' => $row->fromWarehouse?->name,
                'to_warehouse' => $row->toWarehouse?->name,
                'items_count' => $row->items->count(),
                'total_qty' => (float) $row->items->sum('qty'),
                'total_amount' => (float) $row->items->sum('total'),
                'items' => $row->items->map(function ($i) {
                    return [
                        'product' => $i->product?->name,
                        'code' => $i->product?->code,
                        'qty' => (float) $i->qty,
                        'unit_price' => (float) $i->unit_price,
                        'total' => (float) $i->total,
                    ];
                })->values(),
            ];
        })->values();

        return [
            'status' => 1,
            'message' => 'Stock transfer report fetched successfully',
            'data' => $data,
            'summary' => [
                'total_transfers' => $data->count(),
                'total_qty' => (float) $data->sum('total_qty'),
                'total_amount' => (float) $data->sum('total_amount'),
            ],
        ];
    }

    private function generateTransferNo(): string
    {
        $today = now()->format('Ymd');
        $count = StockTransfer::query()
            ->whereDate('created_at', now()->toDateString())
            ->count() + 1;

        return "TR-{$today}-" . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }
}

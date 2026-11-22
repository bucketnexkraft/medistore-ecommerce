<?php

namespace App\Services\Api;

use App\Models\CustomerWaitlist;
use App\Models\CustomerWaitlistReservation;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Warehouse;
use App\Services\CustomerWaitlistService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class WaitlistService
{
    public function store(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required',
            'items.*.requested_qty' => 'required|numeric|min:0.01',
            'items.*.notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return [
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $validator->errors()->all(),
            ];
        }

        DB::beginTransaction();

        try {
            $user = Auth::user();
            $warehouseId = $user?->warehouse_id ?? optional(Warehouse::where('is_default', 1)->first())->id;
            $creator = app(CustomerWaitlistService::class);
            $createdItems = [];

            foreach ((array) $request->input('items', []) as $item) {
                $entry = $creator->createWaitlistEntry([
                    'company_id' => $user?->company_id,
                    'warehouse_id' => $warehouseId,
                    'customer_id' => $request->input('customer_id'),
                    'product_id' => $item['product_id'],
                    'requested_qty' => $item['requested_qty'],
                    'notes' => $item['notes'] ?? 'Created from POS dedicated waitlist submit button.',
                ]);

                $entry->loadMissing(['product:id,name,code']);

                $createdItems[] = [
                    'id' => $entry->id,
                    'product_id' => $entry->product_id,
                    'product_name' => $entry->product?->name ?? 'Product',
                    'product_code' => $entry->product?->code,
                    'requested_qty' => (float) $entry->requested_qty,
                    'status' => $entry->status,
                ];
            }

            DB::commit();

            return [
                'status' => 1,
                'message' => 'Waitlist submitted successfully.',
                'data' => $createdItems,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();

            return [
                'status' => 0,
                'message' => $e->getMessage(),
            ];
        }
    }

    public function list(Request $request): array
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = (string) $request->input('filterText', '');
        $status = (string) $request->input('status', '');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        $query = CustomerWaitlist::query()
            ->with(['customer:id,first_name,last_name,phone,email', 'product:id,name,code', 'reservations']);

        if ($filterText !== '') {
            $query->where(function ($q) use ($filterText) {
                $q->whereHas('product', function ($pq) use ($filterText) {
                    $pq->where('name', 'LIKE', "%{$filterText}%")
                        ->orWhere('code', 'LIKE', "%{$filterText}%");
                })->orWhereHas('customer', function ($cq) use ($filterText) {
                    $cq->where('first_name', 'LIKE', "%{$filterText}%")
                        ->orWhere('last_name', 'LIKE', "%{$filterText}%")
                        ->orWhere('phone', 'LIKE', "%{$filterText}%")
                        ->orWhere('email', 'LIKE', "%{$filterText}%");
                });
            });
        }

        if ($status !== '') {
            $query->where('status', $status);
        }

        $allowedSorts = ['created_at', 'updated_at', 'requested_qty', 'fulfilled_qty', 'status'];
        if (!in_array($sortField, $allowedSorts, true)) {
            $sortField = 'created_at';
        }
        $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortField, $sortOrder);

        $rows = $query->paginate($perPage, ['*'], 'page', $page);

        $data = collect($rows->items())->map(function ($row) {
            return [
                'id' => $row->id,
                'warehouse_id' => $row->warehouse_id,
                'product' => [
                    'id' => $row->product_id,
                    'name' => $row->product?->name,
                    'code' => $row->product?->code,
                ],
                'customer' => [
                    'id' => $row->customer_id,
                    'name' => trim(($row->customer?->first_name ?? '') . ' ' . ($row->customer?->last_name ?? '')),
                    'phone' => $row->customer?->phone,
                    'email' => $row->customer?->email,
                ],
                'requested_qty' => (float) $row->requested_qty,
                'fulfilled_qty' => (float) $row->fulfilled_qty,
                'remaining_qty' => max((float) $row->requested_qty - (float) $row->fulfilled_qty, 0),
                'status' => $row->status,
                'notes' => $row->notes,
                'notified_at' => $row->notified_at,
                'closed_at' => $row->closed_at,
                'created_at' => $row->created_at,
                'reservations_count' => $row->reservations->count(),
                'reserved_qty' => (float) $row->reservations->where('status', 'reserved')->sum('reserved_qty'),
            ];
        })->values();

        return [
            'status' => 1,
            'message' => 'Waitlists fetched successfully',
            'data' => $data,
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ];
    }

    public function show(string $id): array
    {
        $waitlist = CustomerWaitlist::with([
            'customer:id,first_name,last_name,phone,email',
            'product:id,name,code',
            'reservations',
        ])->findOrFail($id);

        return [
            'status' => 1,
            'message' => 'Waitlist fetched successfully',
            'data' => $waitlist,
        ];
    }

    public function claim(string $id): array
    {
        DB::beginTransaction();
        try {
            $waitlist = CustomerWaitlist::query()->lockForUpdate()->findOrFail($id);

            $reservedRows = CustomerWaitlistReservation::query()
                ->where('waitlist_id', $waitlist->id)
                ->where('status', 'reserved')
                ->lockForUpdate()
                ->get();

            if ($reservedRows->isEmpty()) {
                throw new \RuntimeException('No reserved quantity found to claim.');
            }

            foreach ($reservedRows as $row) {
                $row->status = 'claimed';
                $row->note = 'Claimed by cashier';
                $row->save();
            }

            $waitlist->status = 'completed';
            $waitlist->closed_at = now();
            $waitlist->notes = trim(($waitlist->notes ? $waitlist->notes . ' | ' : '') . 'Claimed by user: ' . (Auth::id() ?? 'system'));
            $waitlist->save();

            DB::commit();
            return ['status' => 1, 'message' => 'Waitlist claimed successfully', 'data' => $waitlist];
        } catch (\Throwable $e) {
            DB::rollBack();
            return ['status' => 0, 'message' => $e->getMessage()];
        }
    }

    public function release(string $id): array
    {
        DB::beginTransaction();
        try {
            $waitlist = CustomerWaitlist::query()->lockForUpdate()->findOrFail($id);
            $reservedRows = CustomerWaitlistReservation::query()
                ->where('waitlist_id', $waitlist->id)
                ->where('status', 'reserved')
                ->lockForUpdate()
                ->get();

            if ($reservedRows->isEmpty()) {
                throw new \RuntimeException('No reserved rows found to release.');
            }

            $releasedQty = 0;
            foreach ($reservedRows as $row) {
                if ($row->inventory_item_id) {
                    $inventoryItem = InventoryItem::query()->lockForUpdate()->find($row->inventory_item_id);
                    if ($inventoryItem) {
                        $inventoryItem->quantity = round((float) $inventoryItem->quantity + (float) $row->reserved_qty, 2);
                        $inventoryItem->save();
                    }
                }

                if ($row->inventory_id) {
                    $inventory = Inventory::query()->lockForUpdate()->find($row->inventory_id);
                    if ($inventory) {
                        $inventory->quantity = round((float) $inventory->quantity + (float) $row->reserved_qty, 2);
                        $inventory->save();
                    }
                }

                $releasedQty += (float) $row->reserved_qty;
                $row->status = 'released';
                $row->note = 'Released by cashier/admin';
                $row->save();
            }

            $waitlist->fulfilled_qty = round(max((float) $waitlist->fulfilled_qty - $releasedQty, 0), 2);
            $waitlist->status = $waitlist->fulfilled_qty > 0 ? 'partially_reserved' : 'pending';
            $waitlist->save();

            DB::commit();
            return ['status' => 1, 'message' => 'Reserved quantities released successfully', 'data' => $waitlist];
        } catch (\Throwable $e) {
            DB::rollBack();
            return ['status' => 0, 'message' => $e->getMessage()];
        }
    }

    public function cancel(string $id): array
    {
        DB::beginTransaction();
        try {
            $waitlist = CustomerWaitlist::query()->lockForUpdate()->findOrFail($id);
            if (in_array($waitlist->status, ['completed', 'cancelled'], true)) {
                throw new \RuntimeException('This waitlist is already closed.');
            }

            $reservedRows = CustomerWaitlistReservation::query()
                ->where('waitlist_id', $waitlist->id)
                ->where('status', 'reserved')
                ->lockForUpdate()
                ->get();

            foreach ($reservedRows as $row) {
                if ($row->inventory_item_id) {
                    $inventoryItem = InventoryItem::query()->lockForUpdate()->find($row->inventory_item_id);
                    if ($inventoryItem) {
                        $inventoryItem->quantity = round((float) $inventoryItem->quantity + (float) $row->reserved_qty, 2);
                        $inventoryItem->save();
                    }
                }
                if ($row->inventory_id) {
                    $inventory = Inventory::query()->lockForUpdate()->find($row->inventory_id);
                    if ($inventory) {
                        $inventory->quantity = round((float) $inventory->quantity + (float) $row->reserved_qty, 2);
                        $inventory->save();
                    }
                }
                $row->status = 'released';
                $row->note = 'Released due to waitlist cancellation';
                $row->save();
            }

            $waitlist->status = 'cancelled';
            $waitlist->closed_at = now();
            $waitlist->save();

            DB::commit();
            return ['status' => 1, 'message' => 'Waitlist cancelled successfully', 'data' => $waitlist];
        } catch (\Throwable $e) {
            DB::rollBack();
            return ['status' => 0, 'message' => $e->getMessage()];
        }
    }
}


<?php

namespace App\Services;

use App\Jobs\SendTemplatedEmail;
use App\Models\CustomerWaitlist;
use App\Models\CustomerWaitlistReservation;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Services\StockMovementService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CustomerWaitlistService
{
    public function notifyPendingForProductOnRestock(string $productId, ?string $warehouseId, ?string $companyId): array
    {
        $notified = [];
        $baseQuery = CustomerWaitlist::query()
            ->where('product_id', $productId)
            ->whereIn('status', ['pending', 'partially_reserved', 'reserved'])
            ->orderBy('created_at');

        $waitlists = (clone $baseQuery)
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->when($companyId, fn($q) => $q->where('company_id', $companyId))
            ->get();

        // Fallback for legacy rows where company_id may be null/mismatched.
        if ($waitlists->isEmpty() && $companyId) {
            $waitlists = (clone $baseQuery)
                ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
                ->get();
        }

        // Fallback for warehouse mismatch/null in older rows.
        if ($waitlists->isEmpty()) {
            $waitlists = $baseQuery->get();
        }


        foreach ($waitlists as $waitlist) {
            $this->notifyCustomerRestockOnly($waitlist);

            $waitlist->status = 'notified';
            $waitlist->notified_at = now();
            $waitlist->save();

            $notified[] = [
                'waitlist_id' => $waitlist->id,
                'customer_id' => $waitlist->customer_id,
                'product_id' => $waitlist->product_id,
            ];
        }

        return $notified;
    }

    public function createWaitlistEntry(array $data): CustomerWaitlist
    {
        $id = (string) Str::uuid();
        $now = now();

        DB::table('customer_waitlists')->insert([
            'id' => $id,
            'company_id' => $data['company_id'] ?? null,
            'warehouse_id' => $data['warehouse_id'] ?? null,
            'customer_id' => $data['customer_id'] ?? null,
            'product_id' => $data['product_id'],
            'requested_qty' => (float) ($data['requested_qty'] ?? 0),
            'fulfilled_qty' => 0,
            'status' => 'pending',
            'notes' => $data['notes'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $created = CustomerWaitlist::query()->withoutGlobalScopes()->find($id);
        if (!$created) {
            Log::error('Waitlist insert verification failed', [
                'waitlist_id' => $id,
                'payload' => $data,
            ]);
            throw new \RuntimeException('Failed to persist waitlist entry');
        }

        return $created;
    }

    public function reservePendingForProduct(string $productId, ?string $warehouseId, ?string $companyId): array
    {
        $reservedSummary = [];

        $waitlists = CustomerWaitlist::query()
            ->where('product_id', $productId)
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->when($companyId, fn($q) => $q->where('company_id', $companyId))
            ->whereIn('status', ['pending', 'partially_reserved'])
            ->orderBy('created_at')
            ->lockForUpdate()
            ->get();

        if ($waitlists->isEmpty()) {
            return $reservedSummary;
        }

        $stockRows = InventoryItem::query()
            ->where('product_id', $productId)
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->where('quantity', '>', 0)
            ->orderBy('created_at')
            ->lockForUpdate()
            ->get();

        $inventoryRows = Inventory::query()
            ->where('product_id', $productId)
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->where('quantity', '>', 0)
            ->orderBy('created_at')
            ->lockForUpdate()
            ->get();

        foreach ($waitlists as $waitlist) {
            $remaining = max((float) $waitlist->requested_qty - (float) $waitlist->fulfilled_qty, 0);
            if ($remaining <= 0) {
                continue;
            }

            $reservedNow = 0;
            foreach ($stockRows as $stockRow) {
                if ($remaining <= 0) {
                    break;
                }

                $available = (float) $stockRow->quantity;
                if ($available <= 0) {
                    continue;
                }

                $reserveQty = min($available, $remaining);
                $inventoryBefore = null;
                $inventoryAfter = null;
                $stockRow->quantity = round($available - $reserveQty, 2);
                $stockRow->save();

                if ($stockRow->inventory_id) {
                    $inventory = Inventory::query()->lockForUpdate()->find($stockRow->inventory_id);
                    if ($inventory) {
                        $inventoryBefore = (float) $inventory->quantity;
                        $inventory->quantity = round(max((float) $inventory->quantity - $reserveQty, 0), 2);
                        $inventory->save();
                        $inventoryAfter = (float) $inventory->quantity;
                    }
                }

                CustomerWaitlistReservation::create([
                    'waitlist_id' => $waitlist->id,
                    'inventory_id' => $stockRow->inventory_id,
                    'inventory_item_id' => $stockRow->id,
                    'reserved_qty' => $reserveQty,
                    'reserved_at' => now(),
                    'expires_at' => now()->addHours(48),
                    'status' => 'reserved',
                    'note' => 'Auto-reserved on restock',
                ]);

                $reservedNow += $reserveQty;
                $remaining -= $reserveQty;

                app(StockMovementService::class)->record([
                    'company_id' => $waitlist->company_id,
                    'product_id' => $waitlist->product_id,
                    'inventory_id' => $stockRow->inventory_id,
                    'inventory_item_id' => $stockRow->id,
                    'warehouse_id' => $stockRow->warehouse_id ?? $waitlist->warehouse_id,
                    'type' => StockMovementService::TYPE_RESERVED,
                    'quantity_change' => -1 * $reserveQty,
                    'quantity_before' => $inventoryBefore,
                    'quantity_after' => $inventoryAfter,
                    'reference_type' => StockMovementService::REF_WAITLIST,
                    'reference_id' => $waitlist->id,
                    'note' => 'Auto-reserved on restock',
                    'created_by' => null,
                ]);
            }

            // Fallback allocation path for stock sources that only update `inventory` table
            if ($remaining > 0) {
                foreach ($inventoryRows as $inventoryRow) {
                    if ($remaining <= 0) {
                        break;
                    }

                    $available = (float) $inventoryRow->quantity;
                    if ($available <= 0) {
                        continue;
                    }

                    $reserveQty = min($available, $remaining);
                    $inventoryBefore = (float) $inventoryRow->quantity;
                    $inventoryRow->quantity = round($available - $reserveQty, 2);
                    $inventoryRow->save();

                    CustomerWaitlistReservation::create([
                        'waitlist_id' => $waitlist->id,
                        'inventory_id' => $inventoryRow->id,
                        'inventory_item_id' => null,
                        'reserved_qty' => $reserveQty,
                        'reserved_at' => now(),
                        'expires_at' => now()->addHours(48),
                        'status' => 'reserved',
                        'note' => 'Auto-reserved on restock (inventory fallback)',
                    ]);

                    $reservedNow += $reserveQty;
                    $remaining -= $reserveQty;

                    app(StockMovementService::class)->record([
                        'company_id' => $waitlist->company_id,
                        'product_id' => $waitlist->product_id,
                        'inventory_id' => $inventoryRow->id,
                        'warehouse_id' => $inventoryRow->warehouse_id ?? $waitlist->warehouse_id,
                        'type' => StockMovementService::TYPE_RESERVED,
                        'quantity_change' => -1 * $reserveQty,
                        'quantity_before' => $inventoryBefore,
                        'quantity_after' => (float) $inventoryRow->quantity,
                        'reference_type' => StockMovementService::REF_WAITLIST,
                        'reference_id' => $waitlist->id,
                        'note' => 'Auto-reserved on restock',
                        'created_by' => null,
                    ]);
                }
            }

            if ($reservedNow > 0) {
                $waitlist->fulfilled_qty = round((float) $waitlist->fulfilled_qty + $reservedNow, 2);
                $isFullyReserved = $waitlist->fulfilled_qty >= $waitlist->requested_qty;
                $waitlist->status = $isFullyReserved ? 'reserved' : 'partially_reserved';
                $waitlist->notified_at = now();
                $waitlist->save();

                $this->notifyCustomer($waitlist->id, $reservedNow, $isFullyReserved);
                $reservedSummary[] = [
                    'waitlist_id' => $waitlist->id,
                    'reserved_qty' => $reservedNow,
                    'fully_reserved' => $isFullyReserved,
                ];
            }
        }

        return $reservedSummary;
    }

    protected function notifyCustomer(string $waitlistId, float $reservedQty, bool $isFullyReserved): void
    {
        $waitlist = CustomerWaitlist::with(['customer', 'product'])->find($waitlistId);
        if (!$waitlist) {
            return;
        }

        $customer = $waitlist->customer;
        $product = $waitlist->product;
        $productName = $product?->name ?? 'Product';
        $statusText = $isFullyReserved ? 'fully reserved' : 'partially reserved';
        $message = "Your requested item {$productName} is back in stock. {$reservedQty} unit(s) have been {$statusText} for you.";

        if ($customer?->email) {
            Log::info('Queueing waitlist restock email', [
                'waitlist_id' => $waitlist->id,
                'customer_id' => $customer->id,
                'email' => $customer->email,
                'template_key' => 'waitlist_restock',
            ]);
            SendTemplatedEmail::dispatch($customer->email, 'waitlist_restock', [
                'name' => trim(($customer->first_name ?? '') . ' ' . ($customer->last_name ?? '')) ?: 'Customer',
                'product_name' => $productName,
                'requested_qty' => (float) $waitlist->requested_qty,
                'message' => $message,
            ])->afterCommit();
        }

        // Email-only mode: no DB notification entry is created.
    }

    protected function notifyCustomerRestockOnly(CustomerWaitlist $waitlist): void
    {
        $waitlist->loadMissing(['customer', 'product']);
        $customer = $waitlist->customer;
        $product = $waitlist->product;
        $productName = $product?->name ?? 'Product';
        $message = "Your requested item {$productName} is now back in stock. Please visit the store to complete purchase.";

        if ($customer?->email) {
           
            SendTemplatedEmail::dispatch($customer->email, 'waitlist_restock', [
                'name' => trim(($customer->first_name ?? '') . ' ' . ($customer->last_name ?? '')) ?: 'Customer',
                'product_name' => $productName,
                'requested_qty' => (float) $waitlist->requested_qty,
                'message' => $message,
            ])->afterCommit();
        }

        // Email-only mode: no DB notification entry is created.
    }
}

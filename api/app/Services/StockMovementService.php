<?php

namespace App\Services;

use App\Data\FeaturePreference;
use App\Models\StockMovement;
use App\Utils\PermissionUtils;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

class StockMovementService
{
    public const TYPE_ADDED = 'added';
    public const TYPE_RESERVED = 'reserved';
    public const TYPE_SOLD = 'sold';
    public const TYPE_ADJUSTED = 'adjusted';
    public const TYPE_RETURNED = 'returned';
    public const TYPE_PURCHASE_RETURNED = 'purchase_returned';
    public const TYPE_TRANSFERRED_IN = 'transferred_in';
    public const TYPE_TRANSFERRED_OUT = 'transferred_out';

    public const REF_INVOICE = 'invoice';
    public const REF_INVOICE_ITEM = 'invoice_item';
    public const REF_PURCHASE = 'purchase';
    public const REF_PURCHASE_RETURN = 'purchase_return';
    public const REF_SALES_RETURN = 'sales_return';
    public const REF_WAITLIST = 'waitlist';
    public const REF_STOCK_TRANSFER = 'stock_transfer';
    public const REF_MANUAL_ADJUSTMENT = 'manual_adjustment';

    private ?bool $hasTable = null;

    public function record(array $data): ?StockMovement
    {
        if (!$this->canRecord($data['company_id'] ?? Auth::user()?->company_id)) {
            return null;
        }

        return StockMovement::create([
            'company_id' => $data['company_id'] ?? Auth::user()?->company_id,
            'product_id' => $data['product_id'] ?? null,
            'inventory_id' => $data['inventory_id'] ?? null,
            'inventory_item_id' => $data['inventory_item_id'] ?? null,
            'warehouse_id' => $data['warehouse_id'] ?? null,
            'type' => $data['type'],
            'quantity_change' => round((float) ($data['quantity_change'] ?? 0), 6),
            'quantity_before' => isset($data['quantity_before']) ? round((float) $data['quantity_before'], 6) : null,
            'quantity_after' => isset($data['quantity_after']) ? round((float) $data['quantity_after'], 6) : null,
            'reference_type' => $data['reference_type'] ?? null,
            'reference_id' => isset($data['reference_id']) ? (string) $data['reference_id'] : null,
            'note' => $data['note'] ?? null,
            'created_by' => $data['created_by'] ?? Auth::id(),
        ]);
    }

    private function canRecord(?string $companyId): bool
    {
        if ($this->hasTable === null) {
            $this->hasTable = Schema::hasTable('stock_movements');
        }

        return $this->hasTable
            && PermissionUtils::isFeatureAccessible($companyId, FeaturePreference::STOCK_MOVEMENT_TIMELINE->value);
    }
}

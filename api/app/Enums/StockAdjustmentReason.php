<?php

namespace App\Enums;

enum StockAdjustmentReason: string
{
    case STOCK_COUNT_CORRECTION = 'stock_count_correction';
    case DAMAGED = 'damaged';
    case EXPIRED = 'expired';
    case LOST = 'lost';
    case INTERNAL_USE = 'internal_use';
    case FOUND_STOCK = 'found_stock';
    case SUPPLIER_SHORTAGE = 'supplier_shortage';
    case OTHER = 'other';

    public function label(): string
    {
        return match ($this) {
            self::STOCK_COUNT_CORRECTION => 'Stock Count Correction',
            self::DAMAGED => 'Damaged',
            self::EXPIRED => 'Expired',
            self::LOST => 'Lost',
            self::INTERNAL_USE => 'Internal Use',
            self::FOUND_STOCK => 'Found Stock',
            self::SUPPLIER_SHORTAGE => 'Supplier Shortage',
            self::OTHER => 'Other',
        };
    }

    public function allowsNegativeAdjustment(): bool
    {
        return match ($this) {
            self::STOCK_COUNT_CORRECTION,
            self::DAMAGED,
            self::EXPIRED,
            self::LOST => true,
            default => false,
        };
    }

    public function requiresNote(): bool
    {
        return $this === self::OTHER;
    }

    public static function options(): array
    {
        return array_map(fn (self $reason) => [
            'value' => $reason->value,
            'label' => $reason->label(),
            'allows_negative_adjustment' => $reason->allowsNegativeAdjustment(),
            'requires_note' => $reason->requiresNote(),
        ], self::cases());
    }
}

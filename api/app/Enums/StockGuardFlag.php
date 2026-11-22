<?php

namespace App\Enums;

enum StockGuardFlag: string
{
    case HIGH_QUANTITY = 'high_quantity';
    case HIGH_VALUE = 'high_value';
    case SUSPICIOUS_REASON = 'suspicious_reason';

    public function label(): string
    {
        return match ($this) {
            self::HIGH_QUANTITY => 'High Quantity',
            self::HIGH_VALUE => 'High Value',
            self::SUSPICIOUS_REASON => 'Suspicious Reason',
        };
    }
}

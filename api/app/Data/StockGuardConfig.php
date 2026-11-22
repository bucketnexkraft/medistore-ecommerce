<?php

namespace App\Data;

use App\Enums\StockAdjustmentReason;
use App\Enums\StockGuardFlag;

final class StockGuardConfig
{
    public const UNIT_THRESHOLD = 5;
    public const VALUE_THRESHOLD = 100;

    public static function requiresApproval(float $qtyChange, float $unitCost = 0, ?float $unitThreshold = null, ?float $valueThreshold = null): bool
    {
        $resolvedUnitThreshold = self::normalizeUnitThreshold($unitThreshold);
        $resolvedValueThreshold = self::normalizeValueThreshold($valueThreshold);

        return abs($qtyChange) >= $resolvedUnitThreshold
            || abs($qtyChange * $unitCost) >= $resolvedValueThreshold;
    }

    public static function flags(
        float $qtyChange,
        float $unitCost,
        StockAdjustmentReason $reason,
        ?float $unitThreshold = null,
        ?float $valueThreshold = null
    ): array
    {
        $flags = [];
        $resolvedUnitThreshold = self::normalizeUnitThreshold($unitThreshold);
        $resolvedValueThreshold = self::normalizeValueThreshold($valueThreshold);

        if (abs($qtyChange) >= $resolvedUnitThreshold) {
            $flags[] = StockGuardFlag::HIGH_QUANTITY;
        }

        if (abs($qtyChange * $unitCost) >= $resolvedValueThreshold) {
            $flags[] = StockGuardFlag::HIGH_VALUE;
        }

        if ($qtyChange < 0 && !$reason->allowsNegativeAdjustment()) {
            $flags[] = StockGuardFlag::SUSPICIOUS_REASON;
        }

        return $flags;
    }

    public static function options(?float $unitThreshold = null, ?float $valueThreshold = null): array
    {
        return [
            'unit_threshold' => self::normalizeUnitThreshold($unitThreshold),
            'value_threshold' => self::normalizeValueThreshold($valueThreshold),
        ];
    }

    private static function normalizeUnitThreshold(?float $value): float
    {
        return $value !== null && $value > 0 ? $value : self::UNIT_THRESHOLD;
    }

    private static function normalizeValueThreshold(?float $value): float
    {
        return $value !== null && $value > 0 ? $value : self::VALUE_THRESHOLD;
    }
}

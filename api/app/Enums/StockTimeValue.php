<?php

namespace App\Enums;

enum StockTimeValue: string
{
    case Day_0130 = 'Day_0130';
    case Day_3160 = 'Day_3160';
    case Day61Above = 'Day61Above';

    public function name(): string
    {
        return match ($this) {
            self::Day_0130 => 'Day 1-30',
            self::Day_3160 => 'Day 31-60',
            self::Day61Above => 'Day 61+',
        };
    }

    public function value(): string
    {
        return match ($this) {
            self::Day_0130 => '100%',
            self::Day_3160 => '90%',
            self::Day61Above => 'Recommend discount / bundle',
        };
    }

    public function toArray(): array
    {
        return [
            'code' => $this->value,
            'name' => $this->name(),
            'value' => $this->value(),
        ];
    }

    public static function fromAgeInDays(int $days): self
    {
        if ($days <= 30) {
            return self::Day_0130;
        }

        if ($days <= 60) {
            return self::Day_3160;
        }

        return self::Day61Above;
    }

    public static function options(): array
    {
        return array_map(
            static fn (self $item) => $item->toArray(),
            self::cases()
        );
    }
}

<?php

namespace App\Enums;

enum TemplateTypes: string
{
    case Free = 'FREE';
    case Premium = 'PRMT';
    case PremiumSingleUse = 'PTSU';

    public function label(): string
    {
        return match ($this) {
            self::Free => 'Free',
            self::Premium => 'Premium',
            self::PremiumSingleUse => 'Premium Single Use',
        };
    }

    public function isFree(): bool
    {
        return $this === self::Free;
    }

    public function toArray(): array
    {
        return [
            'code' => $this->value,
            'value' => $this->label(),
        ];
    }

    public static function fromValue(?string $value): self
    {
        $normalized = strtolower(trim((string) $value));

        return match ($normalized) {
            'free' => self::Free,
            'paid', 'premium', 'premimum', 'prmt' => self::Premium,
            'premium single use', 'premium_single_use', 'ptsu' => self::PremiumSingleUse,
            default => self::tryFrom((string) $value) ?? self::Premium,
        };
    }

    public static function isFreeValue(?string $value): bool
    {
        return self::fromValue($value)->isFree();
    }

    public static function values(): array
    {
        return array_map(
            fn (self $type) => $type->value,
            self::cases()
        );
    }

    public static function options(): array
    {
        return array_map(
            fn (self $type) => $type->toArray(),
            self::cases()
        );
    }
}

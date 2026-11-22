<?php

namespace App\Enums;

enum SalesChannel: string
{
    case OnlineStore = 'OS';
    case PosStore = 'POS';
    case Wholesale = 'WS';

    public function label(): string
    {
        return match ($this) {
            self::OnlineStore => 'Online Store',
            self::PosStore => 'POS Store',
            self::Wholesale => 'Wholesale',
        };
    }

    public function toArray(): array
    {
        return [
            'code' => $this->value,
            'value' => $this->label(),
        ];
    }

    public static function options(): array
    {
        return array_map(
            fn (self $channel) => $channel->toArray(),
            self::cases()
        );
    }
}

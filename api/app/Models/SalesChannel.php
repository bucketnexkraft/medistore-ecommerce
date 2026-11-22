<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SalesChannel extends Model
{
    protected $table = 'sales_channels';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'inventory_id',
        'channel_code',
        'quantity',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_id', 'id');
    }
}

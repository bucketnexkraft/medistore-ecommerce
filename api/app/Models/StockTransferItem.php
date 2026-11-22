<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockTransferItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_transfer_id',
        'product_id',
        'from_inventory_id',
        'from_inventory_item_id',
        'to_inventory_id',
        'to_inventory_item_id',
        'lot_number',
        'variant_id',
        'qty',
        'before_qty',
        'after_qty',
        'unit_price',
        'total',
    ];

    protected $casts = [
        'variant_id' => 'array',
        'qty' => 'decimal:2',
        'before_qty' => 'decimal:2',
        'after_qty' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function transfer()
    {
        return $this->belongsTo(StockTransfer::class, 'stock_transfer_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}

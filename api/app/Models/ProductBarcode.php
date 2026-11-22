<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Product;

class ProductBarcode extends Model
{
    use HasFactory, BelongsToCompany;
    protected $table = 'inventory_item_barcode';
    protected $guarded = [];

    protected $fillable = [
        'company_id',
        'inventory_id',
        'inventory_item_id',
        'product_id',
        'use_custom_barcode',
        'barcode',
        'custom_barcode',
        'used'
    ];

    function inventory(){
        return $this->belongsTo(Inventory::class, 'inventory_id', 'id');
    }

    function inventoryItem(){
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id', 'id');
    }

    function product(){
        return $this->belongsTo(Product::class, 'product_id', 'id')->withTrashed();
    }
}

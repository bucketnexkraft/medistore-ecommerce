<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Inventory extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;
    protected $table = 'inventory';
    public $incrementing = true;
    protected $keyType = 'int';
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'product_id',
        'quantity',
        'alert_quantity',
        'stock_out_mood', // LIFO, FIFO, RANDOM
    ];

    protected $casts = [
        'product_id' => 'string',
        'variant_id' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::deleting(function ($inventory) {
            if (!$inventory->isForceDeleting() && !$inventory->is_deleted) {
                $inventory->is_deleted = true;
                $inventory->saveQuietly();
            }
        });

        static::restoring(function ($inventory) {
            if ($inventory->is_deleted) {
                $inventory->is_deleted = false;
                $inventory->saveQuietly();
            }
        });
    }

    public function product(){
        return $this->belongsTo(Product::class)->withTrashed();
    }

    function warehouse(){
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    function user(){
        return $this->belongsTo(User::class,'user_id', 'id');
    }

    public function barcodes()
    {
        return $this->hasMany(ProductBarcode::class, 'inventory_id');
    }

    public function inventory_items(){
        return $this->hasMany(InventoryItem::class, 'inventory_id', 'id');
    }
}

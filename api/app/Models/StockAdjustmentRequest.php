<?php

namespace App\Models;

use App\Enums\StockAdjustmentStatus;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockAdjustmentRequest extends Model
{
    use HasFactory, BelongsToCompany;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'product_id',
        'inventory_id',
        'inventory_item_id',
        'warehouse_id',
        'qty_change',
        'quantity_before',
        'quantity_after',
        'unit_cost',
        'value_change',
        'reason',
        'note',
        'status',
        'flags',
        'is_flagged',
        'requested_by',
        'approved_by',
        'approved_at',
        'applied_at',
    ];

    protected $casts = [
        'qty_change' => 'float',
        'quantity_before' => 'float',
        'quantity_after' => 'float',
        'unit_cost' => 'float',
        'value_change' => 'float',
        'flags' => 'array',
        'is_flagged' => 'boolean',
        'approved_at' => 'datetime',
        'applied_at' => 'datetime',
        'status' => StockAdjustmentStatus::class,
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = substr(uniqid(), 0, 13) . '-sar-' . random_int(10000000000000000, 99999999999999999);
            }
        });
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id')->withTrashed();
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id');
    }

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}

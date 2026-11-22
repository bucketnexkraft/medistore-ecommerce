<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryHistory extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;

    protected $guarded = [];
    protected $fillable = [
        'type', 
        'company_id', 
        'invoice_id', 
        'lot_number', 
        'inventory_id', 
        'product_id', 
        'inventory_item_id',
        'barcode',
        'variant', 
        'unit_price', 
        'original_unit_price',
        'quantity', 
        'discount', 
        'discount_amount', 
        'total', 
        'is_returned', 
        'original_sale_item_id', 
        'created_by',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::deleting(function ($history) {
            if (!$history->isForceDeleting() && !$history->is_deleted) {
                $history->is_deleted = true;
                $history->saveQuietly();
            }
        });

        static::restoring(function ($history) {
            if ($history->is_deleted) {
                $history->is_deleted = false;
                $history->saveQuietly();
            }
        });
    }
    
    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id')->withTrashed();
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    public function originalSaleItem()
    {
        return $this->belongsTo(InventoryHistory::class, 'original_sale_item_id', 'id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

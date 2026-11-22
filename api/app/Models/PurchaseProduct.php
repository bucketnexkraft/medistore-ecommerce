<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseProduct extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;

    protected $table = 'purchases_products';
    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
        });
		
		static::deleting(function ($product) {
            if (!$product->isForceDeleting() && !$product->is_deleted) {
                $product->is_deleted = true;
                $product->saveQuietly();
            }
        });

        static::restoring(function ($product) {
            if ($product->is_deleted) {
                $product->is_deleted = false;
                $product->saveQuietly();
            }
        });
    }

    public function purchase()
    {
        return $this->belongsTo(Purchase::class, 'purchase_id', 'id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
    
}

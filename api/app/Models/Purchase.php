<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Purchase extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;

    protected $table = 'purchases';
    protected $primaryKey = 'id';
    public $incrementing = false;

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13).'-prs-'.random_int(10000000000000000, 99999999999999999);
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

    // supplier 
    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    // purchase items
    public function items()
    {
        return $this->hasMany(PurchaseProduct::class, 'purchase_id', 'id');
    }
}

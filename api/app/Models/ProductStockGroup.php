<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductStockGroup extends Model
{
    use HasFactory, BelongsToCompany;

    protected $primaryKey = 'id';
    public $incrementing = false;

    protected $guarded = [];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13) . '-pro_stock_group-' . random_int(10000000000000000, 99999999999999999);
        });
    }

    public function productStocks()
    {
        return $this->hasMany(Inventory::class, 'variant_id');
    }

    function product(){
        return $this->belongsTo(Product::class,'product_id');
    }
}

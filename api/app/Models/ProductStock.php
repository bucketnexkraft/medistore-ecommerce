<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductStock extends Model
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
            $model->id = substr(uniqid(), 0, 13) . '-product_stock-' . random_int(10000000000000000, 99999999999999999);
        });
    }

    public function stockGroup()
    {
        return $this->belongsTo(ProductStockGroup::class, 'stock_group_id');
    }

    function product(){
        return $this->belongsTo(Product::class,'product_id');
    }
}

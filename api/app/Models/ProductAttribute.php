<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductAttribute extends Model
{
    use HasFactory;
    protected $table = 'product_attribute';

    

    function variant(){
        return $this->belongsTo(ProductVariant::class, 'variant_id', 'id');
    }


     protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13).'-pro_attribute-'.random_int(10000000000000000, 99999999999999999);
        });
    }
    
}

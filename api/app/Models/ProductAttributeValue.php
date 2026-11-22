<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductAttributeValue extends Model
{
    use HasFactory, BelongsToCompany;

    protected $guarded = [];

    protected $primaryKey = 'id';
    public $incrementing = false;

    function attribute(){
        return $this->belongsTo(VariantAttribute::class,'attribute_value_id');
    }

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13) . '-pro_attribute_value-' . random_int(10000000000000000, 99999999999999999);
        });
    }
}

<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductVariant extends Model
{
    use HasFactory, BelongsToCompany;

    protected $primaryKey = 'id';
    public $incrementing = false;

    protected $guarded = [];

    public function attributes()
    {
        return $this->hasMany(VariantAttribute::class,'product_variant_id');
    }

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13).'-pro_varient-'.random_int(10000000000000000, 99999999999999999);
        });
    }
}

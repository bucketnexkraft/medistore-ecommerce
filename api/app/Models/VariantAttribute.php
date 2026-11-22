<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VariantAttribute extends Model
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
            $model->id = substr(uniqid(), 0, 13).'-pro_varient_attribute-'.random_int(10000000000000000, 99999999999999999);
        });
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}

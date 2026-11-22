<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductBundleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_bundle_id',
        'bundle_uuid',
        'product_id',
        'quantity',
        'sort_order',
    ];

    protected $casts = [
        'quantity' => 'float',
        'sort_order' => 'integer',
    ];

    public function bundle()
    {
        return $this->belongsTo(ProductBundle::class, 'product_bundle_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id')->withTrashed();
    }
}

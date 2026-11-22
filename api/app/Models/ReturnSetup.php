<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReturnSetup extends Model
{
    use HasFactory, BelongsToCompany;

    protected $table = 'return_setup';

    protected $fillable = [
        'company_id',
        'brand_id',
        'product_id',
        'category_id',
        'return_enabled',
        'return_day',
        'return_condition',
    ];

    protected $casts = [
        'return_enabled' => 'boolean',
        'return_day' => 'integer',
        'return_condition' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class, 'brand_id', 'id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id', 'id');
    }
}

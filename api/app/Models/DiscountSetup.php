<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Warehouse;

class DiscountSetup extends Model
{
    use HasFactory, BelongsToCompany;

    protected $table = 'discount_setup';

    protected $fillable = [
        'type',
        'name',
        'form_date',
        'to_date',
        'amount',
        'discount_type',   // fixed, percent
        'brands',          // JSON array of brand IDs
        'categories',      // JSON array of category IDs
        'products',        // JSON array of product IDs
        'warehouses',      // JSON array of warehouse IDs
        'vat_applicable',
        'vat_calculate_for', // grand total, after discount
        'code',
        'is_active',
        'no_of_cards',
    ];

    protected $casts = [
        'brands'     => 'array',
        'categories' => 'array',
        'products'   => 'array',
        'warehouses' => 'array',
        'vat_applicable' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::deleting(function ($product) {
            // Delete related data
            $product->rewordCards()->delete();
        });
    }

    /**
     * Helper: Get brand list (id + title) for this discount
     */
    public function brandList()
    {
        return Brand::select('id', 'title')
            ->whereIn('id', $this->brands ?? [])
            ->get();
    }

    /**
     * Helper: Get category list (id + title) for this discount
     */
    public function categoryList()
    {
        return Category::select('id', 'title')
            ->whereIn('id', $this->categories ?? [])
            ->get();
    }

    /**
     * Helper: Get product list (id + name) for this discount
     */
    public function productList()
    {
        return Product::select('id', 'name')
            ->whereIn('id', $this->products ?? [])
            ->get();
    }

    /**
     * Helper: Get warehouse list (id + name) for this discount
     */
    public function warehouseList()
    {
        return Warehouse::select('id', 'name')
            ->whereIn('id', $this->warehouses ?? [])
            ->get();
    }
    
    public function rewordCards()
    {
        return $this->hasMany(RewordCard::class, 'setup_id', 'id');
    }
}

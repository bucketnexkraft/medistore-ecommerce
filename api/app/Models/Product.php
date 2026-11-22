<?php

namespace App\Models;

use App\Services\ImageService;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Product extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;
    protected $table = 'product';
    protected $primaryKey = 'id';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'name',
        'code',
        'slug',
        'brand_id',
        'category_id',
        'unit_id',
        'thumbnail',
        'featured_image',
        'images',
        'status',
        'description',
        'shipping_information',
        'return_information',
        'return_policy',
        'is_free',
        'ancestor_id',
        'meta_title',
        'meta_tags',
        'meta_descriptions',
        'company_id',
        'has_variant',
        'has_segment',
        'variants',
        'segmentation',
        'vat',
        'sales_channel',
        'demand_tags',
        'stock_visibility',
        'stock_visibility_label',
        'is_featured',
        'is_bundle',
        'bundle_uuid',
        'is_group_purchase_available',
        'group_purchase_discount_type',
        'group_purchase_minimum_user',
        'group_purchase_discount_amount',
    ];

    public const DEMAND_TAGS = [
        'best_seller' => 'Best Seller',
        'trending' => 'Trending',
        'popular' => 'Popular',
        'top_rated' => 'Top Rated',
        'most_viewed' => 'Most Viewed',
        'most_sold' => 'Most Sold',
        'seasonal' => 'Seasonal',
        'clearance' => 'Clearance',
        'imported' => 'Imported',
        'high_risk' => 'High Risk',
    ];

    protected $casts = [
        'variants' => 'array',
        'segmentation' => 'array',
        'sales_channel' => 'array',
        'demand_tags' => 'array',
        'stock_visibility' => 'boolean',
        'is_featured' => 'boolean',
        'is_bundle' => 'boolean',
        'is_group_purchase_available' => 'boolean',
        'group_purchase_minimum_user' => 'integer',
        'group_purchase_discount_amount' => 'decimal:2',
        'deleted_at'   => 'datetime',
    ];

    public static function demandTagOptions(): array
    {
        return collect(self::DEMAND_TAGS)
            ->map(fn ($label, $value) => [
                'value' => $value,
                'label' => $label,
            ])
            ->values()
            ->all();
    }

    public function stockDisplay(?float $quantity = null): array
    {
        $visible = $this->stock_visibility ?? true;
        $label = $this->stock_visibility_label;

        return [
            'stock_visibility' => (bool) $visible,
            'stock_visibility_label' => $label,
            'stock_quantity' => $visible ? $quantity : null,
            'stock_display' => $visible
                ? (($quantity ?? 0) . ' in stock')
                : ($label ?: null),
        ];
    }

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13).'-prod-'.random_int(10000000000000000, 99999999999999999);
            $model->generateSlug();
        });
		
        // Optional: Cascade soft delete to related models
        static::deleting(function ($product) {
            if ($product->isForceDeleting()) {
                // Permanent delete → also hard delete translations
                $product->translations()->forceDelete();
            } else {
                // Soft delete → soft delete translations too
                $product->translations()->delete();
            }
        });

        // Restore related translations when product is restored
        static::restoring(function ($product) {
            $product->translations()->restore();
        });
    }

    public function getThumbnailAttribute($value)
    {
        if (!empty($value)) {
            return ImageService::url($value, 'product-images'); // Use the ImageService to get the URL
        }

        return $value; // Return the original value if empty
    }

    public function getImagesAttribute($value)
    {
        if (empty($value)) {
            return [];
        }

        $decoded = json_decode($value, true);

        // Ensure the decoded value is an array
        if (is_array($decoded)) {
            return collect($decoded)
                ->filter(fn($img) => is_string($img) && !empty($img)) // ensure valid strings
                ->map(fn($img) => ImageService::url($img, 'product-images')) // Use the ImageService to get URLs
                ->values();
        }
        // Fallback: return empty array if invalid JSON
        return [];
    }

    public function getFeaturedImageAttribute($value)
    {
        if (!empty($value)) {
            return ImageService::url($value, 'product-images');
        }

        return $value;
    }

    public function brand(){
        return $this->belongsTo(Brand::class, 'brand_id');
    }

    public function category(){
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function unit(){
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    public function custom_options(){
        return $this->hasMany(ProductAttribute::class, 'product_id')->where('type', 'custom value');
    }

    public function company(){
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function inventory(){
        return $this->hasMany(Inventory::class, 'product_id', 'id');
    }

    public function inventory_items(){
        return $this->hasMany(InventoryItem::class, 'product_id', 'id');
    }

    function segments(){
        return $this->hasMany(ProductSegment::class,'product_id','id');
    }
    
    public function existingCombinations(){
        return $this->hasMany(ProductCombination::class, 'product_id', 'id');
    }

    function stockGroup(){
        return $this->hasMany(ProductStockGroup::class,'product_id');
    }

    public function barcodes()
    {
        return $this->hasMany(ProductBarcode::class, 'product_id', 'id');
    }

    public function invoiceItems()
    {
        return $this->hasMany(InvoiceItem::class, 'product_id', 'id');
    }

    public function bundleItems()
    {
        return $this->hasMany(ProductBundleItem::class, 'product_id', 'id');
    }

    public function bundles()
    {
        return $this->belongsToMany(ProductBundle::class, 'product_bundle_items', 'product_id', 'product_bundle_id', 'id', 'id')
            ->withPivot(['quantity', 'sort_order'])
            ->withTimestamps();
    }

    public function groupPurchases()
    {
        return $this->hasMany(GroupPurchase::class, 'product_id', 'id');
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class, 'product_id', 'id')->withoutGlobalScopes();
    }

    public function returnSetup()
    {
        return $this->hasOne(ReturnSetup::class, 'product_id', 'id');
    }

    public function translations()
    {
        return $this->morphMany(Translation::class, 'translatable');
    }

    public function getTranslation($languageCode, $field)
    {
        return $this->translations()
            ->where('language_code', $languageCode)
            ->where('field', $field)
            ->value('value') ?? $this->$field;
    }

    protected function generateSlug(){
		if(optional($this->brand)->title){
			$brand = $this->brand->title;
		}else{
			$brand = 'other';
		}
        $slug = Str::slug($this->code.'-'.$brand.'-'.$this->name);

        $count = static::where('slug', $slug)->where('id', '!=', $this->id)->count();
        if ($count > 0) {
            $slug .= '-' . ($count + 1);
        }
        $this->slug = $slug;
    }
}

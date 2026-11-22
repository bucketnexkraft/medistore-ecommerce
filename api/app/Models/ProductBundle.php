<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ProductBundle extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'uuid',
        'product_id',
        'name',
        'code',
        'discount_type',
        'discount_value',
        'bundle_qty',
        'deduction_mode',
        'is_active',
    ];

    protected $casts = [
        'discount_value' => 'float',
        'bundle_qty' => 'float',
        'is_active' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::creating(function (self $bundle) {
            if (!filled($bundle->uuid)) {
                $bundle->uuid = (string) Str::uuid();
            }
            if (static::hasCodeColumn() && !filled($bundle->code)) {
                $bundle->code = static::generateUniqueCode();
            }
        });
    }

    public static function generateUniqueCode(): string
    {
        if (!static::hasCodeColumn()) {
            return '';
        }

        do {
            $code = 'BNDL-' . strtoupper(Str::random(10));
        } while (static::query()->where('code', $code)->exists());

        return $code;
    }

    public static function hasCodeColumn(): bool
    {
        return Schema::hasColumn((new static())->getTable(), 'code');
    }

    public function getResolvedBarcode(): string
    {
        if (static::hasCodeColumn() && filled($this->code)) {
            return (string) $this->code;
        }

        return 'BNDL-' . (string) $this->id;
    }

    public function bundleItems()
    {
        return $this->hasMany(ProductBundleItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id')->withTrashed();
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'product_bundle_items', 'product_bundle_id', 'product_id', 'id', 'id')
            ->withPivot(['quantity', 'sort_order'])
            ->withTimestamps();
    }
}

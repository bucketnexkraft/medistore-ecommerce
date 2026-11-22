<?php

namespace App\Models;

use App\Services\ImageService;
use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Category extends Model
{
    use HasFactory, BelongsToCompany;

    protected $table = 'categories';
    protected $primaryKey = 'id';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'title',
        'company_id',
        'slug',
        'ancestor_id',
        'status',
        'show_home',
        'short_number',
        'is_show_in_category_header',
        'image',
        'is_demo',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = uniqid().'-ctgr-'.random_int(10000000000000000, 99999999999999999);
            $model->generateSlug();
        });

        static::deleting(function ($product) {
            // Delete related translations
            $product->translations()->delete();
        });
    }

    protected $casts = [
        'is_show_in_category_header' => 'boolean',
    ];

    public function getImageAttribute($value)
    {
        if (!empty($value)) {
            return ImageService::url($value, 'category-images'); // Use the ImageService to get the URL
        }

        return $value; // Return the original value if empty
    }

    protected function generateSlug(){
        $slug = Str::slug($this->title);

        $count = static::where('slug', $slug)->where('id', '!=', $this->id)->count();
        if ($count > 0) {
            $slug .= '-' . ($count + 1);
        }
        $this->slug = $slug;
    }

    public function parent(){
        return $this->belongsTo(Category::class, 'ancestor_id', 'id');
    }

    public function children(){
        return $this->hasMany(Category::class, 'ancestor_id', 'id');
    }

    public function company(){
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id', 'id');
    }

    public function returnSetup()
    {
        return $this->hasOne(ReturnSetup::class, 'category_id', 'id');
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
}

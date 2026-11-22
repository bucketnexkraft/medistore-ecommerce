<?php

namespace App\Models;

use App\Constant\Directory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Blog extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'admin_id',
        'title',
        'slug',
        'short_description',
        'description',
        'tags',
        'seo_tags',
        'seo_description',
        'image',
        'status',
        'is_show_in_home',
    ];

    protected $casts = [
        'tags' => 'array',
        'seo_tags' => 'array',
        'status' => 'boolean',
        'is_show_in_home' => 'boolean',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image) return null;
        return get_file($this->image, Directory::BLOG_PATH);
    }

    public function category()
    {
        return $this->belongsTo(BlogCategory::class, 'category_id');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', true);
    }
}

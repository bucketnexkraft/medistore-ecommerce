<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Page extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'seo_title',
        'seo_tags',
        'seo_description',
        'status',
        'is_default',
        'content',
        'has_breadcrumb',
        'breadcrumb_title',
        'breadcrumb_description',
        'breadcrumb_image',
        'has_builder',
    ];

    protected $casts = [
        'seo_tags' => 'array',
        'status' => 'boolean',
        'is_default' => 'boolean',
        'has_breadcrumb' => 'boolean',
        'has_builder' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('status', true);
    }
}

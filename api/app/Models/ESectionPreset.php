<?php

namespace App\Models;

use App\Constant\Directory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ESectionPreset extends Model
{
    use HasFactory;

    protected $table = 'e_section_presets';

    protected $fillable = [
        'name',
        'section_type',
        'preset_key',
        'component_key',
        'preview_image',
        'categories',
        'status',
    ];

    protected $casts = [
        'categories' => 'array',
        'status' => 'boolean',
    ];

    protected $appends = ['preview_image_url'];

    public function getPreviewImageUrlAttribute(): ?string
    {
        if (! $this->preview_image) {
            return null;
        }

        return get_file($this->preview_image, Directory::E_SECTION_PRESET_IMAGE_PATH);
    }

    public function linkedCategories(): BelongsToMany
    {
        return $this->belongsToMany(
            ECategory::class,
            'e_category_section_presets',
            'section_preset_id',
            'category_id'
        )
            ->withPivot(['sort_order'])
            ->withTimestamps()
            ->orderBy('name');
    }
}

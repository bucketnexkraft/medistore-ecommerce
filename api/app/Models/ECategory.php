<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ECategory extends Model
{
    use HasFactory;

    protected $table = 'e_categories';

    protected $fillable = [
        'name',
        'status',
    ];

    protected $casts = [
        'status' => 'boolean',
    ];

    public function sectionPresets(): BelongsToMany
    {
        return $this->belongsToMany(
            ESectionPreset::class,
            'e_category_section_presets',
            'category_id',
            'section_preset_id'
        )
            ->withPivot(['sort_order'])
            ->withTimestamps()
            ->orderBy('section_type')
            ->orderBy('name');
    }
}

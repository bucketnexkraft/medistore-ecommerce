<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Location extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'location_hierarchy_id',
        'parent_id',
        'status',
        'meta',
    ];

    protected $casts = [
        'status' => 'boolean',
        'meta' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function (self $model) {
            $model->slug = Str::slug((string) $model->name);
        });
    }

    public function hierarchy()
    {
        return $this->belongsTo(LocationHierarchy::class, 'location_hierarchy_id');
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}

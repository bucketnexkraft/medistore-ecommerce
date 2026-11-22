<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class LocationHierarchy extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'parent_hierarchy_id',
        'status',
    ];

    protected $casts = [
        'status' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function (self $model) {
            $model->slug = Str::slug((string) $model->name);
        });
    }

    public function parentHierarchy()
    {
        return $this->belongsTo(self::class, 'parent_hierarchy_id');
    }

    public function childHierarchies()
    {
        return $this->hasMany(self::class, 'parent_hierarchy_id');
    }

    public function locations()
    {
        return $this->hasMany(Location::class, 'location_hierarchy_id');
    }
}

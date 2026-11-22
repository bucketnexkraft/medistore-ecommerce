<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyFeaturePreference extends Model
{
    use HasFactory;

    protected $table = 'company_feature_preference';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'feature',
        'active',
        'is_default_active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'is_default_active' => 'boolean',
    ];

    public function getCodeAttribute(): ?string
    {
        return $this->feature;
    }

    public function getIsActiveAttribute(): bool
    {
        return (bool) $this->active;
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = substr(uniqid(), 0, 13) . '-cfp-' . random_int(10000000000000000, 99999999999999999);
            }
        });
    }
}

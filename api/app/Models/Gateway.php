<?php

namespace App\Models;

use App\Constant\Path;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Gateway extends Model
{
    use HasFactory;

    protected $table = 'gateways';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $guarded = ['id'];

    protected $casts = [
        'parameters' => 'array',
        'status' => 'boolean',
        'charge' => 'decimal:8',
    ];

    protected $appends = ['image_url'];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = substr(uniqid(), 0, 13) . '-gateway-' . random_int(10000000000000000, 99999999999999999);
            }
        });
    }

    public function getImageUrlAttribute()
    {
        if (!empty($this->image)) {
            return get_file($this->image, Path::GATEWAY_IMAGE_PATH);
        }

        return null;
    }

    public function currency()
    {
        return $this->belongsTo(Currency::class, 'currency_id', 'id');
    }
}


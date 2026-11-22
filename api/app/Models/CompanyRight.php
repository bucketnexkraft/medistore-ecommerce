<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyRight extends Model
{
    use HasFactory;

    protected $table = 'company_rights';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'right_id',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = substr(uniqid(), 0, 13) . '-cr-' . random_int(10000000000000000, 99999999999999999);
            }
        });
    }
}


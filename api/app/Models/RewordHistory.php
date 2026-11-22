<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RewordHistory extends Model
{
    use HasFactory, BelongsToCompany;

    protected $table = 'reword_history';

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::creating(function ($model) {
            $model->created_by = auth()->id() ?: $model->user_id ?: 'system';
        });
    }
    protected $fillable = [
        'user_id',
        'invoice_id',
        'invoice_amount',
        'reword_amount',
        'conversion_value', 
        'type',
    ];
}

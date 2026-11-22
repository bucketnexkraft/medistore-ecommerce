<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RewordSetup extends Model
{
    use HasFactory, BelongsToCompany;
    protected $table = 'reword_setup';

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
    }
    
    protected $fillable = [
        'form_date',
        'to_date',
        'amount',
        'reword_unit',
        'reword_value',
        'redeem_type',
    ];
}

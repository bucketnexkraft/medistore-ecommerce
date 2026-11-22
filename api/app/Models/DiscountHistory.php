<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiscountHistory extends Model
{
    use HasFactory, BelongsToCompany;
    protected $table = 'discount_history';
    protected $fillable = [
        'user_id',
        'invoice_id',
        'invoice_amount',
        'discount_amount',
        'discount_type',
        'created_by',
    ];
    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
    }
}

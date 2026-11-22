<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserShipping extends Model
{
    use HasFactory;

    protected $table = 'user_shipping';

    protected $fillable = [
        'user_id',
        'full_name',
        'email',
        'phone',
        'address',
        'division_name',
        'district_name',
        'upazila_name',
        'city',
        'country',
        'postal_code',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}

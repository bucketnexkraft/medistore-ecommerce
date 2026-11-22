<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RewordCard extends Model
{
    use HasFactory;

    protected $table = 'reword_cards';
    protected $fillable = [
        'setup_id',
        'card_number',
        'is_redeemed',
        'user_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function setup()
    {
        return $this->belongsTo(DiscountSetup::class, 'setup_id', 'id');
    }
    
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiUsageLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'user_id',
        'feature_key',
        'characters_generated',
    ];

    protected $casts = [
        'characters_generated' => 'integer',
    ];
}

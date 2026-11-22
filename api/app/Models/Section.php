<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'title',
        'content',
        'element',
        'order',
        'is_active',
    ];

    protected $casts = [
        'content' => 'array',
        'element' => 'array',
        'is_active' => 'boolean',
    ];
}

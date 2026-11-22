<?php

namespace App\Models;

use App\Traits\BelongsToSystemAdmin;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Right extends Model
{
    use HasFactory, BelongsToSystemAdmin;

    protected $table = 'right';

    protected $fillable = ['name', 'module'];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToSystemAdmin();
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoleRight extends Model
{
    use HasFactory;

    protected $table = "role_right";

    protected $fillable = ['role_id', 'right_id', 'permission'];

    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id', 'id');
    }

    public function right()
    {
        return $this->belongsTo(Right::class, 'right_id', 'id');
    }
}

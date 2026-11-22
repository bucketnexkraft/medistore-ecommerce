<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkSlot extends Model
{
    use HasFactory;

    protected $table = 'work_slot';
    protected $fillable = [
        'user_id',
        'start_time',
        'end_time',
        'overtime',
        'handover_instructions',
    ];

    protected $casts = [
        'start_time' => 'string',
        'end_time' => 'string',
        'overtime' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

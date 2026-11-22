<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CustomerWaitlistReservation extends Model
{
    use HasFactory;
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'waitlist_id',
        'inventory_id',
        'inventory_item_id',
        'reserved_qty',
        'reserved_at',
        'expires_at',
        'status',
        'note',
    ];

    protected $casts = [
        'id' => 'string',
        'waitlist_id' => 'string',
        'reserved_qty' => 'float',
        'reserved_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    public function waitlist()
    {
        return $this->belongsTo(CustomerWaitlist::class, 'waitlist_id');
    }
}

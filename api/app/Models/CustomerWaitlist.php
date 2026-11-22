<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CustomerWaitlist extends Model
{
    use HasFactory, BelongsToCompany;
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'customer_id',
        'product_id',
        'requested_qty',
        'fulfilled_qty',
        'status',
        'notified_at',
        'closed_at',
        'notes',
    ];

    protected $casts = [
        'id' => 'string',
        'requested_qty' => 'float',
        'fulfilled_qty' => 'float',
        'notified_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function reservations()
    {
        return $this->hasMany(CustomerWaitlistReservation::class, 'waitlist_id');
    }
}

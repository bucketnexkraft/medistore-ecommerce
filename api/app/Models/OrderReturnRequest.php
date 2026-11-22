<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class OrderReturnRequest extends Model
{
    use HasFactory;

    protected $table = 'order_return_requests';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'order_id',
        'order_item_id',
        'company_id',
        'user_id',
        'product_id',
        'reason',
        'status',
        'refund_amount',
        'approved_by',
        'rejection_reason',
        'requested_at',
        'resolved_at',
    ];

    protected $casts = [
        'refund_amount' => 'decimal:2',
        'requested_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            if (empty($model->requested_at)) {
                $model->requested_at = now();
            }
        });
    }

    public function order()
    {
        return $this->belongsTo(CustomerOrder::class, 'order_id', 'id');
    }

    public function orderItem()
    {
        return $this->belongsTo(CustomerOrderItem::class, 'order_item_id', 'id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}

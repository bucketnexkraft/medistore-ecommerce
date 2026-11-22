<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class CustomerOrder extends Model
{
    use HasFactory;

    protected $table = 'orders';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'order_no',
        'user_id',
        'user_shipping_id',
        'company_id',
        'group_purchase_id',
        'payment_method',
        'payment_status',
        'payable_amount',
        'trx',
        'remarks',
        'group_purchase_discount_status',
        'order_status',
        'subtotal',
        'tax_amount',
        'shipping_amount',
        'total_amount',
        'group_discount_amount',
        'coupon_code',
        'coupon_discount_amount',
        'gateway_txn_id',
        'payment_payload',
        'placed_at',
    ];

    protected $casts = [
        'payable_amount' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'group_discount_amount' => 'decimal:2',
        'coupon_discount_amount' => 'decimal:2',
        'payment_payload' => 'array',
        'placed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->id)) {
                $model->id = substr(uniqid(), 0, 13) . '-ord-' . random_int(100000, 999999);
            }

            if (empty($model->order_no)) {
                $date = now()->format('Ymd');
                $count = static::query()
                    ->whereDate('created_at', now()->toDateString())
                    ->count() + 1;

                $model->order_no = 'ORD-' . $date . '-' . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
            }

            if (empty($model->placed_at)) {
                $model->placed_at = now();
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function shippingAddress()
    {
        return $this->belongsTo(UserShipping::class, 'user_shipping_id');
    }

    public function items()
    {
        return $this->hasMany(CustomerOrderItem::class, 'order_id', 'id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function groupPurchase()
    {
        return $this->belongsTo(GroupPurchase::class, 'group_purchase_id', 'id');
    }

    public function returnRequests()
    {
        return $this->hasMany(OrderReturnRequest::class, 'order_id', 'id');
    }

    public function persistGatewayAttributes(array $attributes): void
    {
        $allowedColumns = collect([
            'payable_amount',
            'trx',
            'payment_payload',
            'remarks',
            'gateway_txn_id',
            'payment_status',
            'order_status',
        ])->filter(fn (string $column) => Schema::hasColumn($this->getTable(), $column));

        $payload = collect($attributes)
            ->only($allowedColumns->all())
            ->all();

        if ($payload === []) {
            return;
        }

        static::query()->where($this->getKeyName(), $this->getKey())->update($payload);
        $this->forceFill($payload);
        $this->syncOriginalAttributes(array_keys($payload));
    }
}

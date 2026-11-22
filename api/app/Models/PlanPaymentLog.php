<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class PlanPaymentLog extends Model
{
    use HasFactory;

    protected $table = 'plan_payment_logs';

    protected $fillable = [
        'trx',
        'company_id',
        'user_id',
        'saas_plan_id',
        'gateway_id',
        'gateway_name',
        'currency_id',
        'amount',
        'gateway_charge',
        'gateway_charge_type',
        'payable_amount',
        'status',
        'payment_payload',
        'remarks',
        'gateway_txn_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'gateway_charge' => 'decimal:2',
        'payable_amount' => 'decimal:2',
        'payment_payload' => 'array',
    ];

    public function getFinalAmountAttribute()
    {
        return (float) $this->payable_amount;
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function plan()
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id', 'id');
    }

    public function gateway()
    {
        return $this->belongsTo(Gateway::class, 'gateway_id', 'id');
    }

    public function currency()
    {
        return $this->belongsTo(Currency::class, 'currency_id', 'id');
    }

    public function persistGatewayAttributes(array $attributes): void
    {
        $allowedColumns = collect([
            'payable_amount',
            'trx',
            'payment_payload',
            'remarks',
            'gateway_txn_id',
            'status',
        ])->filter(fn (string $column) => Schema::hasColumn($this->getTable(), $column));

        $payload = collect($attributes)
            ->only($allowedColumns->all())
            ->all();

        if ($payload === []) {
            return;
        }

        static::query()->whereKey($this->getKey())->update($payload);
        $this->forceFill($payload);
        $this->syncOriginalAttributes(array_keys($payload));
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CommissionPaymentLog extends Model
{
    use HasFactory;

    protected $table = 'commission_payment_logs';

    protected $fillable = [
        'trx',
        'company_id',
        'saas_plan_id',
        'user_id',
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
        'submitted_at',
        'approved_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'gateway_charge' => 'decimal:2',
        'payable_amount' => 'decimal:2',
        'payment_payload' => 'array',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
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

    public function charges()
    {
        return $this->hasMany(CompanyCommissionCharge::class, 'commission_payment_log_id', 'id');
    }
}

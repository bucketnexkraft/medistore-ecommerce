<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyCommissionCharge extends Model
{
    use HasFactory;

    protected $table = 'company_commission_charges';

    protected $fillable = [
        'company_id',
        'saas_plan_id',
        'order_id',
        'order_no',
        'base_amount',
        'commission_rate',
        'commission_type',
        'commission_amount',
        'status',
        'commission_payment_log_id',
        'charged_at',
        'paid_at',
        'remarks',
    ];

    protected $casts = [
        'base_amount' => 'decimal:2',
        'commission_rate' => 'decimal:4',
        'commission_amount' => 'decimal:2',
        'charged_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function plan()
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id', 'id');
    }

    public function order()
    {
        return $this->belongsTo(CustomerOrder::class, 'order_id', 'id');
    }

    public function paymentLog()
    {
        return $this->belongsTo(CommissionPaymentLog::class, 'commission_payment_log_id', 'id');
    }
}

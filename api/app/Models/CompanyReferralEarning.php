<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyReferralEarning extends Model
{
    use HasFactory;

    protected $table = 'company_referral_earnings';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'source_company_id',
        'plan_payment_log_id',
        'reference_key',
        'level',
        'reward_type',
        'amount',
        'status',
        'notes',
        'credited_at',
    ];

    protected $casts = [
        'level' => 'integer',
        'amount' => 'decimal:2',
        'credited_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = substr(uniqid(), 0, 13) . '-rearn-' . random_int(10000000000000000, 99999999999999999);
            }

            if (empty($model->credited_at)) {
                $model->credited_at = now();
            }
        });
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function sourceCompany()
    {
        return $this->belongsTo(Company::class, 'source_company_id', 'company_id');
    }

    public function planPaymentLog()
    {
        return $this->belongsTo(PlanPaymentLog::class, 'plan_payment_log_id', 'id');
    }
}

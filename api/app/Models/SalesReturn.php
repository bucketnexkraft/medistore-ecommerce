<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesReturn extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes, HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $guarded = [];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::creating(function ($model) {
            if (empty($model->uid)) {
                $model->uid = substr(uniqid('', true), 0, 13) . '-sr-' . random_int(10000000000000000, 99999999999999999);
            }
            if (empty($model->return_no)) {
                $date = now()->format('Ymd');
                $countToday = self::whereDate('created_at', now()->toDateString())->count() + 1;
                $model->return_no = 'SR-' . $date . '-' . str_pad((string) $countToday, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    public function items()
    {
        return $this->hasMany(SalesReturnItem::class, 'sales_return_id');
    }

    public function payments()
    {
        return $this->hasMany(SalesReturnPayment::class, 'sales_return_id');
    }

    public function approvals()
    {
        return $this->hasMany(SalesReturnApproval::class, 'sales_return_id');
    }
}

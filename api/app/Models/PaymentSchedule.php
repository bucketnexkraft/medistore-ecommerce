<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentSchedule extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'payment_schedule';

    protected $fillable = [
        'invoice_id',
        'amount',
        'paid_amount',
        'due_date',
        'paid_date',
        'remainder_date',
        'status',
    ];

    protected $casts = [
        'amount' => 'float',
        'paid_amount' => 'float',
    ];

    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($schedule) {
            if (!$schedule->isForceDeleting() && !$schedule->is_deleted) {
                $schedule->is_deleted = true;
                $schedule->saveQuietly();
            }
        });

        static::restoring(function ($schedule) {
            if ($schedule->is_deleted) {
                $schedule->is_deleted = false;
                $schedule->saveQuietly();
            }
        });
    }
}

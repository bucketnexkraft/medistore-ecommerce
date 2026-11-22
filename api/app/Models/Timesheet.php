<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Timesheet extends Model
{
    protected $table = 'timesheet';
    protected $fillable = [
        'subject_user_id',
        'source_user_id',
        'start_time',
        'end_time',
        'cash_in_hand',
        'cash_out_hand',
        'total_sales_cash',
        'total_refund_cash',
        'total_inflow_cash',
        'total_outflow_cash',
        'expected_closing_cash',
        'cash_variance',
        'handover_cash',
        'total_transactions',
        'closed_by_user_id',
        'overtime',
        'comments',
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'cash_in_hand' => 'decimal:2',
        'cash_out_hand' => 'decimal:2',
        'total_sales_cash' => 'decimal:2',
        'total_refund_cash' => 'decimal:2',
        'total_inflow_cash' => 'decimal:2',
        'total_outflow_cash' => 'decimal:2',
        'expected_closing_cash' => 'decimal:2',
        'cash_variance' => 'decimal:2',
        'handover_cash' => 'decimal:2',
        'total_transactions' => 'integer',
        'overtime' => 'decimal:2',
    ];

    public function subjectUser()
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }

    public function sourceUser()
    {
        return $this->belongsTo(User::class, 'source_user_id');
    }

    public function isActive()
    {
        return is_null($this->end_time);
    }

    public function cashHandovers()
    {
        return $this->hasMany(TimesheetCashHandover::class, 'timesheet_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TimesheetCashHandover extends Model
{
    protected $table = 'timesheet_cash_handovers';

    protected $fillable = [
        'timesheet_id',
        'company_id',
        'cashier_user_id',
        'received_by_user_id',
        'amount',
        'notes',
    ];

    protected $casts = [
        'timesheet_id' => 'integer',
        'amount' => 'decimal:2',
    ];

    public function timesheet()
    {
        return $this->belongsTo(Timesheet::class, 'timesheet_id');
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_user_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'received_by_user_id');
    }
}

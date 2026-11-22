<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyETemplateAccess extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'template_id',
        'plan_payment_log_id',
        'amount',
    ];

    protected $casts = ['amount' => 'decimal:2'];

    public function template()
    {
        return $this->belongsTo(ETemplate::class, 'template_id');
    }
}

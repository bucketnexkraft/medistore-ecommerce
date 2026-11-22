<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnalyticsEvent extends Model
{
    protected $fillable = [
        'company_id',
        'event_id',
        'session_id',
        'user_id',
        'event_name',
        'product_id',
        'product_name',
        'order_id',
        'page_path',
        'page_title',
        'referrer',
        'source',
        'medium',
        'campaign',
        'device_type',
        'browser',
        'operating_system',
        'value',
        'currency',
        'metadata',
        'occurred_at',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'metadata' => 'array',
        'occurred_at' => 'datetime',
    ];
}

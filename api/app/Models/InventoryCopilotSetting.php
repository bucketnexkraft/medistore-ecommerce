<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryCopilotSetting extends Model
{
    protected $table = 'inventory_copilot_settings';

    protected $fillable = [
        'company_id',
        'baseline_sales_days',
        'recent_sales_days',
        'low_stock_days',
        'critical_stock_days',
        'fast_selling_multiplier',
        'fast_selling_min_quantity',
        'fast_selling_high_percent',
        'aging_stock_days',
        'dead_stock_days',
        'new_product_grace_days',
        'overstock_days',
        'overstock_medium_days',
        'max_products',
    ];

    protected $casts = [
        'baseline_sales_days' => 'integer',
        'recent_sales_days' => 'integer',
        'low_stock_days' => 'integer',
        'critical_stock_days' => 'integer',
        'fast_selling_multiplier' => 'float',
        'fast_selling_min_quantity' => 'float',
        'fast_selling_high_percent' => 'integer',
        'aging_stock_days' => 'integer',
        'dead_stock_days' => 'integer',
        'new_product_grace_days' => 'integer',
        'overstock_days' => 'integer',
        'overstock_medium_days' => 'integer',
        'max_products' => 'integer',
    ];
}

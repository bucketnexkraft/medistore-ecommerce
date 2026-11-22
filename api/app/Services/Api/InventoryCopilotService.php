<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Models\Inventory;
use App\Models\InventoryCopilotSetting;
use App\Models\InvoiceItem;
use App\Utils\PermissionUtils;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class InventoryCopilotService
{
    private const SETTINGS_TABLE = 'inventory_copilot_settings';

    public function insights(?Request $request = null): array
    {
        $companyId = Auth::user()?->company_id;

        if (!$companyId || !PermissionUtils::isFeatureAccessible($companyId, FeaturePreference::INVENTORY_COPILOT->value)) {
            return [
                'status' => 0,
                'message' => 'Inventory Copilot is not enabled.',
                'summary' => $this->emptySummary(),
                'insights' => [],
            ];
        }

        $now = Carbon::now();
        $settings = $this->resolveSettings($companyId);
        $baselineDays = max(1, (int) $settings['baseline_sales_days']);
        $recentDays = max(1, (int) $settings['recent_sales_days']);
        $sales30 = $this->salesByProduct($companyId, $now->copy()->subDays($baselineDays), $now);
        $sales7 = $this->salesByProduct($companyId, $now->copy()->subDays($recentDays), $now);
        $lastSales = $this->lastSaleByProduct($companyId);
        $stocks = $this->stockRows($companyId, (int) $settings['max_products']);

        $insights = collect();

        foreach ($stocks as $stock) {
            $productId = (string) $stock->product_id;
            $productName = $stock->product_name ?: 'Product';
            $quantity = (float) $stock->quantity;
            $sold30 = (float) ($sales30[$productId] ?? 0);
            $sold7 = (float) ($sales7[$productId] ?? 0);
            $daily30 = $sold30 / $baselineDays;
            $daily7 = $sold7 / $recentDays;
            $daysLeft = $daily30 > 0 ? $quantity / $daily30 : null;
            $lastSoldAt = isset($lastSales[$productId]) ? Carbon::parse($lastSales[$productId]) : null;
            $daysSinceSale = $lastSoldAt ? $lastSoldAt->diffInDays($now) : null;
            $stockStartedAt = $stock->stock_created_at ?: $stock->product_created_at;
            $stockAgeDays = $stockStartedAt ? Carbon::parse($stockStartedAt)->diffInDays($now) : 0;

            if ($daily30 > 0 && $daysLeft !== null && $daysLeft <= $settings['low_stock_days']) {
                $insights->push($this->makeInsight(
                    'low_stock',
                    $daysLeft <= $settings['critical_stock_days'] ? 'high' : 'medium',
                    $productName . ' may run out soon',
                    'Stock may run out in ' . max(1, (int) ceil($daysLeft)) . ' days.',
                    'Current stock is ' . $this->formatNumber($quantity) . ' and average daily sales is ' . $this->formatNumber($daily30) . '.',
                    'Create Purchase',
                    '/stock/in',
                    $productId,
                    ['stock' => $quantity, 'daily_sales_avg' => round($daily30, 2), 'days_left' => round($daysLeft, 1)]
                ));
            }

            if (
                $daily30 > 0
                && $sold7 >= $settings['fast_selling_min_quantity']
                && $daily7 >= ($daily30 * $settings['fast_selling_multiplier'])
            ) {
                $increase = (($daily7 - $daily30) / $daily30) * 100;
                $insights->push($this->makeInsight(
                    'fast_selling',
                    $increase >= $settings['fast_selling_high_percent'] ? 'high' : 'medium',
                    $productName . ' is selling faster than usual',
                    'Sales increased ' . (int) round($increase) . '% in the last ' . $recentDays . ' days.',
                    'Last ' . $recentDays . '-day daily average is ' . $this->formatNumber($daily7) . ' vs ' . $baselineDays . '-day average ' . $this->formatNumber($daily30) . '.',
                    'Review Price',
                    '/product-setup/products',
                    $productId,
                    ['recent_sold_qty' => $sold7, 'baseline_sold_qty' => $sold30, 'increase_percent' => round($increase, 1)]
                ));
            }

            if (
                $quantity > 0
                && (
                    $daysSinceSale >= $settings['dead_stock_days']
                    || ($daysSinceSale === null && $stockAgeDays >= $settings['new_product_grace_days'])
                )
            ) {
                $days = $daysSinceSale ?? $stockAgeDays;
                $insights->push($this->makeInsight(
                    'dead_stock',
                    'high',
                    $productName . ' may be dead stock',
                    'Stock exists but there has been no sale for ' . $days . '+ days.',
                    'Current stock is ' . $this->formatNumber($quantity) . ' with no recent sales activity.',
                    'Mark Clearance',
                    '/product-setup/products',
                    $productId,
                    ['stock' => $quantity, 'days_since_sale' => $daysSinceSale, 'stock_age_days' => $stockAgeDays]
                ));
            } elseif ($quantity > 0 && $daysSinceSale >= $settings['aging_stock_days']) {
                $insights->push($this->makeInsight(
                    'aging_stock',
                    'medium',
                    $productName . ' is aging in stock',
                    'No sale recorded for ' . $daysSinceSale . ' days.',
                    'Current stock is ' . $this->formatNumber($quantity) . ' and the last sale was on ' . $lastSoldAt->toDateString() . '.',
                    'Create Promotion',
                    '/company-preference/discount',
                    $productId,
                    ['stock' => $quantity, 'days_since_sale' => $daysSinceSale]
                ));
            }

            if ($daily30 > 0 && $quantity / $daily30 >= $settings['overstock_days']) {
                $coverDays = $quantity / $daily30;
                $insights->push($this->makeInsight(
                    'overstock',
                    $coverDays >= $settings['overstock_medium_days'] ? 'medium' : 'low',
                    $productName . ' looks overstocked',
                    'Current stock can cover about ' . (int) round($coverDays) . ' days of sales.',
                    'Current stock is ' . $this->formatNumber($quantity) . ' and average daily sales is only ' . $this->formatNumber($daily30) . '.',
                    'Create Discount',
                    '/company-preference/discount',
                    $productId,
                    ['stock' => $quantity, 'daily_sales_avg' => round($daily30, 2), 'cover_days' => round($coverDays, 1)]
                ));
            }
        }

        $ordered = $insights
            ->sort(function ($a, $b) {
                if ($a['score'] === $b['score']) {
                    return $b['created_sort'] <=> $a['created_sort'];
                }

                return $b['score'] <=> $a['score'];
            })
            ->values()
            ->map(function ($item) {
                unset($item['created_sort']);
                return $item;
            });

        $summary = $this->summary($ordered);
        $filtered = $this->filterInsights($ordered, $request);

        return [
            'status' => 1,
            'message' => 'Inventory Copilot insights fetched successfully.',
            'summary' => $summary,
            'insights' => $filtered->values()->all(),
            'active_filter' => [
                'priority' => $request?->input('priority'),
                'type' => $request?->input('type'),
            ],
            'settings' => $settings,
        ];
    }

    public function settings(): array
    {
        $companyId = Auth::user()?->company_id;

        if (!$companyId || !PermissionUtils::isFeatureAccessible($companyId, FeaturePreference::INVENTORY_COPILOT->value)) {
            return [
                'status' => 0,
                'message' => 'Inventory Copilot is not enabled.',
                'data' => $this->defaultSettings(),
            ];
        }

        return [
            'status' => 1,
            'message' => 'Inventory Copilot settings fetched successfully.',
            'data' => $this->resolveSettings($companyId),
            'ready' => Schema::hasTable(self::SETTINGS_TABLE),
        ];
    }

    public function updateSettings(Request $request): array
    {
        $companyId = Auth::user()?->company_id;

        if (!$companyId || !PermissionUtils::isFeatureAccessible($companyId, FeaturePreference::INVENTORY_COPILOT->value)) {
            return [
                'status' => 0,
                'message' => 'Inventory Copilot is not enabled.',
                'data' => $this->defaultSettings(),
            ];
        }

        if (!Schema::hasTable(self::SETTINGS_TABLE)) {
            return [
                'status' => 0,
                'message' => 'Inventory Copilot setup table is missing. Run php artisan migrate first.',
                'data' => $this->defaultSettings(),
            ];
        }

        $validator = Validator::make($request->all(), [
            'baseline_sales_days' => ['required', 'integer', 'min:7', 'max:365'],
            'recent_sales_days' => ['required', 'integer', 'min:1', 'max:90', 'lt:baseline_sales_days'],
            'low_stock_days' => ['required', 'integer', 'min:1', 'max:365'],
            'critical_stock_days' => ['required', 'integer', 'min:1', 'max:365', 'lte:low_stock_days'],
            'fast_selling_multiplier' => ['required', 'numeric', 'min:1', 'max:10'],
            'fast_selling_min_quantity' => ['required', 'numeric', 'min:0', 'max:999999'],
            'fast_selling_high_percent' => ['required', 'integer', 'min:1', 'max:1000'],
            'aging_stock_days' => ['required', 'integer', 'min:1', 'max:1000'],
            'dead_stock_days' => ['required', 'integer', 'min:1', 'max:1000', 'gte:aging_stock_days'],
            'new_product_grace_days' => ['required', 'integer', 'min:0', 'max:365'],
            'overstock_days' => ['required', 'integer', 'min:1', 'max:1000'],
            'overstock_medium_days' => ['required', 'integer', 'min:1', 'max:1000', 'gte:overstock_days'],
            'max_products' => ['required', 'integer', 'min:10', 'max:5000'],
        ]);

        if ($validator->fails()) {
            return [
                'status' => 0,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
                'data' => $this->resolveSettings($companyId),
            ];
        }

        $settings = InventoryCopilotSetting::query()->updateOrCreate(
            ['company_id' => $companyId],
            $this->sanitizeSettings($validator->validated())
        );

        return [
            'status' => 1,
            'message' => 'Inventory Copilot settings updated successfully.',
            'data' => $this->normalizeSettings($settings->toArray()),
            'ready' => true,
        ];
    }

    private function filterInsights($insights, ?Request $request)
    {
        $priority = $request?->input('priority');
        $type = $request?->input('type');
        $allowedPriorities = ['high', 'medium', 'low'];
        $allowedTypes = ['low_stock', 'fast_selling', 'aging_stock', 'dead_stock', 'overstock'];

        if ($priority && in_array($priority, $allowedPriorities, true)) {
            return $insights->where('priority', $priority);
        }

        if ($type && in_array($type, $allowedTypes, true)) {
            return $insights->where('type', $type);
        }

        return $insights;
    }

    private function stockRows(string $companyId, int $limit)
    {
        return Inventory::query()
            ->join('product', 'product.id', '=', 'inventory.product_id')
            ->where('inventory.company_id', $companyId)
            ->where('inventory.quantity', '>', 0)
            ->select([
                'inventory.product_id',
                DB::raw('SUM(inventory.quantity) as quantity'),
                DB::raw('MIN(product.name) as product_name'),
                DB::raw('MIN(product.created_at) as product_created_at'),
                DB::raw('MIN(inventory.created_at) as stock_created_at'),
            ])
            ->groupBy('inventory.product_id')
            ->orderByDesc(DB::raw('SUM(inventory.quantity)'))
            ->limit($limit)
            ->get();
    }

    private function salesByProduct(string $companyId, Carbon $from, Carbon $to): array
    {
        return InvoiceItem::query()
            ->where('company_id', $companyId)
            ->where('type', 'sale')
            ->whereNotNull('product_id')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->select(['product_id', DB::raw('SUM(qty) as sold_qty')])
            ->groupBy('product_id')
            ->pluck('sold_qty', 'product_id')
            ->mapWithKeys(fn ($qty, $productId) => [(string) $productId => (float) $qty])
            ->all();
    }

    private function lastSaleByProduct(string $companyId): array
    {
        return InvoiceItem::query()
            ->where('company_id', $companyId)
            ->where('type', 'sale')
            ->whereNotNull('product_id')
            ->select(['product_id', DB::raw('MAX(date) as last_sale_at')])
            ->groupBy('product_id')
            ->pluck('last_sale_at', 'product_id')
            ->mapWithKeys(fn ($date, $productId) => [(string) $productId => $date])
            ->all();
    }

    private function makeInsight(
        string $type,
        string $priority,
        string $title,
        string $message,
        string $why,
        string $actionLabel,
        string $actionUrl,
        string $productId,
        array $meta = []
    ): array {
        $score = match ($priority) {
            'high' => 3,
            'medium' => 2,
            default => 1,
        };

        return [
            'id' => md5($type . $productId . $title),
            'type' => $type,
            'priority' => $priority,
            'score' => $score,
            'title' => $title,
            'message' => $message,
            'why' => $why,
            'action_label' => $actionLabel,
            'action_url' => $actionUrl,
            'product_id' => $productId,
            'meta' => $meta,
            'created_sort' => now()->timestamp,
        ];
    }

    private function summary($insights): array
    {
        $summary = $this->emptySummary();
        $summary['total'] = $insights->count();

        foreach ($insights as $insight) {
            $summary[$insight['priority']]++;
            if (isset($summary[$insight['type']])) {
                $summary[$insight['type']]++;
            }
        }

        return $summary;
    }

    private function emptySummary(): array
    {
        return [
            'total' => 0,
            'high' => 0,
            'medium' => 0,
            'low' => 0,
            'low_stock' => 0,
            'fast_selling' => 0,
            'aging_stock' => 0,
            'dead_stock' => 0,
            'overstock' => 0,
        ];
    }

    private function formatNumber(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }

    private function resolveSettings(string $companyId): array
    {
        if (!Schema::hasTable(self::SETTINGS_TABLE)) {
            return $this->defaultSettings();
        }

        $settings = InventoryCopilotSetting::query()
            ->where('company_id', $companyId)
            ->first();

        return $this->normalizeSettings($settings?->toArray() ?? []);
    }

    private function normalizeSettings(array $settings): array
    {
        return array_replace($this->defaultSettings(), $this->sanitizeSettings($settings));
    }

    private function sanitizeSettings(array $settings): array
    {
        $defaults = $this->defaultSettings();
        $normalized = [];

        foreach ($defaults as $key => $default) {
            if (!array_key_exists($key, $settings) || $settings[$key] === null || $settings[$key] === '') {
                continue;
            }

            $normalized[$key] = is_float($default) ? (float) $settings[$key] : (int) $settings[$key];
        }

        return $normalized;
    }

    private function defaultSettings(): array
    {
        return [
            'baseline_sales_days' => 30,
            'recent_sales_days' => 7,
            'low_stock_days' => 7,
            'critical_stock_days' => 3,
            'fast_selling_multiplier' => 1.4,
            'fast_selling_min_quantity' => 2.0,
            'fast_selling_high_percent' => 75,
            'aging_stock_days' => 60,
            'dead_stock_days' => 90,
            'new_product_grace_days' => 30,
            'overstock_days' => 120,
            'overstock_medium_days' => 180,
            'max_products' => 200,
        ];
    }
}

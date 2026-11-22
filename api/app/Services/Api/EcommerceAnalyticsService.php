<?php

namespace App\Services\Api;

use App\Models\AnalyticsEvent;
use App\Models\CustomerOrderItem;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class EcommerceAnalyticsService
{
    public function report(string $companyId, Carbon $start, Carbon $end): array
    {
        $base = fn (): Builder => AnalyticsEvent::query()
            ->where('company_id', $companyId)
            ->whereBetween('occurred_at', [$start, $end]);

        $pageViews = (clone $base())->where('event_name', 'page_view')->count();
        $visitors = (clone $base())->distinct('session_id')->count('session_id');
        $productViews = (clone $base())->where('event_name', 'view_item')->count();
        $cartSessions = $this->eventSessions($base(), 'add_to_cart');
        $checkoutSessions = $this->eventSessions($base(), 'begin_checkout');
        $purchaseSessions = $this->eventSessions($base(), 'purchase');
        $revenue = (float) (clone $base())->where('event_name', 'purchase')->sum('value');

        $trend = (clone $base())
            ->selectRaw("DATE(occurred_at) as period_date, COUNT(CASE WHEN event_name = 'page_view' THEN 1 END) as page_views, COUNT(DISTINCT session_id) as visitors, COUNT(CASE WHEN event_name = 'purchase' THEN 1 END) as purchases")
            ->groupByRaw('DATE(occurred_at)')
            ->orderByRaw('DATE(occurred_at)')
            ->get()
            ->map(fn ($row) => [
                'date' => (string) $row->period_date,
                'page_views' => (int) $row->page_views,
                'visitors' => (int) $row->visitors,
                'purchases' => (int) $row->purchases,
            ])->all();

        $grouped = function (string $column, int $limit = 8) use ($base): array {
            return (clone $base())
                ->where('event_name', 'page_view')
                ->selectRaw("COALESCE(NULLIF({$column}, ''), 'Unknown') as name, COUNT(DISTINCT session_id) as value")
                ->groupBy($column)
                ->orderByDesc('value')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => ['name' => (string) $row->name, 'value' => (int) $row->value])
                ->all();
        };

        $topPages = (clone $base())
            ->where('event_name', 'page_view')
            ->selectRaw("COALESCE(NULLIF(page_path, ''), '/') as path, MAX(page_title) as title, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors")
            ->groupBy('page_path')
            ->orderByDesc('views')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'path' => (string) $row->path,
                'title' => (string) ($row->title ?: $row->path),
                'views' => (int) $row->views,
                'visitors' => (int) $row->visitors,
            ])->all();

        $productEngagement = (clone $base())
            ->whereIn('event_name', ['view_item', 'add_to_cart'])
            ->whereNotNull('product_id')
            ->selectRaw("product_id, MAX(product_name) as product_name, COUNT(CASE WHEN event_name = 'view_item' THEN 1 END) as views, COUNT(CASE WHEN event_name = 'add_to_cart' THEN 1 END) as cart_adds")
            ->groupBy('product_id')
            ->orderByDesc('views')
            ->limit(10)
            ->get();

        $salesByProduct = CustomerOrderItem::query()
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('product_id, SUM(quantity) as purchases, SUM(line_total) as revenue')
            ->groupBy('product_id')
            ->get()
            ->keyBy(fn ($row) => (string) $row->product_id);

        $topProducts = $productEngagement->map(function ($row) use ($salesByProduct) {
            $sales = $salesByProduct->get((string) $row->product_id);

            return [
                'product_id' => (string) $row->product_id,
                'name' => (string) ($row->product_name ?: 'Unknown product'),
                'views' => (int) $row->views,
                'cart_adds' => (int) $row->cart_adds,
                'purchases' => (float) ($sales->purchases ?? 0),
                'revenue' => (float) ($sales->revenue ?? 0),
            ];
        })->all();

        return [
            'summary' => [
                'visitors' => $visitors,
                'page_views' => $pageViews,
                'product_views' => $productViews,
                'purchases' => $purchaseSessions,
                'revenue' => $revenue,
                'conversion_rate' => $visitors > 0 ? round(($purchaseSessions / $visitors) * 100, 2) : 0,
                'pages_per_session' => $visitors > 0 ? round($pageViews / $visitors, 2) : 0,
                'cart_abandonment_rate' => $cartSessions > 0 ? round((($cartSessions - $purchaseSessions) / $cartSessions) * 100, 2) : 0,
            ],
            'funnel' => [
                ['name' => 'Visitors', 'value' => $visitors],
                ['name' => 'Product views', 'value' => $this->eventSessions($base(), 'view_item')],
                ['name' => 'Added to cart', 'value' => $cartSessions],
                ['name' => 'Checkout', 'value' => $checkoutSessions],
                ['name' => 'Purchased', 'value' => $purchaseSessions],
            ],
            'trend' => $trend,
            'sources' => $grouped('source'),
            'devices' => $grouped('device_type', 4),
            'browsers' => $grouped('browser', 6),
            'top_pages' => $topPages,
            'top_products' => $topProducts,
        ];
    }

    private function eventSessions(Builder $query, string $event): int
    {
        return $query->where('event_name', $event)->distinct('session_id')->count('session_id');
    }
}

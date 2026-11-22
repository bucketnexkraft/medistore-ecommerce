<?php

namespace App\Services\Api;

use App\Enums\StockTimeValue;
use App\Models\Category;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PlanPaymentLog;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardService
{
    public function __construct(private readonly EcommerceAnalyticsService $ecommerceAnalyticsService) {}

    public function index(Request $request)
    {
        try {
            $type = $request->input('type');
            $startDate = $request->input('startDate');
            $endDate = $request->input('endDate');

            [$start, $end] = $this->getDateRange($type, $startDate, $endDate);
            [$prevStart, $prevEnd] = $this->getPreviousDateRange($type, $start, $end);

            $companyId = Auth::user()->company_id;
            $company = Auth::user()->company;
            $currentInventoryStats = $this->getInventorySummary($companyId, $start, $end);
            $previousInventoryStats = $this->getInventorySummary($companyId, $prevStart, $prevEnd);
            $currentInvoiceStats = $this->getInvoiceSummary($companyId, $start, $end);
            $previousInvoiceStats = $this->getInvoiceSummary($companyId, $prevStart, $prevEnd);
            $todayReturns = $this->getReturnCount($companyId, $start, $end);
            $prevTodayReturns = $this->getReturnCount($companyId, $prevStart, $prevEnd);

            $totalProducts = Product::where('company_id', $companyId)->count();
            $prevTotalProducts = Product::where('company_id', $companyId)->whereBetween('created_at', [$prevStart, $prevEnd])->count();
            $totalCustomers = User::where('role', 2)->where('company_id', $companyId)->count();
            $prevTotalCustomers = User::where('role', 2)->where('company_id', $companyId)->whereBetween('created_at', [$prevStart, $prevEnd])->count();
            $activeSuppliers = Supplier::where('status', 1)->where('company_id', $companyId)->count();
            $prevActiveSuppliers = Supplier::where('status', 1)->where('company_id', $companyId)->whereBetween('created_at', [$prevStart, $prevEnd])->count();

            $calculatePercentageChange = fn ($current, $previous) => $previous == 0 ? ($current > 0 ? '100.00%' : '0.00%') : number_format((($current - $previous) / $previous) * 100, 2).'%';

            $summary = [
                'totalProducts' => $totalProducts,
                'totalProductsChange' => $calculatePercentageChange($totalProducts, $prevTotalProducts),
                'totalStock' => $currentInventoryStats['total_stock'],
                'totalStockChange' => $calculatePercentageChange($currentInventoryStats['total_stock'], $previousInventoryStats['total_stock']),
                'totalStockAmount' => $currentInventoryStats['total_stock_amount'],
                'lowStockItems' => $currentInventoryStats['low_stock_items'],
                'lowStockItemsChange' => $calculatePercentageChange($currentInventoryStats['low_stock_items'], $previousInventoryStats['low_stock_items']),
                'totalCustomers' => $totalCustomers,
                'totalCustomersChange' => $calculatePercentageChange($totalCustomers, $prevTotalCustomers),
                'activeSuppliers' => $activeSuppliers,
                'activeSuppliersChange' => $calculatePercentageChange($activeSuppliers, $prevActiveSuppliers),
                'todayOrders' => $currentInvoiceStats['sale_count'],
                'todayOrdersChange' => $calculatePercentageChange($currentInvoiceStats['sale_count'], $previousInvoiceStats['sale_count']),
                'todayRevenue' => $currentInvoiceStats['sale_total'],
                'todayRevenueChange' => $calculatePercentageChange($currentInvoiceStats['sale_total'], $previousInvoiceStats['sale_total']),
                'todayReturns' => $todayReturns,
                'todayReturnsChange' => $calculatePercentageChange($todayReturns, $prevTodayReturns),
                'todayPurchasesCount' => $currentInvoiceStats['purchase_count'],
                'todayPurchasesCountChange' => $calculatePercentageChange($currentInvoiceStats['purchase_count'], $previousInvoiceStats['purchase_count']),
                'todayPurchasesAmount' => $currentInvoiceStats['purchase_total'],
                'todayPurchasesAmountChange' => $calculatePercentageChange($currentInvoiceStats['purchase_total'], $previousInvoiceStats['purchase_total']),
            ];

            $salesData = $this->getSalesData($type, $start, $end, $companyId);
            $categoryData = $this->getCategoryDistribution($companyId);

            $recentSales = Invoice::with(['items.product', 'customer'])
                ->where('type', 'sale')
                ->where('company_id', $companyId)
                ->whereBetween('created_at', [$start, $end])
                ->orderByDesc('created_at')
                ->take(5)
                ->get()
                ->map(fn ($order) => [
                    'id' => $order->id,
                    'product' => $order->items->pluck('product.name')->implode(', ') ?: 'N/A',
                    'customer' => $order->customer ? trim("{$order->customer->first_name} {$order->customer->last_name}") : 'N/A',
                    'quantity' => (float) $order->items->sum('qty'),
                    'price' => (float) $order->total,
                    'status' => match ($order->payment_status) {
                        1 => 'Completed',
                        2 => 'Pending',
                        3 => 'Cancelled',
                        default => 'Unknown',
                    },
                    'date' => $order->created_at->format('Y-m-d'),
                ])->toArray();

            $productSalesAggregate = InvoiceItem::query()
                ->selectRaw('product_id, SUM(qty) as total_qty, SUM(total) as total_sales')
                ->whereHas('invoice', function ($q) use ($companyId, $start, $end) {
                    $q->where('type', 'sale')
                        ->where('company_id', $companyId)
                        ->whereBetween('created_at', [$start, $end]);
                })
                ->where(function ($q) {
                    $q->whereNull('type')
                        ->orWhere('type', '!=', 'return');
                })
                ->whereNotNull('product_id')
                ->groupBy('product_id')
                ->with('product:id,name,code,thumbnail')
                ->get();

            $formatProductSales = fn ($item) => [
                'product_id' => $item->product_id,
                'name' => $item->product?->name ?? 'N/A',
                'code' => $item->product?->code ?? 'N/A',
                'thumbnail' => $item->product?->thumbnail ?? '',
                'total_qty' => (float) $item->total_qty,
                'total_sales' => (float) $item->total_sales,
            ];

            $highestSellingProducts = $productSalesAggregate
                ->sortByDesc('total_qty')
                ->take(5)
                ->values()
                ->map($formatProductSales)
                ->toArray();

            $lowestSellingProducts = $productSalesAggregate
                ->filter(fn ($item) => (float) $item->total_qty > 0)
                ->sortBy('total_qty')
                ->take(5)
                ->values()
                ->map($formatProductSales)
                ->toArray();

            $highestSellingProduct = ! empty($highestSellingProducts) ? $highestSellingProducts[0] : null;
            $lowestSellingProduct = ! empty($lowestSellingProducts) ? $lowestSellingProducts[0] : null;
            $stockTimeValueItems = $this->getStockTimeValueItems($companyId);
            $latestPlanPayment = PlanPaymentLog::with(['plan:id,name,billing_period,price', 'gateway:id,name,gateway_type,currency_id', 'currency:id,code'])
                ->where('company_id', $companyId)
                ->where(function ($query) {
                    $query->where('status', '!=', 'pending')
                        ->orWhereHas('gateway', fn ($gatewayQuery) => $gatewayQuery->where('gateway_type', 'manual'))
                        ->orWhereRaw('LOWER(gateway_name) LIKE ?', ['%bank%']);
                })
                ->orderByDesc('created_at')
                ->first();

            return response()->json([
                'status' => 1,
                'message' => 'Dashboard data fetched successfully',
                'data' => [
                    'summary' => $summary,
                    'salesData' => $salesData,
                    'categoryData' => $categoryData,
                    'recentSales' => $recentSales,
                    'highestSellingProducts' => $highestSellingProducts,
                    'lowestSellingProducts' => $lowestSellingProducts,
                    'highestSellingProduct' => $highestSellingProduct,
                    'lowestSellingProduct' => $lowestSellingProduct,
                    'stockTimeValueItems' => $stockTimeValueItems,
                    'ecommerceAnalytics' => $this->ecommerceAnalyticsService->report($companyId, $start, $end),
                    'planPayment' => [
                        'current_plan' => $company?->saasPlan,
                        'plan_subscribed_at' => optional($company?->plan_subscribed_at)->toDateTimeString(),
                        'latest_payment' => $latestPlanPayment,
                    ],
                ],
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to fetch dashboard data',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function details(Request $request)
    {
        try {
            $detailType = (string) $request->input('detailType');
            $periodType = (string) $request->input('periodType', 'monthly');
            $startDate = $request->input('startDate');
            $endDate = $request->input('endDate');
            $categoryName = $request->input('category');

            [$start, $end] = $this->getDateRange($periodType, $startDate, $endDate);
            $companyId = Auth::user()->company_id;

            $allowedTypes = [
                'todayOrders',
                'todayRevenue',
                'todayPurchases',
                'totalStock',
                'todayReturns',
                'totalProducts',
                'lowStockItems',
                'totalCustomers',
                'activeSuppliers',
                'category',
                'planPayments',
            ];

            if (! in_array($detailType, $allowedTypes, true)) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Unsupported dashboard detail type.',
                ], 422);
            }

            $data = match ($detailType) {
                'todayOrders', 'todayRevenue' => $this->getSalesDetails($companyId, $start, $end),
                'todayPurchases' => $this->getPurchaseDetails($companyId, $start, $end),
                'totalStock' => $this->getStockDetails($companyId, $start, $end),
                'todayReturns' => $this->getReturnDetails($companyId, $start, $end),
                'totalProducts' => $this->getProductDetails($companyId),
                'lowStockItems' => $this->getLowStockItemList($companyId),
                'totalCustomers' => $this->getCustomerDetails($companyId),
                'activeSuppliers' => $this->getSupplierDetails($companyId),
                'category' => $this->getCategoryDetails($companyId, $categoryName),
                'planPayments' => $this->getPlanPaymentDetails(Auth::user()->company),
                default => [],
            };

            return response()->json([
                'status' => 1,
                'message' => 'Dashboard details fetched successfully.',
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to fetch dashboard details',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function getDateRange($type, $startDate = null, $endDate = null)
    {
        $today = Carbon::now();

        return match ($type) {
            'monthly' => [$today->copy()->startOfMonth(), $today->copy()->endOfMonth()->setTime(23, 59, 59)],
            'yearly' => [$today->copy()->startOfYear(), $today->copy()->endOfYear()->setTime(23, 59, 59)],
            'custom' => [
                Carbon::parse($startDate)->startOfDay(),
                Carbon::parse($endDate)->endOfDay()->setTime(23, 59, 59),
            ],
            default => [$today->copy()->startOfDay(), $today->copy()->endOfDay()->setTime(23, 59, 59)],
        };
    }

    private function getPreviousDateRange($type, $start, $end)
    {
        $diff = $start->diffInDays($end);

        return match ($type) {
            'daily' => [
                $start->copy()->subDay()->startOfDay(),
                $end->copy()->subDay()->endOfDay()->setTime(23, 59, 59),
            ],
            'monthly' => [
                $start->copy()->subMonth()->startOfMonth(),
                $end->copy()->subMonth()->endOfMonth()->setTime(23, 59, 59),
            ],
            'yearly' => [
                $start->copy()->subYear()->startOfYear(),
                $end->copy()->subYear()->endOfYear()->setTime(23, 59, 59),
            ],
            'custom' => [
                $start->copy()->subDays($diff + 1)->startOfDay(),
                $end->copy()->subDays($diff + 1)->endOfDay()->setTime(23, 59, 59),
            ],
            default => [
                $start->copy()->subDay()->startOfDay(),
                $end->copy()->subDay()->endOfDay()->setTime(23, 59, 59),
            ],
        };
    }

    private function getSalesData($type, $start, $end, $companyId)
    {
        if ($type === 'yearly') {
            return Invoice::query()
                ->selectRaw('MONTH(created_at) as period_month, SUM(total) as total_sales')
                ->where('type', 'sale')
                ->where('company_id', $companyId)
                ->whereBetween('created_at', [$start, $end])
                ->groupByRaw('MONTH(created_at)')
                ->orderByRaw('MONTH(created_at)')
                ->get()
                ->map(fn ($row) => [
                    'name' => Carbon::create($start->year, (int) $row->period_month, 1)->format('M'),
                    'sales' => (float) $row->total_sales,
                ])
                ->toArray();
        }

        if ($type === 'custom' && $start->diffInDays($end) > 31) {
            return Invoice::query()
                ->selectRaw('YEAR(created_at) as period_year, MONTH(created_at) as period_month, SUM(total) as total_sales')
                ->where('type', 'sale')
                ->where('company_id', $companyId)
                ->whereBetween('created_at', [$start, $end])
                ->groupByRaw('YEAR(created_at), MONTH(created_at)')
                ->orderByRaw('YEAR(created_at), MONTH(created_at)')
                ->get()
                ->map(fn ($row) => [
                    'name' => Carbon::create((int) $row->period_year, (int) $row->period_month, 1)->format('M Y'),
                    'sales' => (float) $row->total_sales,
                ])
                ->toArray();
        }

        return Invoice::query()
            ->selectRaw('DATE(created_at) as period_date, SUM(total) as total_sales')
            ->where('type', 'sale')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->groupByRaw('DATE(created_at)')
            ->orderByRaw('DATE(created_at)')
            ->get()
            ->map(fn ($row) => [
                'name' => Carbon::parse($row->period_date)->format('d'),
                'sales' => (float) $row->total_sales,
            ])
            ->toArray();
    }

    private function getStockTimeValueItems($companyId): array
    {
        if (blank($companyId)) {
            return [];
        }

        return InventoryItem::with(['product.category', 'product.brand', 'warehouse'])
            ->where('company_id', $companyId)
            ->where('quantity', '>', 0)
            ->orderBy('created_at')
            ->take(10)
            ->get()
            ->map(function (InventoryItem $item) {
                $ageDays = max(1, (int) $item->created_at->startOfDay()->diffInDays(now()->startOfDay()) + 1);
                $stockTimeValue = StockTimeValue::fromAgeInDays($ageDays);

                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product' => $item->product?->name ?? 'N/A',
                    'thumbnail' => $item->product?->thumbnail ?? '',
                    'barcode' => $item->product?->code ?? '',
                    'category' => $item->product?->category?->title ?? '',
                    'brand' => $item->product?->brand?->title ?? '',
                    'warehouse' => $item->warehouse?->name ?? 'Main',
                    'batch_no' => $item->lot_number ?? '',
                    'quantity' => (float) $item->quantity,
                    'purchase_price' => (float) $item->purchase_price,
                    'selling_price' => (float) $item->price,
                    'stock_date' => $item->created_at->format('Y-m-d'),
                    'age_days' => $ageDays,
                    'stv' => $stockTimeValue->toArray(),
                    'suggestion' => $stockTimeValue === StockTimeValue::Day61Above
                        ? 'Recommend discount / bundle'
                        : "Maintain {$stockTimeValue->value()} value",
                ];
            })
            ->toArray();
    }

    private function getInventorySummary(string $companyId, Carbon $start, Carbon $end): array
    {
        $stats = InventoryItem::query()
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->where('quantity', '>', 0)
            ->selectRaw('
                COALESCE(SUM(quantity), 0) as total_stock,
                COALESCE(SUM(quantity * purchase_price), 0) as total_stock_amount,
                COALESCE(SUM(CASE WHEN quantity <= alert_quantity THEN 1 ELSE 0 END), 0) as low_stock_items
            ')
            ->first();

        return [
            'total_stock' => (float) ($stats->total_stock ?? 0),
            'total_stock_amount' => (float) ($stats->total_stock_amount ?? 0),
            'low_stock_items' => (int) ($stats->low_stock_items ?? 0),
        ];
    }

    private function getInvoiceSummary(string $companyId, Carbon $start, Carbon $end): array
    {
        $stats = Invoice::query()
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw("
                COALESCE(SUM(CASE WHEN type = 'sale' THEN 1 ELSE 0 END), 0) as sale_count,
                COALESCE(SUM(CASE WHEN type = 'sale' THEN total ELSE 0 END), 0) as sale_total,
                COALESCE(SUM(CASE WHEN type = 'purchase' THEN 1 ELSE 0 END), 0) as purchase_count,
                COALESCE(SUM(CASE WHEN type = 'purchase' THEN total ELSE 0 END), 0) as purchase_total
            ")
            ->first();

        return [
            'sale_count' => (int) ($stats->sale_count ?? 0),
            'sale_total' => (float) ($stats->sale_total ?? 0),
            'purchase_count' => (int) ($stats->purchase_count ?? 0),
            'purchase_total' => (float) ($stats->purchase_total ?? 0),
        ];
    }

    private function getReturnCount(string $companyId, Carbon $start, Carbon $end): int
    {
        return InvoiceItem::query()
            ->where('company_id', $companyId)
            ->where('type', 'return')
            ->where('is_returned', 1)
            ->whereBetween('created_at', [$start, $end])
            ->count();
    }

    private function getCategoryDistribution(string $companyId): array
    {
        $categories = Category::withoutGlobalScope('company')
            ->whereNull('ancestor_id')
            ->where('company_id', $companyId)
            ->with('children:id,ancestor_id')
            ->get(['id', 'title']);

        $productCounts = Product::query()
            ->where('company_id', $companyId)
            ->whereNotNull('category_id')
            ->selectRaw('category_id, COUNT(*) as total_products')
            ->groupBy('category_id')
            ->pluck('total_products', 'category_id');

        return $categories->map(function ($category) use ($productCounts) {
            $categoryIds = collect([$category->id])->merge($category->children->pluck('id'));
            $count = $categoryIds->sum(fn ($id) => (int) ($productCounts[$id] ?? 0));

            return [
                'name' => $category->title,
                'value' => $count,
            ];
        })->filter(fn ($item) => $item['value'] > 0)->values()->all();
    }

    private function getSalesDetails(string $companyId, Carbon $start, Carbon $end): array
    {
        return Invoice::with(['items.product', 'customer'])
            ->where('type', 'sale')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn ($sale) => [
                'orderId' => $sale->id,
                'product' => $sale->items->pluck('product.name')->implode(', ') ?: 'N/A',
                'customer' => $sale->customer ? trim("{$sale->customer->first_name} {$sale->customer->last_name}") : 'N/A',
                'quantity' => (float) $sale->items->sum('qty'),
                'price' => (float) $sale->total,
                'status' => match ($sale->payment_status) {
                    1 => 'Completed',
                    2 => 'Pending',
                    3 => 'Cancelled',
                    default => 'Unknown',
                },
                'date' => $sale->created_at->format('Y-m-d'),
            ])->toArray();
    }

    private function getPurchaseDetails(string $companyId, Carbon $start, Carbon $end): array
    {
        return Invoice::with(['items.product', 'customer'])
            ->where('type', 'purchase')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn ($purchase) => [
                'orderId' => $purchase->id,
                'product' => $purchase->items->pluck('product.name')->implode(', ') ?: 'N/A',
                'customer' => $purchase->customer ? trim("{$purchase->customer->first_name} {$purchase->customer->last_name}") : 'N/A',
                'quantity' => (float) $purchase->items->sum('qty'),
                'price' => (float) $purchase->total,
                'status' => match ($purchase->payment_status) {
                    1 => 'Completed',
                    2 => 'Pending',
                    3 => 'Cancelled',
                    default => 'Unknown',
                },
                'date' => $purchase->created_at->format('Y-m-d'),
            ])->toArray();
    }

    private function getStockDetails(string $companyId, Carbon $start, Carbon $end): array
    {
        return InventoryItem::with(['product.category', 'product.brand', 'warehouse'])
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$start, $end])
            ->where('quantity', '>', 0)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'warehouse_id' => $item->warehouse?->name ?? 'Main Warehouse',
                'batch_no' => $item->lot_number ?? '',
                'product' => $item->product?->name ?? 'N/A',
                'thumbnail' => $item->product?->thumbnail ?? '',
                'barcode' => $item->product?->code ?? '',
                'category' => $item->product?->category?->title ?? '',
                'brand' => $item->product?->brand?->title ?? '',
                'total_qty' => (float) $item->quantity,
                'selling_price' => (float) $item->price,
                'stock_price' => (float) $item->purchase_price,
            ])->toArray();
    }

    private function getLowStockItemList(string $companyId): array
    {
        return InventoryItem::with(['product.category', 'product.brand', 'warehouse'])
            ->where('company_id', $companyId)
            ->where('quantity', '>', 0)
            ->whereColumn('quantity', '<=', 'alert_quantity')
            ->orderBy('quantity')
            ->limit(100)
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'batch_no' => $item->lot_number ?? '',
                'product' => $item->product?->name ?? 'N/A',
                'thumbnail' => $item->product?->thumbnail ?? '',
                'barcode' => $item->product?->code ?? '',
                'category' => $item->product?->category?->title ?? '',
                'brand' => $item->product?->brand?->title ?? '',
                'quantity' => (float) $item->quantity,
                'alert_quantity' => (float) $item->alert_quantity,
                'warehouse' => $item->warehouse?->name ?? 'Main',
            ])->toArray();
    }

    private function getReturnDetails(string $companyId, Carbon $start, Carbon $end): array
    {
        return InvoiceItem::query()
            ->where('company_id', $companyId)
            ->where('type', 'return')
            ->where('is_returned', 1)
            ->whereBetween('created_at', [$start, $end])
            ->with(['invoice.customer', 'product'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn ($item) => [
                'orderId' => $item->id,
                'product' => $item->product?->name ?? 'N/A',
                'customer' => $item->invoice?->customer ? trim("{$item->invoice->customer->first_name} {$item->invoice->customer->last_name}") : 'N/A',
                'quantity' => (float) $item->qty,
                'price' => (float) $item->total,
                'status' => 'Returned',
                'date' => $item->created_at->format('Y-m-d'),
            ])->toArray();
    }

    private function getProductDetails(string $companyId): array
    {
        $stockByProduct = InventoryItem::query()
            ->where('company_id', $companyId)
            ->selectRaw('product_id, COALESCE(SUM(quantity), 0) as total_stock')
            ->groupBy('product_id')
            ->pluck('total_stock', 'product_id');

        return Product::with(['category', 'brand'])
            ->where('company_id', $companyId)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($product) => [
                'id' => $product->id,
                'thumbnail' => $product->thumbnail,
                'barcode' => $product->code,
                'name' => $product->name,
                'category' => $product->category?->title ?? 'N/A',
                'brand' => $product->brand?->title ?? 'N/A',
                'stock' => (float) ($stockByProduct[$product->id] ?? 0),
            ])->toArray();
    }

    private function getCategoryDetails(string $companyId, ?string $categoryName): array
    {
        $stockByProduct = InventoryItem::query()
            ->where('company_id', $companyId)
            ->selectRaw('product_id, COALESCE(SUM(quantity), 0) as total_stock')
            ->groupBy('product_id')
            ->pluck('total_stock', 'product_id');

        return Product::with('category')
            ->where('company_id', $companyId)
            ->when($categoryName, function ($query) use ($categoryName) {
                $query->whereHas('category', fn ($categoryQuery) => $categoryQuery->where('title', $categoryName));
            })
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($product) => [
                'id' => $product->id,
                'name' => $product->name,
                'stock' => (float) ($stockByProduct[$product->id] ?? 0),
                'price' => (float) ($product->price ?? 0),
                'category' => $product->category?->title ?? 'N/A',
                'thumbnail' => $product->thumbnail ?? '',
                'barcode' => $product->code ?? '',
            ])->toArray();
    }

    private function getCustomerDetails(string $companyId): array
    {
        return User::query()
            ->where('role', 2)
            ->where('company_id', $companyId)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get(['id', 'first_name', 'last_name', 'email', 'phone', 'username', 'profile_image'])
            ->toArray();
    }

    private function getSupplierDetails(string $companyId): array
    {
        return Supplier::query()
            ->where('status', 1)
            ->where('company_id', $companyId)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get(['id', 'name', 'email', 'phone_number as phone', 'address'])
            ->toArray();
    }

    private function getPlanPaymentDetails($company): array
    {
        $latestPlanPayment = PlanPaymentLog::with(['plan:id,name,billing_period,price', 'gateway:id,name,gateway_type,currency_id', 'currency:id,code'])
            ->where('company_id', $company?->company_id)
            ->where(function ($query) {
                $query->where('status', '!=', 'pending')
                    ->orWhereHas('gateway', fn ($gatewayQuery) => $gatewayQuery->where('gateway_type', 'manual'))
                    ->orWhereRaw('LOWER(gateway_name) LIKE ?', ['%bank%']);
            })
            ->orderByDesc('created_at')
            ->first();

        return [
            'current_plan' => $company?->saasPlan,
            'plan_subscribed_at' => optional($company?->plan_subscribed_at)->toDateTimeString(),
            'latest_payment' => $latestPlanPayment,
        ];
    }
}

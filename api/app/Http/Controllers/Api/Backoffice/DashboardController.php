<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Currency;
use App\Models\Gateway;
use App\Models\PlanPaymentLog;
use App\Models\SaasPlan;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private function ensureSuperAdmin(): ?JsonResponse
    {
        $user = auth()->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return null;
    }

    public function index(): JsonResponse
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();
        $startOfPrevMonth = $now->copy()->subMonth()->startOfMonth();
        $endOfPrevMonth = $now->copy()->subMonth()->endOfMonth();

        $companyStats = Company::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active')
            ->selectRaw('SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as inactive')
            ->first();

        $planStats = SaasPlan::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active')
            ->first();

        $gatewayStats = Gateway::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active')
            ->first();

        $currencyStats = Currency::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active')
            ->first();

        $paymentStats = PlanPaymentLog::query()
            ->selectRaw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending")
            ->selectRaw("SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved")
            ->selectRaw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->selectRaw("SUM(CASE WHEN status = 'approved' AND created_at >= ? THEN payable_amount ELSE 0 END) as this_month_revenue", [$startOfMonth])
            ->selectRaw("SUM(CASE WHEN status = 'approved' AND created_at BETWEEN ? AND ? THEN payable_amount ELSE 0 END) as prev_month_revenue", [$startOfPrevMonth, $endOfPrevMonth])
            ->first();

        $totalCompanies = (int) ($companyStats->total ?? 0);
        $activeCompanies = (int) ($companyStats->active ?? 0);
        $inactiveCompanies = (int) ($companyStats->inactive ?? 0);

        $totalPlans = (int) ($planStats->total ?? 0);
        $activePlans = (int) ($planStats->active ?? 0);

        $totalGateways = (int) ($gatewayStats->total ?? 0);
        $activeGateways = (int) ($gatewayStats->active ?? 0);

        $totalCurrencies = (int) ($currencyStats->total ?? 0);
        $activeCurrencies = (int) ($currencyStats->active ?? 0);

        $pendingPayments = (int) ($paymentStats->pending ?? 0);
        $approvedPayments = (int) ($paymentStats->approved ?? 0);
        $rejectedPayments = (int) ($paymentStats->rejected ?? 0);

        $thisMonthRevenue = (float) ($paymentStats->this_month_revenue ?? 0);
        $prevMonthRevenue = (float) ($paymentStats->prev_month_revenue ?? 0);

        $recentCompanies = Company::query()
            ->select(['company_id', 'name', 'email', 'status', 'created_at'])
            ->latest('created_at')
            ->limit(5)
            ->get();

        $recentPayments = PlanPaymentLog::query()
            ->with([
                'company:company_id,name,email',
                'plan:id,name',
                'currency:id,code,symbol',
                'gateway:id,name',
            ])
            ->latest('created_at')
            ->limit(8)
            ->get();

        $revenueRows = PlanPaymentLog::query()
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, SUM(payable_amount) as total")
            ->where('status', 'approved')
            ->where('created_at', '>=', $now->copy()->subMonths(5)->startOfMonth())
            ->groupBy(DB::raw("DATE_FORMAT(created_at, '%Y-%m')"))
            ->orderBy(DB::raw("DATE_FORMAT(created_at, '%Y-%m')"), 'asc')
            ->get();

        $revenueMap = $revenueRows->pluck('total', 'month_key');
        $revenueSeries = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = $now->copy()->subMonths($i);
            $key = $month->format('Y-m');
            $revenueSeries[] = [
                'month' => $month->format('M Y'),
                'total' => round((float) ($revenueMap[$key] ?? 0), 2),
            ];
        }

        return response()->json([
            'status' => 1,
            'message' => 'Backoffice dashboard fetched successfully.',
            'data' => [
                'overview' => [
                    'total_companies' => $totalCompanies,
                    'active_companies' => $activeCompanies,
                    'inactive_companies' => $inactiveCompanies,
                    'total_plans' => $totalPlans,
                    'active_plans' => $activePlans,
                    'total_gateways' => $totalGateways,
                    'active_gateways' => $activeGateways,
                    'total_currencies' => $totalCurrencies,
                    'active_currencies' => $activeCurrencies,
                    'pending_payments' => $pendingPayments,
                    'approved_payments' => $approvedPayments,
                    'rejected_payments' => $rejectedPayments,
                    'monthly_revenue' => round($thisMonthRevenue, 2),
                    'previous_month_revenue' => round($prevMonthRevenue, 2),
                ],
                'charts' => [
                    'company_status' => [
                        'active' => $activeCompanies,
                        'inactive' => $inactiveCompanies,
                    ],
                    'payment_status' => [
                        'pending' => $pendingPayments,
                        'approved' => $approvedPayments,
                        'rejected' => $rejectedPayments,
                    ],
                    'revenue_series' => $revenueSeries,
                ],
                'recent_companies' => $recentCompanies,
                'recent_payments' => $recentPayments,
            ],
        ]);
    }
}

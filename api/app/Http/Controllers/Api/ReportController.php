<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Report\ReportCashiersRequest;
use App\Http\Requests\Api\Report\ReportCategoryWiseSalesRequest;
use App\Http\Requests\Api\Report\ReportCategoryWiseStockRequest;
use App\Http\Requests\Api\Report\ReportDailyMonthlyPurchaseRequest;
use App\Http\Requests\Api\Report\ReportDailyMonthlySalesRequest;
use App\Http\Requests\Api\Report\ReportDuePaymentsListRequest;
use App\Http\Requests\Api\Report\ReportProductLedgerRequest;
use App\Http\Requests\Api\Report\ReportProfitMarginRequest;
use App\Http\Requests\Api\Report\ReportSupplierPurchaseRequest;
use App\Http\Requests\Api\Report\ReportTimesheetRequest;
use App\Http\Requests\Api\Report\ReportVerifyProductReturnRequest;
use App\Services\Api\ReportControllerService;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private readonly ReportControllerService $service)
    {
    }

    public function dailyMonthlySalesReport(ReportDailyMonthlySalesRequest $request)
    {
        return $this->service->dailyMonthlySalesReport($request);
    }

    public function dailyMonthlyPurchaseReport(ReportDailyMonthlyPurchaseRequest $request)
    {
        return $this->service->dailyMonthlyPurchaseReport($request);
    }

    public function supplierPurchaseReport(ReportSupplierPurchaseRequest $request)
    {
        return $this->service->supplierPurchaseReport($request);
    }

    public function categoryWiseStockReport(ReportCategoryWiseStockRequest $request)
    {
        return $this->service->categoryWiseStockReport($request);
    }

    public function categoryWiseSalesReport(ReportCategoryWiseSalesRequest $request)
    {
        return $this->service->categoryWiseSalesReport($request);
    }

    public function duePaymentsList(ReportDuePaymentsListRequest $request)
    {
        return $this->service->duePaymentsList($request);
    }

    public function productLedger(ReportProductLedgerRequest $request)
    {
        return $this->service->productLedger($request);
    }

    public function timesheetReport(ReportTimesheetRequest $request)
    {
        return $this->service->timesheetReport($request);
    }

    public function cashiers(ReportCashiersRequest $request)
    {
        return $this->service->cashiers($request);
    }

    public function verifyProductReturn(ReportVerifyProductReturnRequest $request)
    {
        return $this->service->verifyProductReturn($request);
    }

    public function profitMarginReport(ReportProfitMarginRequest $request)
    {
        return $this->service->profitMarginReport($request);
    }

    public function expireProductReport(Request $request)
    {
        return $this->service->expireProductReport($request);
    }

    public function accountingReport(Request $request)
    {
        return $this->service->accountsReport($request);
    }

    public function accountsReport(Request $request)
    {
        return $this->service->accountsReport($request);
    }
}

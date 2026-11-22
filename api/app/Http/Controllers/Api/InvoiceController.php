<?php

namespace App\Http\Controllers\Api;

use App\Data\FeaturePreference;
use App\Enums\SalesChannel;
use App\Http\Controllers\Controller;
use App\Services\Api\FeaturePreferenceService;
use App\Services\Api\InvoiceService;
use App\Services\ProductBundleService;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceService $service)
    {
    }

    public function list(Request $request)
    {
        return $this->service->list($request);
    }

    public function draftsList(Request $request)
    {
        return $this->service->draftsList($request);
    }

    public function store(
        Request $request,
        ProductBundleService $productBundleService,
        FeaturePreferenceService $featureService
    )
    {
        $channelCode = $request->input('type') === 'sale'
            && $featureService->isEnabled(FeaturePreference::SALES_CHANNEL->value)
            ? SalesChannel::PosStore->value
            : null;

        return $this->service->store($request, $productBundleService, $channelCode);
    }

    public function dailyMonthlySalesReport(Request $request)
    {
        return $this->service->dailyMonthlySalesReport($request);
    }

    public function payInstallment(Request $request, $schedule_id)
    {
        return $this->service->payInstallment($request, $schedule_id);
    }

    public function payInvoiceDue(Request $request, $id)
    {
        return $this->service->payInvoiceDue($request, $id);
    }

    public function invoiceItemReturn(Request $request)
    {
        return $this->service->invoiceItemReturn($request);
    }

    public function returnPreview(Request $request, string $invoiceId)
    {
        return $this->service->returnPreview($request, $invoiceId);
    }

    public function returnStore(Request $request, string $invoiceId)
    {
        return $this->service->returnStore($request, $invoiceId);
    }

    public function approveSalesReturn(Request $request, string $salesReturnId)
    {
        return $this->service->approveSalesReturn($request, $salesReturnId);
    }

    public function dailySellReturnReport(Request $request)
    {
        return $this->service->dailySellReturnReport($request);
    }

    public function productWiseReturnReport(Request $request)
    {
        return $this->service->productWiseReturnReport($request);
    }

    public function customerWiseReturnReport(Request $request)
    {
        return $this->service->customerWiseReturnReport($request);
    }

    public function cashierWiseReturnReport(Request $request)
    {
        return $this->service->cashierWiseReturnReport($request);
    }

    public function damagedReturnReport(Request $request)
    {
        return $this->service->damagedReturnReport($request);
    }

    public function netSalesAfterReturnReport(Request $request)
    {
        return $this->service->netSalesAfterReturnReport($request);
    }

    public function sellReturnLogs(Request $request)
    {
        return $this->service->sellReturnLogs($request);
    }

    public function update(Request $request, $id)
    {
        return $this->service->update($request, $id);
    }

    public function delete(Request $request, $id = null)
    {
        return $this->service->delete($request, $id);
    }

    public function destroyMultiple(Request $request)
    {
        return $this->service->destroyMultiple($request);
    }

    public function verifyCouponOrGiftCard(Request $request)
    {
        return $this->service->verifyCouponOrGiftCard($request);
    }

    public function download($id)
    {
        return $this->service->download($id);
    }

    public function sendEmail(Request $request, $id)
    {
        return $this->service->sendEmail($request, $id);
    }
}

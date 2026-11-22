<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Purchase\PurchaseAddReturnPaymentRequest;
use App\Http\Requests\Api\Purchase\PurchaseGetCombinationsRequest;
use App\Http\Requests\Api\Purchase\PurchaseInventoryCheckRequest;
use App\Http\Requests\Api\Purchase\PurchaseListRequest;
use App\Http\Requests\Api\Purchase\PurchaseReturnListRequest;
use App\Http\Requests\Api\Purchase\PurchaseStockInListRequest;
use App\Http\Requests\Api\Purchase\PurchaseStockOverviewRequest;
use App\Http\Requests\Api\Purchase\PurchaseStoreInvoiceRequest;
use App\Http\Requests\Api\Purchase\PurchaseStoreRequest;
use App\Http\Requests\Api\Purchase\PurchaseStoreReturnRequest;
use App\Http\Requests\Api\Purchase\PurchaseUpdateQuantityRequest;
use App\Http\Requests\Api\Purchase\PurchaseUpdateRequest;
use App\Services\Api\PurchaseControllerService;

class PurchaseController extends Controller
{
    public function __construct(private readonly PurchaseControllerService $service)
    {
    }

    public function list(PurchaseListRequest $request)
    {
        return $this->service->list($request);
    }

    public function stockInList(PurchaseStockInListRequest $request)
    {
        return $this->service->stockInList($request);
    }

    public function purchaseReturnList(PurchaseReturnListRequest $request)
    {
        return $this->service->purchaseReturnList($request);
    }

    public function storePurchaseReturn(PurchaseStoreReturnRequest $request)
    {
        return $this->service->storePurchaseReturn($request);
    }

    public function addPurchaseReturnPayment(PurchaseAddReturnPaymentRequest $request, string $id)
    {
        return $this->service->addPurchaseReturnPayment($request, $id);
    }

    public function stockOverview(PurchaseStockOverviewRequest $request)
    {
        return $this->service->stockOverview($request);
    }

    public function store(PurchaseStoreRequest $request)
    {
        return $this->service->store($request);
    }

    public function salesChannels()
    {
        return $this->service->salesChannels();
    }

    public function updateQuantity(PurchaseUpdateQuantityRequest $request)
    {
        return $this->service->updateQuantity($request);
    }

    public function getProductCombinations(PurchaseGetCombinationsRequest $request, $productId)
    {
        return $this->service->getProductCombinations($request, $productId);
    }

    public function update(PurchaseUpdateRequest $request, $id)
    {
        return $this->service->update($request, $id);
    }

    public function delete($id)
    {
        return $this->service->delete($id);
    }

    public function getInvoice($invoiceNo = null)
    {
        return $this->service->getInvoice($invoiceNo);
    }

    public function storeInvoice(PurchaseStoreInvoiceRequest $request, $invoiceNo)
    {
        return $this->service->storeInvoice($request, $invoiceNo);
    }

    public function inventoryCheck(PurchaseInventoryCheckRequest $request)
    {
        return $this->service->inventoryCheck($request);
    }
}

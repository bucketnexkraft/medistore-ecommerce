<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\ProductBarcodeStoreService;
use Illuminate\Http\Request;

class ProductBarcodeStoreController extends Controller
{
    public function __construct(private readonly ProductBarcodeStoreService $productBarcodeStoreService) {}

    public function list(Request $request)
    {
        return $this->productBarcodeStoreService->list($request);
    }

    public function store(Request $request)
    {
        return $this->productBarcodeStoreService->store($request);
    }

    public function update(Request $request, $id)
    {
        return $this->productBarcodeStoreService->update($request, $id);
    }

    public function delete(Request $request, $id = null)
    {
        return $this->productBarcodeStoreService->delete($request, $id);
    }

    public function destroyMultiple(Request $request)
    {
        return $this->productBarcodeStoreService->destroyMultiple($request);
    }
}

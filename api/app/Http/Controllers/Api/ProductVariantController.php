<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ProductVariant\ProductVariantDeleteRequest;
use App\Http\Requests\Api\ProductVariant\ProductVariantDestroyMultipleRequest;
use App\Http\Requests\Api\ProductVariant\ProductVariantListRequest;
use App\Http\Requests\Api\ProductVariant\ProductVariantStoreRequest;
use App\Http\Requests\Api\ProductVariant\ProductVariantUpdateRequest;
use App\Http\Requests\Api\ProductVariant\ProductVariantUpdateStatusRequest;
use App\Services\Api\ProductVariantService;

class ProductVariantController extends Controller
{
    public function __construct(private readonly ProductVariantService $service)
    {
    }

    public function list(ProductVariantListRequest $request)
    {
        return $this->service->list($request);
    }

    public function store(ProductVariantStoreRequest $request)
    {
        return $this->service->store($request);
    }

    public function update(ProductVariantUpdateRequest $request, $id)
    {
        return $this->service->update($request, $id);
    }

    public function updateStatus(ProductVariantUpdateStatusRequest $request)
    {
        return $this->service->updateStatus($request);
    }

    public function delete(ProductVariantDeleteRequest $request, $id = null)
    {
        return $this->service->delete($request, $id);
    }

    public function destroyMultiple(ProductVariantDestroyMultipleRequest $request)
    {
        return $this->delete($request);
    }
}

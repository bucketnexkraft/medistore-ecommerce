<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ProductBundle\ProductBundleDestroyRequest;
use App\Http\Requests\Api\ProductBundle\ProductBundleIndexRequest;
use App\Http\Requests\Api\ProductBundle\ProductBundlePricePreviewRequest;
use App\Http\Requests\Api\ProductBundle\ProductBundleShowRequest;
use App\Http\Requests\Api\ProductBundle\ProductBundleStoreRequest;
use App\Http\Requests\Api\ProductBundle\ProductBundleUpdateRequest;
use App\Services\Api\ProductBundleControllerService;

class ProductBundleController extends Controller
{
    public function __construct(private readonly ProductBundleControllerService $service)
    {
    }

    public function index(ProductBundleIndexRequest $request)
    {
        return $this->service->index($request);
    }

    public function show(ProductBundleShowRequest $request, $id)
    {
        return $this->service->show($id);
    }

    public function store(ProductBundleStoreRequest $request)
    {
        return $this->service->store($request);
    }

    public function update(ProductBundleUpdateRequest $request, $id)
    {
        return $this->service->update($request, $id);
    }

    public function destroy(ProductBundleDestroyRequest $request, $id)
    {
        return $this->service->destroy($id);
    }

    public function pricePreview(ProductBundlePricePreviewRequest $request, $id)
    {
        return $this->service->pricePreview($request, $id);
    }
}

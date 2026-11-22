<?php

namespace App\Http\Controllers\Api;

use App\Data\FeaturePreference;
use App\Enums\SalesChannel;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Product\ProductDeleteRequest;
use App\Http\Requests\Api\Product\ProductDestroyMultipleRequest;
use App\Http\Requests\Api\Product\ProductFetchCombinationDataRequest;
use App\Http\Requests\Api\Product\ProductListRequest;
use App\Http\Requests\Api\Product\ProductSearchRequest;
use App\Http\Requests\Api\Product\ProductStoreRequest;
use App\Http\Requests\Api\Product\ProductUpdateRequest;
use App\Http\Requests\Api\Product\ProductUpdateStatusRequest;
use App\Services\Api\ProductControllerService;
use App\Services\Api\FeaturePreferenceService;
use App\Services\ProductSearchService;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private readonly ProductControllerService $service)
    {
    }

    public function list(ProductListRequest $request)
    {
        return $this->service->list($request);
    }

    public function store(ProductStoreRequest $request)
    {
        return $this->service->store($request);
    }

    public function update(ProductUpdateRequest $request, $id)
    {
        return $this->service->update($request, $id);
    }

    public function updateStatus(ProductUpdateStatusRequest $request)
    {
        return $this->service->updateStatus($request);
    }

    public function delete(ProductDeleteRequest $request, $id = null)
    {
        return $this->service->delete($request, $id);
    }

    public function details($id)
    {
        return $this->service->details($id);
    }

    public function destroyMultiple(ProductDestroyMultipleRequest $request)
    {
        return $this->service->destroyMultiple($request);
    }

    public function search(
        ProductSearchRequest $request,
        ProductSearchService $service,
        FeaturePreferenceService $featureService
    )
    {
        $searchInput = (array) $request->input('search_value', []);
        $isSaleSearch = !((bool) ($searchInput['for_return'] ?? true));
        $channelCode = $isSaleSearch && $featureService->isEnabled(FeaturePreference::SALES_CHANNEL->value)
            ? SalesChannel::PosStore->value
            : null;

        return $this->service->search($request, $service, $channelCode);
    }

    public function fetchCombinationData(ProductFetchCombinationDataRequest $request)
    {
        return $this->service->fetchCombinationData($request);
    }

    public function getAllProduct()
    {
        return $this->service->getAllProduct();
    }

    public function publicSearch(Request $request)
    {
        return $this->service->publicSearch($request);
    }

    public function publicDetails(string $slug)
    {
        return $this->service->publicDetails($slug);
    }

    public function publicCombinations(Request $request, string $productId)
    {
        return $this->service->publicCombinations($request, $productId);
    }

    public function getProductOptions()
    {
        return $this->service->getProductOptions();
    }

    public function getVariantAttributes(\Illuminate\Http\Request $request)
    {
        return $this->service->getVariantAttributes($request);
    }

    public function getStockGroup($stock_group)
    {
        return $this->service->getStockGroup($stock_group);
    }

    public function generateDescription(Request $request)
    {
        return $this->service->generateDescription($request);
    }
}

<?php

namespace App\Http\Controllers\Api\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Api\ContentService;
use App\Support\EcommerceCompanyContext;
use Illuminate\Support\Facades\Cache;

class StorefrontCatalogController extends Controller
{
    public function __construct(private readonly ContentService $contentService) {}

    private function demoCached(string $key, callable $loader)
    {
        if (! request()->boolean('is_demo')) {
            return $loader();
        }

        $payload = Cache::remember(
            'demo-preview:' . $key . ':' . sha1(request()->fullUrl()),
            now()->addMinutes(10),
            fn () => $loader()->getData(true)
        );

        return response()->json($payload);
    }

    private function liveCached(string $key, callable $loader)
    {
        if (request()->boolean('is_demo')) {
            return $loader();
        }

        $companyId = EcommerceCompanyContext::currentCompanyId() ?: 'global';
        $cacheKey = 'storefront:live:'.$key.':'.$companyId.':'.sha1(request()->fullUrl());
        $json = Cache::remember($cacheKey, now()->addSeconds(30), fn () => $loader()->getContent());

        return response($json, 200, ['Content-Type' => 'application/json']);
    }

    public function landingProducts()
    {
        return $this->demoCached('products', fn () => $this->liveCached('products', fn () => $this->contentService->landingProducts()));
    }

    public function landingBrands()
    {
        return $this->demoCached('brands', fn () => $this->liveCached('brands', fn () => $this->contentService->landingBrands()));
    }

    public function landingMenu()
    {
        return $this->contentService->landingMenu();
    }

    public function landingMegaCategories()
    {
        return $this->contentService->landingMegaCategories();
    }

    public function landingCategories()
    {
        return $this->contentService->landingCategories();
    }

    public function landingCategoryDetails(string $slug)
    {
        return $this->contentService->landingCategoryDetails($slug);
    }
}

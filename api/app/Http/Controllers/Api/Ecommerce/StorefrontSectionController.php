<?php

namespace App\Http\Controllers\Api\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Api\ContentService;
use Illuminate\Support\Facades\Cache;

class StorefrontSectionController extends Controller
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

    public function landingHero()
    {
        return $this->contentService->landingHero();
    }

    public function landingFeaturedProducts()
    {
        return $this->contentService->landingFeaturedProducts();
    }

    public function landingHotCategories()
    {
        return $this->contentService->landingHotCategories();
    }

    public function landingFlashDeals()
    {
        return $this->contentService->landingFlashDeals();
    }

    public function landingJustForYou()
    {
        return $this->contentService->landingJustForYou();
    }

    public function landingFooter()
    {
        return $this->demoCached('footer', fn () => $this->contentService->landingFooter());
    }

    public function landingPricing()
    {
        return $this->contentService->landingPricing();
    }
}

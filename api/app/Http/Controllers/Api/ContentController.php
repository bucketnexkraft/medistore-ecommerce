<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\ContentService;

class ContentController extends Controller
{
    public function __construct(private readonly ContentService $contentService) {}

    public function submitContact()
    {
        return $this->contentService->submitContact();
    }

    public function subscribeNewsletter()
    {
        return $this->contentService->subscribeNewsletter();
    }

    public function landingSettings()
    {
        return $this->contentService->landingSettings();
    }

    public function publicSetting(string $key)
    {
        return $this->contentService->publicSetting($key);
    }

    public function landingCurrencies()
    {
        return $this->contentService->landingCurrencies();
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

    public function landingProducts()
    {
        return $this->contentService->landingProducts();
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
        return $this->contentService->landingFooter();
    }

    public function landingPricing()
    {
        return $this->contentService->landingPricing();
    }

    public function landingBlog()
    {
        return $this->contentService->landingBlog();
    }

    public function landingBlogDetails(string $slug)
    {
        return $this->contentService->landingBlogDetails($slug);
    }

    public function landingBlogCategory(string $slug)
    {
        return $this->contentService->landingBlogCategory($slug);
    }

    public function home()
    {
        return $this->contentService->home();
    }

    public function page(?string $slug = null)
    {
        return $this->contentService->page($slug);
    }
}

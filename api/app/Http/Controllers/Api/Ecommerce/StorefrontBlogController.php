<?php

namespace App\Http\Controllers\Api\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Api\ContentService;

class StorefrontBlogController extends Controller
{
    public function __construct(private readonly ContentService $contentService) {}

    public function landingBlog()
    {
        return $this->contentService->landingBlog();
    }

    public function landingBlogCategory(string $slug)
    {
        return $this->contentService->landingBlogCategory($slug);
    }

    public function landingBlogDetails(string $slug)
    {
        return $this->contentService->landingBlogDetails($slug);
    }
}

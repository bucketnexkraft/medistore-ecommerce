<?php

namespace App\Http\Controllers\Api\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Api\ContentService;

class StorefrontPageController extends Controller
{
    public function __construct(private readonly ContentService $contentService) {}

    public function home()
    {
        return $this->contentService->home();
    }

    public function page(?string $slug = null)
    {
        return $this->contentService->page($slug);
    }
}

<?php

namespace App\Http\Controllers\Api\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Api\ContentService;

class StorefrontEngagementController extends Controller
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
}

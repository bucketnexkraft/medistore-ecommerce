<?php

namespace App\Http\Controllers\Api\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\Api\ContentService;

class StorefrontSettingsController extends Controller
{
    public function __construct(private readonly ContentService $contentService) {}

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

    function preferences()
    {
        return $this->contentService->landingPreferences();
        
    }

    public function socialAuth()
    {
        return $this->contentService->landingSocialAuth();
    }
}

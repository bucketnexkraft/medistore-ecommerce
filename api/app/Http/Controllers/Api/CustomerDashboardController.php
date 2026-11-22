<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\CustomerDashboardService;

class CustomerDashboardController extends Controller
{
    public function __construct(private readonly CustomerDashboardService $service)
    {
    }

    public function index()
    {
        return $this->service->index();
    }
}

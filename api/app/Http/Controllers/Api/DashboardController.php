<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Dashboard\DashboardIndexRequest;
use App\Services\Api\DashboardService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardService $service)
    {
    }

    public function index(DashboardIndexRequest $request)
    {
        return $this->service->index($request);
    }

    public function details(Request $request)
    {
        return $this->service->details($request);
    }
}

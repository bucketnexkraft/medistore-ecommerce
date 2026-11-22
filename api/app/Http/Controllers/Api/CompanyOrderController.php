<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\CompanyOrderService;
use Illuminate\Http\Request;

class CompanyOrderController extends Controller
{
    public function __construct(private readonly CompanyOrderService $service)
    {
    }

    public function index(Request $request)
    {
        return $this->service->index($request);
    }

    public function store(Request $request)
    {
        return $this->service->store($request);
    }

    public function show(string $id)
    {
        return $this->service->show($id);
    }

    public function updateStatus(Request $request, string $id)
    {
        return $this->service->updateStatus($request, $id);
    }

    public function dispatchToPathao(string $id)
    {
        return $this->service->dispatchToPathao($id);
    }

    public function trackByOrderNumber(Request $request)
    {
        return $this->service->trackByOrderNumber($request);
    }

    public function returnRequests(Request $request)
    {
        return $this->service->returnRequests($request);
    }

    public function approveReturnRequest(Request $request, string $id)
    {
        return $this->service->approveReturnRequest($request, $id);
    }

    public function rejectReturnRequest(Request $request, string $id)
    {
        return $this->service->rejectReturnRequest($request, $id);
    }
}

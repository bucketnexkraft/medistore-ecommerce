<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\StockGuardService;
use Illuminate\Http\Request;

class StockGuardController extends Controller
{
    public function __construct(private readonly StockGuardService $service)
    {
    }

    public function options()
    {
        return response()->json($this->service->options());
    }

    public function index(Request $request)
    {
        return response()->json($this->service->list($request));
    }

    public function store(Request $request)
    {
        return response()->json($this->service->store($request));
    }

    public function approve(string $id)
    {
        $payload = $this->service->approve($id);
        return response()->json($payload, $payload['status'] ? 200 : 422);
    }

    public function reject(string $id, Request $request)
    {
        $payload = $this->service->reject($id, $request);
        return response()->json($payload, $payload['status'] ? 200 : 422);
    }

    public function updateRules(Request $request)
    {
        $payload = $this->service->updateRules($request);
        return response()->json($payload, $payload['status'] ? 200 : 422);
    }
}

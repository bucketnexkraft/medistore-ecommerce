<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\StockTransferService;
use Illuminate\Http\Request;

class StockTransferController extends Controller
{
    public function __construct(private readonly StockTransferService $service)
    {
    }

    public function index(Request $request)
    {
        return response()->json($this->service->list($request), 200);
    }

    public function sourceItems(Request $request)
    {
        return response()->json($this->service->sourceItems($request), 200);
    }

    public function store(Request $request)
    {
        $result = $this->service->store($request);
        return response()->json($result, $result['status'] ? 200 : 422);
    }

    public function report(Request $request)
    {
        return response()->json($this->service->report($request), 200);
    }
}


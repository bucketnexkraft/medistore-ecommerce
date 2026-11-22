<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Stock\StockoutListRequest;
use Illuminate\Http\Request;
use App\Services\Api\StockService;

class StockController extends Controller
{
    public function __construct(private readonly StockService $service)
    {
    }

    public function stockoutList(StockoutListRequest $request)
    {
        return response()->json($this->service->stockoutList($request), 200);
    }

    public function movements(Request $request)
    {
        $payload = $this->service->movements($request);
        return response()->json($payload, $payload['status'] ? 200 : 403);
    }
}

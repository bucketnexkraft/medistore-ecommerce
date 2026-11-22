<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\WarehouseService;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function __construct(private readonly WarehouseService $warehouseService) {}

    public function index(Request $request)
    {
        return $this->warehouseService->index($request);
    }

    public function store(Request $request)
    {
        return $this->warehouseService->store($request);
    }

    public function update(Request $request, $id)
    {
        return $this->warehouseService->update($request, $id);
    }

    public function destroy(Request $request, $id = null)
    {
        return $this->warehouseService->destroy($request, $id);
    }
}

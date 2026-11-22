<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\UnitService;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    public function __construct(private readonly UnitService $unitService) {}

    public function list(Request $request)
    {
        return $this->unitService->list($request);
    }

    public function store(Request $request)
    {
        return $this->unitService->store($request);
    }

    public function update(Request $request, $id)
    {
        return $this->unitService->update($request, $id);
    }

    public function delete(Request $request, $id = null)
    {
        return $this->unitService->delete($request, $id);
    }

    public function updateStatus(Request $request, $id)
    {
        return $this->unitService->updateStatus($request, $id);
    }

    public function updateStatusMultiple(Request $request)
    {
        return $this->unitService->updateStatusMultiple($request);
    }

    public function destroyMultiple(Request $request)
    {
        return $this->unitService->destroyMultiple($request);
    }
}

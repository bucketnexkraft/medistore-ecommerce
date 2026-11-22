<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Brand\BrandDeleteRequest;
use App\Http\Requests\Api\Brand\BrandListRequest;
use App\Http\Requests\Api\Brand\BrandStoreRequest;
use App\Http\Requests\Api\Brand\BrandUpdateRequest;
use App\Http\Requests\Api\Brand\BrandUpdateStatusMultipleRequest;
use App\Http\Requests\Api\Brand\BrandUpdateStatusRequest;
use App\Services\Api\BrandService;

class BrandController extends Controller
{
    public function __construct(private readonly BrandService $service)
    {
    }

    public function list(BrandListRequest $request)
    {
        return response()->json($this->service->list($request), 200);
    }

    public function store(BrandStoreRequest $request)
    {
        [$payload, $status] = $this->service->store($request);
        return response()->json($payload, $status);
    }

    public function update(BrandUpdateRequest $request, $id)
    {
        [$payload, $status] = $this->service->update($request, $id);
        return response()->json($payload, $status);
    }

    public function delete(BrandDeleteRequest $request, $id = null)
    {
        [$payload, $status] = $this->service->delete($request, $id);
        return response()->json($payload, $status);
    }

    public function updateStatus(BrandUpdateStatusRequest $request, $id)
    {
        return response()->json($this->service->updateStatus($request, $id), 200);
    }

    public function updateStatusMultiple(BrandUpdateStatusMultipleRequest $request)
    {
        [$payload, $status] = $this->service->updateStatusMultiple($request);
        return response()->json($payload, $status);
    }

    public function destroyMultiple(BrandDeleteRequest $request)
    {
        return $this->delete($request);
    }
}

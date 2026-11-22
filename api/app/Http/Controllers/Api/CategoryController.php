<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Category\CategoryDeleteRequest;
use App\Http\Requests\Api\Category\CategoryListRequest;
use App\Http\Requests\Api\Category\CategoryStoreRequest;
use App\Http\Requests\Api\Category\CategoryUpdateRequest;
use App\Http\Requests\Api\Category\CategoryUpdateStatusMultipleRequest;
use App\Http\Requests\Api\Category\CategoryUpdateStatusRequest;
use App\Services\Api\CategoryService;

class CategoryController extends Controller
{
    public function __construct(private readonly CategoryService $service)
    {
    }

    public function list(CategoryListRequest $request)
    {
        return response()->json($this->service->list($request), 200);
    }

    public function store(CategoryStoreRequest $request)
    {
        [$payload, $status] = $this->service->store($request);
        return response()->json($payload, $status);
    }

    public function update(CategoryUpdateRequest $request, $id)
    {
        [$payload, $status] = $this->service->update($request, $id);
        return response()->json($payload, $status);
    }

    public function updateStatus(CategoryUpdateStatusRequest $request, $id)
    {
        return response()->json($this->service->updateStatus($request, $id), 200);
    }

    public function delete(CategoryDeleteRequest $request, $id = null)
    {
        [$payload, $status] = $this->service->delete($request, $id);
        return response()->json($payload, $status);
    }

    public function updateStatusMultiple(CategoryUpdateStatusMultipleRequest $request)
    {
        [$payload, $status] = $this->service->updateStatusMultiple($request);
        return response()->json($payload, $status);
    }

    public function destroyMultiple(CategoryDeleteRequest $request)
    {
        return $this->delete($request);
    }
}

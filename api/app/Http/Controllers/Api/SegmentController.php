<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Segment\DeleteSegmentRequest;
use App\Http\Requests\Api\Segment\ListSegmentRequest;
use App\Http\Requests\Api\Segment\StoreSegmentRequest;
use App\Http\Requests\Api\Segment\UpdateSegmentRequest;
use App\Services\Api\SegmentService;

class SegmentController extends Controller
{
    public function __construct(private readonly SegmentService $service)
    {
    }

    public function list(ListSegmentRequest $request)
    {
        return response()->json($this->service->list(), 200);
    }

    public function store(StoreSegmentRequest $request)
    {
        [$payload, $status] = $this->service->store($request);
        return response()->json($payload, $status);
    }

    public function update(UpdateSegmentRequest $request, $id)
    {
        [$payload, $status] = $this->service->update($request, $id);
        return response()->json($payload, $status);
    }

    public function delete(DeleteSegmentRequest $request, $id)
    {
        return response()->json($this->service->delete($id), 200);
    }
}

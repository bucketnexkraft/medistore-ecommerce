<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\WorkSlot\DeleteWorkSlotRequest;
use App\Http\Requests\Api\WorkSlot\IndexWorkSlotRequest;
use App\Http\Requests\Api\WorkSlot\StoreWorkSlotRequest;
use App\Http\Requests\Api\WorkSlot\UpdateWorkSlotRequest;
use App\Services\WorkSlotService;

class WorkSlotController extends Controller
{
    protected $workSlotService;

    public function __construct(WorkSlotService $workSlotService)
    {
        $this->workSlotService = $workSlotService;
    }

    /**
     * List Work Slots with filters & pagination
     */
    public function index(IndexWorkSlotRequest $request)
    {
        try {
            $result = $this->workSlotService->list($request);

            return response()->json([
                'status' => 1,
                'message' => 'Work slots retrieved successfully',
                'data' => $result['data'],
                'meta' => $result['meta'] ?? [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'An error occurred',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a new Work Slot
     */
    public function store(StoreWorkSlotRequest $request)
    {
        try {
            $result = $this->workSlotService->store($request);

            if ($result['status'] === 0) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed',
                    'errors' => $result['errors'],
                ], 422);
            }

            return response()->json([
                'status' => 1,
                'message' => 'Work slot created successfully',
                'data' => $result['data'],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'An error occurred',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update existing Work Slot
     */
    public function update(UpdateWorkSlotRequest $request, $id)
    {
        try {
            $result = $this->workSlotService->update($request, $id);

            if ($result['status'] === 0) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed or slot not found',
                    'errors' => $result['errors'] ?? [],
                ], 422);
            }

            return response()->json([
                'status' => 1,
                'message' => 'Work slot updated successfully',
                'data' => $result['data'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'An error occurred',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete one or multiple Work Slots
     */
    public function delete(DeleteWorkSlotRequest $request, $ids = null)
    {
        try {
            $idsToDelete = $ids ? explode(',', $ids) : $request->input('ids', []);
            if (empty($idsToDelete)) {
                return response()->json([
                    'status' => 0,
                    'message' => 'No IDs provided',
                ], 400);
            }

            $result = $this->workSlotService->delete($idsToDelete);

            return response()->json([
                'status' => 1,
                'message' => $result['message'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'An error occurred',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

}

<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\RewordSetup\DeleteRewordSetupRequest;
use App\Http\Requests\Api\RewordSetup\ListRewordSetupRequest;
use App\Http\Requests\Api\RewordSetup\StoreRewordSetupRequest;
use App\Http\Requests\Api\RewordSetup\UpdateRewordSetupRequest;
use App\Services\RewordSetupService;

class RewordSetupController extends Controller
{
    protected $rewordSetupService;

    public function __construct(RewordSetupService $rewordSetupService)
    {
        $this->rewordSetupService = $rewordSetupService;
    }

    /**
     * List Reword Setups with filters
     */
    public function list(ListRewordSetupRequest $request)
    {
        try {
            $result = $this->rewordSetupService->list($request->filters());

            return response()->json([
                'status' => 1,
                'message' => 'Reward setups retrieved successfully',
                'data' => $result['data'],
                'meta' => $result['meta'],
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
     * Store a new Reword Setup
     */
    public function store(StoreRewordSetupRequest $request)
    {
        try {
            $rewordSetup = $this->rewordSetupService->store($request->payload());

            return response()->json([
                'status' => 1,
                'message' => 'Reward setup created successfully',
                'data' => $rewordSetup,
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
     * Update an existing Reword Setup
     */
    public function update(UpdateRewordSetupRequest $request, $id)
    {
        try {
            $rewordSetup = $this->rewordSetupService->update($request->payload(), (int) $id);

            return response()->json([
                'status' => 1,
                'message' => 'Reward setup updated successfully',
                'data' => $rewordSetup,
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
     * Get a single Reword Setup by ID
     */
    public function getSingleSetup($id = null)
    {
        try {
            $rewordSetup = $this->rewordSetupService->singleSetup($id ? (int) $id : null);

            return response()->json([
                'status' => 1,
                'message' => 'Reward setup retrieved successfully',
                'data' => $rewordSetup,
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
     * Delete Reword Setup(s)
     */
    public function delete(DeleteRewordSetupRequest $request, $ids = null)
    {
        try {
            $validatedIds = $request->validated('ids', []);
            $routeIds = [];

            if (!empty($ids)) {
                $routeIds = array_filter(array_map('intval', explode(',', (string) $ids)));
            }

            $finalIds = array_values(array_unique(array_merge($validatedIds, $routeIds)));
            if (empty($finalIds)) {
                return response()->json([
                    'status' => 0,
                    'message' => 'No reward setup ids provided',
                    'errors' => ['Please provide at least one reward setup id.'],
                ], 422);
            }

            $deletedCount = $this->rewordSetupService->delete($finalIds);

            return response()->json([
                'status' => 1,
                'message' => $deletedCount > 0
                    ? 'Reward setup(s) deleted successfully'
                    : 'No reward setup matched the provided id(s)',
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

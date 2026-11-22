<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DiscountSetup\DiscountSetupDeleteRequest;
use App\Http\Requests\Api\DiscountSetup\DiscountSetupListRequest;
use App\Http\Requests\Api\DiscountSetup\DiscountSetupSingleRequest;
use App\Http\Requests\Api\DiscountSetup\DiscountSetupStoreRequest;
use App\Http\Requests\Api\DiscountSetup\DiscountSetupUpdateRequest;
use App\Http\Requests\Api\DiscountSetup\DiscountSetupUpdateStatusMultipleRequest;
use App\Http\Requests\Api\DiscountSetup\DiscountSetupUpdateStatusRequest;
use App\Services\DiscountSetupService;

class DiscountSetupController extends Controller
{
    public function __construct(private readonly DiscountSetupService $discountSetupService)
    {
    }

    /**
     * List Discount Setups with filters
     */
    public function list(DiscountSetupListRequest $request)
    {
        try {
            $result = $this->discountSetupService->list($request);

            return response()->json([
                'status' => 1,
                'message' => 'Discount setups retrieved successfully',
                'data' => $result['data'],
                'meta' => $result['meta'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'An error occurred',
                'error' => $e->getMessage(),
                'filename' => $e->getFile(),
                'line' => $e->getLine(),
            ], 500);
        }
    }

    /**
     * Store a new Discount Setup
     */
    public function store(DiscountSetupStoreRequest $request)
    {
        try {
            $result = $this->discountSetupService->store($request);

            if ($result['status'] === 0) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Unable to create the discount setup',
                    'errors' => $result['errors'],
                ], 422);
            }

            return response()->json([
                'status' => 1,
                'message' => 'Discount setup created successfully',
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
     * Update an existing Discount Setup
     */
    public function update(DiscountSetupUpdateRequest $request, $id)
    {
        try {
            $result = $this->discountSetupService->update($request, $id);

            if ($result['status'] === 0) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed',
                    'errors' => $result['errors'],
                ], 422);
            }

            return response()->json([
                'status' => 1,
                'message' => 'Discount setup updated successfully',
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
     * Get a single Discount Setup by ID
     */
    public function singleSetup(DiscountSetupSingleRequest $request, $id)
    {
        try {
            $result = $this->discountSetupService->getSingleSetup($id);

            return response()->json([
                'status' => 1,
                'message' => 'Discount setup retrieved successfully',
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
     * Delete a Discount Setup by ID
     */
    public function delete(DiscountSetupDeleteRequest $request, $id)
    {
        try {
            $result = $this->discountSetupService->delete($id);

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

    /**
     * Update status (is_active) for a single Discount Setup
     */
    public function updateStatus(DiscountSetupUpdateStatusRequest $request, $id)
    {
        try {
            $result = $this->discountSetupService->updateStatus($request, $id);

            if ($result['status'] === 0) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed',
                    'errors' => $result['errors'],
                ], 422);
            }

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
    

    /**
     * Update status (is_active) for multiple Discount Setups
     */
    public function updateStatusMultiple(DiscountSetupUpdateStatusMultipleRequest $request)
    {
        try {
            $result = $this->discountSetupService->updateStatusMultiple($request);

            if ($result['status'] === 0) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed',
                    'errors' => $result['errors'],
                ], 422);
            }

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

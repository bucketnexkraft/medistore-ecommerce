<?php

namespace App\Services\Api;

use App\Helpers\AuthHelper;
use App\Models\Company;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WarehouseService
{
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 20); // Changed from perPage to per_page for consistency
        $page = $request->input('page', 1);
        $search = $request->input('search', '');
        $isDefault = $request->input('is_default', null); // New filter for is_default
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        // Validate per_page to prevent abuse
        $perPage = in_array($perPage, [10, 20, 50, 100]) ? $perPage : 20;

        $query = Warehouse::query();

        // Search filter
        if (! empty($search)) {
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('location', 'LIKE', "%{$search}%");
            });
        }

        // is_default filter
        if (! is_null($isDefault)) {
            $query->where('is_default', $isDefault);
        }

        // Sorting
        $query->orderBy($sortField, $sortOrder);

        $warehouses = $query->paginate($perPage, ['*'], 'page', $page);

        $data = $warehouses->map(function ($warehouse) {
            return [
                'id' => $warehouse->id,
                'name' => $warehouse->name,
                'location' => $warehouse->location,
                'is_default' => $warehouse->is_default,
                'company_id' => $warehouse->company_id,
            ];
        });

        return response()->json([
            'status' => 1,
            'message' => 'Warehouses fetched successfully',
            'data' => $data,
            'meta' => [
                'current_page' => $warehouses->currentPage(),
                'per_page' => $warehouses->perPage(),
                'total' => $warehouses->total(),
                'last_page' => $warehouses->lastPage(),
            ],
            'others_data' => [],
        ], 200);
    }

    public function store(Request $request)
    {
        // Check if user is superadmin
        $isSuperAdmin = AuthHelper::isSuperAdmin();

        if (! $isSuperAdmin) {
            $companyId = Auth::user()?->company_id;
            $company = $companyId
                ? Company::query()->with('saasPlan')->where('company_id', $companyId)->first()
                : null;
            $warehouseLimit = (int) ($company?->saasPlan?->warehouse_limit ?? 0);

            if ($warehouseLimit > 0) {
                $warehouseCount = Warehouse::query()
                    ->where('company_id', $companyId)
                    ->count();

                if ($warehouseCount >= $warehouseLimit) {
                    return response()->json([
                        'status' => 0,
                        'message' => "Your plan allows up to {$warehouseLimit} warehouses. Please upgrade your plan to add another warehouse.",
                        'errors' => ["Warehouse limit of {$warehouseLimit} reached."],
                    ], 422);
                }
            }
        }

        // Build validation rules
        $rules = [
            'name' => [
                'required',
                'max:255',
                'string',
            ],
            'location' => 'required|string|max:255',
            'is_default' => 'required|boolean',
        ];

        // Add name uniqueness validation based on user role
        if ($isSuperAdmin) {
            // For superadmin, check uniqueness across all companies
            $rules['name'][] = Rule::unique('warehouses', 'name');
        } else {
            // For regular users, check uniqueness within their company
            $rules['name'][] = Rule::unique('warehouses', 'name')->where(function ($query) {
                return $query->where('company_id', Auth::user()->company_id);
            });
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        if ($request->is_default) {
            // Check if another warehouse is already set as default
            $defaultQuery = Warehouse::where('is_default', 1);

            // Apply company scope for regular users
            if (! $isSuperAdmin) {
                $defaultQuery->where('company_id', Auth::user()->company_id);
            } else {
                // For superadmin, check within the selected company if provided
                if ($request->company_id) {
                    $defaultQuery->where('company_id', $request->company_id);
                }
            }

            $existingDefault = $defaultQuery->first();
            if ($existingDefault) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Another warehouse is already set as the main warehouse.',
                ], 422);
            }
        }

        // Prepare warehouse data
        $warehouseData = [
            'name' => $request->name,
            'location' => $request->location,
            'is_default' => $request->is_default,
        ];

        // Add company_id based on user role
        if ($isSuperAdmin) {
            // Superadmin can set company_id from form
            if ($request->company_id) {
                $warehouseData['company_id'] = $request->company_id;
            }
        } else {
            // Regular users use their own company_id
            $warehouseData['company_id'] = Auth::user()->company_id;
        }

        $warehouse = Warehouse::create($warehouseData);

        return response()->json([
            'status' => 1,
            'message' => 'Warehouse created successfully',
            'data' => [
                'id' => $warehouse->id,
                'name' => $warehouse->name,
                'location' => $warehouse->location,
                'is_default' => $warehouse->is_default,
            ],
        ], 201);
    }

    public function update(Request $request, $id)
    {
        // Check if user is superadmin
        $isSuperAdmin = AuthHelper::isSuperAdmin();

        // Build validation rules
        $rules = [
            'name' => [
                'required',
                'max:255',
                'string',
            ],
            'location' => 'required|string|max:255',
            'is_default' => 'required|boolean',
        ];

        // Add name uniqueness validation based on user role
        if ($isSuperAdmin) {
            // For superadmin, check uniqueness across all companies
            $rules['name'][] = Rule::unique('warehouses', 'name')->where(function ($query) use ($id) {
                return $query->where('id', '!=', $id);
            });
        } else {
            // For regular users, check uniqueness within their company
            $rules['name'][] = Rule::unique('warehouses', 'name')->where(function ($query) use ($id) {
                return $query->where('company_id', Auth::user()->company_id)
                    ->where('id', '!=', $id);
            });
        }

        $validator = Validator::make($request->all(), $rules);

        $warehouse = Warehouse::findOrFail($id);

        if ($request->is_default && ! $warehouse->is_default) {
            // Check if another warehouse is already set as default
            $defaultQuery = Warehouse::where('is_default', 1)
                ->where('id', '!=', $id);

            // Apply company scope for regular users
            if (! $isSuperAdmin) {
                $defaultQuery->where('company_id', Auth::user()->company_id);
            } else {
                // For superadmin, check within the selected company if provided
                if ($request->company_id) {
                    $defaultQuery->where('company_id', $request->company_id);
                }
            }

            $existingDefault = $defaultQuery->first();
            if ($existingDefault) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Another warehouse is already set as the main warehouse.',
                ], 422);
            }
        }

        // Prepare warehouse data
        $warehouseData = [
            'name' => $request->name,
            'location' => $request->location,
            'is_default' => $request->is_default,
        ];

        // Add company_id based on user role
        if ($isSuperAdmin) {
            // Superadmin can update company_id from form
            if ($request->company_id) {
                $warehouseData['company_id'] = $request->company_id;
            }
        } else {
            // Regular users cannot change company_id, keep existing
            $warehouseData['company_id'] = $warehouse->company_id;
        }

        $warehouse->update($warehouseData);

        return response()->json([
            'status' => 1,
            'message' => 'Warehouse updated successfully',
            'data' => [
                'id' => $warehouse->id,
                'name' => $warehouse->name,
                'location' => $warehouse->location,
                'is_default' => $warehouse->is_default,
            ],
        ], 200);
    }

    public function destroy(Request $request, $id = null)
    {
        DB::beginTransaction();

        try {
            // Handle single or bulk deletion
            $ids = $id ? [$id] : $request->input('ids', []);

            // Validate input
            if (empty($ids)) {
                return response()->json([
                    'status' => 0,
                    'message' => 'No warehouse IDs provided',
                    'errors' => ['At least one warehouse ID is required'],
                ], 422); // Validation error
            }

            $request->validate([
                'ids' => 'sometimes|required|array',
                'ids.*' => 'exists:warehouses,id',
            ]);

            $failedIds = [];
            foreach ($ids as $warehouseId) {
                $warehouse = Warehouse::find($warehouseId);
                if (! $warehouse) {
                    $failedIds[] = $warehouseId;

                    continue;
                }

                // Delete the warehouse
                $warehouse->delete();
            }

            if (! empty($failedIds)) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Some warehouses could not be deleted',
                    'errors' => ['Failed to delete warehouses with IDs: '.implode(', ', $failedIds)],
                ], 422);
            }

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Warehouses deleted successfully',
            ], 200);

        } catch (ValidationException $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Validation error',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to delete warehouses',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

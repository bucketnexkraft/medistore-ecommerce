<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    protected function currentCompanyId(): ?string
    {
        return Auth::user()?->company_id;
    }

    public function list(Request $request)
    {
        $perPage = $request->input('perPage', 20); // Default to 20 items per page
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterStatus = $request->input('status', 1);
        $sortField = $request->input('sortField', 'created_at'); // Default to 'id'
        $sortOrder = $request->input('sortOrder', 'desc'); // Default to ascending

        $query = Supplier::query();

        // Apply filters
        if (!empty($filterText)) {
            $query->where(function ($q) use ($filterText) {
                $q->where('name', 'LIKE', "%{$filterText}%")
                  ->orWhere('email', 'LIKE', "%{$filterText}%")
                  ->orWhere('phone_number', 'LIKE', "%{$filterText}%")
                  ->orWhere('address', 'LIKE', "%{$filterText}%");
            });
        }

        if (!is_null($filterStatus)) {
            $query->where('status', $filterStatus);
        }

        // Apply sorting
        $query->orderBy($sortField, $sortOrder);
        // Fetch paginated data
        $suppliers = $query->paginate($perPage, ['*'], 'page', $page);
        // Transform result for API

        // Transform result for API
        $data = $suppliers->map(function ($product) {
            return [
                'id' => $product->id,
                'name' => $product->name,
                'email' => $product->email,
                'phone' => $product->phone_number,
                'address' => $product->address,
                'status' => $product->status,
            ];
        });

        $suppliers->setCollection($data); 

        return response()->json([
            'status' => 1,
            'message' => 'Supplier fetched successfully',
            'data' => $suppliers->items(),
            'meta' => [
                'current_page' => $suppliers->currentPage(),
                'per_page' => $suppliers->perPage(),
                'total' => $suppliers->total(),
                'last_page' => $suppliers->lastPage(),
            ],
            'others_data' => [
            ],
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('suppliers', 'email')->where(function ($query) {
                    return $query->where('company_id', $this->currentCompanyId());
                }),
            ],
            'phone_number' => 'required|string|max:15',
            'address' => 'nullable|string|max:255',
        ]);
        // Check if the request has a status field and validate it
        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        DB::beginTransaction();
        
        try {

            $supplier = new Supplier();
            $supplier->name = $request->name;
            $supplier->email = $request->email;
            $supplier->phone_number = $request->phone_number;
            $supplier->address = $request->address ?? '';
            $supplier->status = $request->status ? 1 : 0;
            $supplier->company_id = $this->currentCompanyId();
            $supplier->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Supplier created successfully',
                'data' => [
                    'id' => $supplier->id,
                    'name' => $supplier->name,
                    'email' => $supplier->email,
                    'phone' => $supplier->phone_number,
                    'address' => $supplier->address,
                    'status' => $supplier->status,
                ],
            ], 200);

        }catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Failed to create supplier',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return response()->json([
                'status' => 0,
                'message' => 'Supplier not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('suppliers', 'email')
                    ->ignore($id)
                    ->where(function ($query) {
                        return $query->where('company_id', $this->currentCompanyId());
                    }),
            ],
            'phone_number' => 'required|string|max:15',
            'address' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        DB::beginTransaction();
        
        try {
            $supplier->name = $request->name;
            $supplier->email = $request->email;
            $supplier->phone_number = $request->phone_number;
            $supplier->address = $request->address ?? '';
            $supplier->status = $request->status ? 1 : 0;
            $supplier->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Supplier updated successfully',
                'data' => [
                    'id' => $supplier->id,
                    'name' => $supplier->name,
                    'email' => $supplier->email,
                    'phone' => $supplier->phone_number,
                    'address' => $supplier->address,
                    'status' => $supplier->status,
                ],
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Failed to update supplier',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'required|exists:suppliers,id',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422
            );
        }

        $data = $validator->validated();

        DB::beginTransaction();

        try {
            Supplier::whereIn('id', $data['ids'])->update([
                'status' => $data['status'],
            ]);

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Supplier statuses updated successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to update supplier statuses',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function delete(Request $request, $id = null)
    {
        DB::beginTransaction();

        try {
            // Handle single or bulk deletion
            $ids = $id ? [$id] : $request->input('ids', []);
            
            // Validate input
            if (empty($ids)) {
                throw new \Exception('No Supplier IDs provided');
            }

            $request->validate([
                'ids' => 'sometimes|required|array',
                'ids.*' => 'exists:suppliers,id',
            ]);

            $failedIds = [];
            foreach ($ids as $variantId) {
                $variant = Supplier::findOrFail($variantId);

                if (!$variant) {
                    $failedIds[] = $variantId;
                    continue;
                }
                $variant->delete();
            }

            if (!empty($failedIds)) {
                throw new \Exception('Failed to delete Supplier with IDs: ' . implode(', ', $failedIds));
            }

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Supplier deleted successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to delete Supplier',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function destroyMultiple(Request $request)
    {
        return $this->delete($request);
    }
}

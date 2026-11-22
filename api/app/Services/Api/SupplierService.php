<?php

namespace App\Services\Api;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupplierService
{
    public function list(Request $request): array
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterStatus = $request->input('status', 1);
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        $query = Supplier::query();

        if (!empty($filterText)) {
            $query->where(function ($q) use ($filterText) {
                $q->where('name', 'LIKE', "%{$filterText}%")
                    ->orWhere('email', 'LIKE', "%{$filterText}%")
                    ->orWhere('phone_number', 'LIKE', "%{$filterText}%")
                    ->orWhere('address', 'LIKE', "%{$filterText}%");
            });
        }

        if (!is_null($filterStatus) && $filterStatus !== '') {
            $query->where('status', $filterStatus);
        }

        $suppliers = $query->orderBy($sortField, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

        $data = $suppliers->map(function ($supplier) {
            return [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'email' => $supplier->email,
                'phone' => $supplier->phone_number,
                'address' => $supplier->address,
                'status' => $supplier->status,
            ];
        });

        $suppliers->setCollection($data);

        return [
            'status' => 1,
            'message' => 'Supplier fetched successfully',
            'data' => $suppliers->items(),
            'meta' => [
                'current_page' => $suppliers->currentPage(),
                'per_page' => $suppliers->perPage(),
                'total' => $suppliers->total(),
                'last_page' => $suppliers->lastPage(),
            ],
            'others_data' => [],
        ];
    }

    public function store(Request $request): array
    {
        DB::beginTransaction();

        try {
            $supplier = new Supplier();
            $supplier->name = $request->name;
            $supplier->email = $request->email;
            $supplier->phone_number = $request->phone_number;
            $supplier->address = $request->address ?? '';
            $supplier->status = $request->boolean('status') ? 1 : 0;
            $supplier->save();

            DB::commit();

            return [[
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
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to create supplier',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function update(Request $request, int $id): array
    {
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return [[
                'status' => 0,
                'message' => 'Supplier not found',
            ], 404];
        }

        DB::beginTransaction();

        try {
            $supplier->name = $request->name;
            $supplier->email = $request->email;
            $supplier->phone_number = $request->phone_number;
            $supplier->address = $request->address ?? '';
            $supplier->status = $request->boolean('status') ? 1 : 0;
            $supplier->save();

            DB::commit();

            return [[
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
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to update supplier',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function updateStatus(Request $request): array
    {
        DB::beginTransaction();

        try {
            Supplier::whereIn('id', $request->ids)->update([
                'status' => $request->status,
            ]);

            DB::commit();

            return [[
                'status' => 1,
                'message' => 'Supplier statuses updated successfully',
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to update supplier statuses',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function delete(Request $request, $id = null): array
    {
        DB::beginTransaction();

        try {
            $ids = $id ? [$id] : $request->input('ids', []);

            if (empty($ids)) {
                throw new \Exception('No Supplier IDs provided');
            }

            $failedIds = [];
            foreach ($ids as $supplierId) {
                $supplier = Supplier::find($supplierId);

                if (!$supplier) {
                    $failedIds[] = $supplierId;
                    continue;
                }

                $supplier->delete();
            }

            if (!empty($failedIds)) {
                throw new \Exception('Failed to delete Supplier with IDs: ' . implode(', ', $failedIds));
            }

            DB::commit();

            return [[
                'status' => 1,
                'message' => 'Supplier deleted successfully',
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to delete Supplier',
                'error' => $e->getMessage(),
            ], 500];
        }
    }
}

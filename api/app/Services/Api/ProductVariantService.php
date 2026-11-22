<?php

namespace App\Services\Api;

use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductVariantService
{
    public function list(Request $request)
    {
        $perPage = $request->input('per_page', 10);
        $page = $request->input('page', 1);
        $status = $request->input('status');
        $search = trim($request->input('search', ''));
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        $query = ProductVariant::with(['attributes']);

        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        if (!empty($search)) {
            $query->where('name', 'LIKE', '%' . $search . '%');
        }

        if ($sortField && in_array($sortField, ['name', 'status', 'created_at', 'updated_at'])) {
            $query->orderBy($sortField, $sortOrder);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $variants = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Product variants fetched successfully',
            'meta' => [
                'current_page' => $variants->currentPage(),
                'per_page' => $variants->perPage(),
                'total' => $variants->total(),
                'last_page' => $variants->lastPage(),
            ],
            'data' => $variants->items(),
        ], 200);
    }

    public function store(Request $request)
    {
        DB::beginTransaction();

        try {
            $data = $request->validated();

            $variant = ProductVariant::create([
                'name' => $data['name'],
                'status' => $data['status'],
            ]);

            foreach ($data['attributes'] as $attr) {
                $variant->attributes()->create([
                    'attribute_value' => $attr,
                ]);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to create product variant',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }

        return response()->json(
            [
                'status' => 1,
                'message' => 'Product variant created successfully',
                'data' => $variant->load('attributes'),
            ],
            201
        );
    }

    public function update(Request $request, $id)
    {
        $variant = ProductVariant::findOrFail($id);
        $data = $request->validated();

        DB::beginTransaction();

        try {
            $updates = [];
            if (isset($data['name'])) {
                $updates['name'] = $data['name'];
            }
            if (isset($data['status'])) {
                $updates['status'] = $data['status'];
            }

            if (!empty($updates)) {
                $variant->update($updates);
            }

            if (isset($data['attributes'])) {
                $variant->attributes()->delete();

                foreach ($data['attributes'] as $attr) {
                    $variant->attributes()->create([
                        'attribute_value' => $attr,
                    ]);
                }
            }

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Product variant updated successfully',
                    'data' => $variant->load('attributes'),
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to update product variant',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function updateStatus(Request $request)
    {
        $data = $request->validated();

        DB::beginTransaction();

        try {
            ProductVariant::whereIn('id', $data['ids'])->update([
                'status' => $data['status'],
            ]);

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Variant statuses updated successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to update variant statuses',
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
            $ids = $id ? [$id] : $request->input('ids', []);

            if (empty($ids)) {
                throw new \Exception('No Product variant IDs provided');
            }

            $failedIds = [];
            foreach ($ids as $variantId) {
                $variant = ProductVariant::findOrFail($variantId);

                if (!$variant) {
                    $failedIds[] = $variantId;
                    continue;
                }
                $variant->attributes()->delete();
                $variant->delete();
            }

            if (!empty($failedIds)) {
                throw new \Exception('Failed to delete Product variant with IDs: ' . implode(', ', $failedIds));
            }

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Product variant deleted successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to delete Product variant',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }
    }
}

<?php

namespace App\Services\Api;

use App\Helpers\Helper;
use App\Models\Brand;
use App\Services\ReturnSetupService;
use App\Services\ImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BrandService
{
    public function __construct(private readonly ReturnSetupService $returnSetupService)
    {
    }

    public function list(Request $request): array
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterStatus = $request->input('status', '');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        $query = Brand::query()->with('returnSetup');

        if (!is_null($filterText)) {
            $query->where('title', 'LIKE', "%{$filterText}%");
        }
        if (!is_null($filterStatus)) {
            $query->where('status', $filterStatus);
        }

        $query->orderBy($sortField, $sortOrder);
        $brands = $query->paginate($perPage, ['*'], 'page', $page);

        $data = $brands->map(function ($brand) {
            return [
                'id' => $brand->id,
                'title' => $brand->title,
                'slug' => $brand->slug,
                'image' => $brand->image,
                'status' => $brand->status,
                'return_enabled' => (bool) ($brand->returnSetup?->return_enabled ?? false),
                'return_day' => $brand->returnSetup?->return_day,
                'return_condition' => $brand->returnSetup?->return_condition ?? [],
            ];
        });

        $brands->setCollection($data);

        return [
            'status' => 1,
            'message' => 'Brands fetched successfully',
            'data' => $brands->items(),
            'meta' => [
                'current_page' => $brands->currentPage(),
                'per_page' => $brands->perPage(),
                'total' => $brands->total(),
                'last_page' => $brands->lastPage(),
            ],
            'others_data' => [],
        ];
    }

    public function store(Request $request): array
    {
        DB::beginTransaction();

        try {
            $brand = new Brand();
            $brand->title = ucfirst($request->title);
            $brand->status = $request->status ? 1 : 0;
            if ($request->hasFile('image')) {
                $brand->image = ImageService::upload($request->file('image'), 'brand-images');
            }
            $brand->save();
            $this->returnSetupService->syncForBrand(
                $brand,
                $request->input('return_enabled'),
                $request->input('return_day'),
                $request->input('return_condition')
            );
            $brand->load('returnSetup');

            Helper::insertLanguage(Brand::class, $brand->id, 'en', 'name', $brand->title);

            DB::commit();

            return [[
                'status' => 1,
                'message' => 'Brand created successfully',
                'data' => $brand,
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to create brand',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function update(Request $request, $id): array
    {
        DB::beginTransaction();

        try {
            $brand = Brand::findOrFail($id);
            $brand->title = ucfirst($request->title);
            $brand->status = $request->status ? 1 : 0;
            if ($request->hasFile('image')) {
                ImageService::delete($brand->getRawOriginal('image'), 'brand-images');
                $brand->image = ImageService::upload($request->file('image'), 'brand-images');
            }
            $brand->save();
            $this->returnSetupService->syncForBrand(
                $brand,
                $request->input('return_enabled'),
                $request->input('return_day'),
                $request->input('return_condition')
            );
            $brand->load('returnSetup');

            Helper::insertLanguage(Brand::class, $brand->id, 'en', 'name', $brand->title);

            DB::commit();

            return [[
                'status' => 1,
                'message' => 'Brand updated successfully',
                'data' => $brand,
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to update brand',
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
                throw new \Exception('No category IDs provided');
            }

            $failedIds = [];
            foreach ($ids as $brandId) {
                $brand = Brand::find($brandId);
                if (!$brand) {
                    $failedIds[] = $brandId;
                    continue;
                }

                if ($brand->image) {
                    ImageService::delete($brand->getRawOriginal('image'), 'brand-images');
                }

                $brand->returnSetup()->delete();
                $brand->delete();
            }

            if (!empty($failedIds)) {
                throw new \Exception('Failed to delete brands with IDs: ' . implode(', ', $failedIds));
            }

            DB::commit();

            return [[
                'status' => 1,
                'message' => 'Brands deleted successfully',
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to delete brands',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function updateStatus(Request $request, $id): array
    {
        $ids = is_array($id) ? $id : [$id];
        $success = true;
        $message = '';

        foreach ($ids as $brandId) {
            $brand = Brand::find($brandId);
            if (!$brand) {
                $success = false;
                $message = "Brand with ID {$brandId} not found";
                continue;
            }

            $brand->status = $request->status;
            $brand->save();
        }

        return [
            'status' => $success ? 1 : 0,
            'message' => $success ? 'Status updated successfully' : $message,
        ];
    }

    public function updateStatusMultiple(Request $request): array
    {
        DB::beginTransaction();
        try {
            Brand::whereIn('id', $request->ids)->update(['status' => $request->status]);
            DB::commit();
            return [[
                'status' => 1,
                'message' => 'Statuses updated successfully',
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();
            return [[
                'status' => 0,
                'message' => 'Failed to update statuses: ' . $e->getMessage(),
            ], 500];
        }
    }
}

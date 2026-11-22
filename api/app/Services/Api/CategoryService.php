<?php

namespace App\Services\Api;

use App\Helpers\Helper;
use App\Models\Category;
use App\Services\ReturnSetupService;
use App\Services\ImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CategoryService
{
    public function __construct(private readonly ReturnSetupService $returnSetupService)
    {
    }

    private function forgetStorefrontCategoryCaches(?string $companyId = null): void
    {
        $resolvedCompanyId = is_string($companyId) && trim($companyId) !== '' ? trim($companyId) : 'global';

        Cache::forget(sprintf('storefront:%s:%s', 'landing-mega-categories', $resolvedCompanyId));
        Cache::forget(sprintf('storefront:%s:%s', 'landing-categories', $resolvedCompanyId));
    }

    public function list(Request $request): array
    {
        $companyId = Auth::user()?->company_id;
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterParentCategory = $request->input('filterParentCategory', '');
        $filterStatus = $request->input('status', '');
        $filterShowInHeader = $request->input('filterShowInCategoryHeader', '');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'asc');

        $query = Category::when($filterText, function ($query) use ($filterText) {
            $query->where('title', 'LIKE', '%' . $filterText . '%');
        })
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->when($filterStatus !== '' && $filterStatus !== null, function ($query) use ($filterStatus) {
                $query->where('status', $filterStatus);
            })
            ->when($filterShowInHeader !== '' && $filterShowInHeader !== null, function ($query) use ($filterShowInHeader) {
                $query->where('is_show_in_category_header', $filterShowInHeader);
            })
            ->when($filterParentCategory, function ($query) use ($filterParentCategory) {
                $query->where('ancestor_id', $filterParentCategory);
            })
            ->with(['parent', 'returnSetup']);

        $query->orderBy($sortField, $sortOrder);
        $categories = $query->paginate($perPage, ['*'], 'page', $page);

        $data = $categories->map(function ($category) {
            return [
                'id' => $category->id,
                'title' => $category->title,
                'slug' => $category->slug,
                'image' => $category->image,
                'ancestor_id' => $category->ancestor_id,
                'parent_category' => $category->parent?->title,
                'status' => $category->status,
                'is_show_in_category_header' => (bool) $category->is_show_in_category_header,
                'return_enabled' => (bool) ($category->returnSetup?->return_enabled ?? false),
                'return_day' => $category->returnSetup?->return_day,
                'return_condition' => $category->returnSetup?->return_condition ?? [],
            ];
        });

        return [
            'status' => 1,
            'message' => 'Categories fetched successfully',
            'data' => $data->toArray(),
            'meta' => [
                'current_page' => $categories->currentPage(),
                'per_page' => $categories->perPage(),
                'total' => $categories->total(),
                'last_page' => $categories->lastPage(),
            ],
            'others_data' => [
                'all_categories' => Category::when($companyId, fn ($query) => $query->where('company_id', $companyId))
                    ->select('id', 'title', 'slug', 'image', 'ancestor_id', 'is_show_in_category_header')
                    ->orderBy('title', 'asc')
                    ->get(),
                'parent_categories' => Category::when($companyId, fn ($query) => $query->where('company_id', $companyId))
                    ->select('id', 'title', 'slug', 'image', 'ancestor_id', 'is_show_in_category_header')
                    ->whereNull('ancestor_id')
                    ->orderBy('title', 'asc')
                    ->get(),
            ],
        ];
    }

    public function store(Request $request): array
    {
        DB::beginTransaction();
        try {
            $category = new Category();
            $category->title = ucfirst($request->title);
            $category->ancestor_id = $request->parentId;
            $category->status = $request->status ? 1 : 0;
            $category->is_show_in_category_header = $request->boolean(
                'is_show_in_category_header',
                $request->boolean('isShowInCategoryHeader', false)
            );
            if ($request->hasFile('image')) {
                $category->image = ImageService::upload($request->file('image'), 'category-images');
            }
            $category->save();
            $this->returnSetupService->syncForCategory(
                $category,
                $request->input('return_enabled'),
                $request->input('return_day'),
                $request->input('return_condition')
            );
            $category->load('returnSetup');
            Helper::insertLanguage(Category::class, $category->id, 'en', 'name', $category->title);
            $this->forgetStorefrontCategoryCaches($category->company_id ?? null);

            DB::commit();
            return [[
                'status' => 1,
                'message' => 'Category created successfully',
                'data' => $category,
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();
            return [[
                'status' => 0,
                'message' => 'Failed to create category',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function update(Request $request, $id): array
    {
        DB::beginTransaction();
        try {
            $category = Category::findOrFail($id);
            $category->title = ucfirst($request->title);
            $category->ancestor_id = $request->parentId;
            $category->status = $request->status ? 1 : 0;
            $category->is_show_in_category_header = $request->boolean(
                'is_show_in_category_header',
                $request->boolean('isShowInCategoryHeader', false)
            );

            if ($request->hasFile('image')) {
                ImageService::delete($category->getRawOriginal('image'), 'category-images');
                $category->image = ImageService::upload($request->file('image'), 'category-images');
            }
            $category->save();
            $this->returnSetupService->syncForCategory(
                $category,
                $request->input('return_enabled'),
                $request->input('return_day'),
                $request->input('return_condition')
            );
            $category->load('returnSetup');

            Helper::insertLanguage(Category::class, $category->id, 'en', 'name', $category->title);
            $this->forgetStorefrontCategoryCaches($category->company_id ?? null);

            DB::commit();
            return [[
                'status' => 1,
                'message' => 'Category updated successfully',
                'data' => $category,
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();
            return [[
                'status' => 0,
                'message' => 'Failed to update category',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function updateStatus(Request $request, $id): array
    {
        $ids = is_array($id) ? $id : [$id];
        $success = true;
        $message = '';

        foreach ($ids as $categoryId) {
            $category = Category::find($categoryId);
            if (!$category) {
                $success = false;
                $message = "Category with ID {$categoryId} not found";
                continue;
            }

            $category->status = $request->status;
            $category->save();
            $this->forgetStorefrontCategoryCaches($category->company_id ?? null);
        }

        return [
            'status' => $success ? 1 : 0,
            'message' => $success ? 'Status updated successfully' : $message,
        ];
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
            foreach ($ids as $categoryId) {
                $category = Category::find($categoryId);
                if (!$category) {
                    $failedIds[] = $categoryId;
                    continue;
                }

                if ($category->image) {
                    ImageService::delete($category->getRawOriginal('image'), 'category-images');
                }

                $category->returnSetup()->delete();
                $this->forgetStorefrontCategoryCaches($category->company_id ?? null);
                $category->delete();
            }

            if (!empty($failedIds)) {
                throw new \Exception('Failed to delete categories with IDs: ' . implode(', ', $failedIds));
            }

            DB::commit();
            return [[
                'status' => 1,
                'message' => 'Categories deleted successfully',
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();
            return [[
                'status' => 0,
                'message' => 'Failed to delete categories',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function updateStatusMultiple(Request $request): array
    {
        DB::beginTransaction();
        try {
            $categories = Category::whereIn('id', $request->ids)->get(['id', 'company_id']);
            Category::whereIn('id', $request->ids)->update(['status' => $request->status]);
            $categories->each(fn (Category $category) => $this->forgetStorefrontCategoryCaches($category->company_id ?? null));
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

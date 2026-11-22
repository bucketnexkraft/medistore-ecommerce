<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Enums\StorefrontTemplateVariant;
use App\Http\Controllers\Controller;
use App\Models\ECategory;
use App\Support\StorefrontCategorySectionCatalog;
use App\Support\StorefrontSectionComponentRegistry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

class ESectionPresetController extends Controller
{
    private ?array $configuredCategoriesCache = null;

    private function readOnlyManagedFromConfig()
    {
        return response()->json([
            'status' => 0,
            'message' => 'E-section presets are managed from config and seeder data only. Create/update/delete is disabled.',
        ], 403);
    }

    private function ensureSuperAdmin()
    {
        $user = Auth::user();

        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return null;
    }

    private function ensurePresetSchemaReady()
    {
        if (Schema::hasColumns('e_section_presets', ['preset_key', 'component_key'])) {
            return null;
        }

        return response()->json([
            'status' => 0,
            'message' => 'Database update required. Run the latest Laravel migrations for e-section presets, then try again.',
        ], 409);
    }

    public function options(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $categoryIds = $this->normalizeCategoryIdsFromRequest(
            $request->input('category_ids', $request->input('category_id', []))
        );

        return response()->json([
            'status' => 1,
            'message' => 'E-section preset options fetched successfully.',
            'data' => [
                'categories' => $this->configuredCategories(),
                'section_types' => StorefrontTemplateVariant::options(),
                'component_options' => StorefrontSectionComponentRegistry::options(),
                'section_types_by_category' => StorefrontTemplateVariant::optionsByCategory(),
                'component_options_by_category' => StorefrontSectionComponentRegistry::optionsByCategory(),
                'preset_catalog' => $this->presetCatalog($categoryIds),
            ],
        ]);
    }

    public function index(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $search = trim((string) $request->input('search', ''));
        $sectionType = trim((string) $request->input('section_type', ''));
        $categoryId = (int) $request->input('category_id', 0);
        $perPage = max((int) $request->input('perPage', 200), 1);
        $rows = collect($this->configuredPresetRows($categoryId > 0 ? [$categoryId] : []))
            ->when($search !== '', function ($collection) use ($search) {
                $needle = mb_strtolower($search);

                return $collection->filter(function (array $preset) use ($needle) {
                    return str_contains(mb_strtolower((string) ($preset['name'] ?? '')), $needle)
                        || str_contains(mb_strtolower((string) ($preset['preset_key'] ?? '')), $needle)
                        || str_contains(mb_strtolower((string) ($preset['component_key'] ?? '')), $needle);
                });
            })
            ->when(
                $sectionType !== '' && in_array($sectionType, StorefrontTemplateVariant::values(), true),
                fn ($collection) => $collection->filter(fn (array $preset) => (string) ($preset['section_type'] ?? '') === $sectionType)
            )
            ->values();

        $total = $rows->count();
        $page = max((int) $request->input('page', 1), 1);
        $offset = ($page - 1) * $perPage;
        $pagedRows = $rows->slice($offset, $perPage)->values();

        return response()->json([
            'status' => 1,
            'message' => 'E-section presets fetched successfully.',
            'data' => $pagedRows->all(),
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => max((int) ceil($total / $perPage), 1),
            ],
        ]);
    }

    public function store(Request $request)
    {
        return $this->readOnlyManagedFromConfig();
    }

    public function update(Request $request, int $id)
    {
        return $this->readOnlyManagedFromConfig();
    }

    public function destroy(int $id)
    {
        return $this->readOnlyManagedFromConfig();
    }

    private function normalizeCategoryIdsFromRequest(mixed $value): array
    {
        if (is_numeric($value)) {
            return [(int) $value];
        }

        if (is_array($value)) {
            return collect($value)
                ->filter(fn ($item) => is_numeric($item))
                ->map(fn ($item) => (int) $item)
                ->unique()
                ->values()
                ->all();
        }

        if (! is_string($value) || trim($value) === '') {
            return [];
        }

        return collect(explode(',', $value))
            ->map(fn ($item) => trim($item))
            ->filter(fn ($item) => is_numeric($item))
            ->map(fn ($item) => (int) $item)
            ->unique()
            ->values()
            ->all();
    }

    private function presetCatalog(array $categoryIds = []): array
    {
        return collect($this->configuredPresetRows($categoryIds))
            ->filter(fn (array $preset) => (bool) ($preset['status'] ?? true))
            ->groupBy('section_type')
            ->map(fn ($items) => $items->values()->all())
            ->all();
    }

    private function configuredCategories(): array
    {
        if ($this->configuredCategoriesCache !== null) {
            return $this->configuredCategoriesCache;
        }

        $categoryNames = StorefrontCategorySectionCatalog::categoryNames();
        $categoryMap = ECategory::query()
            ->whereIn('name', $categoryNames)
            ->get(['id', 'name', 'status'])
            ->keyBy('name');

        return $this->configuredCategoriesCache = collect($categoryNames)
            ->map(function (string $name) use ($categoryMap) {
                $category = $categoryMap->get($name);

                return $category ? [
                    'id' => $category->id,
                    'name' => $category->name,
                    'status' => (bool) $category->status,
                ] : null;
            })
            ->filter()
            ->values()
            ->all();
    }

    private function configuredPresetRows(array $categoryIds = []): array
    {
        $categoryNames = $this->categoryNamesForIds($categoryIds);
        $categoryMap = collect($this->configuredCategories())->keyBy('name');

        return collect(StorefrontCategorySectionCatalog::definitions())
            ->when(
                ! empty($categoryNames),
                fn ($items) => $items->filter(fn (array $preset) => in_array($preset['category_name'], $categoryNames, true))
            )
            ->map(function (array $preset) use ($categoryMap) {
                $preset['preset_label'] = $preset['label'];
                $preset['categories'] = [[
                    'id' => (int) ($categoryMap->get($preset['category_name'])['id'] ?? 0),
                    'name' => $preset['category_name'],
                    'key' => $preset['category_key'],
                ]];

                return $preset;
            })
            ->sortBy([['section_type', 'asc'], ['name', 'asc']])
            ->values()
            ->all();
    }

    private function categoryNamesForIds(array $categoryIds): array
    {
        $ids = collect($categoryIds)
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();

        if (empty($ids)) {
            return [];
        }

        return collect($this->configuredCategories())
            ->filter(fn (array $category) => in_array((int) ($category['id'] ?? 0), $ids, true))
            ->pluck('name')
            ->values()
            ->all();
    }

}

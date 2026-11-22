<?php

namespace App\Services\Backoffice;

use App\Constant\Directory;
use App\Models\MenuItem;
use App\Models\Page;
use App\Models\Section;
use App\Sections\SectionRegistry;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ContentManagementService
{
    public function __construct()
    {
        $helperPath = app_path('helpers.php');
        if (file_exists($helperPath)) {
            require_once $helperPath;
        }
    }

    public function pages(Request $request)
    {
        $this->ensureDefaultSectionsFromRegistry();

        $query = Page::query();

        $keyword = trim((string) $request->input('keyword', ''));
        if ($keyword !== '') {
            $query->where(function ($q) use ($keyword) {
                $q->where('name', 'like', "%{$keyword}%")
                    ->orWhere('slug', 'like', "%{$keyword}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', (int) $request->boolean('status'));
        }

        $pages = $query->orderByDesc('id')->get()->map(function ($page) {
            $page->section_names = $this->extractBuilderSectionNames($page);

            return $page;
        });

        return response()->json([
            'status' => 1,
            'message' => 'Pages fetched successfully.',
            'data' => $pages,
        ]);
    }

    public function storePage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:pages,name',
            'status' => 'required|boolean',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string',
            'seo_tags' => 'nullable|array',
            'seo_tags.*' => 'nullable|string|max:100',
            'content' => 'nullable|string',
            'has_breadcrumb' => 'nullable|boolean',
            'breadcrumb_title' => 'nullable|string|max:255',
            'breadcrumb_description' => 'nullable|string',
            'has_builder' => 'nullable|boolean',
            'is_default' => 'nullable|boolean',
            'breadcrumb_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp,svg|max:4096',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $data = $validator->validated();
        $slug = ! empty($data['slug']) ? $this->normalizePageSlug((string) $data['slug']) : $this->normalizePageSlug((string) $data['name']);
        $data['slug'] = $this->uniquePageSlug($slug);

        if ($request->hasFile('breadcrumb_image')) {
            $data['breadcrumb_image'] = $this->uploadBreadcrumbImage($request->file('breadcrumb_image'));
        } else {
            $data['breadcrumb_image'] = null;
        }

        $page = Page::query()->create([
            'name' => $data['name'],
            'slug' => $data['slug'],
            'status' => (bool) $data['status'],
            'seo_title' => $data['seo_title'] ?? null,
            'seo_description' => $data['seo_description'] ?? null,
            'seo_tags' => $data['seo_tags'] ?? [],
            'content' => $this->normalizePageContentForStorage($data['content'] ?? null),
            'has_breadcrumb' => (bool) ($data['has_breadcrumb'] ?? false),
            'breadcrumb_title' => $data['breadcrumb_title'] ?? null,
            'breadcrumb_description' => $data['breadcrumb_description'] ?? null,
            'has_builder' => (bool) ($data['has_builder'] ?? false),
            'is_default' => (bool) ($data['is_default'] ?? false),
            'breadcrumb_image' => $data['breadcrumb_image'] ?? null,
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Page created successfully.',
            'data' => $page,
        ], 201);
    }

    public function showPage(int $id)
    {
        $page = Page::query()->find($id);
        if (! $page) {
            return response()->json([
                'status' => 0,
                'message' => 'Page not found.',
            ], 404);
        }

        $sectionNames = $this->extractBuilderSectionNames($page);
        $page->sections = collect($sectionNames)->map(function ($name) {
            return ['name' => $name];
        })->values();
        $page->section_names = $sectionNames;

        return response()->json([
            'status' => 1,
            'message' => 'Page fetched successfully.',
            'data' => $page,
        ]);
    }

    public function updatePage(Request $request, int $id)
    {
        $page = Page::query()->find($id);
        if (! $page) {
            return response()->json([
                'status' => 0,
                'message' => 'Page not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255', Rule::unique('pages', 'name')->ignore($id)],
            'status' => 'required|boolean',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string',
            'seo_tags' => 'nullable|array',
            'seo_tags.*' => 'nullable|string|max:100',
            'content' => 'nullable|string',
            'has_breadcrumb' => 'nullable|boolean',
            'breadcrumb_title' => 'nullable|string|max:255',
            'breadcrumb_description' => 'nullable|string',
            'has_builder' => 'nullable|boolean',
            'is_default' => 'nullable|boolean',
            'breadcrumb_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp,svg|max:4096',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $data = $validator->validated();
        $slug = ! empty($data['slug']) ? $this->normalizePageSlug((string) $data['slug']) : $this->normalizePageSlug((string) $data['name']);
        $data['slug'] = $this->uniquePageSlug($slug, $id);

        if ($request->hasFile('breadcrumb_image')) {
            $data['breadcrumb_image'] = $this->uploadBreadcrumbImage($request->file('breadcrumb_image'), $page->breadcrumb_image);
        }

        $page->update([
            'name' => $data['name'],
            'slug' => $data['slug'],
            'status' => (bool) $data['status'],
            'seo_title' => $data['seo_title'] ?? null,
            'seo_description' => $data['seo_description'] ?? null,
            'seo_tags' => $data['seo_tags'] ?? [],
            'content' => $this->normalizePageContentForStorage($data['content'] ?? null),
            'has_breadcrumb' => (bool) ($data['has_breadcrumb'] ?? false),
            'breadcrumb_title' => $data['breadcrumb_title'] ?? null,
            'breadcrumb_description' => $data['breadcrumb_description'] ?? null,
            'has_builder' => (bool) ($data['has_builder'] ?? false),
            'breadcrumb_image' => $data['breadcrumb_image'] ?? $page->breadcrumb_image,
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Page updated successfully.',
            'data' => $page->fresh(),
        ]);
    }

    public function deletePage(int $id)
    {
        $page = Page::query()->find($id);
        if (! $page) {
            return response()->json([
                'status' => 0,
                'message' => 'Page not found.',
            ], 404);
        }

        if ((bool) $page->is_default || strtolower((string) $page->slug) === 'home') {
            return response()->json([
                'status' => 0,
                'message' => 'Default Home page cannot be deleted.',
            ], 422);
        }

        $page->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Page deleted successfully.',
        ]);
    }

    public function syncPageSections(Request $request, int $id)
    {
        $this->ensureDefaultSectionsFromRegistry();

        $page = Page::query()->find($id);
        if (! $page) {
            return response()->json([
                'status' => 0,
                'message' => 'Page not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'sections' => 'required|array',
            'sections.*.section_name' => 'required|string',
            'sections.*.order' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $allowedNames = collect($this->registrySections())->pluck('name')->values()->all();

        $sectionNames = collect($validator->validated()['sections'])
            ->sortBy('order')
            ->values()
            ->map(function ($item, $index) use ($allowedNames) {
                $name = (string) $item['section_name'];
                if (! in_array($name, $allowedNames, true)) {
                    return null;
                }

                $section = Section::query()->where('name', $name)->first();
                if (! $section) {
                    return null;
                }

                return [
                    'name' => $section->name,
                    'order' => (int) ($item['order'] ?? $index),
                ];
            })
            ->filter()
            ->values()
            ->sortBy('order')
            ->pluck('name')
            ->values()
            ->all();

        $page->content = $this->mergeBuilderContent($page->content, $sectionNames);
        $page->save();

        $page->sections = collect($sectionNames)->map(fn ($name) => ['name' => $name])->values();
        $page->section_names = $sectionNames;

        return response()->json([
            'status' => 1,
            'message' => 'Page sections updated successfully.',
            'data' => $page,
        ]);
    }

    public function sectionLibrary()
    {
        $this->ensureDefaultSectionsFromRegistry();

        $dbSections = Section::query()->get()->keyBy('name');

        $data = collect($this->registrySections())->map(function ($item, $index) use ($dbSections) {
            $class = $item['class'];
            $name = $item['name'];
            $title = $item['title'];
            $record = $dbSections->get($name);

            $fields = method_exists($class, 'fields') ? $class::fields() : [];
            $repeated = method_exists($class, 'repeatedFields') ? $class::repeatedFields() : [];

            return [
                'name' => $name,
                'title' => $title,
                'is_fixed' => method_exists($class, 'isFixed') ? (bool) $class::isFixed() : false,
                'order' => (int) ($record?->order ?? $index),
                'is_active' => (bool) ($record?->is_active ?? true),
                'content' => is_array($record?->content) ? $record->content : [],
                'element' => is_array($record?->element) ? $record->element : [],
                'fields' => $this->normalizeFields($fields),
                'repeated_fields' => $this->normalizeFields($repeated),
            ];
        })->values();

        return response()->json([
            'status' => 1,
            'message' => 'Section library fetched successfully.',
            'data' => $data,
        ]);
    }

    public function updateSectionContent(Request $request, string $name)
    {
        $this->ensureDefaultSectionsFromRegistry();

        $allowed = collect($this->registrySections())->pluck('name')->all();
        if (! in_array($name, $allowed, true)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid section.',
            ], 404);
        }

        // Support multipart form payload where content/element are sent as JSON strings.
        if (is_string($request->input('content'))) {
            $decodedContent = json_decode((string) $request->input('content'), true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedContent)) {
                $request->merge(['content' => $decodedContent]);
            }
        }

        if (is_string($request->input('element'))) {
            $decodedElement = json_decode((string) $request->input('element'), true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedElement)) {
                $request->merge(['element' => $decodedElement]);
            }
        }

        $validator = Validator::make($request->all(), [
            'content' => 'nullable|array',
            'element' => 'nullable|array',
            'is_active' => 'nullable|boolean',
            'order' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $registryItem = collect($this->registrySections())->firstWhere('name', $name);
        $section = Section::query()->firstOrCreate(
            ['name' => $name],
            ['title' => $registryItem['title'] ?? Str::headline($name), 'content' => [], 'element' => [], 'order' => 0, 'is_active' => true]
        );

        $sectionClass = $registryItem['class'] ?? null;

        $contentFileKeys = [];
        $elementFileKeys = [];
        if (is_string($sectionClass) && class_exists($sectionClass)) {
            $contentFields = method_exists($sectionClass, 'fields') ? $sectionClass::fields() : [];
            $elementFields = method_exists($sectionClass, 'repeatedFields') ? $sectionClass::repeatedFields() : [];

            $contentFileKeys = $this->extractFileFieldKeys($this->normalizeFields($contentFields));
            $elementFileKeys = $this->extractFileFieldKeys($this->normalizeFields($elementFields));
        }

        if (array_key_exists('content', $payload) && is_array($payload['content'])) {
            $payload['content'] = $this->transformSectionFilePayload((array) $payload['content'], $contentFileKeys, $name);
        }

        if (array_key_exists('element', $payload) && is_array($payload['element'])) {
            $payload['element'] = collect($payload['element'])->map(function ($item) use ($elementFileKeys, $name) {
                if (! is_array($item)) {
                    return $item;
                }

                return $this->transformSectionFilePayload($item, $elementFileKeys, $name);
            })->values()->all();
        }

        // Keep existing values when frontend sends only files.
        if (! array_key_exists('content', $payload) || ! is_array($payload['content'])) {
            $payload['content'] = is_array($section->content) ? $section->content : [];
        }
        if (! array_key_exists('element', $payload) || ! is_array($payload['element'])) {
            $payload['element'] = is_array($section->element) ? $section->element : [];
        }

        // Handle multipart uploaded files for content and elements.
        if ($request->hasFile('content_files')) {
            $contentFiles = (array) $request->file('content_files');
            foreach ($contentFileKeys as $key) {
                $file = $contentFiles[$key] ?? null;
                if (! $file) {
                    continue;
                }
                $storedPath = $this->storeUploadedSectionFile($file, $name);
                if ($storedPath !== null) {
                    $payload['content'][$key] = $storedPath;
                }
            }

            // Fallback: some builders send repeater files inside content_files[index][field]
            // instead of element_files[index][field].
            foreach ($contentFiles as $index => $filesForItem) {
                if (! is_numeric($index) || ! is_array($filesForItem)) {
                    continue;
                }
                $idx = (int) $index;
                if (! isset($payload['element'][$idx]) || ! is_array($payload['element'][$idx])) {
                    $payload['element'][$idx] = [];
                }

                foreach ($elementFileKeys as $fieldKey) {
                    $file = $filesForItem[$fieldKey] ?? null;
                    if (! $file) {
                        continue;
                    }
                    $storedPath = $this->storeUploadedSectionFile($file, $name);
                    if ($storedPath !== null) {
                        $payload['element'][$idx][$fieldKey] = $storedPath;
                    }
                }
            }
        }

        if ($request->hasFile('element_files')) {
            $elementFiles = (array) $request->file('element_files');
            foreach ($elementFiles as $firstKey => $firstValue) {
                // Shape A: element_files[index][field]
                if (is_numeric($firstKey) && is_array($firstValue)) {
                    $index = (int) $firstKey;
                    if (! isset($payload['element'][$index]) || ! is_array($payload['element'][$index])) {
                        $payload['element'][$index] = [];
                    }

                    foreach ($elementFileKeys as $fieldKey) {
                        $file = $firstValue[$fieldKey] ?? null;
                        if (! $file) {
                            continue;
                        }
                        $storedPath = $this->storeUploadedSectionFile($file, $name);
                        if ($storedPath !== null) {
                            $payload['element'][$index][$fieldKey] = $storedPath;
                        }
                    }

                    continue;
                }

                // Shape B: element_files[field][index]
                if (! in_array((string) $firstKey, $elementFileKeys, true) || ! is_array($firstValue)) {
                    continue;
                }

                foreach ($firstValue as $index => $file) {
                    if (! $file) {
                        continue;
                    }
                    $idx = (int) $index;
                    if (! isset($payload['element'][$idx]) || ! is_array($payload['element'][$idx])) {
                        $payload['element'][$idx] = [];
                    }
                    $storedPath = $this->storeUploadedSectionFile($file, $name);
                    if ($storedPath !== null) {
                        $payload['element'][$idx][(string) $firstKey] = $storedPath;
                    }
                }
            }

            $payload['element'] = array_values($payload['element']);
        }

        // Generic fallback: support nested multipart keys like
        // content[0][feature_image] / element[0][feature_image] without
        // requiring content_files / element_files wrapper keys.
        // Important: do NOT run this when structured wrappers are present,
        // otherwise files can be remapped/overwritten across repeater indexes.
        if (! $request->hasFile('content_files') && ! $request->hasFile('element_files')) {
            $allFiles = $request->allFiles();
            $this->ingestNestedSectionFiles($allFiles['content'] ?? null, $payload, $contentFileKeys, $elementFileKeys, $name, false);
            $this->ingestNestedSectionFiles($allFiles['element'] ?? null, $payload, $contentFileKeys, $elementFileKeys, $name, true);
            $flatFilesByLeafKey = $this->flattenUploadedFilesByLeafKey($allFiles);
            foreach ($elementFileKeys as $fieldKey) {
                if (! isset($flatFilesByLeafKey[$fieldKey])) {
                    continue;
                }
                foreach ($flatFilesByLeafKey[$fieldKey] as $index => $file) {
                    $storedPath = $this->storeUploadedSectionFile($file, $name);
                    if ($storedPath === null) {
                        continue;
                    }
                    if (! isset($payload['element'][$index]) || ! is_array($payload['element'][$index])) {
                        $payload['element'][$index] = [];
                    }
                    $payload['element'][$index][$fieldKey] = $storedPath;
                }
            }
            foreach ($contentFileKeys as $fieldKey) {
                if (! isset($flatFilesByLeafKey[$fieldKey]) || ! empty($payload['content'][$fieldKey])) {
                    continue;
                }
                $firstFile = $flatFilesByLeafKey[$fieldKey][0] ?? null;
                if ($firstFile instanceof UploadedFile) {
                    $storedPath = $this->storeUploadedSectionFile($firstFile, $name);
                    if ($storedPath !== null) {
                        $payload['content'][$fieldKey] = $storedPath;
                    }
                }
            }
            if (isset($payload['element']) && is_array($payload['element'])) {
                $payload['element'] = array_values($payload['element']);
            }
        }

        $section->update([
            'title' => $section->title ?: ($registryItem['title'] ?? Str::headline($name)),
            'content' => array_key_exists('content', $payload) ? $payload['content'] : (is_array($section->content) ? $section->content : []),
            'element' => array_key_exists('element', $payload) ? $payload['element'] : (is_array($section->element) ? $section->element : []),
            'is_active' => array_key_exists('is_active', $payload) ? (bool) $payload['is_active'] : (bool) $section->is_active,
            'order' => array_key_exists('order', $payload) ? (int) $payload['order'] : (int) $section->order,
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Section content updated successfully.',
            'data' => $section->fresh(),
        ]);
    }

    public function menuItems()
    {
        $items = MenuItem::query()
            ->with(['page:id,name,slug', 'childrenRecursive'])
            ->whereNull('parent_id')
            ->orderBy('order')
            ->get();

        return response()->json([
            'status' => 1,
            'message' => 'Menu items fetched successfully.',
            'data' => $items,
        ]);
    }

    public function storeMenuItem(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'parent_id' => 'nullable|integer|exists:menu_items,id',
            'title' => 'required|string|max:255',
            'url' => 'nullable|string|max:1000',
            'page_id' => 'nullable|integer|exists:pages,id',
            'icon' => 'nullable|string|max:255',
            'target' => 'nullable|in:_self,_blank',
            'order' => 'nullable|integer|min:0',
            'depth' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $data = $validator->validated();
        if (empty($data['url']) && ! empty($data['page_id'])) {
            $page = Page::query()->find($data['page_id']);
            if ($page) {
                $slug = strtolower(trim((string) $page->slug, '/'));
                $data['url'] = $slug === 'home' ? '/' : ('/'.$slug);
            } else {
                $data['url'] = null;
            }
        }

        $item = MenuItem::query()->create([
            'parent_id' => $data['parent_id'] ?? null,
            'title' => $data['title'],
            'url' => $data['url'] ?? null,
            'page_id' => $data['page_id'] ?? null,
            'icon' => $data['icon'] ?? null,
            'target' => $data['target'] ?? '_self',
            'order' => (int) ($data['order'] ?? 0),
            'depth' => (int) ($data['depth'] ?? 0),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Menu item created successfully.',
            'data' => $item->load('page:id,name,slug'),
        ], 201);
    }

    public function updateMenuItem(Request $request, int $id)
    {
        $item = MenuItem::query()->find($id);
        if (! $item) {
            return response()->json([
                'status' => 0,
                'message' => 'Menu item not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'parent_id' => ['nullable', 'integer', 'exists:menu_items,id', Rule::notIn([$id])],
            'title' => 'required|string|max:255',
            'url' => 'nullable|string|max:1000',
            'page_id' => 'nullable|integer|exists:pages,id',
            'icon' => 'nullable|string|max:255',
            'target' => 'nullable|in:_self,_blank',
            'order' => 'nullable|integer|min:0',
            'depth' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $data = $validator->validated();
        if (empty($data['url']) && ! empty($data['page_id'])) {
            $page = Page::query()->find($data['page_id']);
            if ($page) {
                $slug = strtolower(trim((string) $page->slug, '/'));
                $data['url'] = $slug === 'home' ? '/' : ('/'.$slug);
            } else {
                $data['url'] = null;
            }
        }

        $item->update([
            'parent_id' => $data['parent_id'] ?? null,
            'title' => $data['title'],
            'url' => $data['url'] ?? null,
            'page_id' => $data['page_id'] ?? null,
            'icon' => $data['icon'] ?? null,
            'target' => $data['target'] ?? '_self',
            'order' => (int) ($data['order'] ?? $item->order),
            'depth' => (int) ($data['depth'] ?? $item->depth),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Menu item updated successfully.',
            'data' => $item->fresh('page:id,name,slug'),
        ]);
    }

    public function sortMenu(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array',
            'items.*.id' => 'required|integer|exists:menu_items,id',
            'items.*.children' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        DB::transaction(function () use ($request) {
            $this->applyMenuOrder((array) $request->input('items'), null, 0);
        });

        return response()->json([
            'status' => 1,
            'message' => 'Menu items sorted successfully.',
        ]);
    }

    public function deleteMenuItem(int $id)
    {
        $item = MenuItem::query()->find($id);
        if (! $item) {
            return response()->json([
                'status' => 0,
                'message' => 'Menu item not found.',
            ], 404);
        }

        $item->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Menu item deleted successfully.',
        ]);
    }

    private function applyMenuOrder(array $items, ?int $parentId, int $depth): void
    {
        foreach ($items as $index => $item) {
            $menu = MenuItem::query()->find((int) $item['id']);
            if (! $menu) {
                continue;
            }

            $menu->update([
                'parent_id' => $parentId,
                'order' => $index,
                'depth' => $depth,
            ]);

            $children = is_array($item['children'] ?? null) ? $item['children'] : [];
            if (! empty($children)) {
                $this->applyMenuOrder($children, $menu->id, $depth + 1);
            }
        }
    }

    private function uploadBreadcrumbImage($file, ?string $existing = null): string
    {
        return upload($file, Directory::CMS_IMAGE_PATH, $existing ?? '');
    }

    private function uniquePageSlug(string $baseSlug, ?int $ignoreId = null): string
    {
        $slug = $baseSlug !== '' ? $baseSlug : 'page';
        $counter = 1;
        $base = $slug;

        while (true) {
            $query = Page::query()->where('slug', $slug);
            if ($ignoreId !== null) {
                $query->where('id', '!=', $ignoreId);
            }

            if (! $query->exists()) {
                return $slug;
            }

            $slug = $base.'-'.$counter;
            $counter++;
        }
    }

    private function normalizePageSlug(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9_-]+/', '-', $slug) ?? '';
        $slug = preg_replace('/-+/', '-', $slug) ?? '';
        $slug = preg_replace('/_+/', '_', $slug) ?? '';
        return trim($slug, "-_");
    }

    private function registrySections(): array
    {
        $data = [];
        foreach (SectionRegistry::all() as $class) {
            $instance = new $class;
            $data[] = [
                'class' => $class,
                'name' => $instance->getName(),
                'title' => $instance->getTitle(),
            ];
        }

        return $data;
    }

    private function ensureDefaultSectionsFromRegistry(): void
    {
        foreach ($this->registrySections() as $index => $item) {
            Section::query()->firstOrCreate(
                ['name' => $item['name']],
                [
                    'title' => $item['title'],
                    'content' => [],
                    'element' => [],
                    'order' => $index,
                    'is_active' => true,
                ]
            );
        }
    }

    private function normalizeFields(array $fields): array
    {
        return collect($fields)->map(function ($field) {
            $class = class_basename($field);
            $typeMap = [
                'TextField' => 'text',
                'TextareaField' => 'textarea',
                'NumberField' => 'number',
                'FileField' => 'file',
                'IconField' => 'icon',
                'DateField' => 'date',
                'PageLinks' => 'page_links',
                'FooterLinksField' => 'footer_links',
                'RepeaterField' => 'repeater',
            ];

            return [
                'type' => $typeMap[$class] ?? Str::snake(str_replace('Field', '', $class)),
                'class' => $class,
                'name' => method_exists($field, 'getName') ? $field->getName() : null,
                'label' => method_exists($field, 'getLabel') ? $field->getLabel() : null,
                'default' => method_exists($field, 'getDefault') ? $field->getDefault() : null,
                'multiple' => method_exists($field, 'getMultiple') ? (bool) $field->getMultiple() : false,
            ];
        })->values()->all();
    }

    private function extractFileFieldKeys(array $normalizedFields): array
    {
        return collect($normalizedFields)
            ->filter(fn ($field) => ($field['type'] ?? null) === 'file')
            ->map(function ($field) {
                $name = (string) ($field['name'] ?? '');
                if (preg_match('/\[([^\]]+)\]$/', $name, $matches)) {
                    return $matches[1];
                }

                return $name;
            })
            ->filter(fn ($key) => $key !== '')
            ->values()
            ->all();
    }

    private function transformSectionFilePayload(array $payload, array $fileKeys, string $sectionName): array
    {
        foreach ($fileKeys as $key) {
            $current = $payload[$key] ?? null;
            if (! is_string($current) || ! str_starts_with($current, 'data:image/')) {
                continue;
            }

            $storedPath = $this->storeSectionDataUrlImage($current, $sectionName);
            if ($storedPath !== null) {
                $payload[$key] = $storedPath;
            }
        }

        return $payload;
    }

    private function storeSectionDataUrlImage($dataUrl, string $sectionName): ?string
    {

        return upload($dataUrl, Directory::CMS_IMAGE_PATH);

        if (! preg_match('/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/', $dataUrl, $matches)) {
            return null;
        }

        $type = strtolower($matches[1]);
        $base64 = $matches[2];
        $binary = base64_decode($base64, true);
        if ($binary === false) {
            return null;
        }

        $ext = match ($type) {
            'jpeg', 'jpg' => 'jpg',
            'png' => 'png',
            'gif' => 'gif',
            'webp' => 'webp',
            'svg+xml', 'svg' => 'svg',
            default => 'png',
        };
        $tmpPath = tempnam(sys_get_temp_dir(), 'sec_');
        if ($tmpPath === false) {
            return null;
        }

        $finalTmpPath = $tmpPath.'.'.$ext;
        @rename($tmpPath, $finalTmpPath);

        if (file_put_contents($finalTmpPath, $binary) === false) {
            @unlink($finalTmpPath);

            return null;
        }

        try {
            $uploaded = new UploadedFile(
                $finalTmpPath,
                Str::slug($sectionName).'.'.$ext,
                'image/'.$ext,
                null,
                true
            );

            return upload($uploaded, Directory::CMS_IMAGE_PATH);
        } catch (\Throwable $e) {
            return null;
        } finally {
            if (file_exists($finalTmpPath)) {
                @unlink($finalTmpPath);
            }
        }
    }

    private function storeUploadedSectionFile($file, string $sectionName): ?string
    {
        if (! $file || ! $file->isValid()) {
            return null;
        }

        return upload($file, Directory::CMS_IMAGE_PATH);
    }

    private function extractBuilderSectionNames(Page $page): array
    {
        $content = (string) ($page->content ?? '');

        // Preferred/current builder storage format: HTML placeholders with data-section.
        if (str_contains($content, 'data-section=')) {
            return extractDataSections($content);
        }

        // Backward compatibility for older JSON payload format.
        $decoded = $this->decodePageContent($content);
        if (! is_array($decoded)) {
            return [];
        }

        $names = $decoded['builder_sections'] ?? [];

        return collect($names)
            ->filter(fn ($name) => is_string($name) && trim($name) !== '')
            ->map(fn ($name) => trim($name))
            ->values()
            ->all();
    }

    private function mergeBuilderContent($existingContent, array $sectionNames): string
    {
        $normalizedNames = collect($sectionNames)
            ->filter(fn ($name) => is_string($name) && trim($name) !== '')
            ->map(fn ($name) => trim($name))
            ->values()
            ->all();

        $blocks = collect($normalizedNames)->map(function (string $name) {
            $title = Str::headline($name).' Section';

            return '<section data-section="'.e($name).'">'.PHP_EOL
                .'    <div class="section-block" data-section="'.e($name).'">'.PHP_EOL
                .'        <div class="section-header">'.e($title).'</div>'.PHP_EOL
                .'    </div>'.PHP_EOL
                .'</section>';
        })->all();

        return implode(PHP_EOL.PHP_EOL, $blocks);
    }

    private function decodePageContent($content): ?array
    {
        if (! is_string($content) || trim($content) === '') {
            return [];
        }

        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : null;
    }

    private function normalizePageContentForStorage($content): ?string
    {
        if ($content === null) {
            return null;
        }

        if (! is_string($content)) {
            return (string) $content;
        }

        $trimmed = trim($content);
        if ($trimmed === '') {
            return '';
        }

        // Already HTML placeholder format from builder.
        if (str_contains($trimmed, 'data-section=')) {
            return $trimmed;
        }

        // Convert legacy/new JSON payload to HTML placeholder format.
        $decoded = json_decode($trimmed, true);
        if (is_array($decoded) && isset($decoded['builder_sections']) && is_array($decoded['builder_sections'])) {
            return $this->mergeBuilderContent('', $decoded['builder_sections']);
        }

        return $trimmed;
    }

    private function ingestNestedSectionFiles($node, array &$payload, array $contentFileKeys, array $elementFileKeys, string $sectionName, bool $preferElement): void
    {
        if (! is_array($node)) {
            return;
        }

        foreach ($node as $key => $value) {
            if ($value instanceof UploadedFile) {
                $storedPath = $this->storeUploadedSectionFile($value, $sectionName);
                if ($storedPath === null) {
                    continue;
                }

                $fieldKey = (string) $key;
                if (in_array($fieldKey, $contentFileKeys, true) && ! $preferElement) {
                    $payload['content'][$fieldKey] = $storedPath;
                } elseif (in_array($fieldKey, $elementFileKeys, true)) {
                    if (! isset($payload['element'][0]) || ! is_array($payload['element'][0])) {
                        $payload['element'][0] = [];
                    }
                    $payload['element'][0][$fieldKey] = $storedPath;
                }

                continue;
            }

            if (! is_array($value)) {
                continue;
            }

            if (is_numeric($key)) {
                $idx = (int) $key;
                foreach ($value as $fieldKey => $file) {
                    if (! $file instanceof UploadedFile) {
                        continue;
                    }
                    $storedPath = $this->storeUploadedSectionFile($file, $sectionName);
                    if ($storedPath === null) {
                        continue;
                    }

                    $fKey = (string) $fieldKey;
                    if (in_array($fKey, $elementFileKeys, true)) {
                        if (! isset($payload['element'][$idx]) || ! is_array($payload['element'][$idx])) {
                            $payload['element'][$idx] = [];
                        }
                        $payload['element'][$idx][$fKey] = $storedPath;
                    } elseif (in_array($fKey, $contentFileKeys, true) && ! $preferElement) {
                        $payload['content'][$fKey] = $storedPath;
                    }
                }
            } else {
                $this->ingestNestedSectionFiles($value, $payload, $contentFileKeys, $elementFileKeys, $sectionName, $preferElement);
            }
        }

        if (isset($payload['element']) && is_array($payload['element'])) {
            $payload['element'] = array_values($payload['element']);
        }
    }

    private function flattenUploadedFilesByLeafKey(array $files): array
    {
        $result = [];
        $walk = function ($node, ?int $currentIndex = null) use (&$walk, &$result) {
            if (! is_array($node)) {
                return;
            }
            foreach ($node as $key => $value) {
                $nextIndex = $currentIndex;
                if (is_numeric($key)) {
                    $nextIndex = (int) $key;
                }
                if ($value instanceof UploadedFile) {
                    $leaf = (string) $key;
                    $bucket = $nextIndex ?? count($result[$leaf] ?? []);
                    $result[$leaf][$bucket] = $value;

                    continue;
                }
                if (is_array($value)) {
                    $walk($value, $nextIndex);
                }
            }
        };
        $walk($files, null);
        foreach ($result as $leaf => $items) {
            ksort($items);
            $result[$leaf] = array_values($items);
        }

        return $result;
    }
}

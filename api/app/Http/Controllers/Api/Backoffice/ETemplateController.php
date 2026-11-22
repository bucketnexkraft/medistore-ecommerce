<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Constant\Directory;
use App\Enums\TemplateTypes;
use App\Enums\StorefrontSectionPreset;
use App\Http\Controllers\Controller;
use App\Models\ECategory;
use App\Models\ESectionPreset;
use App\Models\ETemplate;
use App\Models\SaasPlan;
use App\Services\Backoffice\ETemplateBuilderService;
use App\Support\StorefrontCategorySectionCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ETemplateController extends Controller
{
    public function __construct(private readonly ETemplateBuilderService $builderService)
    {
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

    public function options(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $data = [
            'categories' => $this->configuredCategories(),
            'plans' => SaasPlan::query()
                ->where('status', true)
                ->orderByDesc('is_default')
                ->orderBy('price')
                ->get(['id', 'name', 'price', 'is_free', 'status']),
            'template_types' => TemplateTypes::options(),
        ];

        // The template list only needs categories, plans and types. Keep the
        // large builder metadata for the builder screen, where it is needed.
        if (! $request->boolean('minimal')) {
            $builderMeta = $this->builderService->defaultBuilder()['meta'];
            $data += [
                'template_variants' => $builderMeta['template_variants'],
                'section_presets' => $builderMeta['section_presets'],
                'category_preset_map' => $builderMeta['category_preset_map'],
                'component_options' => $builderMeta['component_options'],
                'template_variants_by_category' => $builderMeta['template_variants_by_category'],
                'section_presets_by_category' => $builderMeta['section_presets_by_category'],
                'component_options_by_category' => $builderMeta['component_options_by_category'],
                'storefront_themes_by_category' => $builderMeta['storefront_themes_by_category'],
                'page_components_by_category' => $builderMeta['page_components_by_category'],
            ];
        }

        return response()->json([
            'status' => 1,
            'message' => 'E-template options fetched successfully.',
            'data' => $data,
        ]);
    }

    public function index(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $perPage = max((int) $request->input('perPage', 20), 1);
        $page = max((int) $request->input('page', 1), 1);
        $search = trim((string) $request->input('search', ''));

        $query = ETemplate::query()
            ->withCount(['pages', 'sections', 'actions']);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('template_name', 'like', '%' . $search . '%');

                foreach (preg_split('/\s+/', $search) ?: [] as $term) {
                    $term = trim((string) $term);
                    if ($term === '') {
                        continue;
                    }

                    $builder->orWhereJsonContains('tags', $term)
                        ->orWhere('categories', 'like', '%' . $term . '%');
                }
            });
        }

        $rows = $query->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);
        // Counts are available from withCount above. Do not build the complete
        // template builder for every row in the list response.
        $data = collect($rows->items())->map(fn (ETemplate $template) => $template->toArray())
            ->values()
            ->all();

        return response()->json([
            'status' => 1,
            'message' => 'E-templates fetched successfully.',
            'data' => $data,
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = ETemplate::query()->find($id);
        if (! $template) {
            return response()->json([
                'status' => 0,
                'message' => 'E-template not found.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'E-template fetched successfully.',
            'data' => array_merge(
                $template->toArray(),
                [
                    'builder' => $this->builderService->getBuilder($template),
                ],
                $this->builderService->builderMeta($template)
            ),
        ]);
    }

    public function store(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $payload = $this->preparePayload($request);
        $validator = Validator::make($payload, $this->rules());

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $validated = $validator->validated();
        $template = ETemplate::create([
            'template_name' => trim((string) $validated['template_name']),
            'primary_color' => strtoupper($validated['primary_color']),
            'secondary_color' => strtoupper($validated['secondary_color']),
            'font_family' => $validated['font_family'],
            'template_type' => TemplateTypes::fromValue($validated['template_type'])->value,
            'short_description' => trim((string) ($validated['short_description'] ?? '')) ?: null,
            'price' => TemplateTypes::isFreeValue($validated['template_type']) ? 0 : (float) ($validated['price'] ?? 0),
            'discount_amount' => TemplateTypes::isFreeValue($validated['template_type']) ? 0 : (float) ($validated['discount_amount'] ?? 0),
            'discount_type' => TemplateTypes::isFreeValue($validated['template_type']) ? 'fixed' : $validated['discount_type'],
            'image' => isset($validated['image']) && $validated['image'] instanceof UploadedFile
                ? upload($validated['image'], Directory::E_TEMPLATE_IMAGE_PATH)
                : null,
            'categories' => $this->normalizeCategories($validated['categories'] ?? []),
            'tags' => $this->normalizeTags($validated['tags'] ?? []),
            'section_preset_refs' => $this->normalizeSectionPresetRefs($validated['section_preset_refs'] ?? []),
        ]);

        $this->builderService->createDefaultHomePage($template);

        return response()->json([
            'status' => 1,
            'message' => 'E-template created successfully.',
            'data' => array_merge(
                $template->fresh(['plans:id,name'])->toArray(),
                [
                    'builder' => $this->builderService->getBuilder($template),
                ],
                $this->builderService->builderMeta($template)
            ),
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = ETemplate::query()->with(['plans:id,name'])->find($id);
        if (! $template) {
            return response()->json([
                'status' => 0,
                'message' => 'E-template not found.',
            ], 404);
        }

        $payload = $this->preparePayload($request);
        $validator = Validator::make($payload, $this->rules(false));

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $validated = $validator->validated();
        $image = $template->image;

        if (isset($validated['image']) && $validated['image'] instanceof UploadedFile) {
            $image = upload($validated['image'], Directory::E_TEMPLATE_IMAGE_PATH, $template->image ?? '');
        }

        $template->update([
            'template_name' => trim((string) $validated['template_name']),
            'primary_color' => strtoupper($validated['primary_color']),
            'secondary_color' => strtoupper($validated['secondary_color']),
            'font_family' => $validated['font_family'],
            'template_type' => TemplateTypes::fromValue($validated['template_type'])->value,
            'short_description' => trim((string) ($validated['short_description'] ?? '')) ?: null,
            'price' => TemplateTypes::isFreeValue($validated['template_type']) ? 0 : (float) ($validated['price'] ?? 0),
            'discount_amount' => TemplateTypes::isFreeValue($validated['template_type']) ? 0 : (float) ($validated['discount_amount'] ?? 0),
            'discount_type' => TemplateTypes::isFreeValue($validated['template_type']) ? 'fixed' : $validated['discount_type'],
            'image' => $image,
            'categories' => $this->normalizeCategories($validated['categories'] ?? []),
            'tags' => $this->normalizeTags($validated['tags'] ?? []),
            'section_preset_refs' => $this->normalizeSectionPresetRefs($validated['section_preset_refs'] ?? []),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'E-template updated successfully.',
            'data' => array_merge(
                $template->fresh(['plans:id,name'])->toArray(),
                [
                    'builder' => $this->builderService->getBuilder($template->fresh()),
                ],
                $this->builderService->builderMeta($template->fresh())
            ),
        ]);
    }

    public function showBuilder(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = ETemplate::query()->with(['plans:id,name'])->find($id);
        if (! $template) {
            return response()->json([
                'status' => 0,
                'message' => 'E-template not found.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'E-template builder fetched successfully.',
            'data' => [
                'template' => $template,
                'builder' => $this->builderService->getBuilder($template),
            ],
        ]);
    }

    public function updateBuilder(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = ETemplate::query()->with(['plans:id,name'])->find($id);
        if (! $template) {
            return response()->json([
                'status' => 0,
                'message' => 'E-template not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'builder' => ['required', 'array'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $template = $this->builderService->updateBuilder($template, $request->input('builder'));

        return response()->json([
            'status' => 1,
            'message' => 'E-template builder updated successfully.',
            'data' => [
                'template' => $template,
                'builder' => $this->builderService->getBuilder($template),
            ],
        ]);
    }

    public function destroy(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = ETemplate::find($id);
        if (! $template) {
            return response()->json([
                'status' => 0,
                'message' => 'E-template not found.',
            ], 404);
        }

        if (! empty($template->image)) {
            $path = public_path('images/' . Directory::E_TEMPLATE_IMAGE_PATH . '/' . $template->image);
            if (file_exists($path) && is_file($path)) {
                @unlink($path);
            }
        }

        $template->delete();

        return response()->json([
            'status' => 1,
            'message' => 'E-template deleted successfully.',
        ]);
    }

    private function rules(bool $isCreate = true): array
    {
        return [
            'template_name' => ['required', 'string', 'max:191'],
            'primary_color' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'secondary_color' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'font_family' => ['required', 'string', 'max:100'],
            'template_type' => ['required', 'string', 'max:100'],
            'short_description' => ['required', 'string', 'max:500'],
            'price' => ['required', 'numeric', 'min:0'],
            'discount_type' => ['required', Rule::in(['fixed', 'percent'])],
            'discount_amount' => ['nullable', 'numeric', 'min:0', function (string $attribute, mixed $value, \Closure $fail) {
                if (request()->input('discount_type') === 'percent' && (float) $value > 100) {
                    $fail('Percentage discount cannot be greater than 100.');
                }
            }],
            'image' => [$isCreate ? 'required' : 'nullable', 'image', 'mimes:jpeg,png,jpg,gif,webp', 'dimensions:width=444,height=464', 'max:4096'],
            'categories' => ['nullable', 'array'],
            'categories.*.id' => ['required', 'integer', 'exists:e_categories,id'],
            'categories.*.name' => ['nullable', 'string', 'max:191'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['nullable', 'string', 'max:100'],
            'section_preset_refs' => ['nullable', 'array'],
            'section_preset_refs.*.preset_key' => ['required', 'string', 'max:120'],
            'section_preset_refs.*.name' => ['nullable', 'string', 'max:191'],
            'section_preset_refs.*.section_type' => ['nullable', 'string', 'max:80'],
            'section_preset_refs.*.component_key' => ['nullable', 'string', 'max:120'],
        ];
    }

    private function preparePayload(Request $request): array
    {
        $payload = $request->all();

        if (array_key_exists('categories', $payload)) {
            $payload['categories'] = $this->decodeArrayInput($payload['categories']);
        }

        if (array_key_exists('tags', $payload)) {
            $payload['tags'] = $this->decodeArrayInput($payload['tags']);
        }

        if (array_key_exists('section_preset_refs', $payload)) {
            $payload['section_preset_refs'] = $this->decodeArrayInput($payload['section_preset_refs']);
        }

        if (array_key_exists('template_type', $payload)) {
            $payload['template_type'] = TemplateTypes::fromValue($payload['template_type'])->value;
        }

        return $payload;
    }

    private function decodeArrayInput(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeCategories(array $categories): array
    {
        $ids = collect($categories)
            ->pluck('id')
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();

        if (empty($ids)) {
            return [];
        }

        $categoryMap = ECategory::query()
            ->whereIn('id', $ids)
            ->get(['id', 'name'])
            ->keyBy('id');

        return collect($ids)
            ->map(function (int $id) use ($categoryMap) {
                $category = $categoryMap->get($id);

                if (! $category) {
                    return null;
                }

                return [
                    'id' => $category->id,
                    'name' => $category->name,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function configuredCategories()
    {
        $configuredNames = StorefrontCategorySectionCatalog::categoryNames();

        if (empty($configuredNames)) {
            return ECategory::query()
                ->where('status', true)
                ->orderBy('name')
                ->get(['id', 'name']);
        }

        $ordering = implode(', ', array_map(
            fn (string $name) => DB::getPdo()->quote($name),
            $configuredNames
        ));

        return ECategory::query()
            ->where('status', true)
            ->whereIn('name', $configuredNames)
            ->orderByRaw("FIELD(name, {$ordering})")
            ->get(['id', 'name']);
    }

    private function normalizeTags(array $tags): array
    {
        return collect($tags)
            ->map(fn ($tag) => trim((string) $tag))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function normalizeSectionPresetRefs(array $refs): array
    {
        $lookup = $this->configuredPresetLookup();

        $presetKeys = collect($refs)
            ->map(function ($ref) {
                if (is_array($ref)) {
                    $presetKey = trim((string) ($ref['preset_key'] ?? ''));

                    if ($presetKey !== '') {
                        return $presetKey;
                    }

                    $legacyId = $ref['id'] ?? null;
                    if (is_numeric($legacyId)) {
                        $legacyPreset = ESectionPreset::query()->find((int) $legacyId);

                        if ($legacyPreset && trim((string) $legacyPreset->preset_key) !== '') {
                            return trim((string) $legacyPreset->preset_key);
                        }
                    }

                    return '';
                }

                $presetKey = trim((string) $ref);
                if ($presetKey !== '') {
                    return $presetKey;
                }

                if (is_numeric($ref)) {
                    $legacyPreset = ESectionPreset::query()->find((int) $ref);

                    if ($legacyPreset && trim((string) $legacyPreset->preset_key) !== '') {
                        return trim((string) $legacyPreset->preset_key);
                    }
                }

                return '';
            })
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($presetKeys)) {
            return [];
        }

        return collect($presetKeys)
            ->map(function (string $presetKey) use ($lookup) {
                $preset = $lookup[$presetKey] ?? null;

                if (! $preset) {
                    $preset = StorefrontCategorySectionCatalog::find($presetKey);
                }

                if (! $preset) {
                    $definition = StorefrontSectionPreset::tryFromValue($presetKey);

                    if (! $definition) {
                        return null;
                    }

                    $preset = [
                        'preset_key' => $definition->value,
                        'name' => $definition->label(),
                        'section_type' => $definition->sectionType(),
                        'component_key' => $definition->componentKey(),
                    ];
                }

                return [
                    'preset_key' => $preset['preset_key'],
                    'name' => $preset['name'],
                    'section_type' => $preset['section_type'],
                    'component_key' => $preset['component_key'],
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function configuredPresetLookup(): array
    {
        $scoped = collect(StorefrontCategorySectionCatalog::definitions())
            ->keyBy('preset_key')
            ->all();
        $configuredLegacy = collect(StorefrontCategorySectionCatalog::definitions())
            ->mapWithKeys(fn (array $preset) => [
                $preset['legacy_preset_key'] => $preset,
            ])
            ->all();
        $legacy = collect(StorefrontSectionPreset::cases())
            ->mapWithKeys(fn (StorefrontSectionPreset $preset) => [
                $preset->value => [
                    'preset_key' => $preset->value,
                    'name' => $preset->label(),
                    'section_type' => $preset->sectionType(),
                    'component_key' => $preset->componentKey(),
                ],
            ])
            ->all();

        return array_merge($legacy, $configuredLegacy, $scoped);
    }
}

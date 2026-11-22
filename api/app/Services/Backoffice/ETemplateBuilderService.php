<?php

namespace App\Services\Backoffice;

use App\Enums\StorefrontSectionPreset;
use App\Enums\StorefrontTemplateVariant;
use App\Models\ETemplateAction;
use App\Models\ETemplatePage;
use App\Models\ETemplateSection;
use App\Models\ETemplate;
use App\Models\ECategory;
use App\Support\StorefrontCategorySectionCatalog;
use App\Support\StorefrontSectionSchemaRegistry;
use App\Support\StorefrontCategoryThemeCatalog;
use App\Support\StorefrontSectionComponentRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ETemplateBuilderService
{
    private const DEFAULT_HOME_NAME = 'Home';
    private const DEFAULT_HOME_SLUG = 'home';
    private const DEFAULT_HOME_ROUTE_KEY = '/';

    private function supportsSectionConfigJson(): bool
    {
        return Schema::hasColumn('e_template_sections', 'config_json');
    }

    private function normalizeSectionConfig(mixed $value, string $variant, string $presetKey, ?string $category = null): array
    {
        $schema = StorefrontSectionSchemaRegistry::for($variant, $presetKey, $category);
        for ($attempt = 0; $attempt < 2 && is_string($value); $attempt++) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }
        $value = is_array($value) ? $value : [];

        return [
            'schema' => $schema,
            'config' => [
                'schema_version' => (int) ($value['schema_version'] ?? $schema['version'] ?? 1),
                ...StorefrontSectionSchemaRegistry::normalize($value, $schema),
            ],
        ];
    }

    private const ACTION_LINK_TYPES = ['internal_route', 'custom_path', 'external_url', 'storefront_page'];
    private const PAGE_ROUTE_MODES = ['internal_route', 'custom_url'];
    private const PAGE_INTERNAL_ROUTE_OPTIONS = [
        '/',
        '/products',
        '/categories',
        '/brands',
        '/deals',
        '/new-arrival',
        '/limited-sale',
        '/best-seller',
        '/group-purchase',
        '/wishlist',
        '/cart',
        '/checkout',
        '/checkout-one',
        '/checkout-two',
        '/track-order',
        '/user-dashboard',
    ];

    public function defaultBuilder(): array
    {
        return [
            'version' => 1,
            'pages' => [],
            'sections' => [],
            'actions' => [],
            'settings' => [
                'header_placeholder' => '#HEADER_LINKS#',
                'token_pattern_hint' => '#privacy_policy#',
                'load_actions_on_boot' => true,
            ],
            'meta' => [
                'template_variants' => StorefrontTemplateVariant::options(),
                'section_presets' => $this->sectionPresets(),
                'category_preset_map' => $this->categoryPresetMap(),
                'component_options' => StorefrontSectionComponentRegistry::options(),
                'template_variants_by_category' => StorefrontTemplateVariant::optionsByCategory(),
                'section_presets_by_category' => StorefrontCategorySectionCatalog::groupedOptionsByCategory(),
                'section_schemas' => StorefrontSectionSchemaRegistry::all(),
                'component_options_by_category' => StorefrontSectionComponentRegistry::optionsByCategory(),
                'storefront_themes_by_category' => StorefrontCategoryThemeCatalog::themesByCategory(),
                'page_components_by_category' => StorefrontCategoryThemeCatalog::pageOptionsByCategory(),
            ],
        ];
    }

    public function getBuilder(ETemplate $template): array
    {
        return $this->buildResponseFromRecords($template);
    }

    public function createDefaultHomePage(ETemplate $template): ETemplatePage
    {
        $pageId = 'template-' . $template->id . '-home';

        return ETemplatePage::query()->updateOrCreate(
            [
                'id' => $pageId,
                'template_id' => $template->id,
            ],
            [
                'name' => self::DEFAULT_HOME_NAME,
                'slug' => self::DEFAULT_HOME_SLUG,
                'route_mode' => 'internal_route',
                'route_key' => self::DEFAULT_HOME_ROUTE_KEY,
                'component_key' => StorefrontCategoryThemeCatalog::defaultPageComponent(
                    $this->templateCategory($template),
                    'home'
                ) ?: null,
                'description' => null,
                'menu_token' => null,
            ]
        );
    }

    public function updateBuilder(ETemplate $template, mixed $builder): ETemplate
    {
        $normalizedBuilder = $this->enforceDefaultHomePage(
            $template,
            $this->normalizeBuilder($builder)
        );
        $supportsSectionConfigJson = $this->supportsSectionConfigJson();

        DB::transaction(function () use ($template, $normalizedBuilder, $supportsSectionConfigJson) {
            $pageIds = collect($normalizedBuilder['pages'])->pluck('id')->filter()->values();
            $sectionIds = collect($normalizedBuilder['sections'])->pluck('id')->filter()->values();
            $actionIds = collect($normalizedBuilder['actions'])->pluck('id')->filter()->values();

            ETemplateAction::query()
                ->where('template_id', $template->id)
                ->when($actionIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $actionIds->all()))
                ->delete();

            if ($actionIds->isEmpty()) {
                ETemplateAction::query()->where('template_id', $template->id)->delete();
            }

            ETemplateSection::query()
                ->where('template_id', $template->id)
                ->when($sectionIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $sectionIds->all()))
                ->delete();

            if ($sectionIds->isEmpty()) {
                ETemplateSection::query()->where('template_id', $template->id)->delete();
            }

            ETemplatePage::query()
                ->where('template_id', $template->id)
                ->when($pageIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $pageIds->all()))
                ->delete();

            if ($pageIds->isEmpty()) {
                ETemplatePage::query()->where('template_id', $template->id)->delete();
            }

            foreach ($normalizedBuilder['pages'] as $page) {
                ETemplatePage::query()->updateOrCreate(
                    [
                        'id' => $page['id'],
                        'template_id' => $template->id,
                    ],
                    [
                        'name' => $page['name'],
                        'slug' => $page['slug'],
                        'route_mode' => $page['route_mode'] ?: 'custom_url',
                        'route_key' => $page['route_mode'] === 'internal_route'
                            ? ($page['route_key'] ?: '/')
                            : null,
                        'component_key' => $page['component_key'] ?: null,
                        'description' => $page['description'] ?: null,
                        'menu_token' => $page['menu_token'] ?: null,
                    ]
                );
            }

            foreach ($normalizedBuilder['sections'] as $section) {
                ETemplateSection::query()->updateOrCreate(
                    [
                        'id' => $section['id'],
                        'template_id' => $template->id,
                    ],
                    [
                        'page_id' => $section['page_id'],
                        'name' => $section['name'] ?: null,
                        'title' => $section['title'] ?: null,
                        'subtitle' => $section['subtitle'] ?: null,
                        'layout' => $section['layout'],
                        'variant' => $section['variant'] ?: null,
                        'preset_key' => $section['preset_key'] ?: null,
                        'component_key' => $section['component_key'] ?: null,
                        'category_refs' => $this->normalizeCategoryRefs($section['category_refs'] ?? []),
                        'order' => (int) $section['order'],
                        'query_sql' => $section['query_sql'] ?: null,
                        'query_json' => $section['query_json'] ?: null,
                        'rich_text_html' => $section['rich_text_html'] ?: null,
                        ...($supportsSectionConfigJson ? [
                            // Let the Eloquent cast encode the array once.
                            'config_json' => $section['config'] ?? [],
                        ] : []),
                    ]
                );
            }

            foreach ($normalizedBuilder['actions'] as $action) {
                ETemplateAction::query()->updateOrCreate(
                    [
                        'id' => $action['id'],
                        'template_id' => $template->id,
                    ],
                    [
                        'page_id' => $action['page_id'],
                        'section_id' => $action['section_id'] ?: null,
                        'target_page_id' => $action['target_page_id'] ?: null,
                        'name' => $action['name'] ?: null,
                        'slug' => $action['slug'] ?: null,
                        'expression' => $action['expression'] ?: null,
                        'link_type' => $action['link_type'] ?: 'custom_path',
                        'route_key' => $action['route_key'] ?: null,
                        'label' => $action['label'] ?: null,
                        'placement' => in_array($action['placement'] ?? '', ['header', 'footer'], true)
                            ? $action['placement']
                            : 'header',
                        'footer_group' => $action['footer_group'] ?: null,
                        'sort_order' => max(1, (int) ($action['sort_order'] ?? 1)),
                    ]
                );
            }

            $template->update([
                'section_preset_refs' => $this->normalizeSectionPresetRefs($normalizedBuilder['sections']),
            ]);
        });

        return $template->fresh();
    }

    private function enforceDefaultHomePage(ETemplate $template, array $builder): array
    {
        $existingHomePageId = ETemplatePage::query()
            ->where('template_id', $template->id)
            ->where(function ($query) {
                $query->where('route_key', self::DEFAULT_HOME_ROUTE_KEY)
                    ->orWhere('slug', self::DEFAULT_HOME_SLUG);
            })
            ->value('id');

        $submittedHomePages = collect($builder['pages'] ?? [])
            ->filter(fn (array $page) => $this->isHomePage($page));
        $submittedHomePage = $submittedHomePages->first() ?? [];
        $submittedHomePageId = (string) ($submittedHomePage['id'] ?? '');
        $homePageId = (string) ($existingHomePageId
            ?: $submittedHomePageId
            ?: ('template-' . $template->id . '-home'));
        $homePageAliases = $submittedHomePages
            ->pluck('id')
            ->filter()
            ->map(fn ($id) => (string) $id)
            ->push($homePageId)
            ->unique()
            ->values()
            ->all();

        $homePage = [
            'id' => $homePageId,
            'name' => self::DEFAULT_HOME_NAME,
            'slug' => self::DEFAULT_HOME_SLUG,
            'route_mode' => 'internal_route',
            'route_key' => self::DEFAULT_HOME_ROUTE_KEY,
            'component_key' => StorefrontCategoryThemeCatalog::resolvePageComponent(
                $this->templateCategory($template),
                'home',
                $submittedHomePage['component_key'] ?? ''
            ),
            'description' => '',
            'menu_token' => '',
        ];

        $templateCategory = $this->templateCategory($template);
        $otherPages = collect($builder['pages'] ?? [])
            ->reject(fn (array $page) => in_array((string) ($page['id'] ?? ''), $homePageAliases, true) || $this->isHomePage($page))
            ->map(function (array $page) use ($templateCategory) {
                $pageKey = ($page['route_mode'] ?? '') === 'internal_route'
                    ? ($page['route_key'] ?? '')
                    : ($page['slug'] ?? '');
                $page['component_key'] = StorefrontCategoryThemeCatalog::resolvePageComponent(
                    $templateCategory,
                    $pageKey,
                    $page['component_key'] ?? ''
                );

                return $page;
            })
            ->values()
            ->all();

        $builder['pages'] = array_merge([$homePage], $otherPages);
        $builder['sections'] = collect($builder['sections'] ?? [])
            ->map(function (array $section) use ($homePageAliases, $homePageId) {
                if (in_array((string) ($section['page_id'] ?? ''), $homePageAliases, true)) {
                    $section['page_id'] = $homePageId;
                }

                return $section;
            })
            ->all();
        $builder['actions'] = collect($builder['actions'] ?? [])
            ->map(function (array $action) use ($homePageAliases, $homePageId) {
                if (in_array((string) ($action['page_id'] ?? ''), $homePageAliases, true)) {
                    $action['page_id'] = $homePageId;
                }
                if (in_array((string) ($action['target_page_id'] ?? ''), $homePageAliases, true)) {
                    $action['target_page_id'] = $homePageId;
                }

                return $action;
            })
            ->all();
        $builder['default_page_id'] = $homePageId;

        return $builder;
    }

    private function isHomePage(array $page): bool
    {
        return trim((string) ($page['route_key'] ?? '')) === self::DEFAULT_HOME_ROUTE_KEY
            || strtolower(trim((string) ($page['slug'] ?? ''))) === self::DEFAULT_HOME_SLUG;
    }

    public function builderMeta(ETemplate $template): array
    {
        $builder = $this->getBuilder($template);

        return [
            'pages_count' => count($builder['pages'] ?? []),
            'sections_count' => count($builder['sections'] ?? []),
            'actions_count' => count($builder['actions'] ?? []),
        ];
    }

    public function normalizeBuilder(mixed $builder): array
    {
        if (is_string($builder)) {
            $decoded = json_decode($builder, true);
            $builder = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (! is_array($builder)) {
            return $this->defaultBuilder();
        }

        $defaults = $this->defaultBuilder();
        $pages = is_array($builder['pages'] ?? null) ? $builder['pages'] : [];
        $sections = is_array($builder['sections'] ?? null) ? $builder['sections'] : [];
        $actions = is_array($builder['actions'] ?? null) ? $builder['actions'] : [];
        $settings = is_array($builder['settings'] ?? null) ? $builder['settings'] : [];

        $normalizedPages = array_values(array_map(function (array $page, int $index) {
            $name = trim((string) ($page['name'] ?? 'Untitled Page'));
            $slug = trim((string) ($page['slug'] ?? ''));
            $resolvedSlug = $this->normalizePageSlug($slug !== '' ? $slug : $name, $index);
            $routeMode = $this->normalizePageRouteMode($page);
            $routeKey = $this->normalizePageRouteKey($page, $routeMode);
            $resolvedSlug = $routeMode === 'internal_route'
                ? $this->resolvePageSlugFromRoute($routeKey, $resolvedSlug, $index)
                : $resolvedSlug;

            return [
                'id' => (string) ($page['id'] ?? ('template-page-' . ($index + 1) . '-' . Str::uuid())),
                'name' => $name,
                'slug' => $resolvedSlug,
                'route_mode' => $routeMode,
                'route_key' => $routeKey,
                'component_key' => trim((string) ($page['component_key'] ?? '')),
                'description' => trim((string) ($page['description'] ?? '')),
                'menu_token' => trim((string) ($page['menu_token'] ?? '')),
            ];
        }, array_filter($pages, 'is_array'), array_keys(array_filter($pages, 'is_array'))));

        $pageIds = collect($normalizedPages)->pluck('id')->all();
        $pageSlugMap = collect($normalizedPages)
            ->mapWithKeys(fn (array $page) => [$page['id'] => $page['slug']])
            ->all();
        $pageRouteModeMap = collect($normalizedPages)
            ->mapWithKeys(fn (array $page) => [$page['id'] => $page['route_mode']])
            ->all();
        $pageRouteKeyMap = collect($normalizedPages)
            ->mapWithKeys(fn (array $page) => [$page['id'] => $page['route_key']])
            ->all();
        $fallbackPageId = $pageIds[0] ?? null;

        $normalizedSections = array_values(array_filter(array_map(function (array $section, int $index) use ($pageIds, $fallbackPageId) {
            $pageId = (string) ($section['page_id'] ?? $fallbackPageId);
            if ($pageId !== '' && ! in_array($pageId, $pageIds, true)) {
                $pageId = $fallbackPageId;
            }

            if (! $pageId) {
                return null;
            }

            $presetKey = $this->normalizePresetKey($section['preset_key'] ?? '');
            $catalogPreset = StorefrontCategorySectionCatalog::find($presetKey);
            $variant = trim((string) ($catalogPreset['section_type'] ?? $section['variant'] ?? StorefrontTemplateVariant::default()->value));
            if (! in_array($variant, StorefrontTemplateVariant::values(), true)) {
                $variant = StorefrontTemplateVariant::default()->value;
            }

            $requestedComponentKey = trim((string) ($section['component_key'] ?? ''));
            $componentKey = StorefrontSectionComponentRegistry::isValidForVariant($variant, $requestedComponentKey)
                ? $requestedComponentKey
                : trim((string) ($catalogPreset['component_key'] ?? $requestedComponentKey));

            $queryJson = trim((string) ($section['query_json'] ?? ''));
            $queryConfig = is_array($section['query_config'] ?? null) ? $section['query_config'] : [];

            if ($queryJson === '' && ! empty($queryConfig)) {
                $queryJson = json_encode($queryConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '';
            }
            $editor = $this->normalizeSectionConfig(
                $section['config'] ?? $section['config_json'] ?? [],
                $variant,
                $catalogPreset['legacy_preset_key'] ?? $catalogPreset['preset_key'] ?? $presetKey,
                $catalogPreset['category_name'] ?? null
            );

            return [
                'id' => (string) ($section['id'] ?? ('template-section-' . ($index + 1) . '-' . Str::uuid())),
                'page_id' => $pageId,
                'name' => trim((string) ($section['name'] ?? '')),
                'title' => trim((string) ($section['title'] ?? '')),
                'subtitle' => trim((string) ($section['subtitle'] ?? '')),
                'newsletter_title' => trim((string) ($section['newsletter_title'] ?? '')),
                'newsletter_text' => trim((string) ($section['newsletter_text'] ?? '')),
                'layout' => trim((string) ($section['layout'] ?? 'template')),
                'variant' => $variant,
                'preset_key' => trim((string) ($catalogPreset['preset_key'] ?? $presetKey)),
                'component_key' => StorefrontSectionComponentRegistry::normalize($variant, $componentKey),
                'category_refs' => $this->normalizeCategoryRefs($section['category_refs'] ?? []),
                'order' => max(1, (int) ($section['order'] ?? ($index + 1))),
                'query_sql' => trim((string) ($section['query_sql'] ?? '')),
                'query_json' => $queryJson,
                'query_config' => $queryConfig,
                'rich_text_html' => (string) ($section['rich_text_html'] ?? ''),
                'config' => $editor['config'],
                'editor_schema' => $editor['schema'],
            ];
        }, array_filter($sections, 'is_array'), array_keys(array_filter($sections, 'is_array')))));

        $sectionIds = collect($normalizedSections)->pluck('id')->all();

        $normalizedActions = array_values(array_filter(array_map(function (array $action, int $index) use ($pageIds, $sectionIds, $pageSlugMap, $pageRouteModeMap, $pageRouteKeyMap, $fallbackPageId) {
            $pageId = (string) ($action['page_id'] ?? $fallbackPageId);
            if ($pageId !== '' && ! in_array($pageId, $pageIds, true)) {
                $pageId = $fallbackPageId;
            }

            if (! $pageId) {
                return null;
            }

            $sectionId = trim((string) ($action['section_id'] ?? ''));
            if ($sectionId !== '' && ! in_array($sectionId, $sectionIds, true)) {
                $sectionId = '';
            }

            $targetPageId = trim((string) ($action['target_page_id'] ?? ''));
            if ($targetPageId !== '' && ! in_array($targetPageId, $pageIds, true)) {
                $targetPageId = '';
            }

            $linkType = $this->normalizeActionLinkType($action);
            $routeKey = trim((string) ($action['route_key'] ?? ''));
            $expression = trim((string) ($action['expression'] ?? ''));

            if ($linkType === 'internal_route') {
                $routeKey = $routeKey !== '' ? $routeKey : $expression;
                $expression = $routeKey !== '' ? $routeKey : $expression;
            } elseif ($linkType === 'storefront_page') {
                $routeKey = '';
                $expression = '';
            } else {
                $routeKey = '';
            }

            $placement = trim((string) ($action['placement'] ?? 'header')) === 'footer' ? 'footer' : 'header';
            if ($placement === 'footer' && $targetPageId === '') {
                return null;
            }

            return [
                'id' => (string) ($action['id'] ?? ('template-action-' . ($index + 1) . '-' . Str::uuid())),
                'page_id' => $pageId,
                'section_id' => $sectionId,
                'name' => trim((string) ($action['name'] ?? '')),
                'slug' => trim((string) ($action['slug'] ?? '')),
                'expression' => $expression,
                'link_type' => $linkType,
                'route_key' => $routeKey,
                'target_page_id' => $targetPageId,
                'target_page_slug' => $targetPageId !== '' ? ($pageSlugMap[$targetPageId] ?? '') : '',
                'target_page_route_mode' => $targetPageId !== '' ? ($pageRouteModeMap[$targetPageId] ?? 'custom_url') : 'custom_url',
                'target_page_route_key' => $targetPageId !== '' ? ($pageRouteKeyMap[$targetPageId] ?? '') : '',
                'label' => trim((string) ($action['label'] ?? '')),
                'placement' => $placement,
                'footer_group' => trim((string) ($action['footer_group'] ?? '')),
                'sort_order' => max(1, (int) ($action['sort_order'] ?? ($index + 1))),
            ];
        }, array_filter($actions, 'is_array'), array_keys(array_filter($actions, 'is_array')))));

        return [
            'version' => 1,
            'pages' => $normalizedPages,
            'sections' => $normalizedSections,
            'actions' => $normalizedActions,
            'settings' => array_merge($defaults['settings'], $settings),
            'meta' => [
                'template_variants' => StorefrontTemplateVariant::options(),
                'section_presets' => $this->sectionPresets(),
                'category_preset_map' => $this->categoryPresetMap(),
                'component_options' => StorefrontSectionComponentRegistry::options(),
                'template_variants_by_category' => StorefrontTemplateVariant::optionsByCategory(),
                'section_presets_by_category' => StorefrontCategorySectionCatalog::groupedOptionsByCategory(),
                'section_schemas' => StorefrontSectionSchemaRegistry::all(),
                'component_options_by_category' => StorefrontSectionComponentRegistry::optionsByCategory(),
                'storefront_themes_by_category' => StorefrontCategoryThemeCatalog::themesByCategory(),
                'page_components_by_category' => StorefrontCategoryThemeCatalog::pageOptionsByCategory(),
            ],
        ];
    }

    private function buildResponseFromRecords(ETemplate $template): array
    {
        $pages = ETemplatePage::query()
            ->where('template_id', $template->id)
            ->orderBy('created_at')
            ->get()
            ->map(fn (ETemplatePage $page) => [
                'id' => $page->id,
                'name' => $page->name,
                'slug' => $page->slug,
                'route_mode' => $page->route_mode ?? 'custom_url',
                'route_key' => $page->route_key ?? '',
                'component_key' => $page->component_key ?? '',
                'description' => $page->description ?? '',
                'menu_token' => $page->menu_token ?? '',
            ])
            ->values()
            ->all();

        $defaultHomePage = collect($pages)->first(
            fn (array $page) => $this->isHomePage($page)
        );
        $defaultPageId = $defaultHomePage['id'] ?? ($pages[0]['id'] ?? null);

        $pageSlugMap = collect($pages)->mapWithKeys(fn (array $page) => [$page['id'] => $page['slug']])->all();
        $pageRouteModeMap = collect($pages)->mapWithKeys(fn (array $page) => [$page['id'] => ($page['route_mode'] ?? 'custom_url')])->all();
        $pageRouteKeyMap = collect($pages)->mapWithKeys(fn (array $page) => [$page['id'] => ($page['route_key'] ?? '')])->all();

        $supportsSectionConfigJson = $this->supportsSectionConfigJson();
        $sections = ETemplateSection::query()
            ->where('template_id', $template->id)
            ->orderBy('page_id')
            ->orderBy('order')
            ->get()
            ->map(function (ETemplateSection $section) use ($supportsSectionConfigJson) {
                $presetKey = trim((string) ($section->preset_key ?? ''));
                $catalogPreset = StorefrontCategorySectionCatalog::find($presetKey);
                $variant = trim((string) ($catalogPreset['section_type'] ?? $section->variant ?? StorefrontTemplateVariant::default()->value));
                $storedComponentKey = trim((string) ($section->component_key ?? ''));
                $componentKey = StorefrontSectionComponentRegistry::isValidForVariant($variant, $storedComponentKey)
                    ? $storedComponentKey
                    : trim((string) ($catalogPreset['component_key'] ?? $storedComponentKey));
                $editor = $this->normalizeSectionConfig(
                    $supportsSectionConfigJson ? $section->config_json : [],
                    $variant,
                    $catalogPreset['legacy_preset_key'] ?? $catalogPreset['preset_key'] ?? $presetKey,
                    $catalogPreset['category_name'] ?? null
                );
                if ($variant === 'custom') {
                    if (empty($editor['config']['content']['title'])) {
                        $editor['config']['content']['title'] = (string) ($section->title ?? '');
                    }
                    if (empty($editor['config']['content']['subtitle'])) {
                        $editor['config']['content']['subtitle'] = (string) ($section->subtitle ?? '');
                    }
                    if (empty($editor['config']['content']['html'])) {
                        $editor['config']['content']['html'] = (string) ($section->rich_text_html ?? '');
                    }
                }

                return [
                    'id' => $section->id,
                    'page_id' => $section->page_id,
                    'name' => $section->name ?? '',
                    'title' => $section->title ?? '',
                    'subtitle' => $section->subtitle ?? '',
                    'newsletter_title' => $section->newsletter_title ?? '',
                    'newsletter_text' => $section->newsletter_text ?? '',
                    'layout' => $section->layout,
                    'variant' => $variant,
                    'preset_key' => trim((string) ($catalogPreset['preset_key'] ?? $presetKey)),
                    'component_key' => StorefrontSectionComponentRegistry::normalize($variant, $componentKey),
                    'category_refs' => $section->category_refs ?? [],
                    'order' => (int) $section->order,
                    'query_sql' => $section->query_sql ?? '',
                    'query_json' => $section->query_json ?? '',
                    'query_config' => [],
                    'rich_text_html' => $section->rich_text_html ?? '',
                    'editor_schema' => $editor['schema'],
                    'config' => $editor['config'],
                ];
            })
            ->values()
            ->all();

        $actions = ETemplateAction::query()
            ->where('template_id', $template->id)
            ->orderBy('placement')
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get()
            ->map(fn (ETemplateAction $action) => [
                'id' => $action->id,
                'page_id' => $action->page_id,
                'section_id' => $action->section_id ?? '',
                'name' => $action->name ?? '',
                'slug' => $action->slug ?? '',
                'expression' => $action->expression ?? '',
                'link_type' => $action->link_type ?? 'custom_path',
                'route_key' => $action->route_key ?? '',
                'target_page_id' => $action->target_page_id ?? '',
                'target_page_slug' => !empty($action->target_page_id) ? ($pageSlugMap[$action->target_page_id] ?? '') : '',
                'target_page_route_mode' => !empty($action->target_page_id) ? ($pageRouteModeMap[$action->target_page_id] ?? 'custom_url') : 'custom_url',
                'target_page_route_key' => !empty($action->target_page_id) ? ($pageRouteKeyMap[$action->target_page_id] ?? '') : '',
                'label' => $action->label ?? '',
                'placement' => ($action->placement ?? 'header') === 'footer' ? 'footer' : 'header',
                'footer_group' => $action->footer_group ?? '',
                'sort_order' => (int) ($action->sort_order ?? 1),
            ])
            ->values()
            ->all();

        return [
            'version' => 1,
            'default_page_id' => $defaultPageId,
            'pages' => $pages,
            'sections' => $sections,
            'actions' => $actions,
            'settings' => $this->defaultBuilder()['settings'],
            'meta' => [
                'template_variants' => StorefrontTemplateVariant::options(),
                'section_presets' => $this->sectionPresets(),
                'category_preset_map' => $this->categoryPresetMap(),
                'component_options' => StorefrontSectionComponentRegistry::options(),
                'template_variants_by_category' => StorefrontTemplateVariant::optionsByCategory(),
                'section_presets_by_category' => StorefrontCategorySectionCatalog::groupedOptionsByCategory(),
                'section_schemas' => StorefrontSectionSchemaRegistry::all(),
                'component_options_by_category' => StorefrontSectionComponentRegistry::optionsByCategory(),
                'storefront_themes_by_category' => StorefrontCategoryThemeCatalog::themesByCategory(),
                'page_components_by_category' => StorefrontCategoryThemeCatalog::pageOptionsByCategory(),
            ],
        ];
    }

    private function normalizeActionLinkType(array $action): string
    {
        $linkType = trim((string) ($action['link_type'] ?? ''));
        $expression = trim((string) ($action['expression'] ?? ''));
        $targetPageId = trim((string) ($action['target_page_id'] ?? ''));

        if (in_array($linkType, self::ACTION_LINK_TYPES, true)) {
            return $linkType;
        }

        if ($targetPageId !== '') {
            return 'storefront_page';
        }

        if (Str::startsWith($expression, ['http://', 'https://'])) {
            return 'external_url';
        }

        return 'custom_path';
    }

    private function normalizePageRouteMode(array $page): string
    {
        $routeMode = trim((string) ($page['route_mode'] ?? ''));
        $routeKey = trim((string) ($page['route_key'] ?? ''));
        $slug = trim(strtolower((string) ($page['slug'] ?? '')));

        if (in_array($routeMode, self::PAGE_ROUTE_MODES, true)) {
            return $routeMode;
        }

        if ($routeKey !== '' && in_array($routeKey, self::PAGE_INTERNAL_ROUTE_OPTIONS, true)) {
            return 'internal_route';
        }

        if ($slug === 'home') {
            return 'internal_route';
        }

        if (in_array('/' . ltrim($slug, '/'), self::PAGE_INTERNAL_ROUTE_OPTIONS, true)) {
            return 'internal_route';
        }

        return 'custom_url';
    }

    private function inferInternalRouteKey(array $page): string
    {
        $routeKey = trim((string) ($page['route_key'] ?? ''));
        $slug = trim(strtolower((string) ($page['slug'] ?? '')));
        $name = trim(strtolower((string) ($page['name'] ?? '')));

        if ($routeKey !== '' && in_array($routeKey, self::PAGE_INTERNAL_ROUTE_OPTIONS, true)) {
            if ($routeKey !== '/' || $name === 'home' || $slug === 'home') {
                return $routeKey;
            }
        }

        $nameDerivedRoute = '/' . Str::slug($name);
        if ($name !== '' && in_array($nameDerivedRoute, self::PAGE_INTERNAL_ROUTE_OPTIONS, true)) {
            return $nameDerivedRoute;
        }

        $slugDerivedRoute = '/' . ltrim($slug, '/');
        if ($slug !== '' && in_array($slugDerivedRoute, self::PAGE_INTERNAL_ROUTE_OPTIONS, true)) {
            return $slugDerivedRoute;
        }

        if ($name === 'home' || $slug === 'home') {
            return '/';
        }

        return $routeKey;
    }

    private function normalizePageRecordRouteKey(string $routeMode, string $slug, string $name, string $routeKey): string
    {
        if ($routeMode !== 'internal_route') {
            return '';
        }

        $page = [
            'name' => $name,
            'slug' => $slug,
            'route_key' => $routeKey,
        ];
        $inferredRouteKey = $this->inferInternalRouteKey($page);

        if ($inferredRouteKey !== '' && in_array($inferredRouteKey, self::PAGE_INTERNAL_ROUTE_OPTIONS, true)) {
            return $inferredRouteKey;
        }

        if ($slug === 'home' || $name === 'home') {
            return '/';
        }

        $derivedRoute = '/' . ltrim($slug, '/');

        return in_array($derivedRoute, self::PAGE_INTERNAL_ROUTE_OPTIONS, true) ? $derivedRoute : '/';
    }

    private function normalizePageRouteKey(array $page, string $routeMode): string
    {
        if ($routeMode !== 'internal_route') {
            return '';
        }

        $inferredRouteKey = $this->inferInternalRouteKey($page);

        if ($inferredRouteKey !== '' && in_array($inferredRouteKey, self::PAGE_INTERNAL_ROUTE_OPTIONS, true)) {
            return $inferredRouteKey;
        }

        $slug = trim(strtolower((string) ($page['slug'] ?? '')));
        $derivedRoute = '/' . ltrim($slug, '/');

        return in_array($derivedRoute, self::PAGE_INTERNAL_ROUTE_OPTIONS, true) ? $derivedRoute : '/';
    }

    private function resolvePageSlugFromRoute(string $routeKey, string $fallbackSlug, int $index): string
    {
        $normalizedRoute = trim($routeKey);

        if ($normalizedRoute === '/') {
            return 'home';
        }

        $trimmed = trim($normalizedRoute, '/');
        if ($trimmed !== '') {
            return $this->normalizePageSlug($trimmed, $index);
        }

        return $fallbackSlug;
    }

    private function normalizePageSlug(string $value, int $index): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9_-]+/', '-', $slug) ?? '';
        $slug = preg_replace('/-+/', '-', $slug) ?? '';
        $slug = preg_replace('/_+/', '_', $slug) ?? '';
        $slug = trim($slug, "-_");

        return $slug !== '' ? $slug : ('page-' . ($index + 1));
    }

    private function normalizePresetKey(mixed $value): string
    {
        $presetKey = Str::slug(trim((string) $value));

        return $presetKey !== '' ? $presetKey : '';
    }

    private function normalizeCategoryRefs(mixed $value): array
    {
        $items = is_array($value) ? $value : [];
        $ids = collect($items)
            ->pluck('id')
            ->filter(fn ($item) => is_numeric($item))
            ->map(fn ($item) => (int) $item)
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

    private function normalizeSectionPresetRefs(array $sections): array
    {
        return collect($sections)
            ->filter(fn ($section) => is_array($section))
            ->map(function (array $section) {
                $presetKey = trim((string) ($section['preset_key'] ?? ''));

                if ($presetKey === '') {
                    return null;
                }

                $catalogPreset = StorefrontCategorySectionCatalog::find($presetKey);
                $definition = StorefrontSectionPreset::tryFromValue($presetKey);

                return [
                    'preset_key' => $catalogPreset['preset_key'] ?? $definition?->value ?? $presetKey,
                    'name' => $catalogPreset['name'] ?? $definition?->label() ?? trim((string) ($section['title'] ?? $section['name'] ?? $presetKey)),
                    'section_type' => $catalogPreset['section_type'] ?? $definition?->sectionType() ?? trim((string) ($section['variant'] ?? '')),
                    'component_key' => $catalogPreset['component_key'] ?? $definition?->componentKey() ?? trim((string) ($section['component_key'] ?? '')),
                ];
            })
            ->filter()
            ->unique('preset_key')
            ->values()
            ->all();
    }

    private function sectionPresets(): array
    {
        return collect(StorefrontSectionPreset::groupedOptions())
            ->map(function ($items) {
                return collect($items)
                    ->map(fn (array $preset) => [
                        'id' => $preset['preset_key'],
                        'name' => $preset['name'],
                        'label' => $preset['label'],
                        'preset_key' => $preset['preset_key'],
                        'section_type' => $preset['section_type'],
                        'component_key' => StorefrontSectionComponentRegistry::normalize($preset['section_type'], $preset['component_key']),
                        'categories' => [],
                        'preview_image_url' => null,
                    ])
                    ->values()
                    ->all();
            })
            ->all();
    }

    private function categoryPresetMap(): array
    {
        return StorefrontCategorySectionCatalog::categoryPresetMap();
    }

    private function templateCategory(ETemplate $template): string
    {
        $category = collect($template->categories ?? [])->first();

        if (is_array($category)) {
            return trim((string) ($category['key'] ?? $category['name'] ?? ''));
        }

        return trim((string) $category);
    }
}

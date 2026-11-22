<?php

namespace App\Services\Api;

use App\Enums\StorefrontTemplateVariant;
use App\Models\Company;
use App\Models\ETemplate;
use App\Models\StorefrontAction;
use App\Models\StorefrontPage;
use App\Models\StorefrontSection;
use App\Services\Backoffice\ETemplateBuilderService;
use App\Support\StorefrontCategorySectionCatalog;
use App\Support\StorefrontCategoryThemeCatalog;
use App\Support\StorefrontSectionSchemaRegistry;
use App\Support\StorefrontSectionComponentRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Str;

class StorefrontHomeBuilderService
{
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

    private function defaultBuilder(?ETemplate $template = null): array
    {
        return [
            'version' => 1,
            'default_page_id' => null,
            'pages' => [],
            'sections' => [],
            'actions' => [],
            'settings' => [
                'header_placeholder' => '#HEADER_LINKS#',
                'token_pattern_hint' => '#privacy_policy#',
                'load_actions_on_boot' => true,
                'theme' => $this->normalizeTheme([], $template),
            ],
            'meta' => [
                'template_variants' => StorefrontTemplateVariant::options(),
                'section_presets' => $this->sectionPresets($template),
                'category_preset_map' => StorefrontCategorySectionCatalog::categoryPresetMap(),
                'component_options' => StorefrontSectionComponentRegistry::options(),
                'template_variants_by_category' => StorefrontTemplateVariant::optionsByCategory(),
                'section_presets_by_category' => StorefrontCategorySectionCatalog::groupedOptionsByCategory(),
                'component_options_by_category' => StorefrontSectionComponentRegistry::optionsByCategory(),
                'storefront_themes_by_category' => StorefrontCategoryThemeCatalog::themesByCategory(),
                'page_components_by_category' => StorefrontCategoryThemeCatalog::pageOptionsByCategory(),
                'section_schemas' => StorefrontSectionSchemaRegistry::all(),
            ],
        ];
    }

    private function normalizeTheme(mixed $theme, ?ETemplate $template = null): array
    {
        $theme = is_array($theme) ? $theme : [];
        $templatePrimary = $this->normalizeHexColor($template?->primary_color, '#7F00FF');
        $templateSecondary = $this->normalizeHexColor($template?->secondary_color, '#F5F3FF');
        $templateFont = trim((string) ($template?->font_family ?: 'Inter'));
        $fontFamily = trim((string) ($theme['font_family'] ?? $templateFont));

        return [
            'primary_color' => $this->normalizeHexColor($theme['primary_color'] ?? null, $templatePrimary),
            'secondary_color' => $this->normalizeHexColor($theme['secondary_color'] ?? null, $templateSecondary),
            'font_family' => mb_substr($fontFamily !== '' ? $fontFamily : $templateFont, 0, 100),
        ];
    }

    private function normalizeHexColor(mixed $value, string $fallback): string
    {
        $color = strtoupper(trim((string) $value));

        return preg_match('/^#[0-9A-F]{6}$/', $color) === 1 ? $color : strtoupper($fallback);
    }

    private function builderSettings(mixed $settings, ?ETemplate $template = null): array
    {
        $settings = is_array($settings) ? $settings : [];
        $defaults = [
            'header_placeholder' => '#HEADER_LINKS#',
            'token_pattern_hint' => '#privacy_policy#',
            'load_actions_on_boot' => true,
        ];

        return [
            ...array_merge($defaults, $settings),
            'theme' => $this->normalizeTheme($settings['theme'] ?? [], $template),
        ];
    }

    private function hasBuilderContent(mixed $builder): bool
    {
        if (is_string($builder)) {
            $decoded = json_decode($builder, true);
            $builder = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (! is_array($builder)) {
            return false;
        }

        return ! empty($builder['pages'] ?? [])
            || ! empty($builder['sections'] ?? [])
            || ! empty($builder['actions'] ?? []);
    }

    private function selectedTemplateBuilder(?ETemplate $template): ?array
    {
        if (! $template) {
            return null;
        }

        return app(ETemplateBuilderService::class)->getBuilder($template);
    }

    private function allowedSectionPresetKeys(?ETemplate $template): array
    {
        if (! $template) {
            return [];
        }

        $refs = collect($template->section_preset_refs ?? [])
            ->pluck('preset_key')
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (! empty($refs)) {
            return $refs;
        }

        $builder = $this->selectedTemplateBuilder($template);

        return collect($builder['sections'] ?? [])
            ->pluck('preset_key')
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function sectionPresets(?ETemplate $template = null): array
    {
        $allowedKeys = $this->allowedSectionPresetKeys($template);

        // A company's builder may only use presets explicitly saved on the
        // purchased template. An empty template must expose no preset entries;
        // custom sections remain available through the builder UI.
        if ($template && empty($allowedKeys)) {
            return [];
        }

        $allowedLookup = ! empty($allowedKeys)
            ? array_fill_keys($allowedKeys, true)
            : [];

        return collect(StorefrontCategorySectionCatalog::definitions())
            ->when(! empty($allowedLookup), function ($items) use ($allowedLookup) {
                return $items->filter(fn (array $preset) =>
                    isset($allowedLookup[$preset['preset_key']])
                    || isset($allowedLookup[$preset['legacy_preset_key']])
                );
            })
            ->groupBy('section_type')
            ->map(fn ($items) => $items->values()->all())
            ->all();
    }

    private function resolveCompany(): Company
    {
        $user = auth()->user();

        if (!$user || !$user->company_id) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'No company associated with the current user.',
            ], 404));
        }

        $company = Company::query()
            ->with(['selectedETemplate', 'ecommerceCategory'])
            ->find($user->company_id);

        if (!$company) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404));
        }

        return $company;
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

    private function resolveActionTargetPageId(array $action, array $pageSlugMap, array $pageRouteKeyMap): string
    {
        $targetPageId = trim((string) ($action['target_page_id'] ?? ''));
        if ($targetPageId !== '') {
            return $targetPageId;
        }

        $linkType = $this->normalizeActionLinkType($action);
        if ($linkType !== 'internal_route' && $linkType !== 'storefront_page') {
            return '';
        }

        $routeKey = trim((string) ($action['route_key'] ?? ''));
        $expression = trim((string) ($action['expression'] ?? ''));
        $targetPageSlug = trim((string) ($action['target_page_slug'] ?? ''));

        $candidates = array_values(array_filter([
            $routeKey,
            $expression,
            $targetPageSlug !== '' ? '/' . ltrim($targetPageSlug, '/') : '',
            $targetPageSlug,
        ]));

        foreach ($candidates as $candidate) {
            if (isset($pageRouteKeyMap[$candidate])) {
                return (string) $pageRouteKeyMap[$candidate];
            }
        }

        $normalizedSlug = trim((string) Str::of($targetPageSlug ?: $routeKey ?: $expression)->trim()->lower()->replaceMatches('/^\\/+/', ''));
        if ($normalizedSlug !== '' && isset($pageSlugMap[$normalizedSlug])) {
            return (string) $pageSlugMap[$normalizedSlug];
        }

        if ($routeKey === '/' || $expression === '/' || $targetPageSlug === 'home') {
            return (string) ($pageRouteKeyMap['/'] ?? '');
        }

        return '';
    }

    private function supportsStructuredActionLinks(): bool
    {
        return Schema::hasColumns('storefront_actions', ['link_type', 'route_key']);
    }

    private function supportsStorefrontPageSlugs(): bool
    {
        return Schema::hasColumn('storefront_pages', 'slug');
    }

    private function supportsStorefrontPageRouteFields(): bool
    {
        return Schema::hasColumns('storefront_pages', ['route_mode', 'route_key']);
    }

    private function supportsStorefrontPageComponentKey(): bool
    {
        return Schema::hasColumn('storefront_pages', 'component_key');
    }

    private function supportsActionTargetPages(): bool
    {
        return Schema::hasColumn('storefront_actions', 'target_page_id');
    }

    private function supportsActionFooterGroups(): bool
    {
        return Schema::hasColumn('storefront_actions', 'footer_group');
    }

    private function supportsStorefrontSectionPresetKey(): bool
    {
        return Schema::hasColumn('storefront_sections', 'preset_key');
    }

    private function supportsStorefrontSectionComponentKey(): bool
    {
        return Schema::hasColumn('storefront_sections', 'component_key');
    }

    private function supportsStorefrontSectionNewsletterFields(): bool
    {
        return Schema::hasColumns('storefront_sections', ['newsletter_title', 'newsletter_text']);
    }

    private function supportsStorefrontSectionConfigJson(): bool
    {
        return Schema::hasColumn('storefront_sections', 'config_json');
    }

    private function supportsActionSortOrder(): bool
    {
        return Schema::hasColumn('storefront_actions', 'sort_order');
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
            return Str::slug($trimmed) ?: ('page-' . ($index + 1));
        }

        return $fallbackSlug;
    }

    private function sectionEditorData(array $section, string $variant, string $presetKey, ?array $presetSchema = null): array
    {
        $schema = $presetSchema ?: StorefrontSectionSchemaRegistry::for($variant, $presetKey);
        $config = $section['config'] ?? $section['config_json'] ?? null;

        // Older saves encoded config before the model cast, producing a
        // JSON string inside JSON. Decode both legacy layers safely.
        for ($attempt = 0; $attempt < 2 && is_string($config); $attempt++) {
            $decoded = json_decode($config, true);
            $config = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        // Preserve the legacy demand-tag JSON while sections migrate to config_json.
        if (! is_array($config) || empty($config)) {
            $legacy = $section['query_json'] ?? '';
            if (is_string($legacy) && trim($legacy) !== '') {
                $decodedLegacy = json_decode($legacy, true);
                if (is_array($decodedLegacy)) {
                    $config = [
                        'content' => [],
                        'data' => [
                            'filters' => array_filter([
                                'demand_tag' => $decodedLegacy['demand_tag'] ?? null,
                            ], fn ($value) => $value !== null && $value !== ''),
                        ],
                    ];
                }
            }
        }

        $config = is_array($config) ? $config : [];
        $normalized = StorefrontSectionSchemaRegistry::normalize($config, $schema);

        return [
            'schema' => $schema,
            'config' => [
                'schema_version' => (int) ($config['schema_version'] ?? $schema['version'] ?? 1),
                ...$normalized,
            ],
        ];
    }

    private function normalizeBuilder(mixed $builder, ?string $companyId = null, ?ETemplate $template = null): array
    {
        if (is_string($builder)) {
            $decoded = json_decode($builder, true);
            $builder = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (!is_array($builder)) {
            return $this->defaultBuilder($template);
        }

        $pages = is_array($builder['pages'] ?? null) ? $builder['pages'] : [];
        $sections = is_array($builder['sections'] ?? null) ? $builder['sections'] : [];
        $actions = is_array($builder['actions'] ?? null) ? $builder['actions'] : [];
        $settings = is_array($builder['settings'] ?? null) ? $builder['settings'] : [];
        $supportsActionFooterGroups = $this->supportsActionFooterGroups();

        $templateCategory = $this->templateCategory($template);
        $normalizedPages = array_values(array_map(function (array $page, int $index) use ($templateCategory) {
            $name = trim((string) ($page['name'] ?? 'Untitled Page'));
            $slug = trim((string) ($page['slug'] ?? ''));
            $resolvedSlug = $slug !== '' ? Str::slug($slug) : (Str::slug($name) ?: ('page-' . ($index + 1)));
            $routeMode = $this->normalizePageRouteMode($page);
            $routeKey = $this->normalizePageRouteKey($page, $routeMode);
            $resolvedSlug = $routeMode === 'internal_route'
                ? $this->resolvePageSlugFromRoute($routeKey, $resolvedSlug, $index)
                : $resolvedSlug;

            return [
                'id' => (string) ($page['id'] ?? ('page-' . ($index + 1) . '-' . Str::uuid())),
                'name' => $name,
                'slug' => $resolvedSlug,
                'route_mode' => $routeMode,
                'route_key' => $routeKey,
                'component_key' => StorefrontCategoryThemeCatalog::resolvePageComponent(
                    $templateCategory,
                    $routeMode === 'internal_route' ? $routeKey : $resolvedSlug,
                    $page['component_key'] ?? ''
                ),
                'description' => trim((string) ($page['description'] ?? '')),
                'menu_token' => trim((string) ($page['menu_token'] ?? '')),
            ];
        }, array_filter($pages, 'is_array'), array_keys(array_filter($pages, 'is_array'))));

        $pageIds = collect($normalizedPages)->pluck('id')->all();
        $requestedDefaultPageId = (string) ($builder['default_page_id'] ?? '');
        $defaultPageId = in_array($requestedDefaultPageId, $pageIds, true)
            ? $requestedDefaultPageId
            : ($pageIds[0] ?? null);
        $pageSlugMap = collect($normalizedPages)
            ->mapWithKeys(fn (array $page) => [$page['id'] => $page['slug']])
            ->all();
        $fallbackPageId = $pageIds[0] ?? null;

        $normalizedSections = array_values(array_filter(array_map(function (array $section, int $index) use ($pageIds, $fallbackPageId) {
            $pageId = (string) ($section['page_id'] ?? $fallbackPageId);
            if ($pageId !== '' && !in_array($pageId, $pageIds, true)) {
                $pageId = $fallbackPageId;
            }

            if (!$pageId) {
                return null;
            }

            $presetKey = trim((string) ($section['preset_key'] ?? ''));
            $catalogPreset = StorefrontCategorySectionCatalog::find($presetKey);
            $variant = trim((string) ($catalogPreset['section_type'] ?? $section['variant'] ?? StorefrontTemplateVariant::default()->value));
            if (!in_array($variant, StorefrontTemplateVariant::values(), true)) {
                $variant = StorefrontTemplateVariant::default()->value;
            }

            $requestedComponentKey = trim((string) ($section['component_key'] ?? ''));
            $componentKey = StorefrontSectionComponentRegistry::isValidForVariant($variant, $requestedComponentKey)
                ? $requestedComponentKey
                : trim((string) ($catalogPreset['component_key'] ?? $requestedComponentKey));
            $editor = $this->sectionEditorData(
                $section,
                $variant,
                $catalogPreset['preset_key'] ?? $presetKey,
                $catalogPreset['config_schema'] ?? null
            );

            return [
                'id' => (string) ($section['id'] ?? ('section-' . ($index + 1) . '-' . Str::uuid())),
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
                'order' => (int) ($section['order'] ?? ($index + 1)),
                'query_sql' => trim((string) ($section['query_sql'] ?? '')),
                'query_json' => trim((string) ($section['query_json'] ?? '')),
                'rich_text_html' => (string) ($section['rich_text_html'] ?? ''),
                'query_config' => is_array($section['query_config'] ?? null) ? $section['query_config'] : [],
                'config' => $editor['config'],
                'editor_schema' => $editor['schema'],
            ];
        }, array_filter($sections, 'is_array'), array_keys(array_filter($sections, 'is_array')))));

        $sectionIds = collect($normalizedSections)->pluck('id')->all();

        $normalizedActions = array_values(array_filter(array_map(function (array $action, int $index) use ($pageIds, $pageSlugMap, $sectionIds, $fallbackPageId, $supportsActionFooterGroups) {
            $pageId = (string) ($action['page_id'] ?? $fallbackPageId);
            if ($pageId !== '' && !in_array($pageId, $pageIds, true)) {
                $pageId = $fallbackPageId;
            }

            if (!$pageId) {
                return null;
            }

            $sectionId = trim((string) ($action['section_id'] ?? ''));
            if ($sectionId !== '' && !in_array($sectionId, $sectionIds, true)) {
                $sectionId = '';
            }

            $targetPageId = trim((string) ($action['target_page_id'] ?? ''));
            if ($targetPageId !== '' && !in_array($targetPageId, $pageIds, true)) {
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

            return [
                'id' => (string) ($action['id'] ?? ('action-' . ($index + 1) . '-' . Str::uuid())),
                'page_id' => $pageId,
                'section_id' => $sectionId,
                'name' => trim((string) ($action['name'] ?? '')),
                'slug' => trim((string) ($action['slug'] ?? '')),
                'expression' => $expression,
                'link_type' => $linkType,
                'route_key' => $routeKey,
                'target_page_id' => $targetPageId,
                'target_page_slug' => $targetPageId !== '' ? ($pageSlugMap[$targetPageId] ?? '') : '',
                'label' => trim((string) ($action['label'] ?? '')),
                'placement' => trim((string) ($action['placement'] ?? 'contextual')),
                'footer_group' => $supportsActionFooterGroups
                    ? trim((string) ($action['footer_group'] ?? ''))
                    : '',
                'sort_order' => max(1, (int) ($action['sort_order'] ?? ($index + 1))),
            ];
        }, array_filter($actions, 'is_array'), array_keys(array_filter($actions, 'is_array')))));

        return [
            'version' => 1,
            'default_page_id' => $defaultPageId,
            'pages' => $normalizedPages,
            'sections' => $normalizedSections,
            'actions' => $normalizedActions,
            'settings' => $this->builderSettings($settings, $template),
            'meta' => [
                'template_variants' => StorefrontTemplateVariant::options(),
                'section_presets' => $this->sectionPresets($template),
                'category_preset_map' => StorefrontCategorySectionCatalog::categoryPresetMap(),
                'component_options' => StorefrontSectionComponentRegistry::options(),
                'template_variants_by_category' => StorefrontTemplateVariant::optionsByCategory(),
                'section_presets_by_category' => StorefrontCategorySectionCatalog::groupedOptionsByCategory(),
                'component_options_by_category' => StorefrontSectionComponentRegistry::optionsByCategory(),
                'storefront_themes_by_category' => StorefrontCategoryThemeCatalog::themesByCategory(),
                'page_components_by_category' => StorefrontCategoryThemeCatalog::pageOptionsByCategory(),
                'section_schemas' => StorefrontSectionSchemaRegistry::all(),
            ],
        ];
    }

    private function buildResponseFromRecords(Company $company, ?ETemplate $template = null): array
    {
        $supportsStructuredActionLinks = $this->supportsStructuredActionLinks();
        $supportsStorefrontPageSlugs = $this->supportsStorefrontPageSlugs();
        $supportsActionTargetPages = $this->supportsActionTargetPages();
        $supportsActionFooterGroups = $this->supportsActionFooterGroups();
        $supportsStorefrontPageRouteFields = $this->supportsStorefrontPageRouteFields();
        $supportsStorefrontPageComponentKey = $this->supportsStorefrontPageComponentKey();
        $supportsStorefrontSectionPresetKey = $this->supportsStorefrontSectionPresetKey();
        $supportsStorefrontSectionComponentKey = $this->supportsStorefrontSectionComponentKey();
        $supportsStorefrontSectionNewsletterFields = $this->supportsStorefrontSectionNewsletterFields();
        $supportsStorefrontSectionConfigJson = $this->supportsStorefrontSectionConfigJson();
        $supportsActionSortOrder = $this->supportsActionSortOrder();

        $pages = StorefrontPage::query()
            ->where('company_id', $company->company_id)
            ->orderBy('created_at')
            ->get()
            ->map(function (StorefrontPage $page) use ($supportsStorefrontPageSlugs, $supportsStorefrontPageRouteFields, $supportsStorefrontPageComponentKey) {
                $slug = $supportsStorefrontPageSlugs ? ($page->slug ?: Str::slug((string) $page->name)) : (Str::slug((string) $page->name) ?: 'page');
                $routeMode = $supportsStorefrontPageRouteFields ? ($page->route_mode ?? 'custom_url') : 'custom_url';
                $routeKey = $supportsStorefrontPageRouteFields ? $this->inferInternalRouteKey([
                    'name' => $page->name,
                    'slug' => $slug,
                    'route_key' => $page->route_key ?? '',
                ]) : '';

                if ($routeMode === 'internal_route' && $routeKey === '' && $slug === 'home') {
                    $routeKey = '/';
                }

                return [
                    'id' => $page->id,
                    'name' => $page->name,
                    'slug' => $slug,
                    'route_mode' => $routeMode,
                    'route_key' => $routeKey,
                    'component_key' => $supportsStorefrontPageComponentKey ? ($page->component_key ?? '') : '',
                    'description' => $page->description,
                    'menu_token' => $page->menu_token,
                ];
            })
            ->values()
            ->all();

        $pageSlugMap = collect($pages)
            ->mapWithKeys(fn (array $page) => [$page['id'] => $page['slug']])
            ->all();
        $pageRouteModeMap = collect($pages)
            ->mapWithKeys(fn (array $page) => [$page['id'] => ($page['route_mode'] ?? 'custom_url')])
            ->all();
        $pageRouteKeyMap = collect($pages)
            ->mapWithKeys(fn (array $page) => [$page['id'] => ($page['route_key'] ?? '')])
            ->all();
        $pageIdBySlugMap = collect($pages)
            ->mapWithKeys(fn (array $page) => [trim((string) ($page['slug'] ?? '')) => $page['id']])
            ->filter(fn ($pageId, $slug) => $slug !== '')
            ->all();
        $pageIdByRouteKeyMap = collect($pages)
            ->mapWithKeys(fn (array $page) => [trim((string) ($page['route_key'] ?? '')) => $page['id']])
            ->filter(fn ($pageId, $routeKey) => $routeKey !== '')
            ->all();

        $sections = StorefrontSection::query()
            ->where('company_id', $company->company_id)
            ->orderBy('page_id')
            ->orderBy('order')
            ->get()
            ->map(function (StorefrontSection $section) use ($supportsStorefrontSectionPresetKey, $supportsStorefrontSectionComponentKey, $supportsStorefrontSectionNewsletterFields, $supportsStorefrontSectionConfigJson) {
                $presetKey = $supportsStorefrontSectionPresetKey ? trim((string) ($section->preset_key ?? '')) : '';
                $catalogPreset = StorefrontCategorySectionCatalog::find($presetKey);
                $variant = trim((string) ($catalogPreset['section_type'] ?? $section->variant ?? StorefrontTemplateVariant::default()->value));
                $storedComponentKey = $supportsStorefrontSectionComponentKey ? trim((string) ($section->component_key ?? '')) : '';
                $componentKey = StorefrontSectionComponentRegistry::isValidForVariant($variant, $storedComponentKey)
                    ? $storedComponentKey
                    : trim((string) ($catalogPreset['component_key'] ?? $storedComponentKey));
                $editor = $this->sectionEditorData([
                    'config' => $supportsStorefrontSectionConfigJson ? $section->config_json : null,
                    'query_json' => $section->query_json,
                ], $variant, $catalogPreset['preset_key'] ?? $presetKey, $catalogPreset['config_schema'] ?? null);

                return [
                    'id' => $section->id,
                    'page_id' => $section->page_id,
                    'name' => $section->name,
                    'title' => $section->title,
                    'subtitle' => $section->subtitle,
                    'newsletter_title' => $supportsStorefrontSectionNewsletterFields ? ($section->newsletter_title ?? '') : '',
                    'newsletter_text' => $supportsStorefrontSectionNewsletterFields ? ($section->newsletter_text ?? '') : '',
                    'layout' => $section->layout,
                    'variant' => $variant,
                    'preset_key' => trim((string) ($catalogPreset['preset_key'] ?? $presetKey)),
                    'component_key' => StorefrontSectionComponentRegistry::normalize($variant, $componentKey),
                    'order' => (int) $section->order,
                    'query_sql' => $section->query_sql ?? '',
                    'query_json' => $section->query_json ?? '',
                    'rich_text_html' => $section->rich_text_html ?? '',
                    'query_config' => [],
                    'config' => $editor['config'],
                    'editor_schema' => $editor['schema'],
                ];
            })
            ->values()
            ->all();

        $actions = StorefrontAction::query()
            ->where('company_id', $company->company_id)
            ->orderBy('placement')
            ->when($supportsActionSortOrder, fn ($query) => $query->orderBy('sort_order'))
            ->orderBy('created_at')
            ->get()
            ->map(function (StorefrontAction $action) use (
                $supportsStructuredActionLinks,
                $supportsActionTargetPages,
                $supportsActionFooterGroups,
                $supportsActionSortOrder,
                $pageSlugMap,
                $pageRouteModeMap,
                $pageRouteKeyMap,
                $pageIdBySlugMap,
                $pageIdByRouteKeyMap
            ) {
                $linkType = $supportsStructuredActionLinks
                    ? ($action->link_type ?? 'custom_path')
                    : $this->normalizeActionLinkType(['expression' => $action->expression ?? '']);

                $targetPageId = $supportsActionTargetPages
                    ? $this->resolveActionTargetPageId(
                        [
                            'target_page_id' => $action->target_page_id ?? '',
                            'link_type' => $linkType,
                            'route_key' => $supportsStructuredActionLinks ? ($action->route_key ?? '') : '',
                            'expression' => $action->expression ?? '',
                            'target_page_slug' => '',
                        ],
                        $pageIdBySlugMap,
                        $pageIdByRouteKeyMap,
                    )
                    : '';

                return [
                    'id' => $action->id,
                    'page_id' => $action->page_id,
                    'section_id' => $action->section_id ?? '',
                    'name' => $action->name,
                    'slug' => $action->slug,
                    'expression' => $action->expression ?? '',
                    'link_type' => $linkType,
                    'route_key' => $supportsStructuredActionLinks
                        ? ($action->route_key ?? '')
                        : '',
                    'target_page_id' => $targetPageId,
                    'target_page_slug' => $targetPageId !== ''
                        ? ($pageSlugMap[$targetPageId] ?? '')
                        : '',
                    'target_page_route_mode' => $targetPageId !== ''
                        ? ($pageRouteModeMap[$targetPageId] ?? 'custom_url')
                        : 'custom_url',
                    'target_page_route_key' => $targetPageId !== ''
                        ? ($pageRouteKeyMap[$targetPageId] ?? '')
                        : '',
                    'label' => $action->label ?? '',
                    'placement' => $action->placement ?? 'contextual',
                    'footer_group' => $supportsActionFooterGroups ? ($action->footer_group ?? '') : '',
                    'sort_order' => $supportsActionSortOrder ? (int) ($action->sort_order ?? 1) : 1,
                ];
            })
            ->values()
            ->all();

        return [
            'version' => 1,
            'default_page_id' => $pages[0]['id'] ?? null,
            'pages' => $pages,
            'sections' => $sections,
            'actions' => $actions,
            'settings' => $this->builderSettings(
                data_get($company->storefront_homepage_builder, 'settings', []),
                $template
            ),
            'meta' => [
                'template_variants' => StorefrontTemplateVariant::options(),
                'section_presets' => $this->sectionPresets($template),
                'component_options' => StorefrontSectionComponentRegistry::options(),
                'template_variants_by_category' => StorefrontTemplateVariant::optionsByCategory(),
                'section_presets_by_category' => StorefrontCategorySectionCatalog::groupedOptionsByCategory(),
                'component_options_by_category' => StorefrontSectionComponentRegistry::optionsByCategory(),
                'storefront_themes_by_category' => StorefrontCategoryThemeCatalog::themesByCategory(),
                'page_components_by_category' => StorefrontCategoryThemeCatalog::pageOptionsByCategory(),
                'section_schemas' => StorefrontSectionSchemaRegistry::all(),
            ],
        ];
    }

    private function transformTemplateBuilderForCompany(array $templateBuilder, string $companyId, ?ETemplate $template = null): array
    {
        $pageIdMap = [];
        $sectionIdMap = [];

        $pages = collect($templateBuilder['pages'] ?? [])->map(function (array $page, int $index) use (&$pageIdMap, $companyId) {
            $newId = $this->makeStorefrontBuilderId('page', $companyId, $index + 1);
            $pageIdMap[(string) ($page['id'] ?? '')] = $newId;

            return [
                ...$page,
                'id' => $newId,
            ];
        })->values()->all();

        $templateDefaultPageId = (string) ($templateBuilder['default_page_id'] ?? '');
        $defaultPageId = $templateDefaultPageId !== '' && isset($pageIdMap[$templateDefaultPageId])
            ? $pageIdMap[$templateDefaultPageId]
            : ($pages[0]['id'] ?? '');

        $sections = collect($templateBuilder['sections'] ?? [])->map(function (array $section, int $index) use (&$sectionIdMap, $pageIdMap, $companyId, $defaultPageId) {
            $newId = $this->makeStorefrontBuilderId('section', $companyId, $index + 1);
            $oldPageId = (string) ($section['page_id'] ?? '');
            $sectionIdMap[(string) ($section['id'] ?? '')] = $newId;

            return [
                ...$section,
                'id' => $newId,
                'page_id' => $oldPageId !== '' ? ($pageIdMap[$oldPageId] ?? '') : $defaultPageId,
            ];
        })->filter(fn (array $section) => $section['page_id'] !== '')->values()->all();

        $actions = collect($templateBuilder['actions'] ?? [])->map(function (array $action, int $index) use ($pageIdMap, $sectionIdMap, $companyId, $defaultPageId) {
            $oldPageId = (string) ($action['page_id'] ?? '');
            $oldSectionId = (string) ($action['section_id'] ?? '');
            $oldTargetPageId = (string) ($action['target_page_id'] ?? '');

            return [
                ...$action,
                'id' => $this->makeStorefrontBuilderId('action', $companyId, $index + 1),
                'page_id' => $oldPageId !== '' ? ($pageIdMap[$oldPageId] ?? '') : $defaultPageId,
                'section_id' => $oldSectionId !== '' ? ($sectionIdMap[$oldSectionId] ?? '') : '',
                'target_page_id' => $oldTargetPageId !== '' ? ($pageIdMap[$oldTargetPageId] ?? '') : '',
            ];
        })->filter(fn (array $action) => $action['page_id'] !== '')->values()->all();

        $meta = $this->filterTemplateMetaForCompany($templateBuilder['meta'] ?? [], $templateBuilder['sections'] ?? []);

        return [
            'version' => 1,
            'default_page_id' => $defaultPageId,
            'pages' => $pages,
            'sections' => $sections,
            'actions' => $actions,
            'settings' => $this->builderSettings($templateBuilder['settings'] ?? [], $template),
            'meta' => $meta,
        ];
    }

    private function filterTemplateMetaForCompany(array $meta, array $sections): array
    {
        $allowedKeys = collect($sections)
            ->filter(fn ($section) => is_array($section))
            ->pluck('preset_key')
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($allowedKeys)) {
			$meta['section_presets'] = [];
			$meta['category_preset_map'] = [];

			return $meta;
        }

        $allowedLookup = array_fill_keys(
            StorefrontCategorySectionCatalog::expandPresetKeys($allowedKeys),
            true
        );

        if (isset($meta['section_presets']) && is_array($meta['section_presets'])) {
            $meta['section_presets'] = collect($meta['section_presets'])
                ->map(function ($group) use ($allowedLookup) {
                    if (! is_array($group)) {
                        return [];
                    }

                    return collect($group)
                        ->filter(fn ($preset) => is_array($preset) && isset($allowedLookup[$preset['preset_key'] ?? '']))
                        ->values()
                        ->all();
                })
                ->filter(fn ($group) => ! empty($group))
                ->all();
        }

        if (isset($meta['category_preset_map']) && is_array($meta['category_preset_map'])) {
            $meta['category_preset_map'] = collect($meta['category_preset_map'])
                ->map(function ($groupMap) use ($allowedLookup) {
                    if (! is_array($groupMap)) {
                        return [];
                    }

                    return collect($groupMap)
                        ->map(function ($presetKeys) use ($allowedLookup) {
                            if (! is_array($presetKeys)) {
                                return [];
                            }

                            return array_values(array_filter(
                                array_map(fn ($presetKey) => (string) $presetKey, $presetKeys),
                                fn ($presetKey) => isset($allowedLookup[$presetKey])
                            ));
                        })
                        ->filter(fn ($presetKeys) => ! empty($presetKeys))
                        ->all();
                })
                ->filter(fn ($groupMap) => ! empty($groupMap))
                ->all();
        }

        return $meta;
    }

    private function makeStorefrontBuilderId(string $prefix, string $companyId, int $index): string
    {
        $compactPrefix = match ($prefix) {
            'page' => 'pg',
            'section' => 'sec',
            'action' => 'act',
            default => Str::slug($prefix),
        };

        $hash = substr(sha1($companyId . '|' . $prefix . '|' . $index . '|' . (string) Str::uuid()), 0, 24);

        return $compactPrefix . '-' . $index . '-' . $hash;
    }

    public function getResponse(): array
    {
        $company = $this->resolveCompany();
        $selectedTemplate = $company->selectedETemplate;
        $hasStructuredData =
            StorefrontPage::query()->where('company_id', $company->company_id)->exists() ||
            StorefrontSection::query()->where('company_id', $company->company_id)->exists() ||
            StorefrontAction::query()->where('company_id', $company->company_id)->exists();
        $savedBuilder = $company->storefront_homepage_builder;
        $hasSavedBuilder = is_array($savedBuilder)
            && (array_key_exists('pages', $savedBuilder) || array_key_exists('settings', $savedBuilder));

        $companyBuilder = $this->normalizeBuilder($company->storefront_homepage_builder, $company->company_id, $selectedTemplate);
        $templateBuilder = $this->selectedTemplateBuilder($selectedTemplate);
        $materializedTemplateBuilder = ($selectedTemplate && $templateBuilder && $this->hasBuilderContent($templateBuilder))
            ? $this->transformTemplateBuilderForCompany($templateBuilder, $company->company_id, $selectedTemplate)
            : null;
        $savedCompanySettings = data_get($company->storefront_homepage_builder, 'settings');

        if ($materializedTemplateBuilder && is_array($savedCompanySettings)) {
            $materializedTemplateBuilder['settings'] = $this->builderSettings(
                array_merge($materializedTemplateBuilder['settings'] ?? [], $savedCompanySettings),
                $selectedTemplate
            );
        }

        if (
            ! $hasStructuredData
            && ! $hasSavedBuilder
            && $selectedTemplate
            && $templateBuilder
            && $this->hasBuilderContent($templateBuilder)
        ) {
            $materialized = $this->updateResponse(
                $materializedTemplateBuilder
            );
            $materializedData = $materialized['data'] ?? null;
            $materializedHasContent = $this->hasBuilderContent($materializedData);

            return [
                'status' => 1,
                'message' => 'Storefront home builder loaded successfully.',
                'data' => $materializedHasContent
                    ? $materializedData
                    : ($materializedTemplateBuilder ?: $this->buildResponseFromRecords($company->fresh(['selectedETemplate']), $selectedTemplate)),
                'template' => [
                    'id' => $selectedTemplate->id,
                    'template_name' => $selectedTemplate->template_name,
                    'image_url' => $selectedTemplate->image_url,
                    'primary_color' => $selectedTemplate->primary_color,
                    'secondary_color' => $selectedTemplate->secondary_color,
                    'font_family' => $selectedTemplate->font_family,
                    'section_preset_refs' => $selectedTemplate->section_preset_refs ?? [],
                    'selected_category' => $company->ecommerceCategory ? [
                        'id' => $company->ecommerceCategory->id,
                        'name' => $company->ecommerceCategory->name,
                    ] : null,
                ],
                'selected_category' => $company->ecommerceCategory ? [
                    'id' => $company->ecommerceCategory->id,
                    'name' => $company->ecommerceCategory->name,
                ] : null,
                'builder_source' => 'selected_template_materialized',
            ];
        }

        // Once the company has saved any builder records, those records are
        // authoritative. Do not fall back to the purchased template on the
        // next request, otherwise removed sections reappear after reload.
        $builder = $hasStructuredData
            ? $this->buildResponseFromRecords($company, $selectedTemplate)
            : ($hasSavedBuilder
                ? $companyBuilder
                : ($selectedTemplate
                    ? ($materializedTemplateBuilder ?? $templateBuilder ?? $companyBuilder)
                    : $companyBuilder));

        if (! $hasSavedBuilder && ! $this->hasBuilderContent($builder) && $materializedTemplateBuilder) {
            $builder = $materializedTemplateBuilder;
        }

        return [
            'status' => 1,
            'message' => 'Storefront home builder loaded successfully.',
            'data' => $builder,
            'template' => $selectedTemplate ? [
                'id' => $selectedTemplate->id,
                'template_name' => $selectedTemplate->template_name,
                'image_url' => $selectedTemplate->image_url,
                'primary_color' => $selectedTemplate->primary_color,
                'secondary_color' => $selectedTemplate->secondary_color,
                'font_family' => $selectedTemplate->font_family,
                'section_preset_refs' => $selectedTemplate->section_preset_refs ?? [],
                'selected_category' => $company->ecommerceCategory ? [
                    'id' => $company->ecommerceCategory->id,
                    'name' => $company->ecommerceCategory->name,
                ] : null,
            ] : null,
            'selected_category' => $company->ecommerceCategory ? [
                'id' => $company->ecommerceCategory->id,
                'name' => $company->ecommerceCategory->name,
            ] : null,
            'builder_source' => $hasStructuredData
                ? 'company_records'
                : ($hasSavedBuilder
                    ? 'company_builder'
                    : ($selectedTemplate
                        ? 'selected_template_materialized'
                        : ($this->hasBuilderContent($companyBuilder) ? 'company_builder' : 'empty'))),
        ];
    }

    public function updateResponse(array $builder, bool $includeData = true): array
    {
        return $this->updateResponseForCompany($builder, $this->resolveCompany(), $includeData);
    }

    public function materializeSelectedTemplateForCompany(Company $company): array
    {
        $company = $company->fresh(['selectedETemplate']);
        $selectedTemplate = $company?->selectedETemplate;
        $templateBuilder = $this->selectedTemplateBuilder($selectedTemplate);

        if (! $company || ! $selectedTemplate || ! $templateBuilder || ! $this->hasBuilderContent($templateBuilder)) {
            throw new \RuntimeException('The selected template does not contain storefront builder content.');
        }

        return $this->updateResponseForCompany(
            $this->transformTemplateBuilderForCompany($templateBuilder, $company->company_id, $selectedTemplate),
            $company
        );
    }

    private function updateResponseForCompany(array $builder, Company $company, bool $includeData = true): array
    {
        $selectedTemplate = $company->selectedETemplate;
        $normalizedBuilder = $this->normalizeBuilder($builder, $company->company_id, $selectedTemplate);
        $supportsStructuredActionLinks = $this->supportsStructuredActionLinks();
        $supportsStorefrontPageSlugs = $this->supportsStorefrontPageSlugs();
        $supportsActionTargetPages = $this->supportsActionTargetPages();
        $supportsActionFooterGroups = $this->supportsActionFooterGroups();
        $supportsStorefrontPageRouteFields = $this->supportsStorefrontPageRouteFields();
        $supportsStorefrontPageComponentKey = $this->supportsStorefrontPageComponentKey();
        $supportsStorefrontSectionPresetKey = $this->supportsStorefrontSectionPresetKey();
        $supportsStorefrontSectionComponentKey = $this->supportsStorefrontSectionComponentKey();
        $supportsStorefrontSectionNewsletterFields = $this->supportsStorefrontSectionNewsletterFields();
        $supportsStorefrontSectionConfigJson = $this->supportsStorefrontSectionConfigJson();
        $supportsActionSortOrder = $this->supportsActionSortOrder();
        $pageIdBySlugMap = collect($normalizedBuilder['pages'])->mapWithKeys(function (array $page) {
            $slug = trim((string) ($page['slug'] ?? ''));

            return $slug !== '' ? [$slug => $page['id']] : [];
        })->all();
        $pageIdByRouteKeyMap = collect($normalizedBuilder['pages'])->mapWithKeys(function (array $page) {
            $routeKey = trim((string) ($page['route_key'] ?? ''));

            return $routeKey !== '' ? [$routeKey => $page['id']] : [];
        })->all();

        DB::transaction(function () use ($company, $normalizedBuilder, $supportsStructuredActionLinks, $supportsStorefrontPageSlugs, $supportsActionTargetPages, $supportsActionFooterGroups, $supportsStorefrontPageRouteFields, $supportsStorefrontPageComponentKey, $supportsStorefrontSectionPresetKey, $supportsStorefrontSectionComponentKey, $supportsStorefrontSectionNewsletterFields, $supportsStorefrontSectionConfigJson, $supportsActionSortOrder, $pageIdBySlugMap, $pageIdByRouteKeyMap) {
            $pageIds = collect($normalizedBuilder['pages'])->pluck('id')->filter()->values();
            $sectionIds = collect($normalizedBuilder['sections'])->pluck('id')->filter()->values();
            $actionIds = collect($normalizedBuilder['actions'])->pluck('id')->filter()->values();

            StorefrontAction::query()
                ->where('company_id', $company->company_id)
                ->when($actionIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $actionIds->all()), fn ($query) => $query)
                ->when($actionIds->isEmpty(), fn ($query) => $query)
                ->delete();

            if ($actionIds->isEmpty()) {
                StorefrontAction::query()->where('company_id', $company->company_id)->delete();
            }

            StorefrontSection::query()
                ->where('company_id', $company->company_id)
                ->when($sectionIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $sectionIds->all()), fn ($query) => $query)
                ->when($sectionIds->isEmpty(), fn ($query) => $query)
                ->delete();

            if ($sectionIds->isEmpty()) {
                StorefrontSection::query()->where('company_id', $company->company_id)->delete();
            }

            StorefrontPage::query()
                ->where('company_id', $company->company_id)
                ->when($pageIds->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $pageIds->all()), fn ($query) => $query)
                ->when($pageIds->isEmpty(), fn ($query) => $query)
                ->delete();

            if ($pageIds->isEmpty()) {
                StorefrontPage::query()->where('company_id', $company->company_id)->delete();
            }

            foreach ($normalizedBuilder['pages'] as $page) {
                $pageAttributes = [
                    'name' => $page['name'],
                    'description' => $page['description'] ?: null,
                    'menu_token' => $page['menu_token'] ?: null,
                ];

                if ($supportsStorefrontPageSlugs) {
                    $pageAttributes['slug'] = $page['slug'];
                }

                if ($supportsStorefrontPageRouteFields) {
                    $pageAttributes['route_mode'] = $page['route_mode'] ?: 'custom_url';
                    $pageAttributes['route_key'] = $page['route_mode'] === 'internal_route'
                        ? ($page['route_key'] ?: '/')
                        : null;
                }

                if ($supportsStorefrontPageComponentKey) {
                    $pageAttributes['component_key'] = $page['component_key'] ?: null;
                }

                StorefrontPage::query()->updateOrCreate(
                    [
                        'id' => $page['id'],
                        'company_id' => $company->company_id,
                    ],
                    $pageAttributes
                );
            }

            foreach ($normalizedBuilder['sections'] as $section) {
                StorefrontSection::query()->updateOrCreate(
                    [
                        'id' => $section['id'],
                        'company_id' => $company->company_id,
                    ],
                    [
                        'page_id' => $section['page_id'],
                        'name' => $section['name'],
                        'title' => $section['title'] ?: null,
                        'subtitle' => $section['subtitle'] ?: null,
                        ...($supportsStorefrontSectionNewsletterFields ? [
                            'newsletter_title' => $section['newsletter_title'] ?: null,
                            'newsletter_text' => $section['newsletter_text'] ?: null,
                        ] : []),
                        'layout' => $section['layout'],
                        'variant' => $section['variant'] ?: null,
                        'order' => (int) $section['order'],
                        'query_sql' => $section['query_sql'] ?: null,
                        'query_json' => $section['query_json'] ?: null,
                        'rich_text_html' => $section['rich_text_html'] ?: null,
                        ...($supportsStorefrontSectionConfigJson ? [
                            // The model cast serializes arrays to JSON. Passing an
                            // already encoded string here would double-encode it
                            // and make the public storefront receive config: [].
                            'config_json' => $section['config'] ?? [],
                        ] : []),
                        ...($supportsStorefrontSectionPresetKey ? ['preset_key' => $section['preset_key'] ?: null] : []),
                        ...($supportsStorefrontSectionComponentKey ? ['component_key' => $section['component_key'] ?: null] : []),
                    ]
                );
            }

            foreach ($normalizedBuilder['actions'] as $action) {
                $targetPageId = trim((string) ($action['target_page_id'] ?? ''));
                if ($targetPageId !== '' && ! in_array($targetPageId, $pageIds->all(), true)) {
                    $targetPageId = '';
                }

                if ($targetPageId === '') {
                    $targetPageId = $this->resolveActionTargetPageId(
                        [
                            'target_page_id' => '',
                            'link_type' => $action['link_type'] ?: $this->normalizeActionLinkType($action),
                            'route_key' => $action['route_key'] ?: '',
                            'expression' => $action['expression'] ?: '',
                            'target_page_slug' => $action['target_page_slug'] ?? '',
                        ],
                        $pageIdBySlugMap,
                        $pageIdByRouteKeyMap
                    );
                }

                $actionAttributes = [
                    'page_id' => $action['page_id'],
                    'section_id' => $action['section_id'] ?: null,
                    'name' => $action['name'],
                    'slug' => $action['slug'],
                    'expression' => $action['expression'] ?: null,
                    'label' => $action['label'] ?: null,
                    'placement' => $action['placement'] ?: 'contextual',
                ];

                if ($supportsStructuredActionLinks) {
                    $actionAttributes['link_type'] = $action['link_type'] ?: 'custom_path';
                    $actionAttributes['route_key'] = $action['route_key'] ?: null;
                }

                if ($supportsActionTargetPages) {
                    $actionAttributes['target_page_id'] = $targetPageId ?: null;
                }

                if ($supportsActionFooterGroups) {
                    $actionAttributes['footer_group'] = $action['footer_group'] ?: null;
                }

                if ($supportsActionSortOrder) {
                    $actionAttributes['sort_order'] = max(1, (int) ($action['sort_order'] ?? 1));
                }

                StorefrontAction::query()->updateOrCreate(
                    [
                        'id' => $action['id'],
                        'company_id' => $company->company_id,
                    ],
                    $actionAttributes
                );
            }

            if (empty($company->ecommerce_setup_completed_at)) {
                $company->ecommerce_setup_completed_at = now();
            }

            // Pages, sections, and links live in their structured tables. Keep
            // a normalized snapshot as a recovery marker as well, so a later
            // read never repopulates removed sections from the purchased theme.
            $company->storefront_homepage_builder = [
                'version' => 1,
                'default_page_id' => $normalizedBuilder['default_page_id'],
                'pages' => $normalizedBuilder['pages'],
                'sections' => $normalizedBuilder['sections'],
                'actions' => $normalizedBuilder['actions'],
                'settings' => $normalizedBuilder['settings'],
            ];
            $company->save();
        });

        $persistedBuilder = $includeData
            ? $this->buildResponseFromRecords($company->fresh(['selectedETemplate']), $selectedTemplate)
            : null;

        if ($includeData && ! $this->hasBuilderContent($persistedBuilder) && $this->hasBuilderContent($normalizedBuilder)) {
            $persistedBuilder = $normalizedBuilder;
        }

        return [
            'status' => 1,
            'message' => 'Storefront home builder updated successfully.',
            'data' => $persistedBuilder,
        ];
    }

    private function templateCategory(?ETemplate $template): string
    {
        $category = collect($template?->categories ?? [])->first();

        if (is_array($category)) {
            return trim((string) ($category['key'] ?? $category['name'] ?? ''));
        }

        return trim((string) $category);
    }
}

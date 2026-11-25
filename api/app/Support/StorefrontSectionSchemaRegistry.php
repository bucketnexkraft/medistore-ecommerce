<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Loads the editable contract from config/storefront_section_schemas.json.
 * Presets select a schema, while each company section stores only its values.
 */
class StorefrontSectionSchemaRegistry
{
    public static function key(?string $variant, ?string $presetKey = null, ?string $category = null): string
    {
        $definition = self::definition($variant, $presetKey, $category);

        return (string) ($definition['key'] ?? 'generic');
    }

    public static function for(?string $variant, ?string $presetKey = null, ?string $category = null): array
    {
        $definition = self::definition($variant, $presetKey, $category);

        return [
            'key' => $definition['key'] ?? 'generic',
            'fields' => self::fields($definition),
        ];
    }

    public static function defaults(array $schema): array
    {
        $defaults = [];

        foreach ($schema['fields'] ?? [] as $field) {
            if (! is_array($field) || ! isset($field['key'])) {
                continue;
            }

            $group = (string) ($field['group'] ?? 'content');
            $key = (string) $field['key'];
            $default = $field['default'] ?? match ($field['type'] ?? 'text') {
                'number' => 8,
                'boolean' => false,
                'filters' => [],
                'image', 'file' => [],
                'slider', 'multiple_image' => [],
                'repeater' => [],
                default => '',
            };

            $defaults[$group][$key] = $default;
        }

        return $defaults;
    }

    public static function normalize(mixed $value, array $schema): array
    {
        $value = is_array($value) ? $value : [];
        $normalized = self::defaults($schema);

        foreach ($schema['fields'] ?? [] as $field) {
            if (! is_array($field) || ! isset($field['key'])) {
                continue;
            }

            $group = (string) ($field['group'] ?? 'content');
            $key = (string) $field['key'];
            if (! array_key_exists($key, $value[$group] ?? [])) {
                continue;
            }

            $raw = $value[$group][$key];
            $normalized[$group][$key] = match ($field['type'] ?? 'text') {
                'number' => max(
                    (int) ($field['min'] ?? 0),
                    min((int) ($field['max'] ?? 1000), (int) $raw)
                ),
                'boolean' => filter_var($raw, FILTER_VALIDATE_BOOLEAN),
                'filters' => is_array($raw)
                    ? collect($raw)
                        ->filter(fn ($filterValue, $filterKey) => in_array($filterKey, $field['allowed'] ?? [], true))
                        ->map(fn ($filterValue) => is_scalar($filterValue) ? trim((string) $filterValue) : $filterValue)
                        ->all()
                    : [],
                'slider', 'multiple_image' => is_array($raw)
                    ? collect($raw)->map(fn ($item) => is_array($item) ? [
                        'id' => $item['id'] ?? null,
                        'url' => trim((string) ($item['url'] ?? '')),
                        'alt' => trim((string) ($item['alt'] ?? '')),
                    ] : trim((string) $item))->filter()->values()->all()
                    : [],
                'repeater' => self::normalizeRepeater($raw, $field),
                'select' => in_array((string) $raw, self::optionValues($field['options'] ?? []), true)
                    ? (string) $raw
                    : (string) ($field['default'] ?? ''),
                'image', 'file' => is_array($raw) ? [
                    'id' => $raw['id'] ?? null,
                    'url' => trim((string) ($raw['url'] ?? '')),
                    'alt' => trim((string) ($raw['alt'] ?? '')),
                ] : [],
                default => is_scalar($raw) ? trim((string) $raw) : '',
            };
        }

        return $normalized;
    }

    public static function all(): array
    {
        $all = [];
        foreach (self::document() as $category => $sections) {
            foreach ((array) $sections as $variant => $variants) {
                foreach ((array) $variants as $preset => $definition) {
                    if (! is_array($definition)) {
                        continue;
                    }

                    $all[] = [
                        'key' => Str::slug($category . '.' . $variant . '.' . $preset),
                        'fields' => self::fields($definition),
                    ];
                }
            }
        }

        return $all;
    }

    private static function definition(?string $variant, ?string $presetKey, ?string $category = null): array
    {
        $variant = Str::lower(trim((string) $variant));
        $presetKey = Str::lower(trim((string) $presetKey));

        if ($variant === 'custom') {
            return [
                'key' => 'custom',
                'fields' => [
                    'title' => [
                        'input_type' => 'text',
                        'label' => 'Title',
                    ],
                    'subtitle' => [
                        'input_type' => 'text',
                        'label' => 'Subtitle',
                    ],
                    'html' => [
                        'input_type' => 'rich_text',
                        'label' => 'Content',
                    ],
                ],
            ];
        }

        $document = self::document();
        if ($category !== null && isset($document[$category])) {
            $categorySlug = Str::slug($category);
            $localPresetKey = str_starts_with($presetKey, $categorySlug . '-')
                ? substr($presetKey, strlen($categorySlug) + 1)
                : $presetKey;
            $definition = self::findDefinition($document[$category], $variant, $localPresetKey);
            if ($definition) {
                return ['key' => $categorySlug . '.' . ($definition['_preset'] ?? 'default'), ...$definition];
            }
        }
        $categoryCandidates = collect(array_keys($document))
            ->sortByDesc(fn ($category) => strlen(Str::slug((string) $category)))
            ->values();

        foreach ($categoryCandidates as $category) {
            $categorySlug = Str::slug((string) $category);
            if ($categorySlug !== '' && str_starts_with($presetKey, $categorySlug . '-')) {
                $definition = self::findDefinition($document[$category] ?? [], $variant, substr($presetKey, strlen($categorySlug) + 1));
                if ($definition) {
                    return ['key' => $categorySlug . '.' . ($definition['_preset'] ?? 'default'), ...$definition];
                }
            }
        }

        foreach ($document as $category => $sections) {
            $definition = self::findDefinition($sections, $variant, $presetKey);
            if ($definition) {
                return ['key' => Str::slug((string) $category) . '.' . ($definition['_preset'] ?? 'default'), ...$definition];
            }
        }

        return ['key' => 'generic', 'fields' => []];
    }

    private static function findDefinition(array $category, string $variant, string $presetKey): ?array
    {
        $variants = is_array($category[$variant] ?? null) ? $category[$variant] : [];

        // The template catalog historically called category-grid presets
        // `hot_category` in some categories and `category_grid` in others.
        // Keep the JSON contract explicit while accepting that legacy alias
        // so every catalog preset still receives its JSON editor schema.
        if ($variants === [] && $variant === 'hot_category' && is_array($category['category_grid'] ?? null)) {
            $variants = $category['category_grid'];
        } elseif ($variants === [] && $variant === 'category_grid' && is_array($category['hot_category'] ?? null)) {
            $variants = $category['hot_category'];
        }
        if (isset($variants[$presetKey]) && is_array($variants[$presetKey])) {
            return ['_preset' => $presetKey, ...$variants[$presetKey]];
        }

        foreach ($variants as $candidate => $definition) {
            if ($candidate !== 'default' && ($presetKey === $candidate || str_ends_with($presetKey, '-' . $candidate))) {
                return ['_preset' => $candidate, ...$definition];
            }
        }

        // Some template categories keep the shared category-grid variants in
        // the opposite section bucket. Try that bucket before falling back to
        // a generic schema.
        $aliasVariant = $variant === 'hot_category' ? 'category_grid' : ($variant === 'category_grid' ? 'hot_category' : null);
        if ($aliasVariant !== null && is_array($category[$aliasVariant] ?? null)) {
            foreach ($category[$aliasVariant] as $candidate => $definition) {
                if (is_array($definition) && $candidate !== 'default' && ($presetKey === $candidate || str_ends_with($presetKey, '-' . $candidate))) {
                    return ['_preset' => $candidate, ...$definition];
                }
            }
        }

        if (isset($variants['default']) && is_array($variants['default'])) {
            return ['_preset' => 'default', ...$variants['default']];
        }

        // Product variants share one simple product-section definition.
        if (in_array($variant, ['flash_deal', 'products', 'best_selling', 'top_seller', 'group_deals', 'on_sale', 'product_filter', 'group_purchase'], true)) {
            $productVariants = is_array($category['product_sections'] ?? null) ? $category['product_sections'] : [];
            if (isset($productVariants['default']) && is_array($productVariants['default'])) {
                return ['_preset' => 'product_sections', ...$productVariants['default']];
            }
        }

        return null;
    }

    private static function fields(array $definition): array
    {
        $rawFields = is_array($definition['fields'] ?? null) ? $definition['fields'] : $definition;
        $fields = [];

        foreach ($rawFields as $fieldKey => $field) {
            if ($fieldKey === '_preset' || ! is_array($field)) {
                continue;
            }

            $type = (string) ($field['input_type'] ?? $field['type'] ?? 'text');
            $group = in_array($fieldKey, ['data_model', 'items_allow', 'filter'], true) || in_array($type, ['filters', 'select'], true)
                ? 'data'
                : 'content';
            $fields[] = [
                'key' => (string) $fieldKey,
                'label' => (string) ($field['label'] ?? Str::headline((string) $fieldKey)),
                'type' => $type,
                'group' => $group,
                ...collect($field)->except(['input_type', 'type', 'label'])->all(),
                ...($type === 'filters' ? ['allowed' => $field['allowed'] ?? $field['options'] ?? []] : []),
            ];
        }

        return $fields;
    }

    private static function optionValues(mixed $options): array
    {
        return collect(is_array($options) ? $options : [])
            ->map(fn ($option) => is_array($option) ? ($option['value'] ?? '') : $option)
            ->filter(fn ($option) => is_scalar($option))
            ->map(fn ($option) => (string) $option)
            ->values()
            ->all();
    }

    private static function normalizeRepeater(mixed $value, array $field): array
    {
        $items = is_array($value) ? $value : [];
        $itemFields = $field['item_fields'] ?? $field['fields'] ?? [];
        if (! is_array($itemFields)) {
            return [];
        }

        if (array_is_list($itemFields)) {
            $itemFields = collect($itemFields)
                ->filter(fn ($definition) => is_array($definition) && isset($definition['key']))
                ->mapWithKeys(fn (array $definition) => [(string) $definition['key'] => $definition])
                ->all();
        }

        return collect($items)
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item) use ($itemFields) {
                $normalized = [];
                foreach ($itemFields as $key => $definition) {
                    if (! is_array($definition)) {
                        continue;
                    }

                    $key = (string) $key;
                    if (! array_key_exists($key, $item)) {
                        continue;
                    }

                    $normalized[$key] = self::normalizeRepeaterValue($item[$key], $definition);
                }

                return $normalized;
            })
            ->values()
            ->all();
    }

    private static function normalizeRepeaterValue(mixed $value, array $field): mixed
    {
        $type = (string) ($field['input_type'] ?? $field['type'] ?? 'text');

        return match ($type) {
            'number' => max((int) ($field['min'] ?? 0), min((int) ($field['max'] ?? 1000), (int) $value)),
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'filters' => is_array($value) ? collect($value)
                ->filter(fn ($item, $key) => in_array($key, $field['allowed'] ?? $field['options'] ?? [], true))
                ->map(fn ($item) => is_scalar($item) ? trim((string) $item) : $item)
                ->all() : [],
            'image', 'file' => is_array($value) ? [
                'id' => $value['id'] ?? null,
                'url' => trim((string) ($value['url'] ?? '')),
                'alt' => trim((string) ($value['alt'] ?? '')),
            ] : [],
            'slider', 'multiple_image' => is_array($value) ? collect($value)
                ->map(fn ($item) => is_array($item) ? [
                    'id' => $item['id'] ?? null,
                    'url' => trim((string) ($item['url'] ?? '')),
                    'alt' => trim((string) ($item['alt'] ?? '')),
                ] : trim((string) $item))
                ->filter()
                ->values()
                ->all() : [],
            'repeater' => self::normalizeRepeater($value, $field),
            'select' => in_array((string) $value, self::optionValues($field['options'] ?? []), true)
                ? (string) $value
                : (string) ($field['default'] ?? ''),
            default => is_scalar($value) ? trim((string) $value) : '',
        };
    }

    private static function document(): array
    {
        static $document;

        if (is_array($document)) {
            return $document;
        }

        $path = base_path('config/storefront_section_schemas.json');
        if (! is_file($path)) {
            return $document = [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        if (! is_array($decoded)) {
            return $document = [];
        }

        // Field references stay within the same category and section type.
        foreach ($decoded as $category => $sections) {
            foreach ((array) $sections as $variant => $presets) {
                foreach ((array) $presets as $preset => $definition) {
                    $inherit = $definition['inherit_fields'] ?? null;
                    if (! is_array($inherit)) {
                        continue;
                    }

                    $source = $presets[$inherit['preset'] ?? ''] ?? [];
                    $sourceFields = $source['fields'] ?? $source;
                    unset($definition['inherit_fields']);
                    $localFields = $definition['fields'] ?? $definition;
                    foreach ($inherit['keys'] ?? [] as $key) {
                        $localFields[$key] ??= $sourceFields[$key] ?? null;
                    }

                    $decoded[$category][$variant][$preset] = isset($definition['fields'])
                        ? [...$definition, 'fields' => $localFields]
                        : $localFields;
                }
            }
        }

        return $document = $decoded;
    }
}

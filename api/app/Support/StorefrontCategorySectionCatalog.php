<?php

namespace App\Support;

use App\Enums\StorefrontSectionPreset;
use App\Enums\StorefrontTemplateVariant;
use Illuminate\Support\Str;

class StorefrontCategorySectionCatalog
{
    public static function catalog(): array
    {
        return collect(config('ecommerce_templates.category_preset_map', []))
            ->mapWithKeys(function ($sectionMap, $categoryName) {
                $categoryKey = Str::slug((string) $categoryName);
                $groups = collect(is_array($sectionMap) ? $sectionMap : [])
                    ->map(function ($presetEntries, $sectionType) use ($categoryKey, $categoryName) {
                        return collect(is_array($presetEntries) ? $presetEntries : [])
                            ->map(function ($configuredLabel, $configuredKey) use ($categoryKey, $categoryName, $sectionType) {
                                $presetKey = is_int($configuredKey) ? (string) $configuredLabel : (string) $configuredKey;
                                $preset = StorefrontSectionPreset::tryFrom($presetKey);

                                $label = is_int($configuredKey)
                                    ? ($preset?->label() ?? Str::headline($presetKey))
                                    : trim((string) $configuredLabel);
                                $label = $label !== '' ? $label : ($preset?->label() ?? Str::headline($presetKey));
                                $fallbackComponentKey = $preset?->componentKey()
                                    ?? StorefrontTemplateVariant::tryFromValue((string) $sectionType)->componentKey();
                                $variantKey = $preset?->value ?? Str::slug($presetKey);
                                $scopedKey = str_starts_with($fallbackComponentKey, $categoryKey . '-')
                                    ? $fallbackComponentKey
                                    : (str_starts_with($variantKey, $categoryKey . '-')
                                        ? $variantKey
                                        : $categoryKey . '-' . $variantKey);

                                return [
                                    'id' => $scopedKey,
                                    'name' => $label,
                                    'label' => $label,
                                    'preset_key' => $scopedKey,
                                    'legacy_preset_key' => $presetKey,
                                    'section_type' => (string) $sectionType,
                                    'section_type_label' => StorefrontTemplateVariant::tryFromValue((string) $sectionType)->label(),
                                    'component_key' => $scopedKey,
                                    'fallback_component_key' => $fallbackComponentKey,
                                    'category_key' => $categoryKey,
                                    'category_name' => (string) $categoryName,
                                    'category_keys' => [$categoryKey],
                                    'categories' => [[
                                        'key' => $categoryKey,
                                        'name' => (string) $categoryName,
                                    ]],
                                    'preview_image_url' => null,
                                    'status' => true,
                                    'schema_key' => StorefrontSectionSchemaRegistry::key($sectionType, $presetKey, $categoryName),
                                    'config_schema' => StorefrontSectionSchemaRegistry::for($sectionType, $presetKey, $categoryName),
                                ];
                            })
                            ->filter()
                            ->values()
                            ->all();
                    })
                    ->filter(fn ($presets) => ! empty($presets))
                    ->all();

                return [$categoryKey => [
                    'key' => $categoryKey,
                    'name' => (string) $categoryName,
                    'sections' => $groups,
                ]];
            })
            ->all();
    }

    public static function categoryNames(): array
    {
        return collect(self::catalog())->pluck('name')->values()->all();
    }

    public static function groupedOptionsByCategory(): array
    {
        return collect(self::catalog())
            ->map(fn (array $category) => $category['sections'] ?? [])
            ->all();
    }

    public static function groupedOptions(): array
    {
        return collect(self::definitions())
            ->groupBy('section_type')
            ->map(fn ($items) => $items->values()->all())
            ->all();
    }

    public static function definitions(): array
    {
        return collect(self::catalog())
            ->flatMap(fn (array $category) => collect($category['sections'] ?? [])->flatten(1))
            ->values()
            ->all();
    }

    public static function definitionsForCategory(?string $category): array
    {
        $categoryKey = Str::slug(trim((string) $category));

        return self::catalog()[$categoryKey]['sections'] ?? [];
    }

    public static function categoryPresetMap(): array
    {
        return collect(self::catalog())
            ->mapWithKeys(fn (array $category) => [
                $category['name'] => collect($category['sections'] ?? [])
                    ->map(fn ($presets) => collect($presets)->pluck('preset_key')->values()->all())
                    ->all(),
            ])
            ->all();
    }

    public static function componentOptionsByCategory(): array
    {
        return collect(self::catalog())
            ->map(fn (array $category) => collect($category['sections'] ?? [])
                ->map(fn ($presets) => collect($presets)
                    ->map(fn (array $preset) => [
                        'value' => $preset['component_key'],
                        'label' => $preset['label'],
                    ])
                    ->values()
                    ->all())
                ->all())
            ->all();
    }

    public static function componentOptions(): array
    {
        return collect(self::definitions())
            ->groupBy('section_type')
            ->map(fn ($presets) => $presets
                ->map(fn (array $preset) => [
                    'value' => $preset['component_key'],
                    'label' => $preset['label'],
                ])
                ->unique('value')
                ->values()
                ->all())
            ->all();
    }

    public static function find(?string $presetKey): ?array
    {
        $key = trim((string) $presetKey);

        if ($key === '') {
            return null;
        }

        $definitions = collect(self::definitions());
        $match = $definitions->first(fn (array $preset) => $preset['preset_key'] === $key);

        if ($match !== null) {
            return $match;
        }

        // Sections created before the products namespace was introduced used
        // `best-selling-*`. Resolve those records to the new catalog entry
        // without exposing the legacy preset in the builder library.
        $productsAlias = preg_replace('/(^|-)best-selling-(default|grid)$/', '$1products-$2', $key);

        return $productsAlias && $productsAlias !== $key
            ? $definitions->first(fn (array $preset) => $preset['preset_key'] === $productsAlias)
            : null;
    }

    public static function expandPresetKeys(array $presetKeys): array
    {
        $lookup = array_fill_keys(
            collect($presetKeys)
                ->map(fn ($key) => trim((string) $key))
                ->filter()
                ->values()
                ->all(),
            true
        );

        return collect(array_keys($lookup))
            ->merge(
                collect(self::definitions())
                    ->filter(fn (array $preset) =>
                        isset($lookup[$preset['preset_key']])
                        || isset($lookup[$preset['legacy_preset_key']])
                    )
                    ->pluck('preset_key')
            )
            ->unique()
            ->values()
            ->all();
    }

    public static function isManagedKey(?string $presetKey): bool
    {
        $key = trim((string) $presetKey);

        return self::find($key) !== null || StorefrontSectionPreset::tryFrom($key) !== null;
    }
}

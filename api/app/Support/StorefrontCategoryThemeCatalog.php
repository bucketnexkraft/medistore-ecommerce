<?php

namespace App\Support;

use Illuminate\Support\Str;

class StorefrontCategoryThemeCatalog
{
    public static function catalog(): array
    {
        return collect(config('ecommerce_templates.category_theme_map', []))
            ->filter(fn ($theme, $categoryName) => is_string($categoryName) && is_array($theme))
            ->mapWithKeys(function (array $theme, string $categoryName) {
                $categoryKey = Str::slug($categoryName);
                $shells = self::normalizeOptions($theme['shell'] ?? []);
                $pages = collect($theme['pages'] ?? [])
                    ->filter(fn ($options, $pageKey) => is_string($pageKey) && is_array($options))
                    ->mapWithKeys(fn (array $options, string $pageKey) => [
                        Str::slug($pageKey) => self::normalizeOptions($options),
                    ])
                    ->filter(fn (array $options) => ! empty($options))
                    ->all();

                return [
                    $categoryKey => [
                        'category_key' => $categoryKey,
                        'category_name' => $categoryName,
                        'shells' => $shells,
                        'default_shell_component_key' => $shells[0]['value'] ?? '',
                        'pages' => $pages,
                        'default_page_components' => collect($pages)
                            ->map(fn (array $options) => $options[0]['value'] ?? '')
                            ->filter()
                            ->all(),
                    ],
                ];
            })
            ->all();
    }

    public static function themesByCategory(): array
    {
        return self::catalog();
    }

    public static function pageOptionsByCategory(): array
    {
        return collect(self::catalog())
            ->map(fn (array $theme) => $theme['pages'])
            ->all();
    }

    public static function findCategory(mixed $category): ?array
    {
        $categoryKey = Str::slug(trim((string) $category));

        return self::catalog()[$categoryKey] ?? null;
    }

    public static function defaultShellComponent(mixed $category): string
    {
        return (string) (self::findCategory($category)['default_shell_component_key'] ?? '');
    }

    public static function defaultPageComponent(mixed $category, mixed $pageKey): string
    {
        $theme = self::findCategory($category);
        $normalizedPageKey = self::normalizePageKey($pageKey);

        return (string) ($theme['default_page_components'][$normalizedPageKey] ?? '');
    }

    public static function resolvePageComponent(mixed $category, mixed $pageKey, mixed $componentKey): string
    {
        $theme = self::findCategory($category);
        $normalizedPageKey = self::normalizePageKey($pageKey);
        $requestedKey = trim((string) $componentKey);
        $allowed = collect($theme['pages'][$normalizedPageKey] ?? [])->pluck('value')->all();

        if ($requestedKey !== '' && in_array($requestedKey, $allowed, true)) {
            return $requestedKey;
        }

        return (string) ($theme['default_page_components'][$normalizedPageKey] ?? '');
    }

    public static function normalizePageKey(mixed $value): string
    {
        $route = strtolower(trim((string) $value));

        if ($route === '' || $route === '/' || $route === 'home') {
            return 'home';
        }

        return Str::slug(ltrim($route, '/'));
    }

    private static function normalizeOptions(array $options): array
    {
        return collect($options)
            ->map(function ($label, $value) {
                if (is_int($value)) {
                    $value = $label;
                    $label = Str::headline((string) $value);
                }

                $componentKey = trim((string) $value);
                if ($componentKey === '') {
                    return null;
                }

                return [
                    'value' => $componentKey,
                    'label' => trim((string) $label) ?: Str::headline($componentKey),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}

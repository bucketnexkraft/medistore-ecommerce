<?php

use App\Models\Setting;
use App\Models\MenuItem;
use App\Sections\SectionRegistry;
use App\Services\ImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;

if (!function_exists('imageValidation')) {
    function imageValidation(): string
    {
        return 'nullable|image|mimes:jpeg,png,jpg,gif,webp,svg|max:4096';
    }
}

if (!function_exists('get_file')) {
    function resolve_public_asset_base_url(): string
    {
        $configBaseUrl = rtrim((string) (config('app.asset_url') ?: config('app.url')), '/');
        $requestBaseUrl = null;

        try {
            if (!app()->runningInConsole()) {
                $request = request();
                $requestBaseUrl = $request ? rtrim((string) $request->getSchemeAndHttpHost(), '/') : null;
            }
        } catch (\Throwable $throwable) {
            $requestBaseUrl = null;
        }

        $candidates = array_filter([
            $configBaseUrl,
            $requestBaseUrl,
        ]);

        foreach ($candidates as $candidate) {
            return $candidate;
        }

        return '';
    }

    function get_file($image = '', $folder = '')
    {
        $file = 'images/' . trim($folder, '/') . '/' . ltrim((string) $image, '/');
        $absoluteFile = public_path($file);

        if (!(File::exists($absoluteFile) && is_file($absoluteFile))) {
            $demoFolderMap = [
                'category-images' => 'demo/category',
                'brand-images' => 'demo/brand',
                'product-images' => 'demo/product',
            ];

            $demoFolder = $demoFolderMap[trim((string) $folder, '/')] ?? null;
            if ($demoFolder) {
                $demoFile = 'images/' . trim($demoFolder, '/') . '/' . ltrim((string) $image, '/');
                $absoluteDemoFile = public_path($demoFile);

                if (File::exists($absoluteDemoFile) && is_file($absoluteDemoFile)) {
                    $baseUrl = resolve_public_asset_base_url();

                    if ($baseUrl === '') {
                        return asset($demoFile);
                    }

                    return $baseUrl . '/' . ltrim($demoFile, '/');
                }
            }

            return public_asset_url('images/placeholder.jpg');
        }

        $baseUrl = resolve_public_asset_base_url();

        if ($baseUrl === '') {
            return asset($file);
        }

        return $baseUrl . '/' . ltrim($file, '/');
    }
}

if (!function_exists('public_asset_url')) {
    function public_asset_url(string $path): string
    {
        $baseUrl = function_exists('resolve_public_asset_base_url')
            ? resolve_public_asset_base_url()
            : rtrim((string) (config('app.asset_url') ?: config('app.url')), '/');

        if ($baseUrl === '') {
            return asset($path);
        }

        return $baseUrl . '/' . ltrim($path, '/');
    }
}

if (!function_exists('upload')) {
    function upload(UploadedFile $image, string $folder, $old = '', $name = ''): string
    {
        ImageService::assertImageUpload($image);

        $path = 'images/' . trim($folder, '/');

        $fullPath = public_path($path);

        if (!file_exists($fullPath)) {
            mkdir($fullPath, 0755, true);
        }

        if ($old && file_exists($fullPath . '/' . $old)) {
            @unlink($fullPath . '/' . $old);
        }

        $extension = strtolower((string) $image->getClientOriginalExtension());
        $imageName = $name ? $name . '.' . $extension : uniqid() . '-' . time() . '.' . $extension;

        $image->move($fullPath, $imageName);

        return $imageName;
    }
}

if (!function_exists('settings')) {
    function settings(string $key, $default = null)
    {
        static $cached = null;

        if ($cached === null) {
            $cached = Setting::query()->pluck('value', 'key')->toArray();
        }

        $value = $cached[$key] ?? $default;

        if (is_string($value)) {
            $decoded = json_decode($value);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $decoded;
            }
        }

        return $value;
    }
}

if (!function_exists('theme')) {
    function theme(): string
    {
        $theme = settings('theme');
        return 'frontend.' . ($theme ? $theme . '.' : 'basic.');
    }
}

if (!function_exists('theme_assets')) {
    function theme_assets(string $filename = '', bool $css = true): string
    {
        $assetPath = str_replace('.', '/', theme()) . ($css ? 'css/' : 'js/') . ltrim($filename, '/');
        return asset($assetPath);
    }
}

if (!function_exists('t')) {
    function t($key, array $replace = [], ?string $locale = null)
    {
        if ($key === null || $key === '') {
            return $key;
        }

        return __((string) $key, $replace, $locale);
    }
}

if (!function_exists('amount')) {
    function amount($amount, $onlyNumber = false, $currency_symbol = '')
    {
        $basic = settings('basic');
        
        $precision = $basic->precision ?? 2;

        if ($currency_symbol) {
            return number_format((float) $amount, $precision) . ' ' . $currency_symbol;
        }

        if ($onlyNumber) {
            return number_format((float) $amount, $precision);
        }

        $symbol = $basic->currency_symbol ?? '$';
        $code = $basic->currency ?? 'USD';
        $format = $basic->currency_format ?? 'left';
        $formatted = number_format((float) $amount, $precision);

        switch ($format) {
            case 'right':
                return "{$formatted} {$symbol}";
            case 'both':
                return "{$symbol} {$formatted} {$code}";
            case 'left':
            default:
                return "{$symbol} {$formatted}";
        }
    }
}

if (!function_exists('extractDataSections')) {
    function extractDataSections(string $content): array
    {
        preg_match_all('/<section[^>]*data-section\s*=\s*["\']([^"\']+)["\'][^>]*>/i', $content, $matches);
        return array_values(array_unique($matches[1] ?? []));
    }
}

if (!function_exists('generateSectionHtml')) {
    function generateSectionHtml($content)
    {
        $html = (string) $content;
        $sectionsInContent = extractDataSections($html);

        foreach (SectionRegistry::all() as $class) {
            $section = new $class();
            $name = $section->getName();

            if (!in_array($name, $sectionsInContent, true)) {
                continue;
            }

            $sectionHtml = $section->render();
            $pattern = '#(?:<p>\s*)?<section[^>]*data-section\s*=\s*["\']'
                . preg_quote($name, '#')
                . '["\'][^>]*>.*?</section>(?:\s*</p>)?#is';

            $html = preg_replace($pattern, $sectionHtml, $html);
        }

        return $html;
    }
}

if (!function_exists('renderMenu')) {
    function renderMenu($items = null): string
    {
        $isTopLevel = $items === null;

        if ($isTopLevel) {
            $items = MenuItem::query()
                ->whereNull('parent_id')
                ->with(['childrenRecursive', 'page'])
                ->orderBy('order')
                ->get();
        }

        $html = '<ul>';

        foreach ($items as $item) {
            $hasChildren = $item->childrenRecursive && $item->childrenRecursive->isNotEmpty();
            $html .= '<li' . ($hasChildren ? ' class="has-dropdown"' : '') . '>';

            if (!empty($item->url)) {
                $normalized = strtolower(trim((string) $item->url));
                $normalized = preg_replace('#^https?://[^/]+#', '', $normalized) ?? $normalized;
                $normalized = '/' . ltrim($normalized, '/');
                $url = $normalized === '/home' ? '/' : $item->url;
            } elseif (!empty($item->page_id) && $item->page) {
                $slug = strtolower(trim((string) $item->page->slug, '/'));
                if ($slug === 'home') {
                    $url = route('home');
                } elseif (\Illuminate\Support\Facades\Route::has('pages')) {
                    $url = route('pages', $slug);
                } else {
                    $url = url('/' . $slug);
                }
            } else {
                $url = '#';
            }

            $target = !empty($item->target) ? ' target="' . e($item->target) . '"' : '';
            $html .= '<a href="' . e($url) . '"' . $target . '>' . e(t($item->title)) . '</a>';

            if ($hasChildren) {
                $html .= '<ul class="ot-submenu submenu">';
                $html .= renderMenu($item->childrenRecursive);
                $html .= '</ul>';
            }

            $html .= '</li>';
        }

        $html .= '</ul>';

        return $html;
    }
}

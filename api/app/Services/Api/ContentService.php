<?php

namespace App\Services\Api;

use App\Constant\Path;
use App\Enums\SalesChannel;
use App\Enums\StorefrontTemplateVariant;
use App\Data\FeaturePreference;
use App\Models\Blog;
use App\Models\BlogCategory;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Company;
use App\Models\CompanyFeaturePreference;
use App\Models\ContactMessage;
use App\Models\Currency;
use App\Models\DiscountSetup;
use App\Models\MenuItem;
use App\Models\Newsletter;
use App\Models\Page;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\SalesChannel as InventorySalesChannel;
use App\Models\SaasPlan;
use App\Models\Section;
use App\Models\Setting;
use App\Models\StorefrontAction;
use App\Models\StorefrontPage;
use App\Models\StorefrontSection;
use App\Sections\FooterSection;
use App\Sections\HeroSection;
use App\Services\ImageService;
use App\Services\Backoffice\ETemplateBuilderService;
use App\Services\CompanyPlanFeatureService;
use App\Support\EcommerceCompanyContext;
use App\Support\StorefrontCategoryThemeCatalog;
use App\Support\StorefrontDemoProductImages;
use App\Support\StorefrontSectionSchemaRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

class ContentService
{
    private const USER_DEFINED_TYPE_DEMAND_TAG = 'demand_tag';

    private const DEMO_CATEGORY_IMAGES = [
        'books-stationery' => 'diabetic-care.webp',
        'electronics-gadgets' => 'diagnostic-product.webp',
        'fashion-apparel' => 'digital-thermometers.webp',
        'groceries-essentials' => 'hospital-products.webp',
        'health-beauty' => 'nebulizer-machine.webp',
        'home-kitchen' => 'rapid-test-kit.webp',
        'jewelry-accessories' => 'surgical-products.webp',
        'pet-supplies' => 'digital-blood-pressure-monitor.webp',
        'sports-fitness' => 'pain-rehabilitation.webp',
        'toys-kids' => 'veterinary-accessories.webp',
    ];

    private $activeStorefrontDiscountSetups;

    private const PUBLIC_SETTING_KEYS = [
        'basic',
        'configurations',
        'email_configuration',
        'ecommerce_store',
        'extension',
        'seo',
        'social',
        'kyc',
        'cron',
    ];

    private const SENSITIVE_SETTING_FIELDS = [
        'smtp_password',
        'sendgrid_api_key',
        'pusher_app_secret',
        'ai_key',
        'google_client_secret',
        'facebook_client_secret',
        'secret_key',
    ];

    private function storefrontText(mixed $value): string
    {
        return trim((string) ($value ?? ''));
    }

    private function storefrontSectionConfig(mixed $value): array
    {
        // Support records written by the earlier double-encoding bug while
        // keeping the public response consistently array-shaped.
        for ($attempt = 0; $attempt < 2 && is_string($value); $attempt++) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        return is_array($value) ? $value : [];
    }

    private function storefrontThemePayload(?Company $company): array
    {
        $template = $company?->selectedETemplate;
        $savedTheme = data_get($company?->storefront_homepage_builder, 'settings.theme', []);
        $savedTheme = is_array($savedTheme) ? $savedTheme : [];
        $normalizeColor = static function (mixed $value, string $fallback): string {
            $color = strtoupper(trim((string) $value));

            return preg_match('/^#[0-9A-F]{6}$/', $color) === 1 ? $color : $fallback;
        };
        $templatePrimary = $normalizeColor($template?->primary_color, '#7F00FF');
        $templateSecondary = $normalizeColor($template?->secondary_color, '#F5F3FF');
        $templateFont = trim((string) ($template?->font_family ?: 'Inter'));
        $fontFamily = trim((string) ($savedTheme['font_family'] ?? $templateFont));

        return [
            'primary_color' => $normalizeColor($savedTheme['primary_color'] ?? null, $templatePrimary),
            'secondary_color' => $normalizeColor($savedTheme['secondary_color'] ?? null, $templateSecondary),
            'font_family' => mb_substr($fontFamily !== '' ? $fontFamily : $templateFont, 0, 100),
        ];
    }

    private function storefrontCategoryPayload(?Company $company): ?array
    {
        $category = $company?->ecommerceCategory;

        if (! $category) {
            return null;
        }

        return [
            'id' => (int) $category->id,
            'name' => (string) $category->name,
            'key' => Str::slug((string) $category->name),
        ];
    }

    private function storefrontTemplatePayload(?Company $company): ?array
    {
        $template = $company?->selectedETemplate;

        if (! $template) {
            return null;
        }

        $categoryName = (string) ($company?->ecommerceCategory?->name ?? '');
        $categoryTheme = StorefrontCategoryThemeCatalog::findCategory($categoryName);
        $pageComponents = $categoryTheme['default_page_components'] ?? [];
        $builder = app(ETemplateBuilderService::class)->getBuilder($template);

        foreach ($builder['pages'] ?? [] as $page) {
            if (! is_array($page)) {
                continue;
            }

            $pageKey = StorefrontCategoryThemeCatalog::normalizePageKey(
                ($page['route_mode'] ?? '') === 'internal_route'
                    ? ($page['route_key'] ?? '')
                    : ($page['slug'] ?? '')
            );
            $componentKey = StorefrontCategoryThemeCatalog::resolvePageComponent(
                $categoryName,
                $pageKey,
                $page['component_key'] ?? ''
            );

            if ($componentKey !== '') {
                $pageComponents[$pageKey] = $componentKey;
            }
        }

        if ($company) {
            StorefrontPage::query()
                ->where('company_id', $company->company_id)
                ->get(['slug', 'route_mode', 'route_key', 'component_key'])
                ->each(function (StorefrontPage $page) use (&$pageComponents, $categoryName) {
                    $pageKey = StorefrontCategoryThemeCatalog::normalizePageKey(
                        ($page->route_mode ?? '') === 'internal_route'
                            ? ($page->route_key ?? '')
                            : ($page->slug ?? '')
                    );
                    $componentKey = StorefrontCategoryThemeCatalog::resolvePageComponent(
                        $categoryName,
                        $pageKey,
                        $page->component_key ?? ''
                    );

                    if ($componentKey !== '') {
                        $pageComponents[$pageKey] = $componentKey;
                    }
                });
        }

        return [
            'id' => (int) $template->id,
            'name' => (string) $template->template_name,
            'key' => Str::slug((string) $template->template_name),
            'category_key' => Str::slug($categoryName),
            'shell_component_key' => $categoryTheme['default_shell_component_key'] ?? '',
            'page_components' => $pageComponents,
        ];
    }

    private function storefrontDemoOnly(): bool
    {
        return request()->boolean('is_demo');
    }

    /**
     * Demo catalog records are intentionally global (company_id is null), so
     * the active demo storefront company scope must not hide them.
     */
    private function storefrontCatalogQuery(string $modelClass)
    {
        $query = $modelClass::query();

        if ($this->storefrontDemoOnly()) {
            $query->withoutGlobalScope('company');
        }

        return $query;
    }

    private function storefrontActionPlacementMatches(array $action, string $slot): bool
    {
        $placement = strtolower($this->storefrontText($action['placement'] ?? ''));
        $normalizedPlacement = $placement === 'footer' ? 'footer' : 'header';

        return $normalizedPlacement === strtolower($slot);
    }

    private function mergeStorefrontActions(iterable $actions): array
    {
        $merged = [];
        $seen = [];

        foreach ($actions as $action) {
            if (! is_array($action)) {
                continue;
            }

            $key = $this->storefrontText($action['id'] ?? '');
            if ($key === '') {
                $key = md5(json_encode($action));
            }

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $merged[] = $action;
        }

        return array_values($merged);
    }

    private function storefrontActionSortKey(array $action): array
    {
        $placement = strtolower($this->storefrontText($action['placement'] ?? ''));
        $placementOrder = match ($placement) {
            'footer' => 1,
            default => 0,
        };

        return [
            $placementOrder,
            (int) ($action['sort_order'] ?? 1),
            $this->storefrontText($action['id'] ?? ''),
        ];
    }

    private function sortStorefrontActions(array $actions): array
    {
        usort($actions, function (array $left, array $right): int {
            return $this->storefrontActionSortKey($left) <=> $this->storefrontActionSortKey($right);
        });

        return array_values($actions);
    }

    private function collectStorefrontSlotActions(iterable $actions, string $slot): array
    {
        $slot = strtolower($slot);

        $filteredActions = collect($actions)
            ->filter(function ($action) use ($slot) {
                if (! is_array($action)) {
                    return false;
                }

                $placement = strtolower($this->storefrontText($action['placement'] ?? ''));

                return ($placement === 'footer' ? 'footer' : 'header') === $slot;
            })
            ->values()
            ->all();

        return $this->sortStorefrontActions($filteredActions);
    }

    private function resolveCategoryImage(?string $path): string
    {
        if (is_string($path)) {
            $trimmedPath = trim($path);

            if ($trimmedPath !== '' && Str::startsWith($trimmedPath, ['http://', 'https://'])) {
                return $trimmedPath;
            }
        }

        return $path ? ImageService::url($path, 'category-images') : public_path('images/placeholder.jpg');
    }

    private function landingCategoryImage(Category $category, bool $demoOnly): string
    {
        if (! $demoOnly) {
            return $this->resolveCategoryImage($category->image);
        }

        $image = self::DEMO_CATEGORY_IMAGES[Str::slug($category->title)] ?? null;

        return $image === null
            ? ''
            : public_asset_url('images/category-images/demo-medical/' . $image);
    }

    private function storefrontCacheKey(string $suffix, ?string $companyId = null): string
    {
        return sprintf('storefront:%s:%s', $suffix, $companyId ?: 'global');
    }

    private function warmStorefrontCompanyContext(): ?string
    {
        $request = request();

        if (! EcommerceCompanyContext::shouldApplyToRequest($request)) {
            return EcommerceCompanyContext::currentCompanyId();
        }

        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest($request);

        if (is_string($companyId) && trim($companyId) !== '') {
            $request->attributes->set('ecommerce_company_id', trim($companyId));

            if ($request->hasSession()) {
                $request->session()->put(EcommerceCompanyContext::SESSION_KEY, trim($companyId));
            }
        }

        return EcommerceCompanyContext::currentCompanyId();
    }

    private function demandTagOptionsForCompany(?string $companyId): array
    {
        $defaultOptions = Product::demandTagOptions();

        if (blank($companyId) || !Schema::hasTable('user_defined_values')) {
            return $defaultOptions;
        }

        $query = DB::table('user_defined_values')
            ->where('company_id', $companyId)
            ->whereNotNull('name')
            ->where('name', '!=', '');

        if (Schema::hasColumn('user_defined_values', 'type')) {
            $query->where('type', self::USER_DEFINED_TYPE_DEMAND_TAG);
        }

        $customOptions = $query
            ->orderBy('name', 'asc')
            ->get(['value', 'name'])
            ->map(function ($row) {
                $rawValue = is_string($row->value) && trim($row->value) !== ''
                    ? $row->value
                    : $row->name;

                return [
                    'value' => str($rawValue)->lower()->replace(' ', '_')->value(),
                    'label' => (string) $row->name,
                ];
            })
            ->values();

        return collect($defaultOptions)
            ->keyBy('value')
            ->merge($customOptions->keyBy('value'))
            ->values()
            ->all();
    }

    private function resolveProductImage(?string $path): string
    {
        if (is_string($path)) {
            $trimmedPath = trim($path);

            if ($trimmedPath !== '' && Str::startsWith($trimmedPath, ['http://', 'https://'])) {
                return $trimmedPath;
            }
        }

        return $path ? ImageService::url($path, 'product-images') : public_path('images/placeholder.jpg');
    }

    private function resolveStorefrontDiscountSetup(Product $product): ?DiscountSetup
    {
        if ($this->activeStorefrontDiscountSetups === null) {
            $companyId = EcommerceCompanyContext::currentCompanyId();

            $this->activeStorefrontDiscountSetups = DiscountSetup::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('type', 'discount')
                ->where('is_active', true)
                ->whereDate('form_date', '<=', now()->toDateString())
                ->whereDate('to_date', '>=', now()->toDateString())
                ->orderBy('to_date')
                ->orderByDesc('id')
                ->get();
        }

        return $this->activeStorefrontDiscountSetups
              ->first(function (DiscountSetup $discount) use ($product) {
                  $products = collect($discount->products ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                  $categories = collect($discount->categories ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                  $brands = collect($discount->brands ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                  $warehouses = collect($discount->warehouses ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                  $matchesExplicitProduct = in_array((string) $product->id, $products, true);
                  $matchesCategoryOrBrand = in_array((string) $product->category_id, $categories, true)
                      || (!blank($product->brand_id) && in_array((string) $product->brand_id, $brands, true));
                  $hasScope = $matchesExplicitProduct || $matchesCategoryOrBrand || !empty($warehouses);

                  if (! $hasScope) {
                      return false;
                  }

                  if ($matchesExplicitProduct) {
                      return true;
                  }

                  if (! $matchesCategoryOrBrand) {
                      return false;
                  }

                  if (!empty($warehouses)) {
                      $productWarehouseIds = InventoryItem::query()
                        ->where('product_id', $product->id)
                        ->pluck('warehouse_id')
                        ->filter()
                        ->map(fn ($value) => (string) $value)
                        ->values()
                        ->all();

                    if (empty(array_intersect($warehouses, $productWarehouseIds))) {
                        return false;
                    }
                }

                return true;
            });
    }

    private function resolveStorefrontDiscountPricing(Product $product, float $basePrice): array
    {
        $setup = $this->resolveStorefrontDiscountSetup($product);

        if (! $setup || $basePrice <= 0) {
            return [
                'price' => round($basePrice, 2),
                'original_price' => null,
                'discount_percent' => 0,
            ];
        }

        $discountType = $this->normalizeStorefrontDiscountType($setup->discount_type);
        $discountValue = (float) ($setup->amount ?? 0);
        $discountAmount = $discountType === 'percent'
            ? ($basePrice * ($discountValue / 100))
            : $discountValue;
        $discountedPrice = round(max($basePrice - min(max($discountAmount, 0), $basePrice), 0), 2);
        $discountPercent = $basePrice > $discountedPrice
            ? (int) round((($basePrice - $discountedPrice) / $basePrice) * 100)
            : 0;

        return [
            'price' => $discountedPrice,
            'original_price' => round($basePrice, 2),
            'discount_percent' => $discountPercent,
        ];
    }

    private function normalizeStorefrontDiscountType($discountType): string
    {
        $normalizedType = strtolower(trim((string) $discountType));

        return in_array($normalizedType, ['percent', 'percentage'], true) ? 'percent' : 'fixed';
    }

    private function findCategoryBySlug(string $slug, array $columns = ['*']): ?Category
    {
        $normalizedSlug = trim(strtolower($slug));

        if ($normalizedSlug === '') {
            return null;
        }

        $query = $this->storefrontCatalogQuery(Category::class);

        if ($this->storefrontDemoOnly()) {
            $query->where('is_demo', true);
        }

        return $query
            ->where('slug', $normalizedSlug)
            ->first($columns)
            ?? tap($this->storefrontCatalogQuery(Category::class), function ($fallbackQuery) {
                if ($this->storefrontDemoOnly()) {
                    $fallbackQuery->where('is_demo', true);
                }
            })
                ->whereRaw('LOWER(slug) = ?', [$normalizedSlug])
                ->first($columns);
    }

    private function findBrandBySlug(string $slug, array $columns = ['*']): ?Brand
    {
        $normalizedSlug = trim(strtolower($slug));

        if ($normalizedSlug === '') {
            return null;
        }

        $query = $this->storefrontCatalogQuery(Brand::class);

        if ($this->storefrontDemoOnly()) {
            $query->where('is_demo', true);
        }

        return $query
            ->where('slug', $normalizedSlug)
            ->first($columns)
            ?? tap($this->storefrontCatalogQuery(Brand::class), function ($fallbackQuery) {
                if ($this->storefrontDemoOnly()) {
                    $fallbackQuery->where('is_demo', true);
                }
            })
                ->whereRaw('LOWER(slug) = ?', [$normalizedSlug])
                ->first($columns);
    }

    public function submitContact()
    {
        $validated = request()->validate([
            'name' => ['required', 'string', 'max:191'],
            'email' => ['required', 'email', 'max:191'],
            'subject' => ['required', 'string', 'max:191'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        ContactMessage::create($validated);

        return response()->json([
            'status' => true,
            'message' => 'Your message has been sent successfully.',
            'data' => null,
        ]);
    }

    public function subscribeNewsletter()
    {
        $validated = request()->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        if (! Schema::hasTable('newsletters')) {
            return response()->json([
                'status' => false,
                'message' => 'Newsletter subscription is not configured yet.',
                'data' => null,
            ], 422);
        }

        $companyId = $this->warmStorefrontCompanyContext();
        $email = strtolower(trim((string) $validated['email']));
        $hasCompanyColumn = Schema::hasColumn('newsletters', 'company_id');

        $existingNewsletterQuery = Newsletter::query()->where('email', $email);

        if ($hasCompanyColumn) {
            if (filled($companyId)) {
                $existingNewsletterQuery->where('company_id', $companyId);
            } else {
                $existingNewsletterQuery->whereNull('company_id');
            }
        }

        $existingNewsletter = $existingNewsletterQuery->first();

        if ($existingNewsletter) {
            return response()->json([
                'status' => true,
                'message' => 'Newsletter subscribed successfully.',
                'data' => null,
            ]);
        }

        $attributes = ['email' => $email];

        if ($hasCompanyColumn) {
            $attributes['company_id'] = $companyId;
        }

        try {
            Newsletter::query()->create($attributes);
        } catch (QueryException $exception) {
            if ((string) $exception->getCode() !== '23000') {
                throw $exception;
            }
        }

        return response()->json([
            'status' => true,
            'message' => 'Newsletter subscribed successfully.',
            'data' => null,
        ]);
    }

    public function landingSettings()
    {
        $payload = Cache::remember($this->storefrontCacheKey('landing-settings'), now()->addMinutes(10), function () {
            $basic = settings('basic');

            $darkLogo = $basic->dark_logo ?? null;
            $whiteLogo = $basic->white_logo ?? null;
            $icon = $basic->icon ?? null;
            $baseColor = (string) ($basic->base_color ?? '');
            if (! preg_match('/^#[0-9A-Fa-f]{6}$/', $baseColor)) {
                $baseColor = '#5423E7';
            }

            return [
                'dark_logo' => $darkLogo,
                'white_logo' => $whiteLogo,
                'icon' => $icon,
                'base_color' => $baseColor,
                'brand_label' => (string) ($basic->sitename ?? 'e-Nex'),
                'copyright' => (string) ($basic->copyright ?? ''),
                'dark_logo_url' => $darkLogo ? get_file($darkLogo, Path::LOGO_PATH) : null,
                'white_logo_url' => $whiteLogo ? get_file($whiteLogo, Path::LOGO_PATH) : null,
                'icon_url' => $icon ? get_file($icon, Path::LOGO_PATH) : null,
            ];
        });

        return response()->json([
            'status' => true,
            'message' => 'Landing settings fetched successfully.',
            'data' => $payload,
        ]);
    }

    public function publicSetting(string $key)
    {
        if (! in_array($key, self::PUBLIC_SETTING_KEYS, true)) {
            return response()->json([
                'status' => false,
                'message' => 'Invalid settings section.',
                'data' => null,
            ], 404);
        }

        if ($key === 'cron') {
            $appUrl = rtrim(config('app.url') ?? url('/'), '/');

            return response()->json([
                'status' => true,
                'message' => 'Settings fetched successfully.',
                'data' => [
                    'cron_event' => "curl -s {$appUrl}/event-expired",
                    'cron_queue' => "curl -s {$appUrl}/cron/run-queue",
                ],
            ]);
        }

        $data = Cache::remember($this->storefrontCacheKey('public-setting:'.$key), now()->addMinutes(10), function () use ($key) {
            $record = Setting::query()->where('key', $key)->first();
            $data = $this->decodeSettingValue($record?->getRawOriginal('value'));
            $data = $this->appendSettingImageUrls($key, $data);
            $data = $this->sanitizePublicSettingData($data);

            return $key === 'kyc' ? array_values($data) : $data;
        });

        return response()->json([
            'status' => true,
            'message' => 'Settings fetched successfully.',
            'data' => $data,
        ]);
    }

    function landingPreferences(){
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest(request())
            ?? $this->warmStorefrontCompanyContext();

        if (blank($companyId)) {
            return response()->json([
                'status' => false,
                'message' => 'Company not found.',
                'data' => null,
            ], 404);
        }

        $payload = Cache::remember($this->storefrontCacheKey('landing-preferences', $companyId), now()->addMinutes(5), function () use ($companyId) {
            $company = Company::query()->find($companyId);

            if (! $company) {
                return null;
            }

            return [
                'company_id' => $company->company_id,
                'name' => $company->name,
                'email' => $company->email,
                'phone_number' => $company->phone_number,
                'website_url' => $company->website_url,
                'domain' => $company->domain,
                'chat_support_channel' => $company->chat_support_channel,
                'facebook_page_id' => $company->facebook_page_id,
                'whatsapp_number' => $company->whatsapp_number,
                'gtm_id' => $company->gtm_id,
                'facebook_pixel_id' => $company->facebook_pixel_id,
                'facebook_pixel_access_token' => $company->facebook_pixel_access_token,
                'facebook_test_event_id' => $company->facebook_test_event_id,
                'tiktok_pixel_id' => $company->tiktok_pixel_id,
                'tiktok_pixel_access_token' => $company->tiktok_pixel_access_token,
                'tiktok_test_event_code' => $company->tiktok_test_event_code,
                'site_logo' => $company->website_logo ? ImageService::url($company->website_logo, 'settings') : null,
                'site_favicon' => $company->site_favicon ? ImageService::url($company->site_favicon, 'settings') : null,
                'website_logo' => $company->website_logo,
                'site_favicon_path' => $company->site_favicon,
                'facebook_link' => $company->facebook_link,
                'twitter_link' => $company->twitter_link,
                'linkedin_link' => $company->linkedin_link,
                'instagram_link' => $company->instagram_link,
                'youtube_link' => $company->youtube_link,
                'push_status' => (bool) ($company->push_status ?? false),
                'pusher_app_key' => $company->pusher_app_key,
                'pusher_app_cluster' => $company->pusher_app_cluster,
                'social_auth_enabled' => (bool) ($company->social_auth_enabled ?? false),
                'social_auth_available' => app(CompanyPlanFeatureService::class)->isFeatureAllowedByPlan(
                    $company->company_id,
                    FeaturePreference::SOCIAL_AUTH->value
                ) && (bool) ($company->social_auth_enabled ?? false),
            ];
        });

        if (! $payload) {
            return response()->json([
                'status' => false,
                'message' => 'Company not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'status' => true,
            'message' => 'Company preferences fetched successfully.',
            'data' => $payload
        ]);
    }

    public function landingSocialAuth()
    {
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest(request())
            ?? $this->warmStorefrontCompanyContext();

        if (blank($companyId)) {
            return response()->json([
                'status' => false,
                'message' => 'Company not found.',
                'data' => null,
            ], 404);
        }

        $payload = Cache::remember($this->storefrontCacheKey('landing-social-auth', $companyId), now()->addMinutes(5), function () use ($companyId) {
            $company = Company::query()
                ->with('saasPlan:id,features,status')
                ->find($companyId);

            if (! $company) {
                return null;
            }

            $planAllowed = app(CompanyPlanFeatureService::class)->isFeatureAllowedByPlan(
                $company->company_id,
                FeaturePreference::SOCIAL_AUTH->value
            );

            return [
                'company_id' => $company->company_id,
                'social_auth_enabled' => (bool) ($company->social_auth_enabled ?? false),
                'social_auth_available' => $planAllowed && (bool) ($company->social_auth_enabled ?? false),
            ];
        });

        if (! $payload) {
            return response()->json([
                'status' => false,
                'message' => 'Company not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'status' => true,
            'message' => 'Social auth settings fetched successfully.',
            'data' => $payload,
        ]);
    }

    public function landingCurrencies()
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();
        $currencies = Cache::remember($this->storefrontCacheKey('landing-currencies-v3', $companyId), now()->addMinutes(10), function () use ($companyId) {
            $basic = settings('basic');
            $companyCurrency = $companyId
                ? Company::query()->with('currency:id,code')->find($companyId)?->currency
                : null;
            $defaultCode = strtoupper((string) ($companyCurrency?->code ?? $basic->currency ?? 'USD'));
            $precision = max(0, min(6, (int) ($basic->precision ?? 2)));
            $currencyFormat = in_array(($basic->currency_format ?? 'left'), ['left', 'right', 'both'], true)
                ? $basic->currency_format
                : 'left';

            return Currency::query()
                ->where('is_active', 1)
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'symbol', 'exchange_rate'])
                ->map(function (Currency $currency) use ($defaultCode, $precision, $currencyFormat) {
                    $code = strtoupper((string) $currency->code);
                    $symbol = trim((string) ($currency->symbol ?? ''));

                    return [
                        'id' => (int) $currency->id,
                        'name' => (string) $currency->name,
                        'code' => $code,
                        'symbol' => $symbol,
                        'exchange_rate' => (float) $currency->exchange_rate,
                        'precision' => $precision,
                        'currency_format' => $currencyFormat,
                        'label' => $symbol !== '' ? "{$code} ({$symbol})" : $code,
                        'is_default' => $code === $defaultCode,
                    ];
                })
                ->values();
        });

        return response()->json([
            'status' => true,
            'message' => 'Currencies fetched successfully.',
            'data' => $currencies,
        ]);
    }

    public function landingMenu()
    {
        $items = MenuItem::query()
            ->with([
                'page:id,name,slug,seo_description,status',
                'childrenRecursive.page:id,name,slug,seo_description,status',
            ])
            ->whereNull('parent_id')
            ->orderBy('order')
            ->get();

        return response()->json([
            'status' => true,
            'message' => 'Landing menu fetched successfully.',
            'data' => $items->map(fn (MenuItem $item) => $this->formatMenuItem($item))->values(),
        ]);
    }

    public function landingMegaCategories()
    {
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest(request())
            ?? $this->warmStorefrontCompanyContext();
        $data = Cache::remember(
            $this->storefrontCacheKey('landing-mega-categories:v2' . ($this->storefrontDemoOnly() ? ':demo' : ':live'), $companyId),
            now()->addMinutes(10),
            function () use ($companyId) {
            $baseQuery = Category::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('status', 1)
                ->whereNull('ancestor_id')
                ->with([
                    'children' => function ($query) use ($companyId) {
                        $query
                            ->when($companyId, fn ($childQuery) => $childQuery->where('company_id', $companyId))
                            ->where('status', 1)
                            ->select(['id', 'title', 'slug', 'ancestor_id', 'status', 'is_demo']);

                        if ($this->storefrontDemoOnly()) {
                            $query->where('is_demo', true);
                        }
                    },
                ])
                ->orderBy('title');

            if ($this->storefrontDemoOnly()) {
                $baseQuery->where('is_demo', true);
            }

            $categories = (clone $baseQuery)
                ->where('is_show_in_category_header', true)
                ->get();

            if ($categories->isEmpty()) {
                $categories = $baseQuery->get();
            }

            $categoryIdsByRoot = $categories->mapWithKeys(function (Category $category) {
                return [
                    $category->id => collect([$category->id])
                        ->merge(
                            $category->children
                                ->where('status', 1)
                                ->pluck('id')
                        )
                        ->filter()
                        ->values(),
                ];
            });

            $allCategoryIds = $categoryIdsByRoot
                ->flatten()
                ->unique()
                ->values();

            $productsByCategory = Product::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('status', 1)
                ->whereIn('category_id', $allCategoryIds)
                ->orderByDesc('created_at')
                ->get(['id', 'name', 'slug', 'thumbnail', 'category_id', 'created_at', 'is_demo'])
                ->groupBy('category_id');

            if ($this->storefrontDemoOnly()) {
                $productsByCategory = $productsByCategory->map(fn ($items) => $items->filter(fn (Product $product) => (bool) ($product->is_demo ?? false)));
            }

            return $categories->map(function (Category $category) use ($categoryIdsByRoot, $productsByCategory) {
                $categoryIds = $categoryIdsByRoot->get($category->id, collect());

                $products = $categoryIds
                    ->flatMap(fn ($categoryId) => $productsByCategory->get($categoryId, collect()))
                    ->sortByDesc('created_at')
                    ->take(5)
                    ->values()
                    ->map(function (Product $product) {
                        return [
                            'id' => (string) $product->id,
                            'name' => (string) $product->name,
                            'image' => $this->resolveProductImage($product->thumbnail),
                            'link' => '/product/' . $product->slug,
                        ];
                    })
                    ->values();

                return [
                    'id' => (string) $category->id,
                    'label' => (string) $category->title,
                    'slug' => (string) $category->slug,
                    'icon' => $this->resolveCategoryImage($category->image),
                    'products' => $products,
                ];
            })->values();
        });

        return response()->json([
            'status' => true,
            'message' => 'Mega menu categories fetched successfully.',
            'data' => $data,
        ]);
    }

    public function landingCategories()
    {
        $demoOnly = $this->storefrontDemoOnly();
        $companyId = $demoOnly
            ? null
            : (EcommerceCompanyContext::resolveCompanyIdForRequest(request())
                ?? $this->warmStorefrontCompanyContext());
        $payload = Cache::remember(
            $this->storefrontCacheKey('landing-categories:' . ($demoOnly ? 'v5:demo' : 'v2:live'), $companyId),
            now()->addMinutes(10),
            function () use ($companyId, $demoOnly) {
            $categories = $this->storefrontCatalogQuery(Category::class)
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('status', 1)
                ->whereNull('ancestor_id')
                ->with([
                    'children' => function ($query) use ($companyId) {
                        if ($this->storefrontDemoOnly()) {
                            $query->withoutGlobalScope('company');
                        }

                        $query
                            ->when($companyId, fn ($childQuery) => $childQuery->where('company_id', $companyId))
                            ->where('status', 1)
                            ->orderBy('title')
                            ->withCount([
                                'products as products_count' => function ($productQuery) {
                                    if ($this->storefrontDemoOnly()) {
                                        $productQuery->withoutGlobalScope('company');
                                        $productQuery->where('is_demo', true);
                                    }
                                },
                            ])
                            ->select(['id', 'title', 'slug', 'image', 'ancestor_id', 'status', 'is_demo']);
                    },
                ])
                ->withCount([
                    'products as products_count' => function ($productQuery) {
                        if ($this->storefrontDemoOnly()) {
                            $productQuery->withoutGlobalScope('company');
                            $productQuery->where('is_demo', true);
                        }
                    },
                ])
                ->orderBy('title')
                ->when($demoOnly, function ($query) {
                    $query->where('is_demo', true);
                })
                ->get()
                ->map(function (Category $category) use ($demoOnly) {
                    $children = $category->children
                        ->map(function (Category $child) use ($demoOnly) {
                            return [
                                'id' => (string) $child->id,
                                'name' => (string) $child->title,
                                'slug' => (string) $child->slug,
                                'image' => $this->landingCategoryImage($child, $demoOnly),
                                'products_count' => (int) $child->products_count,
                            ];
                        })
                        ->values()
                        ->all();

                    return [
                        'id' => (string) $category->id,
                        'name' => (string) $category->title,
                        'slug' => (string) $category->slug,
                        'image' => $this->landingCategoryImage($category, $demoOnly),
                        'products_count' => (int) $category->products_count,
                        'children_count' => count($children),
                        'children' => $children,
                    ];
                })
                ->values()
                ->all();

            return [
                'heading' => 'All Categories',
                'subheading' => 'Browse every storefront category in one place and discover what the marketplace is stocked with right now.',
                'categories' => $categories,
                'stats' => [
                    'categories_count' => count($categories),
                    'subcategories_count' => collect($categories)->sum('children_count'),
                    'products_count' => collect($categories)->sum(function (array $category) {
                        return (int) $category['products_count'] + collect($category['children'])->sum('products_count');
                    }),
                ],
            ];
        });

        return response()->json([
            'status' => true,
            'message' => 'Categories fetched successfully.',
            'data' => $payload,
        ]);
    }

    public function landingCategoryDetails(string $slug)
    {
        $normalizedSlug = strtolower(trim($slug));
        $page = max((int) request()->query('page', 1), 1);
        $perPage = (int) request()->query('perPage', 12);
        $perPage = $perPage > 0 ? min($perPage, 24) : 12;
        $companyId = EcommerceCompanyContext::currentCompanyId() ?? 'global';
        $cacheKey = sprintf(
            'storefront:category:%s:%s:%s:page:%d:per-page:%d',
            $companyId,
            $this->storefrontDemoOnly() ? 'demo' : 'live',
            $normalizedSlug,
            $page,
            $perPage
        );

        $payload = Cache::remember($cacheKey, now()->addSeconds(60), function () use ($normalizedSlug, $perPage, $page) {
            $category = $this->findCategoryBySlug($normalizedSlug, ['id', 'title', 'slug', 'image', 'ancestor_id', 'status']);

            if (! $category || (int) $category->status !== 1) {
                return null;
            }

            $category->load([
                'parent:id,title,slug',
                'children' => function ($query) {
                    $query
                        ->select(['id', 'title', 'slug', 'image', 'ancestor_id', 'status'])
                        ->where('status', 1)
                        ->orderBy('title')
                        ->withCount([
                            'products as products_count' => function ($productQuery) {
                                if ($this->storefrontDemoOnly()) {
                                    $productQuery->where('is_demo', true);
                                }
                            },
                        ]);

                    if ($this->storefrontDemoOnly()) {
                        $query->where('is_demo', true);
                    }
                },
            ]);
            $category->loadCount([
                'products as products_count' => function ($productQuery) {
                    if ($this->storefrontDemoOnly()) {
                        $productQuery->where('is_demo', true);
                    }
                },
            ]);

            $categoryIds = collect([$category->id])
                ->merge($category->children->pluck('id'))
                ->filter()
                ->values();

            $productQuery = Product::query()
                ->where('status', 1)
                ->where('is_bundle', false)
                ->whereIn('category_id', $categoryIds)
                ->with(['category:id,title,slug', 'brand:id,title'])
                ->latest('created_at');

            if ($this->storefrontDemoOnly()) {
                $productQuery->where('is_demo', true);
            }

            $paginatedProducts = $productQuery->paginate($perPage, ['*'], 'page', $page);
            $productIds = $paginatedProducts->getCollection()->pluck('id')->filter()->values();

              $inventoryByProduct = InventoryItem::query()
                  ->select(['id', 'product_id', 'price', 'quantity', 'created_at'])
                  ->whereIn('product_id', $productIds)
                  ->orderByDesc('created_at')
                  ->get()
                  ->groupBy('product_id');

            $reviewsByProduct = ProductReview::query()
                ->withoutGlobalScope('company')
                ->selectRaw('product_id, COUNT(*) as reviews_count, AVG(rating) as average_rating')
                ->whereIn('product_id', $productIds)
                ->groupBy('product_id')
                ->get()
                ->keyBy('product_id');

            $products = $paginatedProducts->getCollection()
                  ->map(function (Product $product) use ($inventoryByProduct, $reviewsByProduct) {
                      $inventoryItems = collect($inventoryByProduct->get($product->id, collect()));
                      $reviews = $reviewsByProduct->get($product->id);
                      $latestInStockPrice = optional($inventoryItems->firstWhere('quantity', '>', 0))->price;
                      $latestKnownPrice = optional($inventoryItems->first())->price;
                      $basePrice = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
                      $pricing = $this->resolveStorefrontDiscountPricing($product, $basePrice);
                      $totalQuantity = (float) $inventoryItems->sum('quantity');
                      $reviewsCount = (int) ($reviews?->reviews_count ?? 0);
                      $averageRating = $reviewsCount > 0 ? round((float) ($reviews?->average_rating ?? 0), 1) : null;

                    return [
                        'id' => (string) $product->id,
                        'name' => (string) $product->name,
                        'slug' => (string) $product->slug,
                        'thumbnail' => $this->resolveProductImage($product->thumbnail),
                        'price' => (float) $pricing['price'],
                        'original_price' => $pricing['original_price'],
                        'discount_percent' => (int) $pricing['discount_percent'],
                        'quantity' => $this->resolveOnlineStoreQuantity($product, $totalQuantity),
                        'brand' => (string) ($product->brand?->title ?? ''),
                        'rating' => $averageRating,
                        'reviews' => $reviewsCount,
                        'category' => $product->category ? [
                            'name' => (string) $product->category->title,
                            'slug' => (string) $product->category->slug,
                        ] : null,
                        'url' => '/product/' . $product->slug,
                    ];
                })
                ->values()
                ->all();

            return [
                'category' => [
                    'id' => (string) $category->id,
                    'name' => (string) $category->title,
                    'slug' => (string) $category->slug,
                    'image' => $this->resolveCategoryImage($category->image),
                    'products_count' => (int) $category->products_count,
                    'parent' => $category->parent ? [
                        'name' => (string) $category->parent->title,
                        'slug' => (string) $category->parent->slug,
                    ] : null,
                ],
                'subcategories' => $category->children->map(function (Category $child) {
                    return [
                        'id' => (string) $child->id,
                        'name' => (string) $child->title,
                        'slug' => (string) $child->slug,
                        'image' => $this->resolveCategoryImage($child->image),
                        'products_count' => (int) $child->products_count,
                    ];
                })->when($this->storefrontDemoOnly(), function ($children) {
                    return $children->filter(fn (Category $child) => (bool) ($child->is_demo ?? false));
                })->values()->all(),
                'products' => $products,
                'products_meta' => [
                    'current_page' => $paginatedProducts->currentPage(),
                    'last_page' => $paginatedProducts->lastPage(),
                    'per_page' => $paginatedProducts->perPage(),
                    'total' => $paginatedProducts->total(),
                    'has_more' => $paginatedProducts->hasMorePages(),
                ],
            ];
        });

        if (! $payload) {
            return response()->json([
                'status' => false,
                'message' => 'Category not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'status' => true,
            'message' => 'Category details fetched successfully.',
            'data' => $payload,
        ]);
    }

    public function landingProducts()
    {
        $request = request();
        $demoOnly = $this->storefrontDemoOnly();
        $companyId = $demoOnly
            ? null
            : (EcommerceCompanyContext::resolveCompanyIdForRequest($request)
                ?? $this->warmStorefrontCompanyContext());
        $search = trim((string) request()->query('q', ''));
        // Section-builder filters use *_id/min_price/max_price/in_stock/sort_by
        // names, while the public products page historically used the shorter
        // aliases. Accept both so section config can drive this endpoint.
        $categorySlug = trim((string) request()->query('category', request()->query('category_id', '')));
        $brandSlug = trim((string) request()->query('brand', request()->query('brand_id', '')));
        $rawDemandTag = request()->query('demand_tag', '');
        $demandTags = is_array($rawDemandTag)
            ? $rawDemandTag
            : (preg_split('/\s*,\s*/', (string) $rawDemandTag) ?: []);
        $demandTags = collect($demandTags)
            ->flatten()
            ->filter(fn ($tag) => is_scalar($tag))
            ->map(fn ($tag) => trim((string) $tag))
            ->filter()
            ->unique()
            ->values()
            ->all();
        $stock = trim((string) request()->query('stock', request()->query('in_stock', 'all')));
        $sort = trim((string) request()->query('sort', request()->query('sort_by', 'newest')));
        $minPrice = request()->query('minPrice', request()->query('min_price'));
        $maxPrice = request()->query('maxPrice', request()->query('max_price'));
        $perPage = (int) request()->query('perPage', 12);
        $perPage = $perPage > 0 ? min($perPage, 24) : 12;

        $categoryMap = $this->storefrontCatalogQuery(Category::class)
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('status', 1)
            ->orderBy('title')
            ->get(['id', 'title', 'slug', 'is_demo'])
            ->keyBy('id');

        if ($this->storefrontDemoOnly()) {
            $categoryMap = $categoryMap->filter(fn (Category $category) => (bool) ($category->is_demo ?? false));
        }

          $productsQuery = $this->storefrontCatalogQuery(Product::class)
              ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
              ->where('status', 1)
              ->where('is_bundle', false)
              ->withMax('inventory_items as latest_price', 'price')
              ->withSum('inventory_items as total_quantity', 'quantity')
              ->withCount('reviews')
              ->withAvg('reviews', 'rating')
              ->with([
                  'category' => function ($query) {
                      if ($this->storefrontDemoOnly()) {
                          $query->withoutGlobalScope('company');
                      }

                      $query->select(['id', 'title', 'slug']);
                  },
                  'brand' => function ($query) {
                      if ($this->storefrontDemoOnly()) {
                          $query->withoutGlobalScope('company');
                      }

                      $query->select(['id', 'title', 'slug']);
                  },
                  'inventory_items' => function ($query) {
                      $query->with(['salesChannels:id,inventory_id,channel_code,quantity'])
                          ->select('id', 'inventory_id', 'product_id', 'price', 'quantity', 'created_at')
                          ->orderByDesc('created_at');
                  },
              ]);

        if ($this->storefrontDemoOnly()) {
            $productsQuery->where('is_demo', true);
        }

        if ($search !== '') {
            $productsQuery->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($categorySlug !== '') {
            $matchedCategory = is_numeric($categorySlug)
                ? $this->storefrontCatalogQuery(Category::class)
                    ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                    ->whereKey((int) $categorySlug)
                    ->first(['id', 'status'])
                : $this->findCategoryBySlug($categorySlug, ['id', 'status']);

            if ($matchedCategory && (int) $matchedCategory->status === 1) {
                $categoryIds = collect([$matchedCategory->id])
                    ->merge(
                        $this->storefrontCatalogQuery(Category::class)
                            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                            ->where('ancestor_id', $matchedCategory->id)
                            ->where('status', 1)
                            ->when($this->storefrontDemoOnly(), fn ($query) => $query->where('is_demo', true))
                            ->pluck('id')
                    )
                    ->filter()
                    ->values()
                    ->all();

                $productsQuery->whereIn('category_id', $categoryIds);
            } else {
                $productsQuery->whereRaw('1 = 0');
            }
        }

        if ($brandSlug !== '') {
            $matchedBrand = is_numeric($brandSlug)
                ? $this->storefrontCatalogQuery(Brand::class)
                    ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                    ->whereKey((int) $brandSlug)
                    ->first(['id'])
                : $this->findBrandBySlug($brandSlug, ['id']);

            if ($matchedBrand) {
                $productsQuery->where('brand_id', $matchedBrand->id);
            } else {
                $productsQuery->whereRaw('1 = 0');
            }
        }

        if (! empty($demandTags)) {
            $productsQuery->where(function ($query) use ($demandTags) {
                foreach ($demandTags as $demandTag) {
                    $query->orWhereJsonContains('demand_tags', $demandTag);
                }
            });
        }

        if (is_numeric($minPrice)) {
            $productsQuery->whereHas('inventory_items', function ($query) use ($minPrice) {
                $query->where('price', '>=', (float) $minPrice);
            });
        }

        if (is_numeric($maxPrice)) {
            $productsQuery->whereHas('inventory_items', function ($query) use ($maxPrice) {
                $query->where('price', '<=', (float) $maxPrice);
            });
        }

        if ($stock === 'in-stock') {
            $productsQuery->whereHas('inventory_items', function ($query) {
                $query->where('quantity', '>', 0);
            });
        }

        if ($stock === 'out-of-stock') {
            $productsQuery->whereDoesntHave('inventory_items', function ($query) {
                $query->where('quantity', '>', 0);
            });
        }

        if ($demoOnly && $sort === 'newest' && $search === '' && $categorySlug === '' && $brandSlug === ''
            && $demandTags === [] && $stock === 'all' && ! is_numeric($minPrice) && ! is_numeric($maxPrice)) {
            $demoSlugs = StorefrontDemoProductImages::slugs();
            $positions = implode(' ', array_map(fn (int $index): string => "WHEN ? THEN {$index}", array_keys($demoSlugs)));
            $productsQuery->orderByRaw('CASE slug ' . $positions . ' ELSE ' . count($demoSlugs) . ' END', $demoSlugs);
        }

        match ($sort) {
            'price-low-high' => $productsQuery->orderBy('latest_price')->orderByDesc('created_at'),
            'price-high-low' => $productsQuery->orderByDesc('latest_price')->orderByDesc('created_at'),
            'name-a-z' => $productsQuery->orderBy('name'),
            'name-z-a' => $productsQuery->orderByDesc('name'),
            default => $productsQuery->latest('created_at'),
        };

        $paginatedProducts = $productsQuery->paginate($perPage);

          $products = $paginatedProducts->getCollection()
              ->map(function (Product $product) use ($demoOnly) {
                  $latestInStockPrice = optional($product->inventory_items->firstWhere('quantity', '>', 0))->price;
                  $latestKnownPrice = optional($product->inventory_items->first())->price;
                  $basePrice = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
                  $pricing = $this->resolveStorefrontDiscountPricing($product, $basePrice);
                  $totalQuantity = (float) $product->inventory_items->sum('quantity');
                  $quantity = $this->resolveOnlineStoreQuantity($product, $totalQuantity);
                  $reviewsCount = (int) ($product->reviews_count ?? 0);
                  $averageRating = $reviewsCount > 0 ? round((float) ($product->reviews_avg_rating ?? 0), 1) : null;

                return [
                    'id' => (string) $product->id,
                    'name' => (string) $product->name,
                    'slug' => (string) $product->slug,
                    'thumbnail' => $demoOnly
                        ? StorefrontDemoProductImages::thumbnailForSlug($product->slug)
                        : $this->resolveProductImage($product->thumbnail),
                    'price' => (float) $pricing['price'],
                    'original_price' => $pricing['original_price'],
                    'discount_percent' => (int) $pricing['discount_percent'],
                    'quantity' => $quantity,
                    'brand' => (string) ($product->brand?->title ?? ''),
                    'brand_slug' => (string) ($product->brand?->slug ?? ''),
                    'rating' => $averageRating,
                    'reviews' => $reviewsCount,
                    'category' => $product->category ? [
                        'name' => (string) $product->category->title,
                        'slug' => (string) $product->category->slug,
                    ] : null,
                    'url' => '/product/'.$product->slug,
                    'created_at' => optional($product->created_at)->toIso8601String(),
                ];
            })
            ->values()
            ->all();

        $visibleCategories = $categoryMap
            ->only(
                $this->storefrontCatalogQuery(Product::class)
                    ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                    ->where('status', 1)
                    ->where('is_bundle', false)
                    ->whereNotNull('category_id')
                    ->when($this->storefrontDemoOnly(), fn ($query) => $query->where('is_demo', true))
                    ->distinct()
                    ->pluck('category_id')
                    ->all()
            )
            ->values()
            ->map(fn (Category $category) => [
                'id' => (string) $category->id,
                'name' => (string) $category->title,
                'slug' => (string) $category->slug,
            ])
            ->all();

        $visibleBrandIds = $this->storefrontCatalogQuery(Product::class)
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('status', 1)
            ->where('is_bundle', false)
            ->whereNotNull('brand_id')
            ->when($this->storefrontDemoOnly(), fn ($query) => $query->where('is_demo', true))
            ->distinct()
            ->pluck('brand_id');

        $visibleBrands = $this->storefrontCatalogQuery(Brand::class)
            ->whereIn('id', $visibleBrandIds)
            ->orderBy('title')
            ->get(['id', 'title', 'slug'])
            ->map(fn (Brand $brand) => [
                'id' => (string) $brand->id,
                'name' => (string) $brand->title,
                'slug' => (string) $brand->slug,
            ])->values()
            ->all();
        $demandTagOptions = $this->demandTagOptionsForCompany($companyId);

        return response()->json([
            'status' => true,
            'message' => 'Products fetched successfully.',
            'data' => [
                'heading' => 'All Products',
                'subheading' => 'Browse the full catalog with search, category, brand, stock, and price filters.',
                'products' => $products,
                'products_meta' => [
                    'current_page' => (int) $paginatedProducts->currentPage(),
                    'last_page' => (int) $paginatedProducts->lastPage(),
                    'per_page' => (int) $paginatedProducts->perPage(),
                    'total' => (int) $paginatedProducts->total(),
                    'has_more' => (bool) $paginatedProducts->hasMorePages(),
                ],
                'filters' => [
                    'categories' => $visibleCategories,
                    'brands' => $visibleBrands,
                    'demand_tags' => $demandTagOptions,
                    'selected' => [
                        'q' => $search,
                        'category' => $categorySlug,
                        'brand' => $brandSlug,
                        'demand_tag' => implode(',', $demandTags),
                        'stock' => $stock,
                        'sort' => $sort,
                        'min_price' => is_numeric($minPrice) ? (float) $minPrice : null,
                        'max_price' => is_numeric($maxPrice) ? (float) $maxPrice : null,
                    ],
                ],
                'stats' => [
                    'products_count' => (int) $paginatedProducts->total(),
                    'categories_count' => count($visibleCategories),
                    'brands_count' => count($visibleBrands),
                ],
            ],
        ]);
    }

    public function landingBrands()
    {
        $request = request();
        $companyId = $this->storefrontDemoOnly()
            ? null
            : (EcommerceCompanyContext::resolveCompanyIdForRequest($request)
                ?? $this->warmStorefrontCompanyContext());
        $search = trim((string) $request->query('q', ''));
        $limit = (int) $request->query('limit', 24);
        $limit = $limit > 0 ? min($limit, 60) : 24;

        $visibleBrandIds = $this->storefrontCatalogQuery(Product::class)
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('status', 1)
            ->where('is_bundle', false)
            ->whereNotNull('brand_id')
            ->distinct()
            ->pluck('brand_id')
            ->filter()
            ->values();

        $brandsQuery = $this->storefrontCatalogQuery(Brand::class)
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('status', 1)
            ->whereIn('id', $visibleBrandIds)
            ->withCount([
                'products as products_count' => function ($query) use ($companyId) {
                    if ($this->storefrontDemoOnly()) {
                        $query->withoutGlobalScope('company');
                    }

                    $query
                        ->when($companyId, fn ($nested) => $nested->where('company_id', $companyId))
                        ->where('status', 1)
                        ->where('is_bundle', false);
                    if ($this->storefrontDemoOnly()) {
                        $query->where('is_demo', true);
                    }
                },
            ]);

        if ($this->storefrontDemoOnly()) {
            $brandsQuery->where('is_demo', true);
        }

        if ($search !== '') {
            $brandsQuery->where(function ($query) use ($search) {
                $query
                    ->where('title', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $brands = $brandsQuery
            ->orderByDesc('products_count')
            ->orderBy('title')
            ->limit($limit)
            ->get(['id', 'title', 'slug', 'image'])
            ->map(function (Brand $brand) {
                return [
                    'id' => (string) $brand->id,
                    'name' => (string) $brand->title,
                    'slug' => (string) $brand->slug,
                    'image' => $brand->image ?: asset('images/placeholder.jpg'),
                    'products_count' => (int) ($brand->products_count ?? 0),
                    'url' => '/products?brand='.(string) $brand->slug,
                ];
            })
            ->values();

        return response()->json([
            'status' => true,
            'message' => 'Brands fetched successfully.',
            'data' => [
                'heading' => 'Popular Brands',
                'subheading' => 'Trusted names, standout identities, and products people keep coming back for.',
                'brands' => $brands,
                'stats' => [
                    'brands_count' => (int) $brands->count(),
                    'products_count' => (int) $brands->sum('products_count'),
                ],
            ],
        ]);
    }

    public function landingHero()
    {
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest(request())
            ?? $this->warmStorefrontCompanyContext();
        $payload = Cache::remember($this->storefrontCacheKey('landing-hero', $companyId), now()->addMinutes(10), function () use ($companyId) {
            $section = Section::query()
                ->when(
                    $companyId && Schema::hasColumn((new Section())->getTable(), 'company_id'),
                    fn ($query) => $query->where('company_id', $companyId)
                )
                ->where('name', 'hero')
                ->first();
            $content = is_array($section?->content) ? $section->content : [];

            $heroImage = $content['hero-img'] ?? null;
            $heroBg = $content['hero-bg-1'] ?? null;

            return [
                'name' => 'hero',
                'heading' => (string) ($content['heading'] ?? ''),
                'sub_heading' => (string) ($content['sub_heading'] ?? ''),
                'hero_text' => (string) ($content['hero_text'] ?? ($content['subheading'] ?? '')),
                'hero_tag1' => (string) ($content['hero_tag1'] ?? ''),
                'hero_tag2' => (string) ($content['hero_tag2'] ?? ''),
                'button_text_1' => (string) ($content['button_text_1'] ?? 'Get Started'),
                'button_link_1' => $this->resolveButtonLink($content['button_link_1'] ?? '#'),
                'hero_image' => $heroImage,
                'hero_image_url' => $heroImage ? get_file($heroImage, Path::CMS_IMAGE_PATH) : null,
                'hero_bg_image' => $heroBg,
                'hero_bg_image_url' => $heroBg ? get_file($heroBg, Path::CMS_IMAGE_PATH) : null,
            ];
        });

        return response()->json([
            'status' => true,
            'message' => 'Hero section fetched successfully.',
            'data' => $payload,
        ]);
    }

    public function landingFeaturedProducts()
    {
        $items = Product::query()
            ->where('status', 1)
            ->where('is_bundle', false)
            ->where('is_featured', true)
            ->when($this->storefrontDemoOnly(), fn ($query) => $query->where('is_demo', true))
            ->with(['brand:id,title'])
            ->latest('created_at')
            ->take(6)
            ->get()
            ->map(function (Product $product) {
                $featuredImage = $product->featured_image
                    ? $this->resolveProductImage($product->featured_image)
                    : $this->resolveProductImage($product->thumbnail);

                return [
                    'id' => (string) $product->id,
                    'name' => (string) $product->name,
                    'slug' => (string) $product->slug,
                    'image' => $featuredImage,
                    'featured_image' => $featuredImage,
                    'brand' => (string) ($product->brand?->title ?? ''),
                    'url' => '/product/'.$product->slug,
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'status' => true,
            'message' => 'Featured products fetched successfully.',
            'data' => $items,
        ]);
    }

    public function landingHotCategories()
    {
        $this->warmStorefrontCompanyContext();

        $section = Section::query()
            ->whereIn('name', ['hot_categories', 'hot-categories'])
            ->first();
        $content = is_array($section?->content) ? $section->content : [];
        $limit = (int) request()->query('limit', 12);
        $limit = $limit > 0 ? min($limit, 24) : 12;

        $baseQuery = Category::query()
            ->where('status', 1)
            ->whereNull('ancestor_id')
            ->orderBy('title')
            ->limit($limit);

        if ($this->storefrontDemoOnly()) {
            $baseQuery->where('is_demo', true);
        }

        $categories = (clone $baseQuery)
            ->where('is_show_in_category_header', true)
            ->get(['id', 'title', 'slug', 'image'])
            ->map(function (Category $category) {
                return [
                    'id' => (string) $category->id,
                    'name' => (string) $category->title,
                    'slug' => (string) $category->slug,
                    'image' => $this->resolveCategoryImage($category->image),
                ];
            })
            ->values()
            ->all();

        if (empty($categories)) {
            $categories = $baseQuery
                ->get(['id', 'title', 'slug', 'image'])
                ->map(function (Category $category) {
                    return [
                        'id' => (string) $category->id,
                        'name' => (string) $category->title,
                        'slug' => (string) $category->slug,
                        'image' => $this->resolveCategoryImage($category->image),
                    ];
                })
                ->values()
                ->all();
        }

        return response()->json([
            'status' => true,
            'message' => 'Hot categories section fetched successfully.',
            'data' => [
                'name' => 'hot_categories',
                'heading' => (string) ($content['heading'] ?? 'Hot categories'),
                'subheading' => (string) (
                    $content['subheading']
                    ?? $content['sec_text']
                    ?? 'Categories that catching eyes and winning hearts across our marketplace.'
                ),
                'button_text' => (string) ($content['button_text'] ?? 'All Categories'),
                'button_link' => $this->resolveButtonLink($content['button_link'] ?? '/categories'),
                'categories' => $categories,
            ],
        ]);
    }

    public function landingFlashDeals()
    {
        $request = request();
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest($request)
            ?? $this->warmStorefrontCompanyContext();
        $limit = (int) request()->query('limit', 8);
        $limit = $limit > 0 ? min($limit, 12) : 8;
        $cacheKey = sprintf('storefront:flash-deals:%s:%s:%d', $companyId ?: 'global', $this->storefrontDemoOnly() ? 'demo' : 'live', $limit);

        $payload = Cache::remember($cacheKey, now()->addMinutes(2), function () use ($companyId, $limit) {
            $section = Section::query()
                ->when(
                    $companyId && Schema::hasColumn((new Section())->getTable(), 'company_id'),
                    fn ($query) => $query->where('company_id', $companyId)
                )
                ->whereIn('name', ['flash_deal', 'flash-deal'])
                ->first();
            $content = is_array($section?->content) ? $section->content : [];
            $activeDiscounts = DiscountSetup::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('type', 'discount')
                ->where('is_active', true)
                ->whereDate('form_date', '<=', now()->toDateString())
                ->whereDate('to_date', '>=', now()->toDateString())
                ->orderBy('to_date')
                ->orderByDesc('id')
                ->get()
                ->filter(function (DiscountSetup $discount) {
                    return collect($discount->products ?? [])->filter()->isNotEmpty()
                        || collect($discount->categories ?? [])->filter()->isNotEmpty()
                        || collect($discount->brands ?? [])->filter()->isNotEmpty();
                })
                ->values();

            if ($activeDiscounts->isEmpty()) {
                return [
                    'name' => 'flash_deal',
                    'heading' => (string) ($content['heading'] ?? 'Flash deal'),
                    'subheading' => (string) ($content['subheading'] ?? 'Limited-time picks moving fast across the storefront.'),
                    'button_text' => (string) ($content['button_text'] ?? 'Shop all products'),
                    'button_link' => $this->resolveButtonLink($content['button_link'] ?? '/products'),
                    'ends_at' => null,
                    'products' => [],
                ];
            }

            $productQuery = Product::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('status', 1)
                ->where('is_bundle', false)
                ->withCount('reviews')
                ->withAvg('reviews', 'rating')
                ->with([
                    'category:id,title,slug',
                    'brand:id,title',
                    'inventory_items' => function ($query) {
                        $query->select('id', 'product_id', 'price', 'quantity', 'created_at', 'warehouse_id')
                            ->orderByDesc('created_at');
                    },
                ])
                ->where(function ($query) use ($activeDiscounts) {
                    foreach ($activeDiscounts as $discount) {
                        $products = collect($discount->products ?? [])->filter()->values()->all();
                        $categories = collect($discount->categories ?? [])->filter()->values()->all();
                        $brands = collect($discount->brands ?? [])->filter()->values()->all();

                        $query->orWhere(function ($nested) use ($products, $categories, $brands) {
                            if (!empty($products)) {
                                $nested->whereIn('id', $products);
                                return;
                            }

                            if (!empty($categories)) {
                                $nested->whereIn('category_id', $categories);
                                return;
                            }

                            if (!empty($brands)) {
                                $nested->whereIn('brand_id', $brands);
                            }
                        });
                    }
                })
                ->when($this->storefrontDemoOnly(), fn ($query) => $query->where('is_demo', true))
                ->latest('created_at')
                ->take($limit * 3)
                ->get();

            $matchedProducts = $productQuery
                ->map(function (Product $product) use ($activeDiscounts) {
                      $matchingSetup = $activeDiscounts->first(function (DiscountSetup $discount) use ($product) {
                          $products = collect($discount->products ?? [])->map(fn ($value) => (string) $value)->all();
                          $categories = collect($discount->categories ?? [])->map(fn ($value) => (string) $value)->all();
                          $brands = collect($discount->brands ?? [])->map(fn ($value) => (string) $value)->all();
                          $warehouses = collect($discount->warehouses ?? [])->map(fn ($value) => (string) $value)->filter()->all();

                          if (!empty($warehouses)) {
                              $productWarehouseIds = collect($product->inventory_items ?? [])
                                  ->pluck('warehouse_id')
                                  ->filter()
                                  ->map(fn ($value) => (string) $value)
                                  ->values()
                                  ->all();

                              if (empty(array_intersect($warehouses, $productWarehouseIds))) {
                                  return false;
                              }
                          }

                          if (!empty($products)) {
                              return in_array((string) $product->id, $products, true);
                          }

                        if (!empty($categories)) {
                            return in_array((string) $product->category_id, $categories, true);
                        }

                        if (!empty($brands)) {
                            return !blank($product->brand_id) && in_array((string) $product->brand_id, $brands, true);
                        }

                        return false;
                    });

                    return $matchingSetup ? ['product' => $product, 'discount' => $matchingSetup] : null;
                })
                ->filter()
                ->take($limit)
                ->values();

            $endsAt = $matchedProducts
                ->map(function ($entry) {
                    $toDate = $entry['discount']->to_date ?? null;

                    return $toDate ? \Carbon\Carbon::parse($toDate)->format('Y-m-d') : null;
                })
                ->filter()
                ->map(fn ($date) => "{$date} 23:59:59")
                ->sort()
                ->first();

            $items = $matchedProducts->values()->map(function (array $entry, int $index) {
                /** @var Product $product */
                $product = $entry['product'];
                /** @var DiscountSetup $discount */
                $discount = $entry['discount'];
                $latestInStockPrice = optional($product->inventory_items->firstWhere('quantity', '>', 0))->price;
                $latestKnownPrice = optional($product->inventory_items->first())->price;
                $resolvedPrice = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
                $type = $this->normalizeStorefrontDiscountType($discount->discount_type);
                $discountValue = (float) ($discount->amount ?? 0);
                $discountAmount = $type === 'percent'
                    ? ($resolvedPrice * ($discountValue / 100))
                    : $discountValue;
                $discountedPrice = round(max($resolvedPrice - min(max($discountAmount, 0), $resolvedPrice), 0), 2);
                $originalPrice = $resolvedPrice > 0 ? round($resolvedPrice, 2) : 0;
                $totalQuantity = (float) $product->inventory_items->sum('quantity');
                $reviewsCount = (int) ($product->reviews_count ?? 0);
                $averageRating = $reviewsCount > 0 ? round((float) ($product->reviews_avg_rating ?? 0), 1) : null;
                $discountPercent = $originalPrice > $discountedPrice && $originalPrice > 0
                    ? (int) round((($originalPrice - $discountedPrice) / $originalPrice) * 100)
                    : 0;

                return [
                    'id' => (string) $product->id,
                    'name' => (string) $product->name,
                    'slug' => (string) $product->slug,
                    'brand' => (string) ($product->brand?->title ?? ''),
                    'category' => (string) ($product->category?->title ?? 'Flash Deal'),
                    'price' => $discountedPrice,
                    'original_price' => $originalPrice,
                    'discount_percent' => $discountPercent,
                    'image' => $this->resolveProductImage($product->thumbnail),
                    'badge' => $discountPercent > 0 ? "{$discountPercent}% OFF" : 'Flash Deal',
                    'rating' => $averageRating,
                    'reviews' => $reviewsCount,
                    'quantity' => $this->resolveOnlineStoreQuantity($product, $totalQuantity),
                    'ends_at' => ($discount->to_date ?? null)
                        ? \Carbon\Carbon::parse($discount->to_date)->format('Y-m-d 23:59:59')
                        : null,
                    'url' => '/product/' . $product->slug,
                    'accent' => $index % 2 === 0 ? 'ember' : 'sunrise',
                ];
            })->values()->all();

            return [
                'name' => 'flash_deal',
                'heading' => (string) ($content['heading'] ?? 'Flash deal'),
                'subheading' => (string) ($content['subheading'] ?? 'Limited-time picks moving fast across the storefront.'),
                'button_text' => (string) ($content['button_text'] ?? 'Shop all products'),
                'button_link' => $this->resolveButtonLink($content['button_link'] ?? '/products'),
                'ends_at' => $endsAt ? \Carbon\Carbon::parse($endsAt)->toIso8601String() : null,
                'products' => $items,
            ];
        });

        return response()->json([
            'status' => true,
            'message' => 'Flash deals section fetched successfully.',
            'data' => $payload,
        ]);
    }

    public function landingJustForYou()
    {
        $companyId = $this->warmStorefrontCompanyContext();
        $demoOnly = request()->boolean('is_demo');

        $section = Section::query()
            ->when(
                $companyId && Schema::hasColumn((new Section())->getTable(), 'company_id'),
                fn ($query) => $query->where('company_id', $companyId)
            )
            ->whereIn('name', ['just_for_you', 'just-for-you', 'best_selling', 'best-selling'])
            ->first();
        $content = is_array($section?->content) ? $section->content : [];
        $limit = (int) request()->query('limit', 12);
        $limit = $limit > 0 ? min($limit, 100) : 12;
        $demandTag = trim((string) request()->query('demand_tag', ''));

        $products = Product::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('status', 1)
            ->where('is_bundle', false)
            ->when($demoOnly, fn ($query) => $query->where('is_demo', true))
            ->when($demandTag !== '', fn ($query) => $query->whereJsonContains('demand_tags', $demandTag))
            ->withCount('reviews')
            ->withAvg('reviews', 'rating')
            ->with([
                'category:id,title,slug',
                'inventory_items' => function ($query) {
                    $query->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->orderByDesc('created_at');
                },
            ])
            ->latest('created_at')
              ->take($limit)
              ->get();

        $defaultHeading = $demandTag !== ''
            ? Str::headline(str_replace('_', ' ', $demandTag))
            : 'Just for you';

          $items = $products->map(function (Product $product) {
            $latestInStockPrice = optional($product->inventory_items->firstWhere('quantity', '>', 0))->price;
            $latestKnownPrice = optional($product->inventory_items->first())->price;
            $resolvedPrice = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
            $pricing = $this->resolveStorefrontDiscountPricing($product, $resolvedPrice);
            $categoryName = (string) ($product->category?->title ?? 'Other');
            $totalQuantity = (float) $product->inventory_items->sum('quantity');
            $reviewsCount = (int) ($product->reviews_count ?? 0);
            $averageRating = $reviewsCount > 0 ? round((float) ($product->reviews_avg_rating ?? 0), 1) : null;

            return [
                'id' => (string) $product->id,
                'name' => (string) $product->name,
                'slug' => (string) $product->slug,
                'category' => $categoryName,
                'price' => (float) $pricing['price'],
                'original_price' => $pricing['original_price'],
                'discount_percent' => (int) $pricing['discount_percent'],
                'image' => $this->resolveProductImage($product->thumbnail),
                'bg_image' => asset('images/home/bestsell/p-bg.webp'),
                'badge' => (string) ($product->stock_visibility_label ?: $categoryName),
                'quantity' => $this->resolveOnlineStoreQuantity($product, $totalQuantity),
                'rating' => $averageRating,
                'reviews' => $reviewsCount,
                'url' => '/product/'.$product->slug,
            ];
        })->values();

        $categories = $items
            ->pluck('category')
            ->filter()
            ->unique()
            ->values()
            ->all();

        return response()->json([
              'status' => true,
              'message' => 'Just for you section fetched successfully.',
              'data' => [
                  'name' => 'just_for_you',
                  'heading' => (string) ($content['heading'] ?? $defaultHeading),
                  'subheading' => (string) ($content['subheading'] ?? ''),
                  'categories' => $categories,
                  'demand_tag' => $demandTag !== '' ? $demandTag : null,
                  'products' => $items,
              ],
          ]);
    }

    public function landingFooter()
    {
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest(request())
            ?? $this->warmStorefrontCompanyContext();
        $payload = Cache::remember($this->storefrontCacheKey('landing-footer', $companyId), now()->addMinutes(10), function () use ($companyId) {
            $homePage = $this->resolveStorefrontHomePage();
            $homePageId = $homePage?->id ? (string) $homePage->id : '';

            $section = Section::query()
                ->when(
                    $companyId && Schema::hasColumn((new Section())->getTable(), 'company_id'),
                    fn ($query) => $query->where('company_id', $companyId)
                )
                ->where('name', 'footer')
                ->first();
            $content = is_array($section?->content) ? $section->content : [];

            $actions = StorefrontAction::query()
                ->where('company_id', $companyId)
                ->where('placement', 'footer')
                ->when(Schema::hasColumn('storefront_actions', 'sort_order'), fn ($query) => $query->orderBy('sort_order'))
                ->orderBy('created_at')
                ->get();

            $footerGroups = collect($this->builderActionsForPage($actions->all(), $homePageId))
                ->filter(fn (array $action) => $this->storefrontText($action['placement'] ?? '') === 'footer')
                ->groupBy(function (array $action) {
                    $groupKey = $this->storefrontText($action['footer_group'] ?? '');
                    return $groupKey !== '' ? $groupKey : 'information';
                })
                ->map(function ($groupActions, string $groupKey) {
                    $normalizedActions = collect($groupActions)
                        ->sortBy(fn (array $action) => (int) ($action['sort_order'] ?? 0))
                        ->values();

                    $links = $normalizedActions
                        ->map(function (array $action) {
                            $name = trim((string) ($action['name'] ?? ''));
                            $targetPageSlug = trim((string) ($action['target_page_slug'] ?? ''));
                            $targetPageRouteMode = trim((string) ($action['target_page_route_mode'] ?? 'custom_url'));
                            $targetPageRouteKey = trim((string) ($action['target_page_route_key'] ?? ''));
                            $linkType = trim((string) ($action['link_type'] ?? 'custom_path'));
                            $routeKey = trim((string) ($action['route_key'] ?? ''));
                            $expression = trim((string) ($action['expression'] ?? ''));

                            $path = match ($linkType) {
                                'storefront_page' => $targetPageSlug === '' ? '#' : ($targetPageSlug === 'home' ? '/' : '/' . $targetPageSlug),
                                'internal_route' => $routeKey !== '' ? (str_starts_with($routeKey, '/') ? $routeKey : '/' . ltrim($routeKey, '/')) : '#',
                                'external_url' => $expression !== '' ? $expression : '#',
                                default => $expression !== '' ? $expression : ($routeKey !== '' ? $routeKey : '#'),
                            };

                            if ($path === '#' && $targetPageRouteMode === 'internal_route' && $targetPageRouteKey !== '') {
                                $path = str_starts_with($targetPageRouteKey, '/') ? $targetPageRouteKey : '/' . ltrim($targetPageRouteKey, '/');
                            }

                            return [
                                'name' => $name,
                                'slug' => trim((string) ($action['slug'] ?? '')),
                                'path' => $path,
                            ];
                        })
                        ->filter(fn (array $link) => $link['name'] !== '' && $link['path'] !== '#')
                        ->values()
                        ->all();

                    return [
                        'title' => (string) ($normalizedActions->first()['footer_group'] ?? $groupKey),
                        'subtitle' => (string) ($normalizedActions->first()['label'] ?? ''),
                        'links' => $links,
                    ];
                })
                ->filter(fn (array $group) => ! empty($group['title']) || ! empty($group['links']))
                ->values()
                ->all();

            if (empty($footerGroups)) {
                $footerGroups = collect($content['footer_group'] ?? [])
                    ->filter(fn ($group) => ! empty($group['title']) || ! empty($group['links']))
                    ->values()
                    ->map(function ($group) {
                        $subtitle = (string) ($group['label'] ?? $group['subtitle'] ?? '');
                        $links = collect($group['links'] ?? [])
                            ->map(function ($link) {
                                $slug = strtolower(trim((string) ($link['slug'] ?? ''), '/'));
                                $name = (string) ($link['name'] ?? '');
                                $path = $slug === '' ? '#' : ($slug === 'home' ? '/' : '/' . $slug);

                                return [
                                    'name' => $name,
                                    'slug' => $slug,
                                    'path' => $path,
                                ];
                            })
                            ->filter(fn ($link) => $link['path'] !== '#')
                            ->values()
                            ->all();

                        return [
                            'title' => (string) ($group['title'] ?? ''),
                            'subtitle' => $subtitle,
                            'links' => $links,
                        ];
                    })
                    ->values()
                    ->all();
            }

            $basic = settings('basic');
            $logo = $basic->white_logo ?? null;

            return [
                'newsletter_title' => (string) ($content['newsletter_title'] ?? 'Subscribe to our newsletter'),
                'newsletter_text' => (string) ($content['newsletter_text'] ?? 'Enter your email'),
                'footer_groups' => $footerGroups,
                'brand_logo_url' => $logo ? get_file($logo, Path::LOGO_PATH) : null,
                'brand_label' => (string) ($basic->sitename ?? 'Home'),
                'copyright' => (string) ($basic->copyright ?? ''),
            ];
        });

        return response()->json([
            'status' => true,
            'message' => 'Footer section fetched successfully.',
            'data' => $payload,
        ]);
    }

    public function landingPricing()
    {
        $section = Section::query()->where('name', 'pricing')->first();
        $content = is_array($section?->content) ? $section->content : [];

        $plans = SaasPlan::query()
            ->where('status', true)
            ->orderByRaw("CASE WHEN is_free = 'free' THEN 0 ELSE 1 END")
            ->orderBy('price')
            ->get()
            ->map(function (SaasPlan $plan) {
                return [
                    'id' => $plan->id,
                    'name' => (string) $plan->name,
                    'description' => (string) ($plan->description ?? ''),
                    'is_free' => (string) $plan->is_free,
                    'price' => (float) $plan->price,
                    'billing_period' => (string) $plan->billing_period,
                    'trial_period' => (int) ($plan->trial_period ?? 0),
                    'inventory_item_limit' => (int) ($plan->inventory_item_limit ?? 0),
                    'monthly_pos_transaction_limit' => (int) ($plan->monthly_pos_transaction_limit ?? 0),
                    'warehouse_limit' => (int) ($plan->warehouse_limit ?? 0),
                    'user_limit' => (int) ($plan->user_limit ?? 0),
                    'features' => collect($plan->features ?? [])->map(fn ($f) => (string) $f)->values()->all(),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'status' => true,
            'message' => 'Pricing section fetched successfully.',
            'data' => [
                'name' => 'pricing',
                'sec_title' => (string) ($content['sec_title'] ?? ''),
                'sec_text' => (string) ($content['sec_text'] ?? ''),
                'button_text' => (string) ($content['button_text'] ?? 'Get started'),
                'button_link' => $this->resolveButtonLink($content['button_link'] ?? '/login?redirect=/plans'),
                'plans' => $plans,
            ],
        ]);
    }

    public function landingBlog()
    {
        $section = Section::query()->where('name', 'blog')->first();
        $content = is_array($section?->content) ? $section->content : [];
        $isHome = $this->requestBoolean(request()->query('home', true));
        $limit = (int) request()->query('limit', 6);
        $limit = $limit > 0 ? min($limit, 24) : 6;

        $query = Blog::query()
            ->with('category:id,name')
            ->active()
            ->latest('id');

        if ($isHome) {
            $query->where('is_show_in_home', true);
        }

        $blogs = $query->take($limit)->get()->map(function (Blog $blog) {
            return [
                'id' => $blog->id,
                'title' => (string) $blog->title,
                'slug' => (string) $blog->slug,
                'short_description' => (string) ($blog->short_description ?? ''),
                'image_url' => $blog->image_url,
                'created_at' => optional($blog->created_at)->format('M d, Y'),
                'category' => $blog->category ? [
                    'id' => $blog->category->id,
                    'name' => (string) $blog->category->name,
                ] : null,
                'url' => '/blog/'.$blog->slug,
            ];
        })->values()->all();

        return response()->json([
            'status' => true,
            'message' => 'Blog section fetched successfully.',
            'data' => [
                'name' => 'blog',
                'heading' => (string) ($content['heading'] ?? ''),
                'subheading' => (string) ($content['subheading'] ?? ''),
                'button_text' => (string) ($content['button_text'] ?? 'Read all blogs'),
                'button_link' => $this->resolveButtonLink($content['button_link'] ?? '/blog'),
                'is_home' => $isHome,
                'blogs' => $blogs,
            ],
        ]);
    }

    public function landingBlogDetails(string $slug)
    {
        $normalizedSlug = trim(strtolower($slug));
        $blog = Blog::query()
            ->with('category:id,name,slug')
            ->active()
            ->whereRaw('LOWER(slug) = ?', [$normalizedSlug])
            ->first();

        if (! $blog) {
            return response()->json([
                'status' => false,
                'message' => 'Blog not found.',
                'data' => null,
            ], 404);
        }

        $categories = BlogCategory::query()
            ->where('status', true)
            ->withCount(['blogs' => function ($query) {
                $query->where('status', true);
            }])
            ->orderBy('name')
            ->get()
            ->map(fn ($category) => [
                'id' => $category->id,
                'name' => (string) $category->name,
                'slug' => (string) $category->slug,
                'blogs_count' => (int) $category->blogs_count,
                'url' => '/blog/category/'.$category->slug,
            ])
            ->values()
            ->all();

        $recentPosts = Blog::query()
            ->active()
            ->where('id', '!=', $blog->id)
            ->latest('id')
            ->take(5)
            ->get()
            ->map(fn (Blog $post) => [
                'id' => $post->id,
                'title' => (string) $post->title,
                'slug' => (string) $post->slug,
                'image_url' => $post->image_url,
                'created_at' => optional($post->created_at)->format('F j, Y'),
                'url' => '/blog/'.$post->slug,
            ])
            ->values()
            ->all();

        return response()->json([
            'status' => true,
            'message' => 'Blog details fetched successfully.',
            'data' => [
                'blog' => [
                    'id' => $blog->id,
                    'title' => (string) $blog->title,
                    'slug' => (string) $blog->slug,
                    'short_description' => (string) ($blog->short_description ?? ''),
                    'description' => (string) ($blog->description ?? ''),
                    'image_url' => $blog->image_url,
                    'created_at' => optional($blog->created_at)->format('j F Y'),
                    'category' => $blog->category ? [
                        'id' => $blog->category->id,
                        'name' => (string) $blog->category->name,
                        'slug' => (string) $blog->category->slug,
                    ] : null,
                    'tags' => array_values(array_filter((array) ($blog->tags ?? []))),
                ],
                'categories' => $categories,
                'recent_posts' => $recentPosts,
            ],
        ]);
    }

    public function landingBlogCategory(string $slug)
    {
        $normalizedSlug = trim(strtolower($slug));
        $category = BlogCategory::query()
            ->where('status', true)
            ->whereRaw('LOWER(slug) = ?', [$normalizedSlug])
            ->first();

        if (! $category) {
            return response()->json([
                'status' => false,
                'message' => 'Blog category not found.',
                'data' => null,
            ], 404);
        }

        $blogs = Blog::query()
            ->with('category:id,name,slug')
            ->active()
            ->where('category_id', $category->id)
            ->latest('id')
            ->get()
            ->map(fn (Blog $blog) => [
                'id' => $blog->id,
                'title' => (string) $blog->title,
                'slug' => (string) $blog->slug,
                'short_description' => (string) ($blog->short_description ?? ''),
                'image_url' => $blog->image_url,
                'created_at' => optional($blog->created_at)->format('M d, Y'),
                'category' => $blog->category ? [
                    'id' => $blog->category->id,
                    'name' => (string) $blog->category->name,
                    'slug' => (string) $blog->category->slug,
                ] : null,
                'url' => '/blog/'.$blog->slug,
            ])
            ->values()
            ->all();

        $categories = BlogCategory::query()
            ->where('status', true)
            ->withCount(['blogs' => function ($query) {
                $query->where('status', true);
            }])
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => (string) $row->name,
                'slug' => (string) $row->slug,
                'blogs_count' => (int) $row->blogs_count,
                'url' => '/blog/category/'.$row->slug,
            ])
            ->values()
            ->all();

        $recentPosts = Blog::query()
            ->active()
            ->latest('id')
            ->take(5)
            ->get()
            ->map(fn (Blog $post) => [
                'id' => $post->id,
                'title' => (string) $post->title,
                'slug' => (string) $post->slug,
                'image_url' => $post->image_url,
                'created_at' => optional($post->created_at)->format('F j, Y'),
                'url' => '/blog/'.$post->slug,
            ])
            ->values()
            ->all();

        return response()->json([
            'status' => true,
            'message' => 'Blog category fetched successfully.',
            'data' => [
                'category' => [
                    'id' => $category->id,
                    'name' => (string) $category->name,
                    'slug' => (string) $category->slug,
                ],
                'blogs' => $blogs,
                'categories' => $categories,
                'recent_posts' => $recentPosts,
            ],
        ]);
    }

    public function home()
    {
        return $this->buildStorefrontHomeResponse();
    }

    private function hasStorefrontHomeSections(): bool
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();

        if (blank($companyId)) {
            return false;
        }

        return StorefrontSection::query()
            ->where('company_id', $companyId)
            ->whereNotIn('variant', ['header', 'footer'])
            ->exists();
    }

    private function hasRenderableHomePageSections(string $pageId): bool
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();

        if (blank($companyId) || blank($pageId)) {
            return false;
        }

        return StorefrontSection::query()
            ->where('company_id', $companyId)
            ->where('page_id', $pageId)
            ->whereNotIn('variant', ['header', 'footer'])
            ->exists();
    }

    private function supportsStorefrontPageSlugs(): bool
    {
        return Schema::hasColumn('storefront_pages', 'slug');
    }

    private function supportsStorefrontPageRouteFields(): bool
    {
        return Schema::hasColumns('storefront_pages', ['route_mode', 'route_key']);
    }

    private function supportsStorefrontSectionPresetKey(): bool
    {
        return Schema::hasColumn('storefront_sections', 'preset_key');
    }

    private function supportsStorefrontSectionComponentKey(): bool
    {
        return Schema::hasColumn('storefront_sections', 'component_key');
    }

    private function supportsActionTargetPages(): bool
    {
        return Schema::hasColumn('storefront_actions', 'target_page_id');
    }

    private function resolveStorefrontPageSlug(?StorefrontPage $page): string
    {
        if (! $page) {
            return '';
        }

        if ($this->supportsStorefrontPageSlugs() && ! blank($page->slug)) {
            return trim(strtolower((string) $page->slug));
        }

        return Str::slug((string) $page->name) ?: 'page';
    }

    private function resolveStorefrontHomePage(): ?StorefrontPage
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();

        if (blank($companyId)) {
            return null;
        }

        return StorefrontPage::query()
            ->where('company_id', EcommerceCompanyContext::currentCompanyId())
            ->orderByRaw("
                CASE
                    WHEN LOWER(name) IN ('home', 'homepage', 'ecommerce home', 'storefront home') THEN 0
                    ELSE 1
                END
            ")
            ->orderBy('created_at')
            ->first();
    }

    private function resolveStorefrontPageBySlug(string $slug): ?StorefrontPage
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();

        if (blank($companyId)) {
            return null;
        }

        $normalizedSlug = trim(strtolower($slug));

        if ($normalizedSlug === '') {
            return null;
        }

        if ($this->supportsStorefrontPageSlugs()) {
            return StorefrontPage::query()
                ->where('company_id', $companyId)
                ->whereRaw('LOWER(slug) = ?', [$normalizedSlug])
                ->first();
        }

        return StorefrontPage::query()
            ->where('company_id', $companyId)
            ->get()
            ->first(fn (StorefrontPage $page) => $this->resolveStorefrontPageSlug($page) === $normalizedSlug);
    }

    private function builderActionsForPage(array $actions, string $pageId): array
    {
        $filteredActions = array_values(array_filter($actions, function ($action) use ($pageId) {
            if (! is_array($action)) {
                return false;
            }

            $actionPageId = $this->storefrontText($action['page_id'] ?? '');

            return $pageId === '' || $actionPageId === '' || $actionPageId === $pageId;
        }));

        return $this->sortStorefrontActions($filteredActions);
    }

    private function buildStorefrontHomeResponseFromBuilder(Company $company, array $builder): array
    {
        $pages = array_values(array_filter($builder['pages'] ?? [], 'is_array'));
        $sections = array_values(array_filter($builder['sections'] ?? [], 'is_array'));
        $actions = array_values(array_filter($builder['actions'] ?? [], 'is_array'));

        $homePage = collect($pages)->first(function (array $page) {
            $slug = strtolower($this->storefrontText($page['slug'] ?? ''));
            $routeMode = strtolower($this->storefrontText($page['route_mode'] ?? ''));
            $routeKey = $this->storefrontText($page['route_key'] ?? '');
            $name = strtolower($this->storefrontText($page['name'] ?? ''));

            return $slug === 'home'
                || $name === 'home'
                || ($routeMode === 'internal_route' && $routeKey === '/');
        }) ?: ($pages[0] ?? null);

        $pageId = $this->storefrontText($homePage['id'] ?? '');
        $pageSlug = $this->storefrontText($homePage['slug'] ?? '');
        $pageRouteMode = $this->storefrontText($homePage['route_mode'] ?? 'custom_url') ?: 'custom_url';
        $pageRouteKey = $this->storefrontText($homePage['route_key'] ?? '');
        $pageDescription = $this->storefrontText($homePage['description'] ?? '');

        $visibleSections = collect($sections)
            ->filter(function (array $section) use ($pageId) {
                return $pageId === '' || $this->storefrontText($section['page_id'] ?? '') === $pageId;
            })
            ->sortBy(fn (array $section) => (int) ($section['order'] ?? 0))
            ->values()
            ->map(function (array $section) {
                $variant = StorefrontTemplateVariant::tryFromValue((string) ($section['variant'] ?? ''));
                $slot = $variant->slot();
                $richText = $this->storefrontText($section['rich_text_html'] ?? '');

                return [
                    'id' => $this->storefrontText($section['id'] ?? ''),
                    'page_id' => $this->storefrontText($section['page_id'] ?? ''),
                    'name' => $this->storefrontText($section['name'] ?? ''),
                    'title' => $this->storefrontText($section['title'] ?? ''),
                    'subtitle' => $this->storefrontText($section['subtitle'] ?? ''),
                    'layout' => $this->storefrontText($section['layout'] ?? 'template') ?: 'template',
                    'variant' => $variant->value,
                    'preset_key' => $this->storefrontText($section['preset_key'] ?? ''),
                    'component_key' => $this->storefrontText($section['component_key'] ?? '') ?: $variant->componentKey(),
                    'query_sql' => $this->storefrontText($section['query_sql'] ?? ''),
                    'query_json' => $this->storefrontText($section['query_json'] ?? ''),
                    'config' => $this->storefrontSectionConfig($section['config'] ?? null),
                    'rich_text_html' => $richText,
                    'content' => $richText !== '' ? ['html' => $richText] : [],
                    'template' => $variant->metadata(),
                    'editor_schema' => StorefrontSectionSchemaRegistry::for(
                        $variant->value,
                        $this->storefrontText($section['preset_key'] ?? '')
                    ),
                    'actions' => [],
                ];
            })
            ->all();

        $actionsForPage = $this->builderActionsForPage($actions, $pageId);
        $actionsBySection = collect($actionsForPage)
            ->filter(fn (array $action) => $this->storefrontText($action['section_id'] ?? '') !== '')
            ->groupBy(fn (array $action) => $this->storefrontText($action['section_id'] ?? ''));

        $preparedSections = collect($visibleSections)
            ->map(function (array $section) use ($actionsBySection, $actionsForPage) {
                $slot = strtolower($this->storefrontText(data_get($section, 'template.slot', '')));
                $sectionId = $this->storefrontText($section['id'] ?? '');
                $sectionActions = $actionsBySection->get($sectionId, collect())->values()->all();
                $slotActions = $slot === ''
                    ? []
                    : collect($actionsForPage)
                        ->filter(fn (array $action) => $this->storefrontText($action['section_id'] ?? '') === '' && (($this->storefrontText($action['placement'] ?? '') === 'footer' ? 'footer' : 'header') === $slot))
                        ->values()
                        ->all();

                $section['actions'] = $this->mergeStorefrontActions(array_merge($sectionActions, $slotActions));

                return $section;
            })
            ->values()
            ->all();

        return [
            'status' => true,
            'message' => 'Storefront home content fetched successfully.',
            'data' => [
                'page' => [
                    'id' => $this->storefrontText($homePage['id'] ?? ''),
                    'company_id' => $company->company_id,
                    'name' => $this->storefrontText($homePage['name'] ?? 'Home') ?: 'Home',
                    'slug' => $pageSlug !== '' ? $pageSlug : 'home',
                    'route_mode' => $pageRouteMode,
                    'route_key' => $pageRouteKey,
                    'component_key' => $this->storefrontText($homePage['component_key'] ?? ''),
                    'description' => $pageDescription,
                ],
                'theme' => $this->storefrontThemePayload($company),
                'storefront_category' => $this->storefrontCategoryPayload($company),
                'storefront_template' => $this->storefrontTemplatePayload($company),
                'raw_content' => null,
                'content_html' => '',
                'rendered_html' => '',
                'header_html' => '',
                'footer_html' => '',
                'full_html' => '',
                'assets' => [
                    'css' => [],
                    'js' => [],
                ],
                'sections' => $preparedSections,
                'actions' => $actionsForPage,
            ],
        ];
    }

    private function buildStorefrontHomeResponse()
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();
        if (blank($companyId)) {
            return response()->json([
                'status' => false,
                'message' => 'Storefront home page is not configured.',
                'data' => null,
            ], 404);
        }

        $company = Company::query()
            ->with(['selectedETemplate', 'ecommerceCategory'])
            ->find($companyId);

        if (! $company) {
            return response()->json([
                'status' => false,
                'message' => 'Storefront home page is not configured.',
                'data' => null,
            ], 404);
        }

        $page = $this->resolveStorefrontHomePage();

        // A saved company page is authoritative, even when it contains only
        // header/footer or no sections. Never repopulate it from the purchased
        // template after the company has edited the builder.
        if ($page) {
            return $this->buildStorefrontPageResponse($page, 'Storefront home content fetched successfully.');
        }

        return response()->json(
            $this->buildStorefrontHomeResponseFromTemplate($company),
            200
        );
    }

    private function buildStorefrontHomeResponseFromTemplate(Company $company): array
    {
        $selectedTemplate = $company->selectedETemplate;

        if (! $selectedTemplate) {
            return [
                'status' => false,
                'message' => 'Storefront home page is not configured.',
                'data' => null,
            ];
        }

        $builder = app(ETemplateBuilderService::class)->getBuilder($selectedTemplate);

        return $this->buildStorefrontHomeResponseFromBuilder($company, $builder);
    }

    private function buildStorefrontPageResponse(StorefrontPage $page, string $message)
    {

        $companyId = EcommerceCompanyContext::currentCompanyId();
        $company = Company::query()
            ->with(['selectedETemplate', 'ecommerceCategory'])
            ->find($companyId);
        $selectedTemplate = $company?->selectedETemplate;
        $supportsActionTargetPages = $this->supportsActionTargetPages();
        $supportsActionFooterGroups = Schema::hasColumn('storefront_actions', 'footer_group');
        $supportsStorefrontPageRouteFields = $this->supportsStorefrontPageRouteFields();

        $targetPages = StorefrontPage::query()
            ->where('company_id', EcommerceCompanyContext::currentCompanyId())
            ->get()
            ->keyBy('id');

        $actions = StorefrontAction::query()
            ->where('company_id', EcommerceCompanyContext::currentCompanyId())
            ->where('page_id', $page->id)
            ->orderBy('created_at')
            ->get()
            ->map(function (StorefrontAction $action) use ($supportsActionTargetPages, $supportsActionFooterGroups, $supportsStorefrontPageRouteFields, $targetPages) {
                $targetPage = ! empty($action->target_page_id) ? $targetPages->get($action->target_page_id) : null;

                return [
                'id' => $action->id,
                'page_id' => $action->page_id,
                'section_id' => $action->section_id,
                'name' => (string) $action->name,
                'slug' => (string) $action->slug,
                'expression' => (string) ($action->expression ?? ''),
                'link_type' => (string) ($action->link_type ?? 'custom_path'),
                'route_key' => (string) ($action->route_key ?? ''),
                'target_page_id' => $supportsActionTargetPages ? (string) ($action->target_page_id ?? '') : '',
                'target_page_slug' => $supportsActionTargetPages
                    ? $this->resolveStorefrontPageSlug($targetPage)
                    : '',
                'target_page_route_mode' => $supportsActionTargetPages && $supportsStorefrontPageRouteFields
                    ? (string) ($targetPage?->route_mode ?? 'custom_url')
                    : 'custom_url',
                'target_page_route_key' => $supportsActionTargetPages && $supportsStorefrontPageRouteFields
                    ? (string) ($targetPage?->route_key ?? '')
                    : '',
                'label' => (string) ($action->label ?? ''),
                'placement' => ($action->placement ?? 'header') === 'footer' ? 'footer' : 'header',
                'footer_group' => $supportsActionFooterGroups ? (string) ($action->footer_group ?? '') : '',
                'token' => '#' . trim((string) $action->slug, '#') . '#',
            ];
            })
            ->values();

        $actionsBySection = $actions
            ->filter(fn ($action) => ! blank($action['section_id']))
            ->groupBy('section_id');
        $supportsStorefrontSectionPresetKey = $this->supportsStorefrontSectionPresetKey();
        $supportsStorefrontSectionComponentKey = $this->supportsStorefrontSectionComponentKey();
        $supportsStorefrontSectionConfigJson = Schema::hasColumn('storefront_sections', 'config_json');

        $sections = StorefrontSection::query()
            ->where('company_id', EcommerceCompanyContext::currentCompanyId())
            ->where('page_id', $page->id)
            ->orderBy('order')
            ->orderBy('created_at')
            ->get()
            ->map(function (StorefrontSection $section) use ($actionsBySection, $actions, $companyId, $supportsStorefrontSectionPresetKey, $supportsStorefrontSectionComponentKey, $supportsStorefrontSectionConfigJson) {
                $variant = StorefrontTemplateVariant::tryFromValue($section->variant);
                $slot = in_array($variant->value, ['header', 'footer'], true) ? $variant->value : '';
                $sectionActions = $actionsBySection->get($section->id, collect())
                    ->filter(function ($action) use ($slot) {
                        if ($slot === '' || ! is_array($action)) {
                            return true;
                        }

                        return $this->storefrontActionPlacementMatches($action, $slot);
                    })
                    ->values()
                    ->all();
                $slotActions = $slot === ''
                    ? []
                    : collect($actions)
                        ->filter(function ($action) use ($slot) {
                            if (! is_array($action)) {
                                return false;
                            }

                            return $this->storefrontText($action['section_id'] ?? '') === ''
                                && strtolower($this->storefrontText($action['placement'] ?? '')) === $slot;
                        })
                        ->values()
                        ->all();

                return [
                    'id' => $section->id,
                    'page_id' => $section->page_id,
                    'company_id' => $companyId,
                    'name' => (string) $section->name,
                    'title' => (string) ($section->title ?? ''),
                    'subtitle' => (string) ($section->subtitle ?? ''),
                    'layout' => (string) $section->layout,
                    'variant' => $variant->value,
                    'preset_key' => $supportsStorefrontSectionPresetKey ? (string) ($section->preset_key ?? '') : '',
                    'component_key' => $supportsStorefrontSectionComponentKey
                        ? (string) ($section->component_key ?? $variant->componentKey())
                        : $variant->componentKey(),
                    'template' => $variant->metadata(),
                    'order' => (int) ($section->order ?? 0),
                    'query_sql' => (string) ($section->query_sql ?? ''),
                    'query_json' => (string) ($section->query_json ?? ''),
                    'config' => $supportsStorefrontSectionConfigJson
                        ? $this->storefrontSectionConfig($section->config_json)
                        : [],
                    'editor_schema' => StorefrontSectionSchemaRegistry::for(
                        $variant->value,
                        (string) ($section->preset_key ?? '')
                    ),
                    'rich_text_html' => (string) ($section->rich_text_html ?? ''),
                    'content' => $section->layout === 'rich_text'
                        ? ['html' => (string) ($section->rich_text_html ?? '')]
                        : [],
                    'elements' => [],
                    'actions' => $this->mergeStorefrontActions([...$sectionActions, ...$slotActions]),
                ];
            })
            ->values();

        $headerSlotActions = $this->collectStorefrontSlotActions($actions->all(), 'header');
        $footerSlotActions = $this->collectStorefrontSlotActions($actions->all(), 'footer');
        $matchedHeaderSection = $sections->first(function (array $section) {
            return strtolower($this->storefrontText(data_get($section, 'template.slot'))) === 'header';
        });
        $matchedFooterSection = $sections->first(function (array $section) {
            return strtolower($this->storefrontText(data_get($section, 'template.slot'))) === 'footer';
        });
        $templateChromeSection = function (string $slot) use ($selectedTemplate, $page, $companyId, $actions) {
            if (! $selectedTemplate) {
                return null;
            }

            $builder = app(ETemplateBuilderService::class)->getBuilder($selectedTemplate);
            $section = collect($builder['sections'] ?? [])->first(function ($item) use ($slot) {
                if (! is_array($item)) {
                    return false;
                }

                $variant = strtolower($this->storefrontText($item['variant'] ?? ''));
                $componentKey = strtolower($this->storefrontText(($item['component_key'] ?? '') ?: ($item['preset_key'] ?? '')));

                return $variant === $slot
                    || $componentKey === $slot
                    || str_contains($componentKey, "-{$slot}");
            });

            if (! is_array($section)) {
                return null;
            }

            $variant = StorefrontTemplateVariant::tryFromValue($slot);

            return [
                'id' => 'template-fallback-' . $slot,
                'page_id' => $page->id,
                'company_id' => $companyId,
                'name' => (string) ($section['name'] ?? $slot),
                'title' => (string) ($section['title'] ?? ucfirst($slot)),
                'subtitle' => (string) ($section['subtitle'] ?? ''),
                'layout' => (string) ($section['layout'] ?? 'template'),
                'variant' => $slot,
                'preset_key' => (string) ($section['preset_key'] ?? ''),
                'component_key' => (string) (($section['component_key'] ?? '') ?: ($section['preset_key'] ?? $slot)),
                'template' => $variant->metadata(),
                'order' => $slot === 'header' ? -1 : 999999,
                'query_sql' => (string) ($section['query_sql'] ?? ''),
                'query_json' => (string) ($section['query_json'] ?? ''),
                'config' => $this->storefrontSectionConfig($section['config'] ?? null),
                'editor_schema' => StorefrontSectionSchemaRegistry::for($slot, (string) ($section['preset_key'] ?? '')),
                'rich_text_html' => (string) ($section['rich_text_html'] ?? ''),
                'content' => [],
                'elements' => [],
                'actions' => $this->collectStorefrontSlotActions($actions->all(), $slot),
            ];
        };

        if (! $matchedHeaderSection && ($fallbackHeader = $templateChromeSection('header'))) {
            $sections->prepend($fallbackHeader);
            $matchedHeaderSection = $fallbackHeader;
        }

        if (! $matchedFooterSection && ($fallbackFooter = $templateChromeSection('footer'))) {
            $sections->push($fallbackFooter);
            $matchedFooterSection = $fallbackFooter;
        }

        if (! $matchedHeaderSection && ! empty($headerSlotActions)) {
            $sections->prepend([
                'id' => 'virtual-header-slot',
                'page_id' => $page->id,
                'company_id' => $companyId,
                'name' => 'header',
                'title' => 'Header',
                'subtitle' => '',
                'layout' => 'default',
                'variant' => 'header',
                'preset_key' => '',
                'component_key' => 'header',
                'template' => [
                    'slot' => 'header',
                    'label' => 'Header',
                    'component_key' => 'header',
                ],
                'order' => -1,
                'query_sql' => '',
                'query_json' => '',
                'rich_text_html' => '',
                'content' => [],
                'elements' => [],
                'actions' => $headerSlotActions,
            ]);
        }

        if (! $matchedFooterSection && ! empty($footerSlotActions)) {
            $sections->push([
                'id' => 'virtual-footer-slot',
                'page_id' => $page->id,
                'company_id' => $companyId,
                'name' => 'footer',
                'title' => 'Footer',
                'subtitle' => '',
                'layout' => 'default',
                'variant' => 'footer',
                'preset_key' => '',
                'component_key' => 'footer',
                'template' => [
                    'slot' => 'footer',
                    'label' => 'Footer',
                    'component_key' => 'footer',
                ],
                'order' => 999999,
                'query_sql' => '',
                'query_json' => '',
                'rich_text_html' => '',
                'content' => [],
                'elements' => [],
                'actions' => $footerSlotActions,
            ]);
        }

        return response()->json([
            'status' => true,
            'message' => $message,
            'data' => [
                'page' => [
                    'id' => $page->id,
                    'company_id' => $companyId,
                    'name' => (string) $page->name,
                    'slug' => $this->resolveStorefrontPageSlug($page),
                    'route_mode' => $supportsStorefrontPageRouteFields ? (string) ($page->route_mode ?? 'custom_url') : 'custom_url',
                    'route_key' => $supportsStorefrontPageRouteFields ? (string) ($page->route_key ?? '') : '',
                    'component_key' => (string) ($page->component_key ?? ''),
                    'description' => (string) ($page->description ?? ''),
                ],
                'theme' => $this->storefrontThemePayload($company),
                'storefront_category' => $this->storefrontCategoryPayload($company),
                'storefront_template' => $this->storefrontTemplatePayload($company),
                'raw_content' => null,
                'content_html' => '',
                'rendered_html' => '',
                'header_html' => '',
                'footer_html' => '',
                'full_html' => '',
                'assets' => [
                    'css' => [],
                    'js' => [],
                ],
                'sections' => $sections,
                'actions' => $actions->values()->all(),
            ],
        ]);
    }

    public function page(?string $slug = null)
    {
        $normalizedSlug = trim(strtolower((string) $slug));
        if ($normalizedSlug === '' || $normalizedSlug === 'home') {
            return $this->home();
        }

        $storefrontPage = $this->resolveStorefrontPageBySlug($normalizedSlug);

        if ($storefrontPage) {
            return $this->buildStorefrontPageResponse($storefrontPage, 'Storefront page content fetched successfully.');
        }

        $slugAliases = [
            'mission-vission' => ['mission-vision'],
            'mission-vision' => ['mission-vission'],
        ];

        $candidateSlugs = array_values(array_unique(array_merge(
            [$normalizedSlug],
            $slugAliases[$normalizedSlug] ?? []
        )));

        $page = Page::query()
            ->whereIn(DB::raw('LOWER(slug)'), $candidateSlugs)
            ->where('status', true)
            ->first();

        if (! $page) {
            return response()->json([
                'status' => false,
                'message' => 'Page not found.',
                'data' => null,
            ], 404);
        }

        return $this->buildPageResponse($page, 'Page content fetched successfully.');
    }

    private function buildPageResponse(Page $page, string $message)
    {
        $reactMode = $this->requestBoolean(request()->query('react', false));
        $sectionNames = $this->extractSectionNamesFromContent((string) $page->content);

        $sections = Section::query()
            ->whereIn('name', $sectionNames)
            ->get()
            ->keyBy('name');

        $orderedSections = collect($sectionNames)
            ->map(function (string $name) use ($sections) {
                $section = $sections->get($name);
                if (! $section) {
                    $section = $this->resolveAliasedSection($name, $sections);
                }

                return [
                    'name' => $name,
                    'title' => $section?->title,
                    'is_active' => (bool) ($section?->is_active ?? false),
                    'content' => $section?->content ?? [],
                    'elements' => $section?->element ?? [],
                ];
            })
            ->values();

        $renderedHtml = '';
        $fullHtml = '';
        $contentHtml = (string) $page->content;
        $headerHtml = '';
        $footerHtml = '';
        $assets = [
            'css' => [],
            'js' => [],
        ];

        if (! $reactMode) {
            $renderedHtml = $this->renderPageByTemplate($page);
            $fullHtml = $this->renderPageFullHtml($page);
            $contentHtml = $this->renderPageContentOnly($page);
            $headerHtml = $this->renderHeaderHtml();
            $footerHtml = $this->renderFooterHtml();
            $assets = [
                'css' => $this->themeCssAssets(),
                'js' => $this->themeJsAssets(),
            ];
        }

        return response()->json([
            'status' => true,
            'message' => $message,
            'data' => [
                'page' => [
                    'id' => $page->id,
                    'name' => $page->name,
                    'slug' => $page->slug,
                    'breadcrumb_title' => $page->breadcrumb_title,
                    'breadcrumb_description' => $page->breadcrumb_description,
                    'seo_title' => $page->seo_title,
                    'seo_tags' => $page->seo_tags,
                    'seo_description' => $page->seo_description,
                    'has_builder' => (bool) $page->has_builder,
                    'has_breadcrumb' => (bool) $page->has_breadcrumb,
                ],
                'raw_content' => $page->content,
                'content_html' => $contentHtml,
                'rendered_html' => $renderedHtml,
                'header_html' => $headerHtml,
                'footer_html' => $footerHtml,
                'full_html' => $fullHtml,
                'assets' => $assets,
                'sections' => $orderedSections,
            ],
        ]);
    }

    private function decodeSettingValue(?string $rawValue): array
    {
        if (! $rawValue) {
            return [];
        }

        $decoded = json_decode($rawValue, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function appendSettingImageUrls(string $key, array $data): array
    {
        if ($key === 'basic') {
            foreach (['dark_logo', 'white_logo', 'icon'] as $field) {
                if (! empty($data[$field])) {
                    $data[$field.'_url'] = get_file($data[$field], Path::LOGO_PATH);
                }
            }
        }

        if ($key === 'seo' && ! empty($data['og_image'])) {
            $data['og_image_url'] = get_file($data['og_image'], Path::SEO_PATH);
        }

        return $data;
    }

    private function sanitizePublicSettingData(array $data): array
    {
        foreach (self::SENSITIVE_SETTING_FIELDS as $field) {
            unset($data[$field]);
        }

        return $data;
    }

    private function renderHomeHtml(string $content): string
    {
        $heroHtml = (new HeroSection)->render();
        $sectionsHtml = generateSectionHtml($content);

        return $heroHtml.$sectionsHtml;
    }

    private function renderHeaderHtml(): string
    {
        return view(theme().'includes.header')->render();
    }

    private function renderFooterHtml(): string
    {
        return (new FooterSection)->render();
    }

    private function renderFullHtml(string $content): string
    {
        return $this->renderHeaderHtml()
            .$this->renderHomeHtml($content)
            .$this->renderFooterHtml();
    }

    private function renderPageByTemplate(Page $page): string
    {
        if ($this->isHomePage($page)) {
            return view(theme().'home', ['page' => $page])->render();
        }

        return view(theme().'pages', ['page' => $page])->render();
    }

    private function renderPageFullHtml(Page $page): string
    {
        if ($this->isHomePage($page)) {
            return $this->renderFullHtml((string) $page->content);
        }

        // pages.blade.php already applies page-specific logic
        // (breadcrumb, builder/raw content), so render it directly.
        return view(theme().'pages', ['page' => $page])->render();
    }

    private function isHomePage(Page $page): bool
    {
        return (bool) $page->is_default || strtolower((string) $page->slug) === 'home';
    }

    private function themeCssAssets(): array
    {
        return [
            theme_assets('bootstrap.min.css'),
            theme_assets('bootstrap-icons.min.css'),
            theme_assets('magnific-popup.min.css'),
            theme_assets('swiper-bundle.min.css'),
            theme_assets('main.css'),
        ];
    }

    private function themeJsAssets(): array
    {
        return [
            theme_assets('jquery-4.0.0.min.js', false),
            theme_assets('bootstrap.bundle.min.js', false),
            theme_assets('swiper-bundle.min.js', false),
            theme_assets('purecounter.js', false),
            theme_assets('animated-headline.js', false),
            theme_assets('plugin.js', false),
            theme_assets('lenis.min.js', false),
            theme_assets('slider-init.js', false),
            theme_assets('main.js', false),
        ];
    }

    private function extractSectionNamesFromContent(string $content): array
    {
        return extractDataSections($content);
    }

    private function renderPageContentOnly(Page $page): string
    {
        if ($this->isHomePage($page)) {
            return $this->renderHomeHtml((string) $page->content);
        }

        $html = '';

        if ((bool) $page->has_breadcrumb) {
            $html .= view(theme().'sections.breadcrumb', ['page' => $page])->render();
        }

        if ((bool) $page->has_builder) {
            $html .= generateSectionHtml((string) $page->content);
        } else {
            $html .= (string) $page->content;
        }

        return $html;
    }

    private function formatMenuItem(MenuItem $item): array
    {
        $children = $item->childrenRecursive
            ? $item->childrenRecursive->map(fn (MenuItem $child) => $this->formatMenuItem($child))->values()->all()
            : [];

        return [
            'id' => $item->id,
            'title' => $item->title,
            'path' => $this->resolveMenuPath($item),
            'target' => $item->target ?: '_self',
            'icon' => $item->icon,
            'description' => $item->page?->seo_description ?: null,
            'page_slug' => $item->page?->slug ?: null,
            'has_children' => ! empty($children),
            'children' => $children,
        ];
    }

    private function resolveMenuPath(MenuItem $item): string
    {
        if (! empty($item->url)) {
            $url = trim((string) $item->url);
            if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
                return $url;
            }

            $normalized = '/'.ltrim($url, '/');

            return strtolower($normalized) === '/home' ? '/' : $normalized;
        }

        if ($item->page) {
            $slug = strtolower(trim((string) $item->page->slug, '/'));

            return $slug === '' || $slug === 'home' ? '/' : '/'.$slug;
        }

        return '#';
    }

    private function resolveButtonLink($value): string
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return '#';
            }

            if (str_starts_with($trimmed, 'http://') || str_starts_with($trimmed, 'https://')) {
                return $trimmed;
            }

            $normalized = '/'.ltrim($trimmed, '/');

            return strtolower($normalized) === '/home' ? '/' : $normalized;
        }

        if (is_array($value) && isset($value['slug'])) {
            $slug = strtolower(trim((string) $value['slug'], '/'));

            return $slug === '' || $slug === 'home' ? '/' : '/'.$slug;
        }

        return '#';
    }

    private function requestBoolean($value, bool $default = false): bool
    {
        if ($value === null || $value === '') {
            return $default;
        }
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'on'], true);
    }

    private function getChannelQuantitySnapshot(Product $product, string $channelCode): array
    {
        if ($product->relationLoaded('inventory_items')) {
            $channelRows = $product->inventory_items
                ->filter(fn ($item) => $item && $item->relationLoaded('salesChannels'))
                ->flatMap(fn ($item) => $item->salesChannels ?? collect())
                ->filter(fn ($channel) => strtoupper((string) $channel->channel_code) === strtoupper($channelCode))
                ->values();

            if ($channelRows->isNotEmpty()) {
                return [
                    'exists' => true,
                    'quantity' => (float) $channelRows->sum(fn ($channel) => (float) $channel->quantity),
                ];
            }
        }

        if (Schema::hasTable('sales_channels')) {
            $channelQuery = InventorySalesChannel::query()
                ->where('channel_code', strtoupper($channelCode))
                ->whereHas('inventoryItem', fn ($query) => $query->where('product_id', $product->id));

            return [
                'exists' => $channelQuery->exists(),
                'quantity' => (float) $channelQuery->sum('quantity'),
            ];
        }

        return [
            'exists' => false,
            'quantity' => 0,
        ];
    }

    private function resolveOnlineStoreQuantity(Product $product, float $totalQuantity): float
    {
        $snapshot = $this->getChannelQuantitySnapshot($product, SalesChannel::OnlineStore->value);

        if ($snapshot['exists']) {
            return round(max((float) $snapshot['quantity'], 0), 2);
        }

        $channels = is_array($product->sales_channel) ? $product->sales_channel : [];
        $onlinePercentage = (float) ($channels[SalesChannel::OnlineStore->value] ?? 100);

        if ($onlinePercentage <= 0) {
            return 0;
        }

        if ($onlinePercentage >= 100) {
            return round($totalQuantity, 2);
        }

        return round(($totalQuantity * $onlinePercentage) / 100, 2);
    }

    private function resolveAliasedSection(string $name, $sections)
    {
        $normalized = strtolower(trim($name));
        $aliases = [
            'core_principal' => 'core_principles',
            'core_principle' => 'core_principles',
        ];

        $target = $aliases[$normalized] ?? null;
        if (! $target) {
            return null;
        }

        return $sections->get($target);
    }
}

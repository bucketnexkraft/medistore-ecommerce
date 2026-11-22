<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Enums\SalesChannel;
use App\Models\AiUsageLog;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Company;
use App\Models\DiscountSetup;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductBarcode;
use App\Models\ProductCombination;
use App\Models\ProductReview;
use App\Models\ProductStockGroup;
use App\Models\ProductVariant;
use App\Models\SalesChannel as InventorySalesChannel;
use App\Models\Unit;
use App\Services\ImageService;
use App\Services\ProductBundleService;
use App\Services\ProductSearchService;
use App\Services\ReturnSetupService;
use App\Helpers\Helper;
use App\Support\EcommerceCompanyContext;
use App\Utils\PermissionUtils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ProductControllerService
{
    private const USER_DEFINED_TYPE_DEMAND_TAG = 'demand_tag';
    private const PUBLIC_PRODUCT_PLACEHOLDER = 'placeholder/product-placeholder.svg';
    private ?bool $hasSalesChannelColumn = null;
    private ?bool $hasDemandTagsColumn = null;
    private ?bool $hasStockVisibilityColumn = null;
    private ?bool $hasStockVisibilityLabelColumn = null;

    public function __construct(
        private readonly ProductBundleService $productBundleService,
        private readonly ReturnSetupService $returnSetupService
    )
    {
    }

    private function productReturnConditionRule(): array
    {
        return [
            'nullable',
            function ($attribute, $value, $fail) {
                if (is_array($value)) {
                    return;
                }

                if (! is_string($value)) {
                    $fail('The return condition must be valid JSON.');
                    return;
                }

                if (trim($value) === '') {
                    return;
                }

                $decoded = json_decode($value, true);

                if (! is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
                    $fail('The return condition must be valid JSON.');
                }
            },
        ];
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

        $rows = $query
            ->orderBy('name', 'asc')
            ->get(['value', 'name']);

        $customOptions = $rows
            ->map(function ($row) {
                $rawValue = is_string($row->value) && trim($row->value) !== ''
                    ? $row->value
                    : $row->name;
                $value = str($rawValue)->lower()->replace(' ', '_')->value();

                return [
                    'value' => $value,
                    'label' => $row->name,
                ];
            })
            ->values();

        return collect($defaultOptions)
            ->keyBy('value')
            ->merge($customOptions->keyBy('value'))
            ->values()
            ->all();
    }

    private function demandTagValuesForCompany(?string $companyId): array
    {
        return collect($this->demandTagOptionsForCompany($companyId))
            ->pluck('value')
            ->filter(fn ($value) => is_string($value) && $value !== '')
            ->values()
            ->all();
    }

    private function scopedUnitsQuery()
    {
        return Unit::query()
            ->where('is_active', 1)
            ->when(
                !blank(Auth::user()?->company_id),
                fn ($query) => $query->where('company_id', Auth::user()?->company_id)
            );
    }

    private function normalizeSalesChannelPercentages($value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        if (!is_array($value)) {
            return [];
        }

        $allowedCodes = collect(SalesChannel::cases())
            ->map(fn (SalesChannel $channel) => $channel->value)
            ->all();

        return collect($value)
            ->mapWithKeys(function ($percentage, $code) {
                if (is_array($percentage)) {
                    $code = $percentage['channel_code'] ?? $percentage['code'] ?? $code;
                    $percentage = $percentage['percentage'] ?? $percentage['value'] ?? 0;
                }

                return [$this->normalizeSalesChannelCode($code) => (float) $percentage];
            })
            ->filter(fn ($percentage, $code) => in_array($code, $allowedCodes, true) && $percentage >= 0)
            ->map(fn ($percentage) => round($percentage, 2))
            ->all();
    }

    private function hasFractionalSalesChannelPercentage($value): bool
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        if (! is_array($value)) {
            return false;
        }

        foreach ($value as $percentage) {
            if (is_array($percentage)) {
                $percentage = $percentage['percentage'] ?? $percentage['value'] ?? 0;
            }

            if (is_numeric($percentage) && (float) $percentage !== floor((float) $percentage)) {
                return true;
            }
        }

        return false;
    }

    private function isWholeQuantity($value): bool
    {
        return is_numeric($value)
            && (float) $value >= 0
            && floor((float) $value) === (float) $value;
    }

    private function normalizeSalesChannelCode($code): string
    {
        return match (strtolower(trim((string) $code))) {
            'online_store', 'online store', 'onlinestore' => SalesChannel::OnlineStore->value,
            'pos_store', 'pos store', 'posstore' => SalesChannel::PosStore->value,
            'wholesale' => SalesChannel::Wholesale->value,
            default => strtoupper(trim((string) $code)),
        };
    }

    private function normalizeSegments($value, $fallback = null): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : [];
        }

        if (!is_array($value) || empty($value)) {
            $value = is_array($fallback) ? $fallback : [];
        }

        return collect($value)
            ->map(fn ($segment) => [
                'name' => trim((string) ($segment['name'] ?? $segment['segment_name'] ?? '')),
                'value' => trim((string) ($segment['value'] ?? $segment['segment_value'] ?? '')),
            ])
            ->filter(fn ($segment) => $segment['name'] !== '' || $segment['value'] !== '')
            ->values()
            ->all();
    }

    private function productHasSalesChannelColumn(): bool
    {
        if ($this->hasSalesChannelColumn === null) {
            $this->hasSalesChannelColumn = Schema::hasColumn('product', 'sales_channel');
        }

        return $this->hasSalesChannelColumn;
    }

    private function productHasDemandTagsColumn(): bool
    {
        if ($this->hasDemandTagsColumn === null) {
            $this->hasDemandTagsColumn = Schema::hasColumn('product', 'demand_tags');
        }

        return $this->hasDemandTagsColumn;
    }

    private function productHasStockVisibilityColumn(): bool
    {
        if ($this->hasStockVisibilityColumn === null) {
            $this->hasStockVisibilityColumn = Schema::hasColumn('product', 'stock_visibility');
        }

        return $this->hasStockVisibilityColumn;
    }

    private function productHasStockVisibilityLabelColumn(): bool
    {
        if ($this->hasStockVisibilityLabelColumn === null) {
            $this->hasStockVisibilityLabelColumn = Schema::hasColumn('product', 'stock_visibility_label');
        }

        return $this->hasStockVisibilityLabelColumn;
    }

    private function normalizeDemandTags($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        if (!is_array($value)) {
            return [];
        }

        $allowedTags = $this->demandTagValuesForCompany(Auth::user()?->company_id);

        return collect($value)
            ->filter(fn ($tag) => is_string($tag) && in_array($tag, $allowedTags, true))
            ->unique()
            ->values()
            ->all();
    }

    private function validateDemandTags($value, $validator): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $decoded = is_string($value) ? json_decode($value, true) : $value;
        $allowedTags = $this->demandTagValuesForCompany(Auth::user()?->company_id);

        if (!is_array($decoded)) {
            $validator->errors()->add('demand_tags', 'Demand tags must be a valid list.');
            return;
        }

        foreach ($decoded as $tag) {
            if (!is_string($tag) || !in_array($tag, $allowedTags, true)) {
                $validator->errors()->add('demand_tags', 'One or more demand tags are invalid.');
                return;
            }
        }
    }

    private function resolvePublicProductImage(?string $image): ?string
    {
        if (!is_string($image) || trim($image) === '') {
            return null;
        }

        if (filter_var($image, FILTER_VALIDATE_URL)) {
            return $image;
        }

        return ImageService::url($image, 'product-images');
    }

    private function resolvePublicProductThumbnail(?string $thumbnail): string
    {
        return $this->resolvePublicProductImage($thumbnail) ?: asset(self::PUBLIC_PRODUCT_PLACEHOLDER);
    }

    private function resolveStorefrontDiscountSetup(Product $product): ?DiscountSetup
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();

        return DiscountSetup::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('type', 'discount')
            ->where('is_active', true)
            ->whereDate('form_date', '<=', now()->toDateString())
            ->whereDate('to_date', '>=', now()->toDateString())
            ->orderBy('to_date')
            ->orderByDesc('id')
            ->get()
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
                      $productWarehouseIds = $product->relationLoaded('inventory_items')
                        ? collect($product->inventory_items)->pluck('warehouse_id')->filter()->map(fn ($value) => (string) $value)->values()->all()
                        : InventoryItem::query()
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

        if (!$setup || $basePrice <= 0) {
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

    private function normalizeGalleryImagePaths($value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : [$value];
        }

        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(function ($image) {
                if (! is_string($image)) {
                    return null;
                }

                $image = trim($image);

                if ($image === '') {
                    return null;
                }

                $image = preg_replace('#^https?://[^/]+/#', '', $image);
                $image = preg_replace('#^images/product-images/#', '', $image);
                $image = preg_replace('#^product-images/#', '', $image);

                return ltrim((string) $image, '/');
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function rawProductImages(Product $product): array
    {
        return $this->normalizeGalleryImagePaths($product->getRawOriginal('images'));
    }

    private function syncProductGallery(Product $product, Request $request, bool $isUpdate = false): void
    {
        $existingImages = $isUpdate
            ? $this->normalizeGalleryImagePaths($request->input('existing_images', $this->rawProductImages($product)))
            : [];

        $uploadedImages = collect($request->file('images', []))
            ->filter()
            ->map(fn ($file) => ImageService::upload($file, 'product-images'))
            ->values()
            ->all();

        $finalImages = collect($existingImages)
            ->merge($uploadedImages)
            ->filter(fn ($image) => is_string($image) && trim($image) !== '')
            ->unique()
            ->values()
            ->all();

        if ($isUpdate) {
            $removedImages = array_diff($this->rawProductImages($product), $existingImages);

            foreach ($removedImages as $removedImage) {
                ImageService::delete($removedImage, 'product-images');
            }
        }

        $product->images = ! empty($finalImages) ? json_encode($finalImages) : null;
    }

    public function list(Request $request)
    {
        $perPage = $request->input('perPage', 20); // Default to 20 items per page
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterCategory = $request->input('category', '');
        $filterBrand = $request->input('brand', '');
        $filterStatus = $request->input('status', '');
        $filterDemandTag = $request->input('demand_tag', '');
        $sortField = $request->input('sortField', 'created_at'); // Default to 'id'
        $sortOrder = $request->input('sortOrder', 'desc'); // Default to ascending

        $query = Product::query()->where('is_bundle', false);

        // Apply filters
        if ($filterCategory) {
            $query->where('category_id', $filterCategory);
        }

        if ($filterBrand) {
            $query->where('brand_id', $filterBrand);
        }

        if ($filterDemandTag) {
            $query->whereJsonContains('demand_tags', $filterDemandTag);
        }

        if (!empty($filterText)) {
            $hasProductCodeColumn = Schema::hasColumn('product', 'code');
            $hasProductSkuColumn = Schema::hasColumn('product', 'sku');

            $query->where(function ($q) use ($filterText, $hasProductCodeColumn, $hasProductSkuColumn) {
                $q->where('name', 'LIKE', "%{$filterText}%");

                if ($hasProductCodeColumn) {
                    $q->orWhere('code', 'LIKE', "%{$filterText}%");
                }

                if ($hasProductSkuColumn) {
                    $q->orWhere('sku', 'LIKE', "%{$filterText}%");
                }
            });
        }

        if ($filterStatus !== null && $filterStatus !== '') {
            $query->where('status', $filterStatus);
        }

        // Load relationships to avoid N+1 queries
        $query->with([
            'category',
            'company',
            'brand',
            'inventory',
            'unit',
            'inventory_items.salesChannels',
            'returnSetup',
        ]);

        // Apply sorting
        $query->orderBy($sortField, $sortOrder);
        // Fetch paginated data
        $products = $query->paginate($perPage, ['*'], 'page', $page);

        // Transform result for API
        $reservedBundleQuantities = $this->productBundleService->getReservedComponentQuantities(Auth::user()?->company_id);

        $data = $products->map(function ($product) use ($reservedBundleQuantities) {
            $rawQuantity = (float) $product->inventory->sum('quantity');
            $reservedBundleQuantity = (float) $reservedBundleQuantities->get($product->id, 0);
            $availableQuantity = max($this->resolveOnlineStoreQuantity($product, $rawQuantity) - $reservedBundleQuantity, 0);
            $variantsDisplay = collect($product->existingCombinations ?? [])
                ->map(function ($variant) {
                    $attrs = $variant['combination'] ?? [];

                    if (empty($attrs) || !is_array($attrs)) {
                        return null;
                    }

                    return collect($attrs)
                        ->map(fn($val, $key) => ucfirst($key) . ': ' . $val)
                        ->implode(', ');
                })
                ->filter()
                ->implode(' | ');

            if ($variantsDisplay === '') {
                $variantsDisplay = collect($product->variants ?? [])
                    ->map(fn($variant) => $this->formatVariant($variant))
                    ->filter(fn($variant) => $variant !== '' && $variant !== 'N/A')
                    ->implode(' | ');
            }

            return [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code ?? null,
                'category_id' => $product->category_id,
                'brand_id' => $product->brand_id,
                'unit_id' => $product->unit_id,
                'category' => $product?->category?->title ?? null,
                'brand' => $product->brand->title ?? null,
                'unit' => $product?->unit?->unit_name ?? null,
                'unit_code' => $product?->unit?->unit_code ?? null,
                'company' => $product?->company?->name ?? null,
                'thumbnail' => $product->thumbnail,
                'featured_image' => $product->featured_image,
                'is_featured' => (bool) $product->is_featured,
                'images' => $product->images,
                'price' => $product->inventory()
                    ->where('quantity', '>', 0)
                    ->orderBy('created_at', 'desc')
                    ->first()?->price ?? 0,
                'purchase_price' => $product->purchase_price,
                'total_quantity' => $availableQuantity,
                'raw_total_quantity' => $rawQuantity,
                'reserved_bundle_quantity' => $reservedBundleQuantity,
                'available_quantity' => $availableQuantity,
                'status' => $product->status,
                'attributes' => $product->variants,
                'segments' => $product->segmentation,
                'description' => $product->description,
                'return_enabled' => (bool) ($product->returnSetup?->return_enabled ?? false),
                'return_day' => $product->returnSetup?->return_day,
                'return_condition' => $product->returnSetup?->return_condition ?? [],
                'status' => $product->status,
                'vat' => $product->vat,
                'sales_channel' => $product->sales_channel,
                'demand_tags' => $product->demand_tags ?? [],
                'stock_visibility' => $product->stock_visibility ?? true,
                'stock_visibility_label' => $product->stock_visibility_label,
                'stock_display' => $product->stockDisplay($availableQuantity),
                'is_group_purchase_available' => (bool) ($product->is_group_purchase_available ?? false),
                'group_purchase_discount_type' => $product->group_purchase_discount_type,
                'group_purchase_minimum_user' => $product->group_purchase_minimum_user,
                'group_purchase_discount_amount' => $product->group_purchase_discount_amount !== null
                    ? (float) $product->group_purchase_discount_amount
                    : null,
                'has_variant' => $product->has_variant,
                'has_segment' => $product->has_segment,
                'variants_display' => $variantsDisplay,
            ];
        });

        $products->setCollection($data);

        return response()->json(
            [
                'status' => 1,
                'message' => 'Product fetched successfully',
                'data' => $products->items(),
                'meta' => [
                    'current_page' => $products->currentPage(),
                    'per_page' => $products->perPage(),
                    'total' => $products->total(),
                    'last_page' => $products->lastPage(),
                ],
                'others_data' => [],
            ],
            200,
        );
    }

    public function store(Request $request)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'sku' => [
                'required',
                'string',
                'max:100',
                Rule::unique('product', 'code')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'category_id' => [
                'required',
                Rule::exists('categories', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'unit_id' => [
                'nullable',
                Rule::exists('units', 'id')->where(function ($query) {
                    if (!blank(Auth::user()?->company_id)) {
                        $query->where('company_id', Auth::user()?->company_id);
                    }
                }),
            ],
            'brand_id' => [
                'required',
                Rule::exists('brand', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'status' => 'nullable',
            'description' => 'nullable|string',
            'return_enabled' => 'nullable|boolean',
            'return_day' => 'nullable|integer|min:0',
            'return_condition' => $this->productReturnConditionRule(),
            'thumbnail' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'featured_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'images' => 'nullable|array',
            'images.*' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'is_featured' => 'nullable|boolean',
            'vat' => 'nullable|integer|min:0|max:100',
            'is_group_purchase_available' => 'nullable|boolean',
            'group_purchase_discount_type' => ['nullable', Rule::in(['fixed', 'percent'])],
            'group_purchase_minimum_user' => 'nullable|integer|min:2|max:1000',
            'group_purchase_discount_amount' => 'nullable|numeric|min:0',
            'initial_quantity' => 'nullable|integer|min:0',
            'initial_selling_price' => 'nullable|numeric|min:0',
            'initial_inventory' => 'nullable|json',
            'variant_combinations' => 'nullable|json',
        ];

        if ($this->productHasSalesChannelColumn()) {
            $rules['sales_channel'] = 'nullable|json';
        }
        if ($this->productHasDemandTagsColumn()) {
            $rules['demand_tags'] = 'nullable';
        }
        if ($this->productHasStockVisibilityColumn()) {
            $rules['stock_visibility'] = 'nullable|boolean';
        }
        if ($this->productHasStockVisibilityLabelColumn()) {
            $rules['stock_visibility_label'] = 'nullable|string|max:100';
        }

        $validator = Validator::make($request->all(), $rules);

        $validator->after(function ($validator) use ($request) {
            if ($this->productHasSalesChannelColumn()) {
                if ($this->hasFractionalSalesChannelPercentage($request->input('sales_channel'))) {
                    $validator->errors()->add('sales_channel', 'Sales channel percentages must be whole numbers.');
                }

                $total = array_sum($this->normalizeSalesChannelPercentages($request->input('sales_channel')));

                if ($total > 100) {
                    $validator->errors()->add('sales_channel', 'Sales channel percentages cannot exceed 100%.');
                }
            }

            if ($this->productHasDemandTagsColumn()) {
                $this->validateDemandTags($request->input('demand_tags'), $validator);
            }

            $isGroupPurchaseAvailable = filter_var($request->input('is_group_purchase_available', false), FILTER_VALIDATE_BOOLEAN);

            if ($isGroupPurchaseAvailable) {
                if (! in_array($request->input('group_purchase_discount_type'), ['fixed', 'percent'], true)) {
                    $validator->errors()->add('group_purchase_discount_type', 'Group purchase discount type is required.');
                }

                if (blank($request->input('group_purchase_minimum_user'))) {
                    $validator->errors()->add('group_purchase_minimum_user', 'Minimum users are required for group purchase.');
                }

                if (blank($request->input('group_purchase_discount_amount'))) {
                    $validator->errors()->add('group_purchase_discount_amount', 'Discount amount is required for group purchase.');
                }
            }

            if (! $this->stockTrackingEnabled()) {
                $hasVariant = filter_var($request->input('has_variant', false), FILTER_VALIDATE_BOOLEAN);
                $initialInventory = $this->decodeInitialInventory($request->input('initial_inventory'));

                if ($hasVariant) {
                    if (empty($initialInventory)) {
                        $validator->errors()->add('initial_inventory', 'Quantity and selling price are required for every variant.');
                    } else {
                        foreach ($initialInventory as $index => $item) {
                            if (! is_array($item) || ! $this->isWholeQuantity($item['quantity'] ?? null)) {
                                $validator->errors()->add("initial_inventory.{$index}.quantity", 'Variant quantity must be a whole number zero or greater.');
                            }
                            if (! is_array($item) || ! is_numeric($item['selling_price'] ?? null) || (float) $item['selling_price'] < 0) {
                                $validator->errors()->add("initial_inventory.{$index}.selling_price", 'Variant selling price must be zero or greater.');
                            }
                        }
                    }
                } elseif (! $this->isWholeQuantity($request->input('initial_quantity'))) {
                    $validator->errors()->add('initial_quantity', 'Initial quantity must be a whole number zero or greater.');
                } elseif (! is_numeric($request->input('initial_selling_price')) || (float) $request->input('initial_selling_price') < 0) {
                    $validator->errors()->add('initial_selling_price', 'Selling price is required.');
                }
            }
        });

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        DB::beginTransaction();

        try {
            $productLimitError = $this->productCreationLimitError();
            if ($productLimitError) {
                DB::rollBack();

                return response()->json($productLimitError, 422);
            }

            $validated = $validator->validated();

            $product = new Product();
            $product->name = ucfirst($request->name);
            $product->code = $request->sku;
            $product->category_id = $request->category_id;
            $product->unit_id = $request->unit_id;
            $product->brand_id = $request->brand_id ?? null;
            $product->status = $request->status ?? 0;
            $product->description = $request->description;
            $product->is_featured = $request->boolean('is_featured', $request->boolean('isFeatured', false));

            $product->has_variant = $request->has_variant;
            $product->has_segment = $request->has_segment;

            $product->segmentation = $this->normalizeSegments(
                $request->input('segments'),
                $request->input('segments_array')
            );
            $product->variants = json_decode($request->variant, true);

            if ($request->hasFile('thumbnail')) {
                $product->thumbnail = ImageService::upload($request->file('thumbnail'), 'product-images');
            }

            if ($request->hasFile('featured_image')) {
                $product->featured_image = ImageService::upload($request->file('featured_image'), 'product-images');
            }

            $this->syncProductGallery($product, $request);

            $product->vat = $request->vat;
            if ($this->productHasSalesChannelColumn()) {
                $product->sales_channel = $this->normalizeSalesChannelPercentages($request->input('sales_channel'));
            }
            if ($this->productHasDemandTagsColumn()) {
                $product->demand_tags = $this->normalizeDemandTags($request->input('demand_tags'));
            }
            if ($this->productHasStockVisibilityColumn()) {
                $product->stock_visibility = $request->boolean('stock_visibility', true);
            }
            if ($this->productHasStockVisibilityLabelColumn()) {
                $product->stock_visibility_label = $request->filled('stock_visibility_label')
                    ? trim($request->input('stock_visibility_label'))
                    : null;
            }
            $product->is_group_purchase_available = $request->boolean('is_group_purchase_available', false);
            $product->group_purchase_discount_type = $product->is_group_purchase_available
                ? $request->input('group_purchase_discount_type')
                : null;
            $product->group_purchase_minimum_user = $product->is_group_purchase_available
                ? (int) $request->input('group_purchase_minimum_user')
                : null;
            $product->group_purchase_discount_amount = $product->is_group_purchase_available
                ? (float) $request->input('group_purchase_discount_amount')
                : null;
            $product->save();
            $this->syncProductCombinations($product, $request);
            $this->createInitialInventoryIfNeeded($product, $request);
            $this->returnSetupService->syncForProduct(
                $product,
                $request->input('return_enabled'),
                $request->input('return_day'),
                $request->input('return_condition')
            );
            $product->load('returnSetup');

            Helper::insertLanguage(Product::class, $product->id, 'en', 'name', $product->name);

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Product created successfully',
                    'data' => [
                        'id' => $product->id,
                        'name' => $product->name,
                        'sku' => $product->code,
                        'category' => optional($product->category)->title,
                        'brand' => optional($product->brand)->title,
                        'unit' => optional($product->unit)->unit_name,
                        'unit_code' => optional($product->unit)->unit_code,
                        'company' => optional($product->company)->name,
                        'thumbnail' => $product->thumbnail ? ImageService::url($product->thumbnail) : null,
                        'featured_image' => $product->featured_image ? ImageService::url($product->featured_image) : null,
                        'images' => $product->images,
                        'description' => $product->description,
                        'return_enabled' => (bool) ($product->returnSetup?->return_enabled ?? false),
                        'return_day' => $product->returnSetup?->return_day,
                        'return_condition' => $product->returnSetup?->return_condition ?? [],
                        'is_featured' => (bool) $product->is_featured,
                        'status' => $product->status,
                        'sales_channel' => $product->sales_channel,
                        'demand_tags' => $product->demand_tags,
                        'stock_visibility' => $product->stock_visibility,
                        'stock_visibility_label' => $product->stock_visibility_label,
                        'is_group_purchase_available' => (bool) $product->is_group_purchase_available,
                        'group_purchase_discount_type' => $product->group_purchase_discount_type,
                        'group_purchase_minimum_user' => $product->group_purchase_minimum_user,
                        'group_purchase_discount_amount' => $product->group_purchase_discount_amount !== null
                            ? (float) $product->group_purchase_discount_amount
                            : null,
                    ],
                ],
                200,
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to create product',
                    'error' => $e->getMessage(),
                ],
                500,
            );
        }
    }

    public function update(Request $request, $id)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'sku' => [
                'required',
                'string',
                'max:100',
                Rule::unique('product', 'code')->where(function ($query) use ($id) {
                    return $query->where('company_id', Auth::user()->company_id)
                                ->where('id', '!=', $id);
                }),
            ],
            'category_id' => [
                'required',
                Rule::exists('categories', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'unit_id' => [
                'required',
                Rule::exists('units', 'id')->where(function ($query) {
                    if (!blank(Auth::user()?->company_id)) {
                        $query->where('company_id', Auth::user()?->company_id);
                    }
                }),
            ],
            'brand_id' => [
                'nullable',
                Rule::exists('brand', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'status' => 'nullable|in:0,1',
            'description' => 'nullable|string',
            'return_enabled' => 'nullable|boolean',
            'return_day' => 'nullable|integer|min:0',
            'return_condition' => $this->productReturnConditionRule(),
            'thumbnail' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'featured_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'images' => 'nullable|array',
            'images.*' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'existing_images' => 'nullable|array',
            'existing_images.*' => 'nullable|string',
            'is_featured' => 'nullable|boolean',
            'vat' => 'nullable|integer|min:0|max:100',
            'is_group_purchase_available' => 'nullable|boolean',
            'group_purchase_discount_type' => ['nullable', Rule::in(['fixed', 'percent'])],
            'group_purchase_minimum_user' => 'nullable|integer|min:2|max:1000',
            'group_purchase_discount_amount' => 'nullable|numeric|min:0',
            'initial_quantity' => 'nullable|integer|min:0',
            'initial_selling_price' => 'nullable|numeric|min:0',
            'initial_inventory' => 'nullable|json',
            'variant_combinations' => 'nullable|json',
        ];

        if ($this->productHasSalesChannelColumn()) {
            $rules['sales_channel'] = 'nullable|json';
        }
        if ($this->productHasDemandTagsColumn()) {
            $rules['demand_tags'] = 'nullable';
        }
        if ($this->productHasStockVisibilityColumn()) {
            $rules['stock_visibility'] = 'nullable|boolean';
        }
        if ($this->productHasStockVisibilityLabelColumn()) {
            $rules['stock_visibility_label'] = 'nullable|string|max:100';
        }

        $validator = Validator::make($request->all(), $rules);

        $validator->after(function ($validator) use ($request) {
            if ($this->productHasSalesChannelColumn()) {
                if ($this->hasFractionalSalesChannelPercentage($request->input('sales_channel'))) {
                    $validator->errors()->add('sales_channel', 'Sales channel percentages must be whole numbers.');
                }

                $total = array_sum($this->normalizeSalesChannelPercentages($request->input('sales_channel')));

                if ($total > 100) {
                    $validator->errors()->add('sales_channel', 'Sales channel percentages cannot exceed 100%.');
                }
            }

            if ($this->productHasDemandTagsColumn()) {
                $this->validateDemandTags($request->input('demand_tags'), $validator);
            }

            $isGroupPurchaseAvailable = filter_var($request->input('is_group_purchase_available', false), FILTER_VALIDATE_BOOLEAN);

            if ($isGroupPurchaseAvailable) {
                if (! in_array($request->input('group_purchase_discount_type'), ['fixed', 'percent'], true)) {
                    $validator->errors()->add('group_purchase_discount_type', 'Group purchase discount type is required.');
                }

                if (blank($request->input('group_purchase_minimum_user'))) {
                    $validator->errors()->add('group_purchase_minimum_user', 'Minimum users are required for group purchase.');
                }

                if (blank($request->input('group_purchase_discount_amount'))) {
                    $validator->errors()->add('group_purchase_discount_amount', 'Discount amount is required for group purchase.');
                }
            }

            if (! $this->stockTrackingEnabled() && $request->hasAny(['initial_quantity', 'initial_selling_price', 'initial_inventory'])) {
                $hasVariant = filter_var($request->input('has_variant', false), FILTER_VALIDATE_BOOLEAN);
                $initialInventory = $this->decodeInitialInventory($request->input('initial_inventory'));

                if ($hasVariant) {
                    foreach ($initialInventory as $index => $item) {
                        if (! is_array($item) || ! $this->isWholeQuantity($item['quantity'] ?? null) || ! is_numeric($item['selling_price'] ?? null)) {
                            $validator->errors()->add("initial_inventory.{$index}", 'Variant quantity must be a whole number and selling price is required.');
                        }
                    }
                } elseif (! $this->isWholeQuantity($request->input('initial_quantity')) || ! is_numeric($request->input('initial_selling_price'))) {
                    $validator->errors()->add('initial_quantity', 'Quantity must be a whole number and selling price is required.');
                }
            }
        });

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Validation failed',
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        DB::beginTransaction();

        try {
            $validated = $validator->validated();

            $product = Product::findOrFail($id);
            $previousSlug = $product->slug;
            $product->name = ucfirst($request->name);
            $product->code = $request->sku;
            $product->category_id = $request->category_id;
            if ($request->filled('unit_id')) {
                $product->unit_id = $request->unit_id;
            }
            $product->brand_id = $request->brand_id ?? null;
            $product->status = $request->status ?? 0;
            $product->description = $request->description;
            $product->is_featured = $request->boolean('is_featured', $request->boolean('isFeatured', false));
            $product->has_variant = $request->has_variant;
            $product->has_segment = $request->has_segment;

            $product->segmentation = $this->normalizeSegments(
                $request->input('segments'),
                $request->input('segments_array')
            );
            $product->variants = json_decode($request->variant, true);

            if ($request->hasFile('thumbnail')) {
                $product->thumbnail = ImageService::upload($request->file('thumbnail'), 'product-images');
            }
            if ($request->hasFile('featured_image')) {
                $product->featured_image = ImageService::upload($request->file('featured_image'), 'product-images');
            }

            $this->syncProductGallery($product, $request, true);
            $product->vat = $request->vat;
            if ($this->productHasSalesChannelColumn()) {
                $product->sales_channel = $this->normalizeSalesChannelPercentages($request->input('sales_channel'));
            }
            if ($this->productHasDemandTagsColumn()) {
                $product->demand_tags = $this->normalizeDemandTags($request->input('demand_tags'));
            }
            if ($this->productHasStockVisibilityColumn() && $request->has('stock_visibility')) {
                $product->stock_visibility = $request->boolean('stock_visibility');
            }
            if ($this->productHasStockVisibilityLabelColumn() && $request->has('stock_visibility_label')) {
                $product->stock_visibility_label = $request->filled('stock_visibility_label')
                    ? trim($request->input('stock_visibility_label'))
                    : null;
            }
            $product->is_group_purchase_available = $request->boolean('is_group_purchase_available', false);
            $product->group_purchase_discount_type = $product->is_group_purchase_available
                ? $request->input('group_purchase_discount_type')
                : null;
            $product->group_purchase_minimum_user = $product->is_group_purchase_available
                ? (int) $request->input('group_purchase_minimum_user')
                : null;
            $product->group_purchase_discount_amount = $product->is_group_purchase_available
                ? (float) $request->input('group_purchase_discount_amount')
                : null;
            $product->save();
            $this->syncProductCombinations($product, $request);
            $this->updateInitialInventoryIfNeeded($product, $request);
            $this->returnSetupService->syncForProduct(
                $product,
                $request->input('return_enabled'),
                $request->input('return_day'),
                $request->input('return_condition')
            );
            $product->load('returnSetup');
            $this->forgetStorefrontProductCaches($product, $previousSlug);
            Helper::insertLanguage(Product::class, $product->id, 'en', 'name', $product->name);

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Product updated successfully',
                    'data' => [
                        'id' => $product->id,
                        'name' => $product->name,
                        'sku' => $product->code,
                        'category' => optional($product->category)->title,
                        'brand' => optional($product->brand)->title,
                        'unit' => optional($product->unit)->unit_name,
                        'unit_code' => optional($product->unit)->unit_code,
                        'company' => optional($product->company)->name,
                        'thumbnail' => $product->thumbnail ? ImageService::url($product->thumbnail) : null,
                        'featured_image' => $product->featured_image ? ImageService::url($product->featured_image) : null,
                        'images' => $product->images,
                        'description' => $product->description,
                        'return_enabled' => (bool) ($product->returnSetup?->return_enabled ?? false),
                        'return_day' => $product->returnSetup?->return_day,
                        'return_condition' => $product->returnSetup?->return_condition ?? [],
                        'is_featured' => (bool) $product->is_featured,
                        'status' => $product->status,
                        'sales_channel' => $product->sales_channel,
                        'demand_tags' => $product->demand_tags,
                        'stock_visibility' => $product->stock_visibility,
                        'stock_visibility_label' => $product->stock_visibility_label,
                        'is_group_purchase_available' => (bool) $product->is_group_purchase_available,
                        'group_purchase_discount_type' => $product->group_purchase_discount_type,
                        'group_purchase_minimum_user' => $product->group_purchase_minimum_user,
                        'group_purchase_discount_amount' => $product->group_purchase_discount_amount !== null
                            ? (float) $product->group_purchase_discount_amount
                            : null,
                    ],
                ],
                200,
            );
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to update product',
                    'error' => $e->getMessage(),
                ],
                500,
            );
        }
    }

    public function updateStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'required|exists:product,id',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422
            );
        }

        $data = $validator->validated();

        DB::beginTransaction();

        try {
            Product::whereIn('id', $data['ids'])->update([
                'status' => $data['status'],
            ]);

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Product statuses updated successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to update product statuses',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function delete(Request $request, $id = null)
    {
        DB::beginTransaction();

        try {
            // Handle single or bulk deletion
            $ids = $id ? [$id] : $request->input('ids', []);
            
            // Validate input
            if (empty($ids)) {
                throw new \Exception('No product IDs provided');
            }

            $request->validate([
                'ids' => 'sometimes|required|array',
                'ids.*' => 'exists:product,id',
            ]);

            $failedIds = [];
            foreach ($ids as $productId) {
                $product = Product::find($productId);
                if (!$product) {
                    $failedIds[] = $productId;
                    continue;
                }

                if ($product->getRawOriginal('thumbnail')) {
                    ImageService::delete($product->getRawOriginal('thumbnail'), 'product-images');
                }
                if ($product->getRawOriginal('featured_image')) {
                    ImageService::delete($product->getRawOriginal('featured_image'), 'product-images');
                }
                foreach ($this->rawProductImages($product) as $galleryImage) {
                    ImageService::delete($galleryImage, 'product-images');
                }

                // Delete the product
                $product->delete();
            }

            if (!empty($failedIds)) {
                throw new \Exception('Failed to delete products with IDs: ' . implode(', ', $failedIds));
            }

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'products deleted successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to delete products',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function details($id)
    {
        $warehouseId = Auth::user()?->warehouse_id;
        $product = Product::with([
            'category',
            'company',
            'brand',
            'unit',
            'inventory_items' => function ($query) use ($warehouseId) {
                $query->select('id', 'product_id', 'inventory_id', 'warehouse_id', 'variant_id', 'quantity', 'price')
                    ->when(
                        $warehouseId !== null,
                        fn ($q) => $q->orderByRaw('warehouse_id = ? DESC', [$warehouseId])
                    )
                    ->when(
                        $warehouseId === null,
                        fn ($q) => $q->orderByRaw('warehouse_id IS NULL DESC')
                    );
            },
            'existingCombinations:id,product_id,combination,segmentations',
        ])->find($id);
        if (!$product) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Product not found',
                ],
                404,
            );
        }

        return response()->json(
            [
                'status' => 1,
                'message' => 'Product details fetched successfully',
                'data' => array_merge($product->toArray(), [
                    'featured_image' => $product->featured_image,
                    'variant_combinations' => collect($product->existingCombinations ?? [])
                        ->pluck('combination')
                        ->merge(collect($product->inventory_items ?? [])->pluck('variant_id'))
                        ->filter(fn ($combination) => is_array($combination) && $combination !== [])
                        ->unique(fn ($combination) => json_encode($this->normalizeCombination($combination), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
                        ->values()
                        ->all(),
                    'return_enabled' => (bool) ($product->returnSetup?->return_enabled ?? false),
                    'return_day' => $product->returnSetup?->return_day,
                    'return_condition' => $product->returnSetup?->return_condition ?? [],
                    'is_featured' => (bool) $product->is_featured,
                    'is_group_purchase_available' => (bool) ($product->is_group_purchase_available ?? false),
                    'group_purchase_discount_type' => $product->group_purchase_discount_type,
                    'group_purchase_minimum_user' => $product->group_purchase_minimum_user,
                    'group_purchase_discount_amount' => $product->group_purchase_discount_amount !== null
                        ? (float) $product->group_purchase_discount_amount
                        : null,
                ]),
            ],
            200,
        );
    }

    public function destroyMultiple(Request $request)
    {
        return $this->delete($request);
    }
    
    public function search(Request $request, ProductSearchService $service, ?string $channelCode = null)
    {
        $searchInput = (array) $request->input('search_value', []);
        $searchInput['warehouse_id'] = $searchInput['warehouse_id'] ?? Auth::user()?->warehouse_id;
        $searchInput['channel_code'] = $channelCode;
        $result = $service->search($searchInput);

        $httpCode = $result['http_code'] ?? 200;
        unset($result['http_code']);

        return response()->json($result, $httpCode);
    }

    /**
     * Format variant array to readable string
     */
    private function formatVariant($variant): string
    {
        if (empty($variant) || !is_array($variant)) return 'N/A';
        return collect($variant)
            ->map(fn($value, $key) => ucfirst($key) . ': ' . $value)
            ->implode(', ');
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

        $channelQuery = InventorySalesChannel::query()
            ->where('channel_code', $channelCode)
            ->whereHas('inventoryItem', function ($query) use ($product) {
                $query->where('product_id', $product->id);
            });

        return [
            'exists' => $channelQuery->exists(),
            'quantity' => (float) $channelQuery->sum('quantity'),
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

    private function productCreationLimitError(): ?array
    {
        $authUser = Auth::user();

        if (! $authUser?->company_id || $authUser->isSuperAdmin()) {
            return null;
        }

        $company = Company::query()
            ->with('saasPlan')
            ->where('company_id', $authUser->company_id)
            ->lockForUpdate()
            ->first();
        $productLimit = (int) ($company?->saasPlan?->inventory_item_limit ?? 0);

        // A zero inventory limit is treated as unlimited, as in the SaaS plan UI.
        if ($productLimit <= 0) {
            return null;
        }

        $productCount = Product::withoutGlobalScopes()
            ->where('company_id', $authUser->company_id)
            ->whereNull('deleted_at')
            ->count();

        if ($productCount < $productLimit) {
            return null;
        }

        return [
            'status' => 0,
            'message' => "Your plan allows up to {$productLimit} inventory items. Please upgrade your plan to add another product.",
            'errors' => ["Product limit of {$productLimit} reached."],
        ];
    }

    private function stockTrackingEnabled(): bool
    {
        $companyId = Auth::user()?->company_id;

        if (! $companyId) {
            return true;
        }

        return ! in_array(
            (string) Company::query()->where('company_id', $companyId)->value('stock_tracking_enabled'),
            ['0', 'false'],
            true
        );
    }

    private function decodeInitialInventory(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        return is_array($value) ? array_values($value) : [];
    }

    private function createInitialInventoryIfNeeded(Product $product, Request $request): void
    {
        if (! $request->hasAny(['initial_quantity', 'initial_selling_price', 'initial_inventory'])) {
            return;
        }

        $this->syncInitialInventory($product, $request);
    }

    private function updateInitialInventoryIfNeeded(Product $product, Request $request): void
    {
        if (! $request->hasAny(['initial_quantity', 'initial_selling_price', 'initial_inventory'])) {
            return;
        }

        $this->syncInitialInventory($product, $request);
    }

    private function syncProductCombinations(Product $product, Request $request): void
    {
        if (! filter_var($request->input('has_variant', false), FILTER_VALIDATE_BOOLEAN)) {
            ProductCombination::query()->where('product_id', $product->id)->delete();

            return;
        }

        $combinations = collect($this->decodeInitialInventory($request->input('variant_combinations')))
            ->map(fn ($combination) => $this->normalizeCombination((array) $combination))
            ->filter(fn ($combination) => $combination !== [])
            ->unique(fn ($combination) => json_encode($combination, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
            ->values();

        if ($combinations->isEmpty()) {
            return;
        }

        $activeKeys = $combinations->map(fn ($combination) => json_encode(
            $combination,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        ));

        ProductCombination::query()
            ->where('product_id', $product->id)
            ->get()
            ->each(function (ProductCombination $existing) use ($activeKeys) {
                $key = json_encode(
                    $this->normalizeCombination((array) $existing->combination),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                );

                if (! $activeKeys->contains($key)) {
                    $existing->delete();
                }
            });

        foreach ($combinations as $combination) {
            $key = json_encode($combination, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $existing = ProductCombination::query()
                ->where('product_id', $product->id)
                ->get()
                ->first(fn (ProductCombination $item) => json_encode(
                    $this->normalizeCombination((array) $item->combination),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                ) === $key);

            if (! $existing) {
                ProductCombination::query()->create([
                    'product_id' => $product->id,
                    'combination' => $combination,
                    'segmentations' => null,
                ]);
            }
        }
    }

    private function syncInitialInventory(Product $product, Request $request): void
    {
        $companyId = Auth::user()?->company_id ?: $product->company_id;
        $warehouseId = Auth::user()?->warehouse_id ?: null;
        $hasVariant = filter_var($request->input('has_variant', false), FILTER_VALIDATE_BOOLEAN);
        $variantRows = $this->decodeInitialInventory($request->input('variant'));
        $rows = $hasVariant
            ? $this->decodeInitialInventory($request->input('initial_inventory'))
            : [[
                'quantity' => $request->input('initial_quantity'),
                'selling_price' => $request->input('initial_selling_price'),
                'variant_id' => null,
            ]];

        $inventoryQuery = Inventory::query()
            ->where('product_id', $product->id)
            ->where('company_id', $companyId);
        $warehouseId === null
            ? $inventoryQuery->whereNull('warehouse_id')
            : $inventoryQuery->where('warehouse_id', $warehouseId);

        $inventory = $inventoryQuery->first() ?: new Inventory();
        $inventory->company_id = $companyId;
        $inventory->warehouse_id = $warehouseId;
        $inventory->product_id = $product->id;
        $inventory->quantity = collect($rows)->sum(fn ($row) => (float) ($row['quantity'] ?? 0));
        $inventory->alert_quantity = 0;
        $inventory->stock_out_mood = 'FIFO';
        $inventory->save();

        $existingItems = $inventory->exists
            ? InventoryItem::query()->where('inventory_id', $inventory->id)->get()
            : collect();
        $usedItemIds = [];

        foreach ($rows as $index => $row) {
            $variantId = $row['variant_id'] ?? ($hasVariant ? ($variantRows[$index] ?? null) : null);
            $variantId = is_array($variantId) ? $variantId : null;

            if ($variantId !== null) {
                $variantId = $this->normalizeCombination($variantId);
                $combinationKey = json_encode($variantId, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $combinationExists = ProductCombination::query()
                    ->where('product_id', $product->id)
                    ->get()
                    ->contains(fn (ProductCombination $combination) => json_encode(
                        $this->normalizeCombination((array) $combination->combination),
                        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                    ) === $combinationKey);

                if (! $combinationExists) {
                    ProductCombination::query()->create([
                        'product_id' => $product->id,
                        'combination' => $variantId,
                        'segmentations' => null,
                    ]);
                }
            }

            $existingItem = $existingItems
                ->first(fn ($item) => ! in_array($item->id, $usedItemIds, true)
                    && json_encode($item->variant_id, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    === json_encode($variantId, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

            if ($existingItem) {
                $item = $existingItem;
                $usedItemIds[] = $item->id;
                $item->quantity = (float) ($row['quantity'] ?? 0);
                $item->price = (float) ($row['selling_price'] ?? 0);
                $item->save();
            } else {
                $barcode = $hasVariant ? $product->code.'-'.($index + 1) : $product->code;
                $item = InventoryItem::create([
                    'inventory_id' => $inventory->id,
                    'company_id' => $companyId,
                    'warehouse_id' => $warehouseId,
                    'product_id' => $product->id,
                    'barcode' => $barcode,
                    'sku' => $barcode,
                    'quantity' => (float) ($row['quantity'] ?? 0),
                    'variant_id' => $variantId,
                    'price' => (float) ($row['selling_price'] ?? 0),
                    'purchase_price' => 0,
                    'stock_out_mood' => 'FIFO',
                    'alert_quantity' => 0,
                ]);

                ProductBarcode::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'inventory_id' => $inventory->id,
                        'inventory_item_id' => $item->id,
                        'barcode' => $barcode,
                    ],
                    ['company_id' => $companyId, 'use_custom_barcode' => false]
                );
            }
        }

        $existingItems
            ->reject(fn ($item) => in_array($item->id, $usedItemIds, true))
            ->each(function ($item) {
                $item->quantity = 0;
                $item->save();
            });
    }

    private function storefrontCacheKey(string $suffix, ?string $companyId = null): string
    {
        return sprintf('storefront:product:%s:%s', $suffix, $companyId ?: 'global');
    }

    private function forgetStorefrontProductCaches(Product $product, ?string $previousSlug = null): void
    {
        $companyId = $product->company_id ?: EcommerceCompanyContext::currentCompanyId();
        $slugs = collect([$previousSlug, $product->slug])
            ->filter(fn ($slug) => is_string($slug) && trim($slug) !== '')
            ->map(fn ($slug) => strtolower(trim((string) $slug)))
            ->unique()
            ->values()
            ->all();

        foreach ($slugs as $slug) {
            Cache::forget($this->storefrontCacheKey('details:' . $slug, $companyId));
        }

        $this->forgetStorefrontGroupPurchaseCaches($companyId);
    }

    private function forgetStorefrontGroupPurchaseCaches(?string $companyId = null): void
    {
        foreach (range(1, 24) as $limit) {
            Cache::forget(sprintf('storefront:group-purchases:%s:%d', $companyId ?: 'global', $limit));
        }
    }

    function getProductOptions()
    {
        $companyId = Auth::user()?->company_id;

        $categories = Category::where('status', 1)
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->select('id', 'title')
            ->orderBy('title', 'asc')
            ->get()
            ->unique(fn (Category $category) => mb_strtolower(trim((string) $category->title)))
            ->values();

        $brands = Brand::where('status', 1)
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->select('id', 'title')
            ->orderBy('title', 'asc')
            ->get()
            ->unique(fn (Brand $brand) => mb_strtolower(trim((string) $brand->title)))
            ->values();

        return response()->json(
            [
                'status' => 1,
                'message' => '',
                'data' => [
                    'categories' => $categories,
                    'brands' => $brands,
                    'units' => $this->scopedUnitsQuery()
                        ->select('id', 'unit_name', 'unit_code')
                        ->orderBy('unit_name', 'asc')
                        ->get(),
                    'variants' => ProductVariant::with('attributes')->select('id', 'name')->get(),
                    'demand_tags' => $this->demandTagOptionsForCompany(Auth::user()?->company_id),
                ],
            ],
            200,
        );
    }

    function getVariantAttributes(Request $request)
    {
        $variantId = $request->input('variant_id');
        if (!$variantId) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Variant ID is required',
                ],
                400,
            );
        }

        $variant = ProductVariant::with('attributes')->find($variantId);
        if (!$variant) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Variant not found',
                ],
                404,
            );
        }

        return response()->json(
            [
                'status' => 1,
                'message' => 'Variant attributes fetched successfully',
                'data' => $variant->attributes,
            ],
            200,
        );
    }

    function getAllProduct()
    {
        $products = Product::where('status', 1)
            ->with([
                'barcodes' => function ($query) {
                    $query->select('id', 'product_id', 'barcode', 'custom_barcode');
                },
                'inventory_items' => function ($query) {
                    $query->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->with('salesChannels')
                        ->orderByDesc('created_at');
                },
            ])
            ->get();

        $reservedBundleQuantities = $this->productBundleService->getReservedComponentQuantities(Auth::user()?->company_id);

        $data = $products->map(function ($product) use ($reservedBundleQuantities) {
            $latestInStockPrice = optional(
                $product->inventory_items->firstWhere('quantity', '>', 0)
            )->price;

            $latestKnownPrice = optional($product->inventory_items->first())->price;
            $resolvedPrice = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
            $rawAvailableQuantity = (float) $product->inventory_items
                ->where('quantity', '>', 0)
                ->sum('quantity');
            $reservedBundleQuantity = (float) $reservedBundleQuantities->get($product->id, 0);
            $availableQuantity = max($this->resolveOnlineStoreQuantity($product, $rawAvailableQuantity) - $reservedBundleQuantity, 0);

            return array_merge($product->toArray(), [
                'sku' => $product->code,
                'selling_price' => $resolvedPrice,
                'price' => $resolvedPrice,
                'available_quantity' => $availableQuantity,
                'raw_total_quantity' => $rawAvailableQuantity,
                'reserved_bundle_quantity' => $reservedBundleQuantity,
                'sales_channel' => $product->sales_channel,
                'demand_tags' => $product->demand_tags ?? [],
                'stock_visibility' => $product->stock_visibility ?? true,
                'stock_visibility_label' => $product->stock_visibility_label,
                'stock_display' => $product->stockDisplay($availableQuantity),
                'is_group_purchase_available' => (bool) ($product->is_group_purchase_available ?? false),
                'group_purchase_discount_type' => $product->group_purchase_discount_type,
                'group_purchase_minimum_user' => $product->group_purchase_minimum_user,
                'group_purchase_discount_amount' => $product->group_purchase_discount_amount !== null
                    ? (float) $product->group_purchase_discount_amount
                    : null,
            ]);
        });

        return response()->json(
            [
                'status' => 1,
                'message' => 'Product fetched successfully',
                'data' => $data,
            ],
            200,
        );
    }

    public function publicSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $limit = max(1, min((int) $request->query('limit', 8), 12));

        if ($query === '') {
            return response()->json([
                'status' => 1,
                'message' => 'Product suggestions fetched successfully',
                'data' => [],
            ], 200);
        }

        $products = Product::query()
            ->where('company_id', EcommerceCompanyContext::currentCompanyId())
            ->where('status', 1)
            ->where('is_bundle', false)
            ->where(function ($builder) use ($query) {
                $builder->where('name', 'like', "%{$query}%")
                    ->orWhere('slug', 'like', "%{$query}%");

                if (Schema::hasColumn('product', 'code')) {
                    $builder->orWhere('code', 'like', "%{$query}%");
                }
            })
            ->with([
                'category:id,title',
                'inventory_items' => function ($builder) {
                    $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->orderByDesc('created_at');
                },
            ])
            ->orderByRaw(
                "CASE
                    WHEN name LIKE ? THEN 0
                    WHEN name LIKE ? THEN 1
                    WHEN slug LIKE ? THEN 2
                    ELSE 3
                END",
                [$query, "%{$query}%", "%{$query}%"]
            )
            ->orderBy('name')
            ->limit($limit)
            ->get();

        $data = $products->map(function (Product $product) {
            $latestInStockPrice = optional(
                $product->inventory_items->firstWhere('quantity', '>', 0)
            )->price;

            $latestKnownPrice = optional($product->inventory_items->first())->price;
            $resolvedPrice = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);

            return [
                'id' => $product->id,
                'name' => $product->name,
                'slug' => $product->slug,
                'code' => $product->code ?? null,
                'thumbnail' => $this->resolvePublicProductThumbnail($product->thumbnail),
                'category' => $product->category?->title,
                'price' => $resolvedPrice,
                'url' => '/product/' . $product->slug,
            ];
        })->values();

        return response()->json([
            'status' => 1,
            'message' => 'Product suggestions fetched successfully',
            'data' => $data,
        ], 200);
    }

    public function publicDetails(string $slug)
    {
        $normalizedSlug = strtolower(trim($slug));
        $companyId = EcommerceCompanyContext::currentCompanyId();
        $cacheKey = $this->storefrontCacheKey('details:v3:' . $normalizedSlug, $companyId);

        $payload = Cache::remember($cacheKey, now()->addMinutes(2), function () use ($companyId, $normalizedSlug) {
            $product = Product::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->whereRaw('LOWER(slug) = ?', [$normalizedSlug])
                ->where('status', 1)
                ->where('is_bundle', false)
                ->withCount('reviews')
                ->withAvg('reviews', 'rating')
                ->with([
                    'category:id,title,slug',
                    'brand:id,title,slug',
                    'unit:id,unit_name,unit_code',
                    'returnSetup:product_id,return_enabled,return_day,return_condition',
                    'existingCombinations:id,product_id,combination',
                    'inventory_items' => function ($builder) {
                        $builder->select('id', 'product_id', 'variant_id', 'price', 'quantity', 'created_at')
                            ->orderByDesc('created_at');
                    },
                ])
                ->first();

            if (! $product) {
                return null;
            }

            $latestInStockPrice = optional(
                $product->inventory_items->firstWhere('quantity', '>', 0)
            )->price;
            $latestKnownPrice = optional($product->inventory_items->first())->price;
            $resolvedPrice = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
            $pricing = $this->resolveStorefrontDiscountPricing($product, $resolvedPrice);
            $rawQuantity = (float) $product->inventory_items->where('quantity', '>', 0)->sum('quantity');
            $availableQuantity = $this->resolveOnlineStoreQuantity($product, $rawQuantity);
            $stockDisplay = $product->stockDisplay($availableQuantity);

            $variantsDisplay = collect($product->existingCombinations ?? [])
                ->map(function ($variant) {
                    $attrs = $variant['combination'] ?? [];

                    if (empty($attrs) || !is_array($attrs)) {
                        return null;
                    }

                    return collect($attrs)
                        ->map(fn ($val, $key) => ucfirst($key) . ': ' . $val)
                        ->implode(', ');
                })
                ->filter()
                ->values()
                ->all();

            $combinations = collect($product->existingCombinations ?? [])
                ->map(function ($combination) use ($product) {
                    $variant = is_array($combination->combination) ? $combination->combination : [];
                    $matchingInventory = $product->inventory_items->filter(function ($item) use ($variant) {
                        $itemVariant = is_array($item->variant_id) ? $item->variant_id : [];
                        return $this->normalizeCombination($itemVariant) === $this->normalizeCombination($variant);
                    });

                    $latestItem = $matchingInventory->sortByDesc('created_at')->first();
                    return [
                        'id' => $combination->id,
                        'combination' => $variant,
                        'quantity' => (float) $matchingInventory->sum('quantity'),
                        'price' => $latestItem?->price !== null ? (float) $latestItem->price : null,
                    ];
                })
                ->filter(fn ($item) => $item['combination'] !== [])
                ->values()
                ->all();

            if (empty($variantsDisplay)) {
                $variantsDisplay = collect($product->variants ?? [])
                    ->map(fn ($variant) => $this->formatVariant($variant))
                    ->filter(fn ($variant) => $variant !== '' && $variant !== 'N/A')
                    ->values()
                    ->all();
            }

            $rawFeaturedImage = $product->getRawOriginal('featured_image');
            $rawThumbnail = $product->getRawOriginal('thumbnail');
            $gallery = collect([$rawThumbnail])
                ->merge($this->rawProductImages($product))
                ->map(fn ($image) => $this->resolvePublicProductImage($image))
                ->filter(fn ($image) => is_string($image) && trim($image) !== '')
                ->unique()
                ->values()
                ->all();

            $productReviews = ProductReview::query()
                ->withoutGlobalScope('company')
                ->where('product_id', $product->id)
                ->with('user:id,first_name,last_name,email,phone')
                ->latest('created_at')
                ->limit(12)
                ->get();

            $reviewsCount = (int) ($product->reviews_count ?? 0);
            $averageRating = $reviewsCount > 0
                ? round((float) ($product->reviews_avg_rating ?? 0), 1)
                : 0.0;

            $relatedProducts = Product::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('status', 1)
                ->where('is_bundle', false)
                ->where('id', '!=', $product->id)
                ->with([
                    'category:id,title,slug',
                    'brand:id,title',
                    'inventory_items' => function ($builder) {
                        $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                            ->orderByDesc('created_at');
                    },
                ])
                ->latest('created_at')
                ->take(4)
                ->get()
                ->map(function (Product $related) {
                    $quantity = $this->resolveOnlineStoreQuantity(
                        $related,
                        (float) $related->inventory_items->where('quantity', '>', 0)->sum('quantity')
                    );
                    $relatedLatestInStockPrice = optional(
                        $related->inventory_items->firstWhere('quantity', '>', 0)
                    )->price;
                    $relatedLatestKnownPrice = optional($related->inventory_items->first())->price;
                    $relatedBasePrice = (float) ($relatedLatestInStockPrice ?? $relatedLatestKnownPrice ?? 0);
                    $relatedPricing = $this->resolveStorefrontDiscountPricing($related, $relatedBasePrice);

                    return [
                        'id' => (string) $related->id,
                        'name' => (string) $related->name,
                        'slug' => (string) $related->slug,
                        'thumbnail' => $this->resolvePublicProductThumbnail($related->thumbnail),
                        'price' => (float) $relatedPricing['price'],
                        'original_price' => $relatedPricing['original_price'],
                        'discount_percent' => (int) $relatedPricing['discount_percent'],
                        'quantity' => $quantity,
                        'brand' => (string) ($related->brand?->title ?? ''),
                        'category' => $related->category ? [
                            'name' => (string) $related->category->title,
                            'slug' => (string) $related->category->slug,
                        ] : null,
                        'url' => '/product/' . $related->slug,
                    ];
                })
                ->values()
                ->all();

            return [
                'id' => $product->id,
                'name' => $product->name,
                'slug' => $product->slug,
                'code' => $product->code ?? null,
                'thumbnail' => $this->resolvePublicProductThumbnail($rawThumbnail),
                'featured_image' => $this->resolvePublicProductThumbnail($rawThumbnail),
                'images' => collect($this->rawProductImages($product))
                    ->map(fn ($image) => $this->resolvePublicProductImage($image))
                    ->filter()
                    ->values()
                    ->all(),
                'gallery' => $gallery,
                'category' => $product->category ? [
                    'id' => (string) $product->category->id,
                    'name' => (string) $product->category->title,
                    'slug' => (string) $product->category->slug,
                ] : null,
                'brand' => $product->brand ? [
                    'id' => (string) $product->brand->id,
                    'name' => (string) $product->brand->title,
                    'slug' => (string) $product->brand->slug,
                ] : null,
                'unit' => $product->unit ? [
                    'id' => (string) $product->unit->id,
                    'name' => (string) $product->unit->unit_name,
                    'code' => (string) $product->unit->unit_code,
                ] : null,
                'price' => (float) $pricing['price'],
                'original_price' => $pricing['original_price'],
                'discount_percent' => (int) $pricing['discount_percent'],
                'combinations' => $combinations,
                'description' => (string) ($product->description ?? ''),
                'return_enabled' => (bool) ($product->returnSetup?->return_enabled ?? false),
                'return_day' => $product->returnSetup?->return_day,
                'return_condition' => $product->returnSetup?->return_condition ?? [],
                'is_featured' => (bool) $product->is_featured,
                'demand_tags' => $product->demand_tags ?? [],
                'sales_channel' => $product->sales_channel ?? [],
                'vat' => (float) ($product->vat ?? 0),
                'has_variant' => (bool) $product->has_variant,
                'variants' => $product->variants ?? [],
                'variants_display' => $variantsDisplay,
                'available_quantity' => $availableQuantity,
                'raw_total_quantity' => $rawQuantity,
                'stock_visibility' => $product->stock_visibility ?? true,
                'stock_visibility_label' => $product->stock_visibility_label,
                'stock_display' => $stockDisplay,
                'is_group_purchase_available' => (bool) ($product->is_group_purchase_available ?? false),
                'group_purchase_discount_type' => $product->group_purchase_discount_type,
                'group_purchase_minimum_user' => $product->group_purchase_minimum_user,
                'group_purchase_discount_amount' => $product->group_purchase_discount_amount !== null
                    ? (float) $product->group_purchase_discount_amount
                    : null,
                'reviews_count' => $reviewsCount,
                'average_rating' => $averageRating,
                'reviews' => $productReviews->map(function (ProductReview $review) {
                    $reviewerName = trim(implode(' ', array_filter([
                        (string) ($review->user?->first_name ?? ''),
                        (string) ($review->user?->last_name ?? ''),
                    ])));

                    return [
                        'id' => (string) $review->id,
                        'rating' => (int) $review->rating,
                        'comment' => (string) ($review->comment ?? ''),
                        'created_at' => optional($review->created_at)?->toIso8601String(),
                        'reviewer' => $reviewerName !== ''
                            ? $reviewerName
                            : (string) ($review->user?->email ?? $review->user?->phone ?? 'Customer'),
                    ];
                })->values()->all(),
                'related_products' => $relatedProducts,
            ];
        });

        if (! $payload) {
            return response()->json([
                'status' => 0,
                'message' => 'Product not found',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Product fetched successfully',
            'data' => $payload,
        ], 200);
    }

    public function publicCombinations(Request $request, string $productId)
    {
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest($request)
            ?? EcommerceCompanyContext::currentCompanyId();

        $product = Product::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('id', $productId)
            ->where('status', 1)
            ->where('is_bundle', false)
            ->with('existingCombinations:id,product_id,combination,segmentations')
            ->first();

        if (! $product) {
            return response()->json([
                'status' => 0,
                'message' => 'Product not found',
                'data' => [],
            ], 404);
        }

        $combinations = collect($product->existingCombinations ?? [])
            ->map(function ($combination) use ($productId, $companyId) {
                $variant = $combination->combination ?? [];
                $quantity = $this->resolveCombinationQuantity($productId, $variant, $companyId);

                return [
                    'id' => $combination->id,
                    'combination' => $variant,
                    'segmentations' => $combination->segmentations ?? [],
                    'quantity' => $quantity,
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'status' => 1,
            'message' => 'Product combinations fetched successfully',
            'data' => $combinations,
        ], 200);
    }

    public function fetchCombinationData(Request $request)
    {
        // ==============================================================
        // 1. VALIDATION
        // ==============================================================
        $validator = Validator::make($request->all(), [
            'product_id'   => 'required|string',
            'combination'  => 'nullable|array',
            'lot_number'   => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 0,
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $productId   = $request->input('product_id');
        $combination = $request->input('combination');
        $lotNumber   = $request->input('lot_number');
        $normalizedCombination = $this->normalizeCombination((array) $combination);
        $combinationJson = $normalizedCombination !== []
            ? json_encode($normalizedCombination, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            : null;

        // ==============================================================
        // 2. BUILD QUERY ON inventory_items (correct table)
        // ==============================================================
        $query = InventoryItem::query()
            ->with(['inventory.warehouse', 'inventory.product'])
            ->whereHas('inventory', fn($q) => $q->where('product_id', $productId));

        if ($combinationJson) {
            $query->where(function ($variantQuery) use ($normalizedCombination, $combinationJson) {
                $variantQuery->where('variant_id', $combinationJson);

                if ($normalizedCombination !== []) {
                    $variantQuery->orWhereJsonContains('variant_id', $normalizedCombination);
                }
            });
        }

        // Optional lot number
        if ($lotNumber) {
            $query->where('lot_number', $lotNumber);
        }

        // ==============================================================
        // 3. FETCH SINGLE ITEM
        // ==============================================================
        $item = $query->orderby('created_at', 'desc')->first();
        $items_qty = (float) $query->sum('quantity');

        if (!$item) {
            return response()->json([
                'status'  => 0,
                'message' => 'Variant combination not found',
            ], 404);
        }

        // ==============================================================
        // 4. FORMAT RESPONSE
        // ==============================================================
        return response()->json([
            'status'  => 1,
            'message' => 'Variant fetched successfully',
                'data'    => [
                    'id'             => $item->id,
                    'inventory_id'   => $item->inventory_id,
                    'product_id'     => $item->inventory->product_id,
                    'warehouse'      => $item->inventory->warehouse?->name ?? 'N/A',
                    'variant'        => $item->variant_id, // JSON array
                    'lot_number'     => $item->lot_number,
                    'quantity'       => $items_qty,
                    'selling_price'  => (float) $item->price,
                    'purchase_price' => (float) $item->purchase_price,
                    'created_at'     => $item->created_at->toIso8601String(),
                ],
            ], 200);
    }

    private function resolveCombinationQuantity(string $productId, array $combination, ?string $companyId = null): float
    {
        $normalizedCombination = $this->normalizeCombination($combination);

        if ($normalizedCombination === []) {
            return 0;
        }

        $combinationJson = json_encode($normalizedCombination, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $query = InventoryItem::query()
            ->when($companyId, fn ($builder) => $builder->where('company_id', $companyId))
            ->where('product_id', $productId)
            ->where(function ($variantQuery) use ($normalizedCombination, $combinationJson) {
                $variantQuery->where('variant_id', $combinationJson);

                if ($normalizedCombination !== []) {
                    $variantQuery->orWhereJsonContains('variant_id', $normalizedCombination);
                }
            });

        return (float) $query->sum('quantity');
    }

    private function normalizeCombination(array $combination): array
    {
        $normalized = [];

        foreach ($combination as $key => $value) {
            if ($value === null) {
                continue;
            }

            $normalized[(string) $key] = is_string($value) ? trim($value) : (string) $value;
        }

        ksort($normalized);

        return $normalized;
    }

    private function currentAiUsageCount(string $companyId, string $featureKey = 'product_description'): int
    {
        if (! Schema::hasTable('ai_usage_logs')) {
            return 0;
        }

        return AiUsageLog::query()
            ->where('company_id', $companyId)
            ->where('feature_key', $featureKey)
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();
    }

    private function recordAiUsage(string $companyId, ?string $userId, string $featureKey, string $generatedDescription): void
    {
        if (! Schema::hasTable('ai_usage_logs')) {
            return;
        }

        AiUsageLog::query()->create([
            'company_id' => $companyId,
            'user_id' => $userId,
            'feature_key' => $featureKey,
            'characters_generated' => mb_strlen(trim(strip_tags($generatedDescription))),
        ]);
    }

    private function normalizeGeneratedDescription(string $generatedDescription, int $maxTextLength): string
    {
        $generatedDescription = trim($generatedDescription);

        if ($maxTextLength <= 0) {
            return $generatedDescription;
        }

        $plainText = trim(strip_tags($generatedDescription));

        if (mb_strlen($plainText) <= $maxTextLength) {
            return $generatedDescription;
        }

        $truncatedText = trim(mb_substr($plainText, 0, max($maxTextLength - 1, 1)));

        if ($truncatedText === '') {
            return '<p></p>';
        }

        return '<p>' . htmlspecialchars($truncatedText . '…', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>';
    }

    public function generateDescription(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', 'string'],
            'brand_id' => ['nullable', 'string'],
            'unit_id' => ['nullable', 'string'],
            'sku' => ['nullable', 'string', 'max:100'],
            'demand_tags' => ['nullable'],
            'return_enabled' => ['nullable'],
            'group_purchase_available' => ['nullable'],
            'prompt' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $aiSettings = settings('extension');
        $apiKey = trim((string) ($aiSettings->ai_key ?? ''));
        $isAiEnabled = (int) ($aiSettings->ai_status ?? 0) === 1;
        $monthlyGenerationLimit = max(0, (int) ($aiSettings->ai_generation_limit ?? 0));
        $maxTextLength = max(0, (int) ($aiSettings->ai_max_text_length ?? 0));
        $companyId = Auth::user()?->company_id;
        $userId = Auth::id() ? (string) Auth::id() : null;

        if ($apiKey === '' || ! $isAiEnabled) {
            return response()->json([
                'status' => 0,
                'message' => 'AI is not enabled in backoffice extension settings.',
            ], 422);
        }

        if (blank($companyId)) {
            return response()->json([
                'status' => 0,
                'message' => 'AI product generation requires an active company account.',
            ], 422);
        }

        if (! PermissionUtils::isFeatureAccessible(Auth::user()?->company_id, FeaturePreference::AI->value)) {
            return response()->json([
                'status' => 0,
                'message' => 'AI features are not enabled for your active plan.',
            ], 403);
        }

        if ($monthlyGenerationLimit > 0 && $this->currentAiUsageCount((string) $companyId) >= $monthlyGenerationLimit) {
            return response()->json([
                'status' => 0,
                'message' => 'Your AI generation limit for this month has been reached.',
            ], 429);
        }

        $context = $this->buildProductDescriptionContext($validator->validated());
        $prompt = $this->buildProductDescriptionPrompt($context, $maxTextLength, $validator->validated()['prompt'] ?? null);

        try {
            $response = Http::withToken($apiKey)
                ->acceptJson()
                ->timeout(60)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-4.1-mini',
                    'temperature' => 0.7,
                    'max_tokens' => 320,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You write concise ecommerce product descriptions in HTML. Return only valid HTML with plain paragraphs and bullet lists. Avoid markdown, headings, and code fences.',
                        ],
                        [
                            'role' => 'user',
                            'content' => $prompt,
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Product description generation failed.',
                    'error' => $response->json('error.message') ?? $response->body(),
                ], 422);
            }

            $generatedDescription = trim((string) data_get($response->json(), 'choices.0.message.content', ''));

            if ($generatedDescription === '') {
                return response()->json([
                    'status' => 0,
                    'message' => 'Product description generation returned an empty response.',
                ], 422);
            }

            $generatedDescription = $this->normalizeGeneratedDescription($generatedDescription, $maxTextLength);
            $this->recordAiUsage((string) $companyId, $userId, 'product_description', $generatedDescription);

            return response()->json([
                'status' => 1,
                'message' => 'Product description generated successfully.',
                'data' => [
                    'description' => $generatedDescription,
                    'context' => $context,
                ],
            ], 200);
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => 'Product description generation failed.',
                'error' => $exception->getMessage(),
            ], 422);
        }
    }

    private function buildProductDescriptionContext(array $data): array
    {
        $companyId = Auth::user()?->company_id;
        $category = null;
        $brand = null;
        $unit = null;

        if (! blank($data['category_id'] ?? null)) {
            $category = Category::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->find($data['category_id']);
        }

        if (! blank($data['brand_id'] ?? null)) {
            $brand = Brand::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->find($data['brand_id']);
        }

        if (! blank($data['unit_id'] ?? null) && Schema::hasTable('units')) {
            $unit = Unit::query()->find($data['unit_id']);
        }

        $demandTags = $data['demand_tags'] ?? [];
        if (is_string($demandTags)) {
            $decoded = json_decode($demandTags, true);
            $demandTags = is_array($decoded) ? $decoded : [$demandTags];
        }

        $normalizedDemandTags = collect(is_array($demandTags) ? $demandTags : [])
            ->filter(fn ($tag) => is_string($tag) && trim($tag) !== '')
            ->map(fn ($tag) => trim((string) $tag))
            ->values()
            ->all();

        return [
            'name' => trim((string) ($data['name'] ?? '')),
            'sku' => trim((string) ($data['sku'] ?? '')),
            'category' => $category?->title ?? $category?->name ?? '',
            'brand' => $brand?->title ?? $brand?->name ?? '',
            'unit' => $unit?->unit_name ?? $unit?->name ?? '',
            'demand_tags' => $normalizedDemandTags,
            'return_enabled' => (bool) ($data['return_enabled'] ?? false),
            'group_purchase_available' => (bool) ($data['group_purchase_available'] ?? false),
            'notes' => trim((string) ($data['notes'] ?? '')),
        ];
    }

    private function buildProductDescriptionPrompt(array $context, int $maxTextLength = 0, ?string $customPrompt = null): string
    {
        $lines = [
            'Write an ecommerce product description in HTML for the following product.',
            '',
            'Product name: ' . ($context['name'] ?: 'N/A'),
            'SKU: ' . ($context['sku'] ?: 'N/A'),
            'Category: ' . ($context['category'] ?: 'N/A'),
            'Brand: ' . ($context['brand'] ?: 'N/A'),
            'Unit: ' . ($context['unit'] ?: 'N/A'),
            'Demand tags: ' . (! empty($context['demand_tags']) ? implode(', ', $context['demand_tags']) : 'N/A'),
            'Return enabled: ' . (! empty($context['return_enabled']) ? 'Yes' : 'No'),
            'Group purchase available: ' . (! empty($context['group_purchase_available']) ? 'Yes' : 'No'),
        ];

        if (! empty($context['notes'])) {
            $lines[] = 'Extra notes: ' . $context['notes'];
        }

        $lines[] = '';
        $lines[] = 'Requirements:';
        $lines[] = '- Return only valid HTML.';
        $lines[] = '- Use 2 short paragraphs and, if helpful, one bullet list.';
        $lines[] = '- Keep it persuasive, specific, and natural.';
        $lines[] = '- Avoid exaggerated claims and avoid mentioning that you are an AI.';
        $lines[] = '- Keep it around 100 to 180 words.';

        if ($maxTextLength > 0) {
            $lines[] = '- Keep the final HTML output under ' . $maxTextLength . ' characters.';
        }

        $customPrompt = trim((string) $customPrompt);
        if ($customPrompt !== '') {
            $lines[] = '';
            $lines[] = 'Custom instruction from user:';
            $lines[] = $customPrompt;
        }

        return implode("\n", $lines);
    }

    function getStockGroup($stock_group)
    {
        $stockGroup = ProductStockGroup::find($stock_group);

        if ($stockGroup) {
            return response()->json([
                'status' => 1,
                'message' => 'Stock Group Fetch Successfully',
                'data' => $stockGroup->productStocks()->with('product')->get(),
            ]);
        }
    }
}



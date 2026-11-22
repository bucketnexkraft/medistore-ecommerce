<?php

namespace App\Support;

use App\Enums\StorefrontTemplateVariant;
use Illuminate\Support\Str;

class StorefrontSectionComponentRegistry
{
    public static function options(): array
    {
        $legacyOptions = [
            StorefrontTemplateVariant::Header->value => [
                self::option('storefront-header', 'Default Header'),
            ],
            StorefrontTemplateVariant::Hero->value => [
                self::option('storefront-hero', 'Hero Classic'),
                self::option('storefront-hero-split', 'Hero Split Spotlight'),
                self::option('storefront-hero-music-stage', 'Musical Instruments Hero Stage'),
                self::option('storefront-hero-music-showcase', 'Musical Instruments Hero Showcase'),
                self::option('fashion-apparel-hero-editorial', 'Fashion Hero Editorial'),
                self::option('electronics-gadgets-hero-tech', 'Electronics Hero Tech'),
                self::option('groceries-essentials-hero-fresh', 'Groceries Hero Fresh'),
                self::option('home-kitchen-hero-lifestyle', 'Home Hero Lifestyle'),
                self::option('health-beauty-hero-glow', 'Beauty Hero Glow'),
                self::option('sports-fitness-hero-performance', 'Sports Hero Performance'),
                self::option('jewelry-accessories-hero-luxe', 'Jewelry Hero Luxe'),
                self::option('toys-kids-hero-playful', 'Toys Hero Playful'),
                self::option('books-stationery-hero-editorial', 'Books Hero Editorial'),
                self::option('pet-supplies-hero-care', 'Pet Care Hero'),
            ],
            StorefrontTemplateVariant::HotCategory->value => [
                self::option('storefront-hot-category', 'Hot Category Grid'),
                self::option('storefront-hot-category-stacked', 'Hot Category Stacked'),
            ],
            StorefrontTemplateVariant::CategoryGrid->value => [
                self::option('storefront-category-grid', 'Category Grid Classic'),
                self::option('storefront-category-grid-cards', 'Category Grid Cards'),
            ],
            StorefrontTemplateVariant::FlashDeal->value => [
                self::option('storefront-flash-deal', 'Flash Deal Countdown'),
                self::option('storefront-flash-deal-highlight', 'Flash Deal Highlight'),
            ],
            StorefrontTemplateVariant::BestSelling->value => [
                self::option('storefront-best-selling', 'Product Feed Default'),
                self::option('storefront-best-selling-grid', 'Product Feed Grid'),
            ],
            StorefrontTemplateVariant::TopSeller->value => [
                self::option('storefront-top-seller', 'Top Seller Default'),
                self::option('storefront-top-seller-compact', 'Top Seller Compact'),
            ],
            StorefrontTemplateVariant::GroupDeals->value => [
                self::option('storefront-group-deals', 'Group Deals Default'),
                self::option('storefront-group-deals-compact', 'Group Deals Compact'),
            ],
            StorefrontTemplateVariant::OnSale->value => [
                self::option('storefront-on-sale', 'On Sale Default'),
                self::option('storefront-on-sale-spotlight', 'On Sale Spotlight'),
            ],
            StorefrontTemplateVariant::BrandStrip->value => [
                self::option('storefront-brand-strip', 'Brand Strip Default'),
                self::option('storefront-brand-strip-marquee', 'Brand Strip Marquee'),
            ],
            StorefrontTemplateVariant::Footer->value => [
                self::option('storefront-footer', 'Default Footer'),
            ],
            StorefrontTemplateVariant::ProductFilter->value => [
                self::option('storefront-product-filter', 'Product Filter Default'),
                self::option('storefront-product-filter-alt', 'Product Filter Highlight'),
            ],
            StorefrontTemplateVariant::GroupPurchase->value => [
                self::option('storefront-group-purchase', 'Group Purchase Default'),
                self::option('storefront-group-purchase-alt', 'Group Purchase Highlight'),
            ],
            'product_carousel' => [
                self::option('storefront-product-carousel', 'Product Carousel Classic'),
                self::option('storefront-product-carousel-showcase', 'Product Carousel Showcase'),
            ],
        ];

        return collect($legacyOptions)
            ->mergeRecursive(StorefrontCategorySectionCatalog::componentOptions())
            ->map(fn ($options) => collect($options)->unique('value')->values()->all())
            ->all();
    }

    public static function defaultForVariant(?string $variant): string
    {
        $normalizedVariant = trim((string) $variant);

        if ($normalizedVariant === '') {
            return StorefrontTemplateVariant::default()->componentKey();
        }

        $available = self::options()[$normalizedVariant] ?? [];

        if (! empty($available[0]['value'])) {
            return (string) $available[0]['value'];
        }

        return StorefrontTemplateVariant::tryFromValue($normalizedVariant)->componentKey();
    }

    public static function optionsByCategory(): array
    {
        return StorefrontCategorySectionCatalog::componentOptionsByCategory();
    }

    public static function optionsForCategory(?string $category): array
    {
        $categoryKey = Str::slug(trim((string) $category));

        return self::optionsByCategory()[$categoryKey] ?? [];
    }

    public static function normalize(?string $variant, ?string $componentKey): string
    {
        $normalizedVariant = trim((string) $variant);
        $normalizedComponentKey = trim((string) $componentKey);
        $available = collect(self::options()[$normalizedVariant] ?? [])
            ->pluck('value')
            ->filter()
            ->values()
            ->all();

        if ($normalizedComponentKey !== '' && in_array($normalizedComponentKey, $available, true)) {
            return $normalizedComponentKey;
        }

        return self::defaultForVariant($normalizedVariant);
    }

    public static function isValidForVariant(?string $variant, ?string $componentKey): bool
    {
        $normalizedVariant = trim((string) $variant);
        $normalizedComponentKey = trim((string) $componentKey);

        if ($normalizedVariant === '' || $normalizedComponentKey === '') {
            return false;
        }

        return collect(self::options()[$normalizedVariant] ?? [])
            ->pluck('value')
            ->contains($normalizedComponentKey);
    }

    private static function option(string $value, string $label): array
    {
        return [
            'value' => $value,
            'label' => $label,
        ];
    }
}

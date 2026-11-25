<?php

namespace App\Enums;

use App\Support\StorefrontCategorySectionCatalog;

enum StorefrontTemplateVariant: string
{
    case Header = 'header';
    case Hero = 'hero';
    case HotCategory = 'hot_category';
    case CategoryGrid = 'category_grid';
    case FlashDeal = 'flash_deal';
    case Products = 'products';
    /** @deprecated Kept so existing non-product templates continue to resolve. */
    case BestSelling = 'best_selling';
    case TopSeller = 'top_seller';
    case GroupDeals = 'group_deals';
    case OnSale = 'on_sale';
    case BrandStrip = 'brand_strip';
    case ServiceHighlights = 'service_highlights';
    case WhyChooseUs = 'why_choose_us';
    case Articles = 'articles';
    case Newsletter = 'newsletter';
    case Footer = 'footer';
    case ProductFilter = 'product_filter';
    case GroupPurchase = 'group_purchase';
    case Assistant = 'assistant';
    case Custom = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::Header => 'Header',
            self::Hero => 'Hero',
            self::HotCategory => 'Hot Category',
            self::CategoryGrid => 'Category Grid',
            self::FlashDeal => 'Flash Deal',
            self::Products => 'Products',
            self::BestSelling => 'Product Feed',
            self::TopSeller => 'Top Seller',
            self::GroupDeals => 'Group Deals',
            self::OnSale => 'On Sale',
            self::BrandStrip => 'Brand Strip',
            self::ServiceHighlights => 'Service Highlights',
            self::WhyChooseUs => 'Why Choose Us',
            self::Articles => 'Articles',
            self::Newsletter => 'Newsletter',
            self::Footer => 'Footer',
            self::ProductFilter => 'Product Filter',
            self::GroupPurchase => 'Group Purchase',
            self::Assistant => 'Shopping Assistant',
            self::Custom => 'Custom Section',
        };
    }

    public function slot(): string
    {
        return match ($this) {
            self::Header => 'header',
            self::Footer => 'footer',
            default => 'main',
        };
    }

    public function componentKey(): string
    {
        return match ($this) {
            self::Header => 'storefront-header',
            self::Hero => 'storefront-hero',
            self::HotCategory => 'storefront-hot-category',
            self::CategoryGrid => 'storefront-category-grid',
            self::FlashDeal => 'storefront-flash-deal',
            self::Products => 'storefront-products',
            self::BestSelling => 'storefront-best-selling',
            self::TopSeller => 'storefront-top-seller',
            self::GroupDeals => 'storefront-group-deals',
            self::OnSale => 'storefront-on-sale',
            self::BrandStrip => 'storefront-brand-strip',
            self::ServiceHighlights => 'storefront-service-highlights',
            self::WhyChooseUs => 'storefront-why-choose-us',
            self::Articles => 'storefront-articles',
            self::Newsletter => 'storefront-newsletter',
            self::Footer => 'storefront-footer',
            self::ProductFilter => 'storefront-product-filter',
            self::GroupPurchase => 'storefront-group-purchase',
            self::Assistant => 'storefront-assistant',
            self::Custom => 'storefront-custom',
        };
    }

    public function supportsDataFeed(): bool
    {
        return match ($this) {
            self::HotCategory,
            self::CategoryGrid,
            self::FlashDeal,
            self::Products,
            self::BestSelling,
            self::GroupDeals,
            self::OnSale,
            self::BrandStrip => true,
            default => false,
        };
    }

    public function metadata(): array
    {
        return [
            'value' => $this->value,
            'label' => $this->label(),
            'slot' => $this->slot(),
            'component_key' => $this->componentKey(),
            'supports_data_feed' => $this->supportsDataFeed(),
        ];
    }

    public static function default(): self
    {
        return self::Hero;
    }

    public static function tryFromValue(?string $value): self
    {
        return self::tryFrom((string) $value) ?? self::default();
    }

    public static function options(): array
    {
        return array_map(
            fn (self $variant) => $variant->metadata(),
            self::cases()
        );
    }

    public static function optionsByCategory(): array
    {
        return collect(StorefrontCategorySectionCatalog::groupedOptionsByCategory())
            ->map(fn (array $sectionMap) => collect(array_keys($sectionMap))
                ->map(fn (string $sectionType) => self::tryFromValue($sectionType)->metadata())
                ->values()
                ->all())
            ->all();
    }

    public static function values(): array
    {
        return array_map(fn (self $variant) => $variant->value, self::cases());
    }
}

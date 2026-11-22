<?php

namespace App\Enums;

use App\Support\StorefrontCategorySectionCatalog;
use Illuminate\Support\Str;

enum StorefrontSectionPreset: string
{
    case HeaderDefault = 'header-default';
    case HeroClassic = 'hero-classic';
    case HeroSplitSpotlight = 'hero-split-spotlight';
    case HeroMusicStage = 'hero-music-stage';
    case HeroMusicShowcase = 'hero-music-showcase';
    case HeroFashionEditorial = 'hero-fashion-editorial';
    case HeroElectronicsTech = 'hero-electronics-tech';
    case HeroGroceryFresh = 'hero-grocery-fresh';
    case HeroHomeLifestyle = 'hero-home-lifestyle';
    case HeroBeautyGlow = 'hero-beauty-glow';
    case HeroSportsPerformance = 'hero-sports-performance';
    case HeroJewelryLuxe = 'hero-jewelry-luxe';
    case HeroToysPlayful = 'hero-toys-playful';
case HeroBooksEditorial = 'hero-books-editorial';
    case HeroPetCare = 'hero-pet-care';
    case HotCategoryGrid = 'hot-category-grid';
    case HotCategoryStacked = 'hot-category-stacked';
    case CategoryGridClassic = 'category-grid-classic';
    case CategoryGridCards = 'category-grid-cards';
    case FlashDealCountdown = 'flash-deal-countdown';
    case FlashDealHighlight = 'flash-deal-highlight';
    case BestSellingDefault = 'best-selling-default';
    case BestSellingGrid = 'best-selling-grid';
    case TopSellerDefault = 'top-seller-default';
    case TopSellerCompact = 'top-seller-compact';
    case GroupDealsDefault = 'group-deals-default';
    case GroupDealsCompact = 'group-deals-compact';
    case OnSaleDefault = 'on-sale-default';
    case OnSaleSpotlight = 'on-sale-spotlight';
    case BrandStripDefault = 'brand-strip-default';
    case BrandStripMarquee = 'brand-strip-marquee';
    case FooterDefault = 'footer-default';
    case ProductFilterDefault = 'product-filter-default';
    case ProductFilterHighlight = 'product-filter-highlight';
    case GroupPurchaseDefault = 'group-purchase-default';
    case GroupPurchaseHighlight = 'group-purchase-highlight';

    public function label(): string
    {
        return match ($this) {
            self::HeaderDefault => 'Header Default',
            self::HeroClassic => 'Hero Classic',
            self::HeroSplitSpotlight => 'Hero Split Spotlight',
            self::HeroMusicStage => 'Musical Instruments Hero Stage',
            self::HeroMusicShowcase => 'Musical Instruments Hero Showcase',
            self::HeroFashionEditorial => 'Fashion Hero Editorial',
            self::HeroElectronicsTech => 'Electronics Hero Tech',
            self::HeroGroceryFresh => 'Groceries Hero Fresh',
            self::HeroHomeLifestyle => 'Home Hero Lifestyle',
            self::HeroBeautyGlow => 'Beauty Hero Glow',
            self::HeroSportsPerformance => 'Sports Hero Performance',
            self::HeroJewelryLuxe => 'Jewelry Hero Luxe',
            self::HeroToysPlayful => 'Toys Hero Playful',
            self::HeroBooksEditorial => 'Books Hero Editorial',
            self::HeroPetCare => 'Pet Care Hero',
            self::HotCategoryGrid => 'Hot Category Grid',
            self::HotCategoryStacked => 'Hot Category Stacked',
            self::CategoryGridClassic => 'Category Grid Classic',
            self::CategoryGridCards => 'Category Grid Cards',
            self::FlashDealCountdown => 'Flash Deal Countdown',
            self::FlashDealHighlight => 'Flash Deal Highlight',
            self::BestSellingDefault => 'Best Selling Default',
            self::BestSellingGrid => 'Best Selling Grid',
            self::TopSellerDefault => 'Top Seller Default',
            self::TopSellerCompact => 'Top Seller Compact',
            self::GroupDealsDefault => 'Group Deals Default',
            self::GroupDealsCompact => 'Group Deals Compact',
            self::OnSaleDefault => 'On Sale Default',
            self::OnSaleSpotlight => 'On Sale Spotlight',
            self::BrandStripDefault => 'Brand Strip Default',
            self::BrandStripMarquee => 'Brand Strip Marquee',
            self::FooterDefault => 'Footer Default',
            self::ProductFilterDefault => 'Product Filter Default',
            self::ProductFilterHighlight => 'Product Filter Highlight',
            self::GroupPurchaseDefault => 'Group Purchase Default',
            self::GroupPurchaseHighlight => 'Group Purchase Highlight',
        };
    }

    public function sectionType(): string
    {
        return match ($this) {
            self::HeaderDefault => StorefrontTemplateVariant::Header->value,
            self::HeroClassic,
            self::HeroSplitSpotlight,
            self::HeroMusicStage,
            self::HeroMusicShowcase,
            self::HeroFashionEditorial,
            self::HeroElectronicsTech,
            self::HeroGroceryFresh,
            self::HeroHomeLifestyle,
            self::HeroBeautyGlow,
            self::HeroSportsPerformance,
            self::HeroJewelryLuxe,
            self::HeroToysPlayful,
            self::HeroBooksEditorial,
            self::HeroPetCare => StorefrontTemplateVariant::Hero->value,
            self::HotCategoryGrid, self::HotCategoryStacked => StorefrontTemplateVariant::HotCategory->value,
            self::CategoryGridClassic, self::CategoryGridCards => StorefrontTemplateVariant::CategoryGrid->value,
            self::FlashDealCountdown, self::FlashDealHighlight => StorefrontTemplateVariant::FlashDeal->value,
            self::BestSellingDefault, self::BestSellingGrid => StorefrontTemplateVariant::BestSelling->value,
            self::TopSellerDefault, self::TopSellerCompact => StorefrontTemplateVariant::TopSeller->value,
            self::GroupDealsDefault, self::GroupDealsCompact => StorefrontTemplateVariant::GroupDeals->value,
            self::OnSaleDefault, self::OnSaleSpotlight => StorefrontTemplateVariant::OnSale->value,
            self::BrandStripDefault, self::BrandStripMarquee => StorefrontTemplateVariant::BrandStrip->value,
            self::FooterDefault => StorefrontTemplateVariant::Footer->value,
            self::ProductFilterDefault, self::ProductFilterHighlight => StorefrontTemplateVariant::ProductFilter->value,
            self::GroupPurchaseDefault, self::GroupPurchaseHighlight => StorefrontTemplateVariant::GroupPurchase->value,
        };
    }

    public function componentKey(): string
    {
        return match ($this) {
            self::HeaderDefault => 'storefront-header',
            self::HeroClassic => 'storefront-hero',
            self::HeroSplitSpotlight => 'storefront-hero-split',
            self::HeroMusicStage => 'storefront-hero-music-stage',
            self::HeroMusicShowcase => 'storefront-hero-music-showcase',
            self::HeroFashionEditorial => 'fashion-apparel-hero-editorial',
            self::HeroElectronicsTech => 'electronics-gadgets-hero-tech',
            self::HeroGroceryFresh => 'groceries-essentials-hero-fresh',
            self::HeroHomeLifestyle => 'home-kitchen-hero-lifestyle',
            self::HeroBeautyGlow => 'health-beauty-hero-glow',
            self::HeroSportsPerformance => 'sports-fitness-hero-performance',
            self::HeroJewelryLuxe => 'jewelry-accessories-hero-luxe',
            self::HeroToysPlayful => 'toys-kids-hero-playful',
            self::HeroBooksEditorial => 'books-stationery-hero-editorial',
            self::HeroPetCare => 'pet-supplies-hero-care',
            self::HotCategoryGrid => 'storefront-hot-category',
            self::HotCategoryStacked => 'storefront-hot-category-stacked',
            self::CategoryGridClassic => 'storefront-category-grid',
            self::CategoryGridCards => 'storefront-category-grid-cards',
            self::FlashDealCountdown => 'storefront-flash-deal',
            self::FlashDealHighlight => 'storefront-flash-deal-highlight',
            self::BestSellingDefault => 'storefront-best-selling',
            self::BestSellingGrid => 'storefront-best-selling-grid',
            self::TopSellerDefault => 'storefront-top-seller',
            self::TopSellerCompact => 'storefront-top-seller-compact',
            self::GroupDealsDefault => 'storefront-group-deals',
            self::GroupDealsCompact => 'storefront-group-deals-compact',
            self::OnSaleDefault => 'storefront-on-sale',
            self::OnSaleSpotlight => 'storefront-on-sale-spotlight',
            self::BrandStripDefault => 'storefront-brand-strip',
            self::BrandStripMarquee => 'storefront-brand-strip-marquee',
            self::FooterDefault => 'storefront-footer',
            self::ProductFilterDefault => 'storefront-product-filter',
            self::ProductFilterHighlight => 'storefront-product-filter-alt',
            self::GroupPurchaseDefault => 'storefront-group-purchase',
            self::GroupPurchaseHighlight => 'storefront-group-purchase-alt',
        };
    }

    public function metadata(): array
    {
        return [
            'preset_key' => $this->value,
            'name' => $this->label(),
            'label' => $this->label(),
            'section_type' => $this->sectionType(),
            'component_key' => $this->componentKey(),
            'category_keys' => $this->categoryKeys(),
        ];
    }

    public function categoryKeys(): array
    {
        return collect(config('ecommerce_templates.category_preset_map', []))
            ->filter(function ($sectionMap) {
                if (! is_array($sectionMap)) {
                    return false;
                }

                return collect($sectionMap)
                    ->flatMap(function ($presetEntries) {
                        if (! is_array($presetEntries)) {
                            return [];
                        }

                        return collect($presetEntries)
                            ->map(fn ($label, $key) => is_int($key) ? (string) $label : (string) $key)
                            ->values();
                    })
                    ->contains($this->value);
            })
            ->keys()
            ->map(fn ($name) => Str::slug((string) $name))
            ->values()
            ->all();
    }

    public static function options(): array
    {
        return array_map(fn (self $preset) => $preset->metadata(), self::cases());
    }

    public static function groupedOptions(): array
    {
        return StorefrontCategorySectionCatalog::groupedOptions();
    }

    public static function groupedOptionsByCategory(): array
    {
        return StorefrontCategorySectionCatalog::groupedOptionsByCategory();
    }

    public static function values(): array
    {
        return array_map(fn (self $preset) => $preset->value, self::cases());
    }

    public static function tryFromValue(?string $value): ?self
    {
        return self::tryFrom((string) $value);
    }
}

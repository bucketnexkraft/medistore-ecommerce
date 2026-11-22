<?php

/*
|--------------------------------------------------------------------------
| Ecommerce Storefront Template Map
|--------------------------------------------------------------------------
|
| Structure:
|
|   'Category Name' => [
|       'section_type' => [
|           'preset-key' => 'Showing Label',
|           ...
|       ],
|       ...
|   ]
|
| - 'preset-key' is the category-local variant identity. Existing enum keys keep
|   legacy compatibility, but new config keys do not need a new enum case.
| - 'Showing Label' is what gets displayed in the UI (dropdowns, pickers, etc).
| - section_type keys must match StorefrontTemplateVariant::values()
|   (header, hero, hot_category, category_grid, flash_deal, products,
|   best_selling (legacy), top_seller, group_deals, on_sale, brand_strip, footer, product_filter,
|   group_purchase, assistant).
|
*/

return [
    /*
    |----------------------------------------------------------------------
    | Fixed category theme component libraries
    |----------------------------------------------------------------------
    |
    | Templates remain dynamic database records. They only save component
    | keys from the fixed category library below. Runtime uses the selected
    | template + category to resolve the complete storefront experience.
    |
    */
    'category_preset_map' => [
        'Fashion & Apparel' => [
            'header' => [
                'header-default' => 'Header Default',
                'header-overlay' => 'Header Overlay',
                'header-minimal' => 'Header Minimal',
                'header-classic' => 'Header Classic',
                'header-compact' => 'Header Compact',
            ],
            'hero' => [
                'hero-compact' => 'Hero Compact',
                'hero-fashion-editorial' => 'Fashion Hero Editorial',
                'hero-classic' => 'Hero Classic',
                'hero-split-spotlight' => 'Hero Split Spotlight',
                'hero-fashion-luxe' => 'Fashion Hero Luxe',
            ],
            'hot_category' => [
                'category-grid' => 'Hot Category Grid',
                'category-stacked' => 'Hot Category Stacked',
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'products' => [
                'products-default' => 'Products Default',
                'products-grid' => 'Products Grid',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

        'Electronics & Gadgets' => [
            'header' => [
                'header-default' => 'Header Default',
                'header-gadgets-one' => 'Header Gadgets One',
                'header-gadgets-two' => 'Header Gadgets Two',
            ],
            'hero' => [
                'hero-gadgets-one' => 'Hero Gadgets One',
                'hero-gadgets-two' => 'Hero Gadgets Two',
                'hero-gadgets-three' => 'Hero Gadgets Three',
                'hero-gadgets-four' => 'Hero Gadgets Four',
                'hero-gadgets-five' => 'Hero Gadgets Five',
            ],
            'hot_category' => [
                'hot-category-gadgets-four' => 'Category Gadgets One',
                'hot-category-gadgets-five' => 'Category Gadgets Two',
                'hot-category-grid' => 'Hot Category Grid',
                'hot-category-stacked' => 'Hot Category Stacked',
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'products' => [
                'products-default' => 'Products Default',
                'products-grid' => 'Products Grid',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'assistant' => [
                'assistant-luminex' => 'LumiNex Shopping Assistant',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

        'Groceries & Essentials' => [
            'header' => [
                'header-default' => 'Header Default',
            ],
            'hero' => [
                'hero-essentials-one' => 'Hero Essentials One',
            ],
            'hot_category' => [
                'category-essentials-one' => 'Category Essentials One',
                'hot-category-gadgets-four' => 'Category Gadgets One',
                'hot-category-gadgets-five' => 'Category Gadgets Two',
                'hot-category-grid' => 'Hot Category Grid',
                'hot-category-stacked' => 'Hot Category Stacked',
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'products' => [
                'products-default' => 'Products Default',
                'products-grid' => 'Products Grid',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'assistant' => [
                'assistant-luminex' => 'LumiNex Shopping Assistant',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

        'Home & Kitchen' => [
            'header' => [
                'header-default' => 'Header Default',
            ],
            'hero' => [
                'hero-home-lifestyle' => 'Home Hero Lifestyle',
                'hero-split-spotlight' => 'Hero Split Spotlight',
                'hero-classic' => 'Hero Classic',
            ],
            'hot_category' => [
                'hot-category-grid' => 'Hot Category Grid',
                'hot-category-stacked' => 'Hot Category Stacked',
            ],
            'category_grid' => [
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'best_selling' => [
                'best-selling-default' => 'Best Selling Default',
                'best-selling-grid' => 'Best Selling Grid',
            ],
            'top_seller' => [
                'top-seller-default' => 'Top Seller Default',
                'top-seller-compact' => 'Top Seller Compact',
            ],
            'group_deals' => [
                'group-deals-default' => 'Group Deals Default',
                'group-deals-compact' => 'Group Deals Compact',
            ],
            'on_sale' => [
                'on-sale-default' => 'On Sale Default',
                'on-sale-spotlight' => 'On Sale Spotlight',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

        'Health & Beauty' => [
            'header' => [
                'header-default' => 'Header Default',
            ],
            'hero' => [
                'hero-beauty-glow' => 'Beauty Hero Glow',
                'hero-classic' => 'Hero Classic',
            ],
            'hot_category' => [
                'hot-category-grid' => 'Hot Category Grid',
                'hot-category-stacked' => 'Hot Category Stacked',
            ],
            'category_grid' => [
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'best_selling' => [
                'best-selling-default' => 'Best Selling Default',
                'best-selling-grid' => 'Best Selling Grid',
            ],
            'top_seller' => [
                'top-seller-default' => 'Top Seller Default',
                'top-seller-compact' => 'Top Seller Compact',
            ],
            'group_deals' => [
                'group-deals-default' => 'Group Deals Default',
                'group-deals-compact' => 'Group Deals Compact',
            ],
            'on_sale' => [
                'on-sale-default' => 'On Sale Default',
                'on-sale-spotlight' => 'On Sale Spotlight',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

        'Sports & Fitness' => [
            'header' => [
                'header-default' => 'Header Default',
            ],
            'hero' => [
                'hero-sports-performance' => 'Sports Hero Performance',
                'hero-split-spotlight' => 'Hero Split Spotlight',
                'hero-classic' => 'Hero Classic',
            ],
            'hot_category' => [
                'hot-category-grid' => 'Hot Category Grid',
                'hot-category-stacked' => 'Hot Category Stacked',
            ],
            'category_grid' => [
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'best_selling' => [
                'best-selling-default' => 'Best Selling Default',
                'best-selling-grid' => 'Best Selling Grid',
            ],
            'top_seller' => [
                'top-seller-default' => 'Top Seller Default',
                'top-seller-compact' => 'Top Seller Compact',
            ],
            'group_deals' => [
                'group-deals-default' => 'Group Deals Default',
                'group-deals-compact' => 'Group Deals Compact',
            ],
            'on_sale' => [
                'on-sale-default' => 'On Sale Default',
                'on-sale-spotlight' => 'On Sale Spotlight',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

        'Jewelry & Accessories' => [
            'header' => [
                'header-default' => 'Header Default',
            ],
            'hero' => [
                'hero-jewelry-luxe' => 'Jewelry Hero Luxe',
                'hero-classic' => 'Hero Classic',
            ],
            'hot_category' => [
                'hot-category-grid' => 'Hot Category Grid',
                'hot-category-stacked' => 'Hot Category Stacked',
            ],
            'category_grid' => [
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'best_selling' => [
                'best-selling-default' => 'Best Selling Default',
                'best-selling-grid' => 'Best Selling Grid',
            ],
            'top_seller' => [
                'top-seller-default' => 'Top Seller Default',
                'top-seller-compact' => 'Top Seller Compact',
            ],
            'group_deals' => [
                'group-deals-default' => 'Group Deals Default',
                'group-deals-compact' => 'Group Deals Compact',
            ],
            'on_sale' => [
                'on-sale-default' => 'On Sale Default',
                'on-sale-spotlight' => 'On Sale Spotlight',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

        'Books & Stationery' => [
            'header' => [
                'header-default' => 'Header Default',
            ],
            'hero' => [
                'hero-books-editorial' => 'Books Hero Editorial',
                'hero-split-spotlight' => 'Hero Split Spotlight',
                'hero-classic' => 'Hero Classic',
            ],
            'hot_category' => [
                'hot-category-grid' => 'Hot Category Grid',
                'hot-category-stacked' => 'Hot Category Stacked',
            ],
            'category_grid' => [
                'category-grid-classic' => 'Category Grid Classic',
                'category-grid-cards' => 'Category Grid Cards',
            ],
            'flash_deal' => [
                'flash-deal-countdown' => 'Flash Deal Countdown',
                'flash-deal-highlight' => 'Flash Deal Highlight',
            ],
            'best_selling' => [
                'best-selling-default' => 'Best Selling Default',
                'best-selling-grid' => 'Best Selling Grid',
            ],
            'top_seller' => [
                'top-seller-default' => 'Top Seller Default',
                'top-seller-compact' => 'Top Seller Compact',
            ],
            'group_deals' => [
                'group-deals-default' => 'Group Deals Default',
                'group-deals-compact' => 'Group Deals Compact',
            ],
            'on_sale' => [
                'on-sale-default' => 'On Sale Default',
                'on-sale-spotlight' => 'On Sale Spotlight',
            ],
            'brand_strip' => [
                'brand-strip-default' => 'Brand Strip Default',
                'brand-strip-marquee' => 'Brand Strip Marquee',
            ],
            'product_filter' => [
                'product-filter-default' => 'Product Filter Default',
                'product-filter-highlight' => 'Product Filter Highlight',
            ],
            'group_purchase' => [
                'group-purchase-default' => 'Group Purchase Default',
                'group-purchase-highlight' => 'Group Purchase Highlight',
            ],
            'footer' => [
                'footer-default' => 'Footer Default',
            ],
        ],

    ],

];

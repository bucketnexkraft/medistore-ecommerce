import type { GroceriesSectionRegistry } from "../types";

export const sectionRegistry: GroceriesSectionRegistry = {
	custom: { load: () => import("./custom/CustomSection") },
	"groceries-essentials-hero-essentials-one": { load: () => import("./hero/HeroEssentialsOne") },
	"groceries-essentials-category-essentials-one": { load: () => import("./category/CategoryEssentialsOne") },
	"groceries-essentials-hot-category-gadgets-four": { load: () => import("./category/CategoryGadgetsOne") },
	"groceries-essentials-hot-category-gadgets-five": { load: () => import("./category/CategoryGadgetsTwo") },
	"groceries-essentials-hot-category-grid": { load: () => import("./category/CategoryGrid") },
	"groceries-essentials-hot-category-stacked": { load: () => import("./category/CategoryStacked") },
	"groceries-essentials-category-grid-classic": { load: () => import("./category/CategoryGridClassic") },
	"groceries-essentials-category-grid-cards": { load: () => import("./category/CategoryGridCards") },
	"groceries-essentials-flash-deal-countdown": { load: () => import("./flash_deal/FlashDealCountdown") },
	"groceries-essentials-flash-deal-highlight": { load: () => import("./flash_deal/FlashDealHighlight") },
	"groceries-essentials-products-default": { load: () => import("./products/ProductsDefault") },
	"groceries-essentials-products-grid": { load: () => import("./products/ProductsGrid") },
	"groceries-essentials-brand-strip-default": { load: () => import("./brand_strip/BrandStripDefault") },
	"groceries-essentials-brand-strip-marquee": { load: () => import("./brand_strip/BrandStripMarquee") },
	"groceries-essentials-product-filter-default": { load: () => import("./product_filter/ProductFilterDefault") },
	"groceries-essentials-product-filter-highlight": { load: () => import("./product_filter/ProductFilterHighlight") },
	"groceries-essentials-group-purchase-default": { load: () => import("./group_purchase/GroupPurchaseDefault") },
	"groceries-essentials-group-purchase-highlight": { load: () => import("./group_purchase/GroupPurchaseHighlight") },
	"groceries-essentials-assistant-luminex": { load: () => import("./assistant/LumiNexAssistant") },

	// Keep existing stores that saved the old `best_selling` keys renderable.
	"groceries-essentials-best-selling-default": { load: () => import("./products/ProductsDefault") },
	"groceries-essentials-best-selling-grid": { load: () => import("./products/ProductsGrid") },
	"groceries-essentials-storefront-best-selling": { load: () => import("./products/ProductsDefault") },
	"groceries-essentials-storefront-best-selling-grid": { load: () => import("./products/ProductsGrid") },
};

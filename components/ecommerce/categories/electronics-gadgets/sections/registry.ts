import type { ElectronicsSectionRegistry } from "../types";

export const sectionRegistry: ElectronicsSectionRegistry = {
	custom: { load: () => import("./custom/CustomSection") },
	"electronics-gadgets-hero-gadgets-one": { load: () => import("./hero/HeroGadgetsOne") },
	"electronics-gadgets-hero-gadgets-two": { load: () => import("./hero/HeroGadgetsTwo") },
	"electronics-gadgets-hero-gadgets-three": { load: () => import("./hero/HeroGadgetsThree") },
	"electronics-gadgets-hero-gadgets-four": { load: () => import("./hero/HeroGadgetsFour") },
	"electronics-gadgets-hero-gadgets-five": { load: () => import("./hero/HeroGadgetsFive") },
	"electronics-gadgets-hot-category-gadgets-four": { load: () => import("./category/CategoryGadgetsOne") },
	"electronics-gadgets-hot-category-gadgets-five": { load: () => import("./category/CategoryGadgetsTwo") },
	"electronics-gadgets-hot-category-grid": { load: () => import("./category/CategoryGrid") },
	"electronics-gadgets-hot-category-stacked": { load: () => import("./category/CategoryStacked") },
	"electronics-gadgets-category-grid-classic": { load: () => import("./category/CategoryGridClassic") },
	"electronics-gadgets-category-grid-cards": { load: () => import("./category/CategoryGridCards") },
	"electronics-gadgets-flash-deal-countdown": { load: () => import("./flash_deal/FlashDealCountdown") },
	"electronics-gadgets-flash-deal-highlight": { load: () => import("./flash_deal/FlashDealHighlight") },
	"electronics-gadgets-products-default": { load: () => import("./products/ProductsDefault") },
	"electronics-gadgets-products-grid": { load: () => import("./products/ProductsGrid") },
	"electronics-gadgets-brand-strip-default": { load: () => import("./brand_strip/BrandStripDefault") },
	"electronics-gadgets-brand-strip-marquee": { load: () => import("./brand_strip/BrandStripMarquee") },
	"electronics-gadgets-product-filter-default": { load: () => import("./product_filter/ProductFilterDefault") },
	"electronics-gadgets-product-filter-highlight": { load: () => import("./product_filter/ProductFilterHighlight") },
	"electronics-gadgets-group-purchase-default": { load: () => import("./group_purchase/GroupPurchaseDefault") },
	"electronics-gadgets-group-purchase-highlight": { load: () => import("./group_purchase/GroupPurchaseHighlight") },
	"electronics-gadgets-assistant-luminex": { load: () => import("./assistant/LumiNexAssistant") },

	// Existing stores may still have sections saved with the legacy
	// `best_selling` component keys. Keep them renderable after the catalog
	// moves to the `products` section type used by the category folders.
	"electronics-gadgets-best-selling-default": { load: () => import("./products/ProductsDefault") },
	"electronics-gadgets-best-selling-grid": { load: () => import("./products/ProductsGrid") },
	"electronics-gadgets-storefront-best-selling": { load: () => import("./products/ProductsDefault") },
	"electronics-gadgets-storefront-best-selling-grid": { load: () => import("./products/ProductsGrid") },
};

import type { EcommerceCategoryKey, EcommerceHomeModule } from "./category-contract";

const categoryThemeLoaders: Record<EcommerceCategoryKey, () => Promise<EcommerceHomeModule>> = {
	"fashion-apparel": () => import("./fashion-apparel/home"),
	"electronics-gadgets": () => import("./electronics-gadgets/home"),
	"groceries-essentials": () => import("./groceries-essentials/home"),
	"home-kitchen": () => import("./home-kitchen/home"),
	"health-beauty": () => import("./health-beauty/home"),
	"sports-fitness": () => import("./sports-fitness/home"),
	"jewelry-accessories": () => import("./jewelry-accessories/home"),
	"toys-kids": () => import("./toys-kids/home"),
	"books-stationery": () => import("./books-stationery/home"),
	"pet-supplies": () => import("./pet-supplies/home"),
};

export async function loadEcommerceCategoryHome(categoryKey: EcommerceCategoryKey) {
	return (await categoryThemeLoaders[categoryKey]()).default;
}


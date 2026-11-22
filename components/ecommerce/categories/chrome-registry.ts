import type { ComponentType } from "react";
import type { HeaderInitialData } from "@/lib/header-context";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";
import {
	ecommerceCategoryKeys,
	type EcommerceCategoryKey,
	type EcommerceChromeSlot,
	type EcommerceSection,
} from "./category-contract";

export type EcommerceChromeComponentProps = {
	section: EcommerceSection;
	host: string | null;
	sections: EcommerceSection[];
	index: number;
	initialData?: HeaderInitialData;
	preferencesData?: Record<string, unknown> | null;
	demoOnly?: boolean;
	previewMode?: boolean;
};

type EcommerceChromeModule = { default: ComponentType<EcommerceChromeComponentProps> };
type EcommerceChromeLoader = () => Promise<EcommerceChromeModule>;
type EcommerceChromeRegistry = Record<EcommerceCategoryKey, Record<EcommerceChromeSlot, Record<string, EcommerceChromeLoader>>>;

const loadDefaultHeader: EcommerceChromeLoader = async () => await import("./chrome/DefaultHeader");
const loadDefaultFooter: EcommerceChromeLoader = async () => await import("./chrome/DefaultFooter");

const registry = Object.fromEntries(
	ecommerceCategoryKeys.map((categoryKey) => [categoryKey, {
		header: { [`${categoryKey}-header-default`]: loadDefaultHeader },
		footer: { [`${categoryKey}-footer-default`]: loadDefaultFooter },
	}]),
) as EcommerceChromeRegistry;

// Category-owned implementations override only their own scoped keys. Add new
// variants here when their components are introduced; no cross-category lookup occurs.
registry["fashion-apparel"].header["fashion-apparel-header-default"] = async () =>
	await import("./fashion-apparel/sections/header/HeaderDefault") as unknown as EcommerceChromeModule;
registry["fashion-apparel"].header["fashion-apparel-header-overlay"] = async () =>
	await import("./fashion-apparel/sections/header/HeaderOverlay") as unknown as EcommerceChromeModule;
registry["fashion-apparel"].header["fashion-apparel-header-minimal"] = async () =>
	await import("./fashion-apparel/sections/header/HeaderMinimal") as unknown as EcommerceChromeModule;
registry["fashion-apparel"].header["fashion-apparel-header-classic"] = async () =>
	await import("./fashion-apparel/sections/header/HeaderClassic") as unknown as EcommerceChromeModule;
registry["fashion-apparel"].header["fashion-apparel-header-compact"] = async () =>
	await import("./fashion-apparel/sections/header/HeaderCompact") as unknown as EcommerceChromeModule;
registry["fashion-apparel"].footer["fashion-apparel-footer-default"] = async () =>
	await import("./fashion-apparel/sections/footer/FooterDefault") as unknown as EcommerceChromeModule;
registry["electronics-gadgets"].header["electronics-gadgets-header-default"] = async () =>
	await import("./electronics-gadgets/sections/header/HeaderDefault") as unknown as EcommerceChromeModule;
registry["electronics-gadgets"].header["electronics-gadgets-header-gadgets-one"] = async () =>
	await import("./electronics-gadgets/sections/header/HeaderGadgetsOne") as unknown as EcommerceChromeModule;
registry["electronics-gadgets"].header["electronics-gadgets-header-gadgets-two"] = async () =>
	await import("./electronics-gadgets/sections/header/HeaderGadgetsTwo") as unknown as EcommerceChromeModule;
registry["electronics-gadgets"].footer["electronics-gadgets-footer-default"] = async () =>
	await import("./electronics-gadgets/sections/footer/FooterDefault") as unknown as EcommerceChromeModule;
registry["groceries-essentials"].header["groceries-essentials-header-default"] = async () =>
	await import("./groceries-essentials/sections/header/HeaderDefault") as unknown as EcommerceChromeModule;
registry["groceries-essentials"].footer["groceries-essentials-footer-default"] = async () =>
	await import("./groceries-essentials/sections/footer/FooterDefault") as unknown as EcommerceChromeModule;

export async function loadEcommerceChromeComponent(
	categoryKey: EcommerceCategoryKey,
	slot: EcommerceChromeSlot,
	selectedComponentKey: string,
) {
	const scopedRegistry = registry[categoryKey][slot];
	const normalizedSelection = String(selectedComponentKey || "").trim().toLowerCase();
	const isLegacyDefault = normalizedSelection === slot
		|| normalizedSelection === `${slot}-default`
		|| normalizedSelection === `storefront-${slot}`;
	const belongsToAnotherCategory = ecommerceCategoryKeys.some(
		(key) => key !== categoryKey && normalizedSelection.startsWith(`${key}-`),
	);

	if (belongsToAnotherCategory) return null;

	const componentKey = !normalizedSelection || isLegacyDefault
		? `${categoryKey}-${slot}-default`
		: normalizedSelection.startsWith(`${categoryKey}-`)
			? normalizedSelection
			: `${categoryKey}-${normalizedSelection}`;
	const loader = scopedRegistry[componentKey];

	if (!loader) return null;
	return (await loader()).default;
}

export const asChromeSection = (section: StorefrontChromeSection): EcommerceSection => section as unknown as EcommerceSection;

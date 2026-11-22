import { cache } from "react";
import { loadStorefrontPageData } from "@/lib/storefront-page";
import { loadStorefrontSettings } from "@/lib/storefront-settings";

export type StorefrontChromeAction = {
	id?: string;
	name?: string;
	slug?: string;
	expression?: string;
	link_type?: string;
	route_key?: string;
	footer_group?: string;
};

export type StorefrontChromeSection = {
	id?: string | number;
	title?: string;
	subtitle?: string;
	variant?: string;
	preset_key?: string;
	component_key?: string;
	template?: {
		slot?: string;
		component_key?: string;
	};
	actions?: StorefrontChromeAction[];
	config?: {
		content?: Record<string, unknown>;
		data?: Record<string, unknown>;
		style?: Record<string, unknown>;
	};
};

export type StorefrontTemplateTheme = {
	id?: number;
	name?: string;
	key?: string;
	category_key?: string;
	shell_component_key?: string;
	page_components?: Record<string, string>;
};

export type StorefrontChromeData = {
	settingsData: Record<string, unknown> | null;
	preferencesData: Record<string, unknown> | null;
	headerSections: StorefrontChromeSection[];
	footerSections: StorefrontChromeSection[];
	headerSection: StorefrontChromeSection | null;
	footerSection: StorefrontChromeSection | null;
	theme: Record<string, unknown> | null;
	categoryKey: unknown;
	storefrontTemplate: StorefrontTemplateTheme | null;
};

const matchesChromeSlot = (section: StorefrontChromeSection, slot: "header" | "footer") => {
	const templateSlot = String(section?.template?.slot || "").trim().toLowerCase();
	const variant = String(section?.variant || "").trim().toLowerCase();
	const componentKey = String(
		section?.component_key || section?.preset_key || section?.template?.component_key || "",
	).trim().toLowerCase();

	return templateSlot === slot
		|| variant === slot
		|| componentKey === slot
		|| componentKey === `storefront-${slot}`
		|| componentKey.startsWith(`${slot}-`)
		|| componentKey.endsWith(`-${slot}`)
		|| componentKey.includes(`-${slot}-`);
};

export const loadStorefrontChromeData = cache(async (host: string | null): Promise<StorefrontChromeData> => {
	try {
		const [storefrontSettings, homeData] = await Promise.all([
			loadStorefrontSettings(host),
			loadStorefrontPageData("/home?react=1", host),
		]);
		const sections = Array.isArray(homeData?.sections) ? (homeData.sections as StorefrontChromeSection[]) : [];
		const headerSections = sections.filter((section) => matchesChromeSlot(section, "header"));
		const footerSections = sections.filter((section) => matchesChromeSlot(section, "footer"));

		return {
			settingsData: storefrontSettings.settingsData,
			preferencesData: storefrontSettings.preferencesData,
			headerSections,
			footerSections,
			headerSection: headerSections[0] || null,
			footerSection: footerSections[0] || null,
			theme: homeData.theme || null,
			categoryKey: homeData.storefrontCategory?.key || homeData.storefrontCategory?.name || null,
			storefrontTemplate: (homeData.storefrontTemplate as StorefrontTemplateTheme | null) || null,
		};
	} catch {
		return {
			settingsData: null,
			preferencesData: null,
			headerSections: [],
			footerSections: [],
			headerSection: null,
			footerSection: null,
			theme: null,
			categoryKey: null,
			storefrontTemplate: null,
		};
	}
});

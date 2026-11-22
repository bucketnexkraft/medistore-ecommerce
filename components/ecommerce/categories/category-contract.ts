import type { ComponentType } from "react";

export const ecommerceCategoryKeys = [
	"fashion-apparel",
	"electronics-gadgets",
	"groceries-essentials",
	"home-kitchen",
	"health-beauty",
	"sports-fitness",
	"jewelry-accessories",
	"toys-kids",
	"books-stationery",
	"pet-supplies",
] as const;

export type EcommerceCategoryKey = (typeof ecommerceCategoryKeys)[number];

export type EcommerceSection = {
	id?: string;
	page_id?: string;
	name?: string;
	title?: string;
	subtitle?: string;
	layout?: string;
	variant?: string;
	preset_key?: string;
	component_key?: string;
	rich_text_html?: string;
	content?: { html?: string };
	actions?: Array<Record<string, unknown>>;
	template?: { slot?: string; component_key?: string };
	[key: string]: unknown;
};

export type EcommerceSectionProps = {
	section: EcommerceSection;
	host: string | null;
	sections: EcommerceSection[];
	index: number;
	demoOnly?: boolean;
	previewMode?: boolean;
};

export type EcommerceSectionComponent = ComponentType<EcommerceSectionProps>;
export type EcommerceSectionModule = { default: EcommerceSectionComponent };
export type EcommerceSectionDefinition = { load: () => Promise<EcommerceSectionModule> };
export type EcommerceSectionRegistry = Readonly<Record<string, EcommerceSectionDefinition>>;

export type EcommerceHomeProps = {
	sections: EcommerceSection[];
	host: string | null;
	demoOnly?: boolean;
	previewMode?: boolean;
};

export type EcommerceHomeModule = { default: ComponentType<EcommerceHomeProps> };

export type EcommerceChromeSlot = "header" | "footer";

export function getEcommerceChromeSlot(section: EcommerceSection): EcommerceChromeSlot | null {
	const slot = String(section.template?.slot || "").trim().toLowerCase();
	const variant = String(section.variant || "").trim().toLowerCase();
	const componentKey = String(section.component_key || section.preset_key || section.template?.component_key || "").trim().toLowerCase();

	if (slot === "header" || variant === "header" || componentKey === "header" || componentKey === "storefront-header" || componentKey.startsWith("header-") || componentKey.endsWith("-header") || componentKey.includes("-header-")) return "header";
	if (slot === "footer" || variant === "footer" || componentKey === "footer" || componentKey === "storefront-footer" || componentKey.startsWith("footer-") || componentKey.endsWith("-footer") || componentKey.includes("-footer-")) return "footer";
	return null;
}

export const isEcommerceChromeSection = (section: EcommerceSection) => getEcommerceChromeSlot(section) !== null;

const ecommerceCategoryKeySet = new Set<string>(ecommerceCategoryKeys);

export function resolveEcommerceCategoryKey(value: unknown): EcommerceCategoryKey | null {
	const normalized = String(value || "")
		.trim()
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-and-/g, "-");

	return ecommerceCategoryKeySet.has(normalized) ? (normalized as EcommerceCategoryKey) : null;
}

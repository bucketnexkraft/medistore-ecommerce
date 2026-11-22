import type { ComponentType } from "react";

export type GroceriesSection = {
	id?: string;
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

export type GroceriesSectionProps = {
	section: GroceriesSection;
	host: string | null;
	sections: GroceriesSection[];
	index: number;
	demoOnly?: boolean;
	previewMode?: boolean;
	[key: string]: unknown;
};

export type GroceriesSectionComponent = ComponentType<GroceriesSectionProps>;
export type GroceriesSectionModule = { default: unknown };
export type GroceriesSectionDefinition = { load: () => Promise<GroceriesSectionModule> };
export type GroceriesSectionRegistry = Readonly<Record<string, GroceriesSectionDefinition>>;

export type GroceriesHomeProps = {
	sections: GroceriesSection[];
	host: string | null;
	demoOnly?: boolean;
	previewMode?: boolean;
};

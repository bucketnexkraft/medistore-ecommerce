import type { ComponentType } from "react";

export type FashionSection = {
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

export type FashionSectionProps = {
	section: FashionSection;
	host: string | null;
	sections: FashionSection[];
	index: number;
	demoOnly?: boolean;
	previewMode?: boolean;
	[key: string]: unknown;
};

export type FashionSectionComponent = ComponentType<FashionSectionProps>;
export type FashionSectionModule = { default: unknown };
export type FashionSectionDefinition = { load: () => Promise<FashionSectionModule> };
export type FashionSectionRegistry = Readonly<Record<string, FashionSectionDefinition>>;

export type FashionHomeProps = {
	sections: FashionSection[];
	host: string | null;
	demoOnly?: boolean;
	previewMode?: boolean;
};

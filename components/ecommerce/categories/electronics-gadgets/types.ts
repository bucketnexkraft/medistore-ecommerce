import type { ComponentType } from "react";

export type ElectronicsSection = {
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

export type ElectronicsSectionProps = {
	section: ElectronicsSection;
	host: string | null;
	sections: ElectronicsSection[];
	index: number;
	demoOnly?: boolean;
	previewMode?: boolean;
	[key: string]: unknown;
};

export type ElectronicsSectionComponent = ComponentType<ElectronicsSectionProps>;
export type ElectronicsSectionModule = { default: unknown };
export type ElectronicsSectionDefinition = { load: () => Promise<ElectronicsSectionModule> };
export type ElectronicsSectionRegistry = Readonly<Record<string, ElectronicsSectionDefinition>>;

export type ElectronicsHomeProps = {
	sections: ElectronicsSection[];
	host: string | null;
	demoOnly?: boolean;
	previewMode?: boolean;
};

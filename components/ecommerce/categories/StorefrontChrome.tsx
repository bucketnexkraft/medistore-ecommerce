import type { HeaderInitialData } from "@/lib/header-context";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";
import type { EcommerceCategoryKey, EcommerceChromeSlot } from "./category-contract";
import { asChromeSection, loadEcommerceChromeComponent } from "./chrome-registry";

type Props = {
	categoryKey: EcommerceCategoryKey | null;
	slot: EcommerceChromeSlot;
	section: StorefrontChromeSection | null;
	host: string | null;
	initialData?: HeaderInitialData;
	preferencesData?: Record<string, unknown> | null;
	demoOnly?: boolean;
	previewMode?: boolean;
};

export default async function StorefrontChrome({ categoryKey, slot, section, host, initialData, preferencesData, demoOnly, previewMode }: Props) {
	if (!categoryKey || !section) return null;

	const componentKey = String(section.component_key || section.preset_key || section.template?.component_key || "").trim();
	const Component = await loadEcommerceChromeComponent(categoryKey, slot, componentKey);
	if (!Component) return null;

	const typedSection = asChromeSection(section);
	return (
		<Component
			section={typedSection}
			host={host}
			sections={[typedSection]}
			index={0}
			initialData={initialData}
			preferencesData={preferencesData}
			demoOnly={demoOnly}
			previewMode={previewMode}
		/>
	);
}

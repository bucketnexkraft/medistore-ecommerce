import type { EcommerceHomeProps } from "../category-contract";
import { sectionRegistry } from "./sections/registry";
import type { GroceriesSectionComponent } from "./types";

function EmptyCategoryHome() {
	return (
		<section className="section py-16 md:py-24">
			<div className="rounded-[28px] border border-secondary-stroke bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:p-12">
				<p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-body">Storefront</p>
				<h1 className="mt-4 text-3xl font-bold text-primary-black md:text-4xl">No configuration has been set up yet</h1>
				<p className="mt-4 text-base text-primary-body">This category does not have any home sections configured yet.</p>
			</div>
		</section>
	);
}

function resolveSectionKey(section: EcommerceHomeProps["sections"][number]): string {
	const rawKey = String(section.component_key || section.preset_key || section.template?.component_key || section.variant || "").trim().toLowerCase();
	if (rawKey === "header") return "groceries-essentials-header-default";
	if (rawKey === "footer") return "groceries-essentials-footer-default";
	if (rawKey === "custom") return "custom";
	return rawKey.startsWith("groceries-essentials-") ? rawKey : `groceries-essentials-${rawKey}`;
}

export default async function GroceriesEssentialsCategoryHome({ sections, host }: EcommerceHomeProps) {
	if (sections.length === 0) return <EmptyCategoryHome />;

	const loaded = await Promise.all(sections.map(async (section, index) => {
		const definition = sectionRegistry[resolveSectionKey(section)];
		if (!definition) return { section, index, Component: null };
		return { section, index, Component: (await definition.load()).default as GroceriesSectionComponent };
	}));

	return <>{loaded.map(({ section, index, Component }) => Component ? <Component key={`${section.id || section.name || "section"}-${index}`} section={section} host={host} sections={sections} index={index} /> : null)}</>;
}

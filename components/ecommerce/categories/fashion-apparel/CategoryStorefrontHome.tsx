import type { FashionHomeProps, FashionSection, FashionSectionComponent, FashionSectionRegistry } from "./types";

type Props = FashionHomeProps & { sectionRegistry: FashionSectionRegistry };

function EmptyStorefrontState() {
	return (
		<section className="section py-16 md:py-24">
			<div className="rounded-[28px] border border-secondary-stroke bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:p-12">
				<p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-body">Storefront</p>
				<h1 className="mt-4 text-3xl font-bold text-primary-black md:text-4xl">dsdsddsd</h1>
				<p className="mt-4 text-base text-primary-body">This category does not have any home sections configured yet.</p>
			</div>
		</section>
	);
}

function resolveSectionKey(section: FashionSection): string {
	const rawKey = String(section.component_key || section.preset_key || section.template?.component_key || section.variant || "").trim().toLowerCase();
	if (rawKey === "header" || rawKey === "header-default" || rawKey === "storefront-header") return "fashion-apparel-header-default";
	if (rawKey === "footer" || rawKey === "footer-default" || rawKey === "storefront-footer") return "fashion-apparel-footer-default";
	if (rawKey === "custom") return "custom";
	return rawKey.startsWith("fashion-apparel-") ? rawKey : `fashion-apparel-${rawKey}`;
}

export async function CategoryStorefrontHome({ sections, host, sectionRegistry, demoOnly, previewMode }: Props & { demoOnly?: boolean; previewMode?: boolean }) {
	if (sections.length === 0) return <EmptyStorefrontState />;

	const loaded = await Promise.all(
		sections.map(async (section, index) => {
			const sectionKey = resolveSectionKey(section);
			if (sectionKey === "fashion-apparel-header-default") return { section, index, Component: null };
			const definition = sectionRegistry[sectionKey];
			if (!definition) return { section, index, Component: null };
			return { section, index, Component: (await definition.load()).default as FashionSectionComponent };
		}),
	);

	return (
		<>
			{loaded.map(({ section, index, Component }) =>
				Component ? (
					<Component
						key={`${section.id || section.name || "section"}-${index}`}
						section={section}
						host={host}
						sections={sections}
						index={index}
						demoOnly={demoOnly}
						previewMode={previewMode}
					/>
				) : null,
			)}
		</>
	);
}

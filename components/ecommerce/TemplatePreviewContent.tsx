import { loadEcommerceCategoryHome } from "@/components/ecommerce/categories/theme-registry";
import StorefrontChrome from "@/components/ecommerce/categories/StorefrontChrome";
import PreviewNavigationGuard from "@/components/ecommerce/PreviewNavigationGuard";
import {
	ecommerceCategoryKeys,
	getEcommerceChromeSlot,
	isEcommerceChromeSection,
	resolveEcommerceCategoryKey,
	type EcommerceSection,
} from "@/components/ecommerce/categories/category-contract";
import { serverApiFetch } from "@/lib/api-client";
import { buildHeaderInitialData } from "@/lib/header-context";
import type { StorefrontChromeData, StorefrontChromeSection } from "@/lib/storefront-chrome";
import { headers } from "next/headers";
import type { CSSProperties } from "react";

type PreviewAction = {
	page_id?: string;
	id?: string;
	section_id?: string;
	name?: string;
	slug?: string;
	expression?: string;
	link_type?: string;
	route_key?: string;
	target_page_id?: string;
	target_page_slug?: string;
	target_page_route_mode?: string;
	target_page_route_key?: string;
	placement?: string;
	footer_group?: string;
};

type PreviewSection = {
	id?: string;
	page_id?: string;
	name?: string;
	title?: string;
	subtitle?: string;
	layout?: string;
	variant?: string;
	order?: number;
	query_json?: string;
	rich_text_html?: string;
};

type PreviewPage = {
	id?: string;
	slug?: string;
	route_key?: string;
	route_mode?: string;
};

type PreviewPayload = {
	template?: {
		id?: number;
		template_name?: string;
		primary_color?: string;
		secondary_color?: string;
		font_family?: string;
		categories?: Array<{ key?: string; name?: string } | string>;
	} | null;
	builder?: {
		pages?: PreviewPage[];
		sections?: PreviewSection[];
		actions?: PreviewAction[];
	} | null;
};

const toText = (value: unknown) => String(value || "").trim();

const previewFonts: Record<string, string> = {
	Inter: "Inter:wght@400;500;600;700",
	Poppins: "Poppins:wght@400;500;600;700",
	Roboto: "Roboto:wght@400;500;700",
	Montserrat: "Montserrat:wght@400;500;600;700",
	"Open Sans": "Open+Sans:wght@400;500;600;700",
	Lato: "Lato:wght@400;700",
	Nunito: "Nunito:wght@400;500;600;700",
	"DM Sans": "DM+Sans:wght@400;500;600;700",
	"Playfair Display": "Playfair+Display:wght@400;500;600;700",
};

function filterActionsForPage(actions: PreviewAction[], pageId: string) {
	return actions.filter((action) => {
		const actionPageId = toText(action?.page_id);
		return pageId === "" || actionPageId === "" || actionPageId === pageId;
	});
}

function mergeUniqueActions(...groups: PreviewAction[][]) {
	const seen = new Set<string>();

	return groups.flat().filter((action, index) => {
		const baseKey = [
			toText(action?.id),
			toText(action?.section_id),
			toText(action?.slug),
			toText(action?.name),
		].join("::");
		const key = baseKey === "::::" ? `fallback::${index}` : baseKey;

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}

function isSlotPlacementMatch(action: PreviewAction, slot: "header" | "footer") {
	const placement = toText(action?.placement).toLowerCase();

	if (placement === "") {
		return true;
	}

	if (placement === "contextual") {
		return true;
	}

	return placement === slot;
}

export async function getTemplatePreview(templateId: string, host: string | null): Promise<PreviewPayload | null> {
	try {
		const previewPath = /^\d+$/.test(templateId)
			? `/storefront/ecommerce-setup/public-preview/${templateId}`
			: `/storefront/ecommerce-setup/public-preview-token?template_id=${encodeURIComponent(templateId)}`;
		const response = await serverApiFetch(previewPath, host, {
			cache: "no-store",
		});

		if (!response.ok) {
			return null;
		}

		const result = await response.json();
		return result?.data || null;
	} catch {
		return null;
	}
}

function attachActions(sections: PreviewSection[], actions: PreviewAction[], pageId: string) {
	return sections.map((section) => {
		const sectionId = toText(section?.id);
		const variant = toText(section?.variant).toLowerCase();
		const slot = variant === "header" || variant === "footer" ? variant : "";
		const sectionActions = filterActionsForPage(actions, pageId).filter((action) => {
			if (toText(action?.section_id) !== sectionId) {
				return false;
			}

			if (slot === "") {
				return true;
			}

			return isSlotPlacementMatch(action, slot);
		});
		const slotActions =
			slot === ""
				? []
				: filterActionsForPage(actions, pageId).filter(
						(action) =>
							toText(action?.section_id) === "" && toText(action?.placement).toLowerCase() === slot,
					);

		return {
			...section,
			actions: mergeUniqueActions(sectionActions, slotActions),
			content: section.rich_text_html ? { html: section.rich_text_html } : undefined,
			template: slot
				? {
						slot,
						label: section.title || section.name || slot,
						component_key: variant,
					}
				: undefined,
		};
	});
}

export default async function TemplatePreviewContent({
	templateId,
	host,
	initialPreview,
	pageSlug,
}: {
	templateId: string;
	host?: string | null;
	initialPreview?: PreviewPayload | null;
	pageSlug?: string | null;
}) {
	const requestHost = host ?? (await headers()).get("host");
	const preview = initialPreview === undefined ? await getTemplatePreview(templateId, requestHost) : initialPreview;

	if (!preview) {
		return (
			<main className="min-h-screen bg-background">
				<div className="section py-16">
					<div className="rounded-3xl border border-secondary-stroke bg-white p-10">
						<h1 className="text-3xl font-bold text-primary-black">Template preview not found</h1>
						<p className="mt-4 text-primary-body">The requested template could not be loaded.</p>
					</div>
				</div>
			</main>
		);
	}

	const pages = Array.isArray(preview?.builder?.pages) ? preview.builder.pages : [];
	const sections = Array.isArray(preview?.builder?.sections) ? preview.builder.sections : [];
	const actions = Array.isArray(preview?.builder?.actions) ? preview.builder.actions : [];
	const homePage = pages.find((page) => toText(page?.slug).toLowerCase() === "home") || pages[0] || null;
	const requestedPage = toText(pageSlug).replace(/^\/+|\/+$/g, "").toLowerCase();
	const selectedPage = requestedPage
		? pages.find((page) => {
			const slug = toText(page?.slug).replace(/^\/+|\/+$/g, "").toLowerCase();
			const routeKey = toText(page?.route_key).replace(/^\/+|\/+$/g, "").toLowerCase();
			return slug === requestedPage || routeKey === requestedPage;
		}) || homePage
		: homePage;
	const pageId = toText(selectedPage?.id);
	const homePageId = toText(homePage?.id);
	const selectedPageSections = sections.filter((section) => {
		const sectionPageId = toText(section?.page_id);

		// Header/footer sections may be stored as global builder sections.
		// Keep global sections in every preview page.
		return !pageId || sectionPageId === "" || sectionPageId === pageId;
	});
	const selectedPreparedSections = attachActions(
		selectedPageSections.sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0)),
		actions,
		pageId,
	);
	const homeChromeSections = pageId !== homePageId
		? sections
				.filter((section) => toText(section?.page_id) === homePageId && (String(section?.variant || "").toLowerCase() === "header" || String(section?.variant || "").toLowerCase() === "footer" || isEcommerceChromeSection(section as EcommerceSection)))
				.sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0))
		: [];
	const preparedSections = [
		...selectedPreparedSections,
		...attachActions(homeChromeSections, actions, homePageId),
	];

	const themeStyle = {
		"--storefront-primary": preview.template?.primary_color || "#7F00FF",
		"--storefront-secondary": preview.template?.secondary_color || "#F5F3FF",
		// Text uses the template secondary color; accents/backgrounds use primary.
		"--primary-black": preview.template?.secondary_color || "#212124",
		"--primary-body": preview.template?.secondary_color || "#5a5a59",
		"--primary-blue": preview.template?.primary_color || "#7406ff",
		"--theme-coral": preview.template?.primary_color || "#f84a51",
		"--primary-green": preview.template?.primary_color || "#34c759",
		"--secondary-stroke": preview.template?.secondary_color || "#dbdbdb",
		"--bg": preview.template?.secondary_color || "#fcfbf7",
		"--fg": preview.template?.secondary_color || "#f2efe7",
		backgroundColor: "#ffffff",
		fontFamily: preview.template?.font_family
			? `'${preview.template.font_family.replace(/'/g, "")}', sans-serif`
			: undefined,
	} as CSSProperties;
	const selectedFont = preview.template?.font_family || "Inter";
	const fontDefinition = previewFonts[selectedFont];
	const previewCategory = preview.template?.categories?.[0];
	const previewCategoryKey = typeof previewCategory === "string"
		? previewCategory
		: previewCategory?.key || previewCategory?.name;
	const typedSections = preparedSections as EcommerceSection[];
	const inferredCategory = typedSections
		.flatMap((section) => [section.component_key, section.preset_key, section.template?.component_key])
		.map((componentKey) => String(componentKey || "").trim().toLowerCase())
		.flatMap((componentKey) => ecommerceCategoryKeys.filter((key) => componentKey.startsWith(`${key}-`)))[0];
	const ecommerceCategoryKey = resolveEcommerceCategoryKey(previewCategoryKey) || inferredCategory || null;
	const CategoryHome = ecommerceCategoryKey ? await loadEcommerceCategoryHome(ecommerceCategoryKey) : null;
	const headerSections = typedSections.filter((section) => getEcommerceChromeSlot(section) === "header");
	const footerSections = typedSections.filter((section) => getEcommerceChromeSlot(section) === "footer");
	const headerSection = headerSections[0] || null;
	const footerSection = footerSections[0] || null;
	const contentSections = typedSections.filter((section) => !isEcommerceChromeSection(section));
	const previewChromeData: StorefrontChromeData = {
		settingsData: null,
		preferencesData: null,
		headerSections: headerSections as StorefrontChromeSection[],
		footerSections: footerSections as StorefrontChromeSection[],
		headerSection: headerSection as StorefrontChromeSection | null,
		footerSection: footerSection as StorefrontChromeSection | null,
		theme: (preview.template || null) as Record<string, unknown> | null,
		categoryKey: ecommerceCategoryKey,
		storefrontTemplate: null,
	};
	return (
		<PreviewNavigationGuard>
			{fontDefinition ? (
				<link
					rel="stylesheet"
					href={`https://fonts.googleapis.com/css2?family=${fontDefinition}&display=swap`}
				/>
			) : null}
			<style>{`
				/* Keep semantic roles separate: text is secondary, filled controls/backgrounds are primary. */
				.bg-primary-black,
				.bg-primary-blue,
				.bg-primary-green,
				.bg-theme-coral { background-color: var(--storefront-primary) !important; }
				.hover\\:bg-theme-coral:hover,
				.hover\\:bg-primary-green:hover,
				.hover\\:bg-primary-blue:hover { background-color: var(--storefront-primary) !important; }
				.border-primary-black,
				.border-primary-blue,
				.border-primary-green,
				.border-theme-coral { border-color: var(--storefront-primary) !important; }
				.text-primary-black,
				.text-primary-body { color: var(--storefront-secondary) !important; }
			`}</style>
			<div style={themeStyle}>
				{headerSections.map((section, index) => (
					<StorefrontChrome
						key={`preview-header-${section.id || section.component_key || index}`}
						categoryKey={ecommerceCategoryKey}
						slot="header"
						section={section as StorefrontChromeSection}
						host={requestHost}
						initialData={buildHeaderInitialData({ ...previewChromeData, headerSection: section as StorefrontChromeSection })}
						demoOnly
						previewMode
					/>
				))}
				{CategoryHome ? <CategoryHome sections={contentSections} host={requestHost} demoOnly previewMode /> : null}
				{footerSections.map((section, index) => (
					<StorefrontChrome
						key={`preview-footer-${section.id || section.component_key || index}`}
						categoryKey={ecommerceCategoryKey}
						slot="footer"
						section={section as StorefrontChromeSection}
						host={requestHost}
						demoOnly
						previewMode
					/>
				))}
			</div>
		</PreviewNavigationGuard>
	);
}

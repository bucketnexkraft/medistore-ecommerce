import { StorefrontMarketingScripts } from "@/components/common/StorefrontMarketingScripts";
import { StorefrontAnalytics } from "@/components/common/StorefrontAnalytics";
import StorefrontChrome from "@/components/ecommerce/categories/StorefrontChrome";
import { ecommerceCategoryKeys, resolveEcommerceCategoryKey } from "@/components/ecommerce/categories/category-contract";
import { buildHeaderInitialData } from "@/lib/header-context";
import { serverApiFetch } from "@/lib/api-client";
import { loadStorefrontChromeData } from "@/lib/storefront-chrome";
import StorefrontInitialPreloader from "@/components/common/StorefrontInitialPreloader";
import StorefrontPreloader from "@/components/common/StorefrontPreloader";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";

export const dynamic = "force-dynamic";

const storefrontFonts: Record<string, string> = {
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

const DEMO_STOREFRONT_HOST = "demo.nex-ecom.orfactor.com";

type PublicOptionsResponse = {
	data?: {
		selected_template?: { demo_preview_url?: string | null } | null;
		templates?: Array<{ demo_preview_url?: string | null }>;
	};
};

async function resolveDemoPreviewPath(host: string | null, pathname: string | null) {
	try {
		const response = await serverApiFetch("/storefront/ecommerce-setup/public-options", host, { cache: "no-store" });
		if (!response.ok) return null;

		const payload = (await response.json()) as PublicOptionsResponse;
		const previewUrl = String(
			payload.data?.selected_template?.demo_preview_url
			|| payload.data?.templates?.[0]?.demo_preview_url
			|| "",
		).trim();
		if (!previewUrl) return null;

		const target = new URL(previewUrl);
		const previewPage = String(pathname || "/").replace(/^\/+|\/+$/g, "") || "home";
		target.searchParams.set("preview_page", previewPage);

		return target.toString();
	} catch {
		return null;
	}
}

export default async function MainLayout({ children }: { children: ReactNode }) {
	const headerStore = await headers();
	const previewMode = headerStore.get("x-storefront-template-preview") === "1";
	const host = String(headerStore.get("host") || "")
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/:\d+$/, "");

	if (previewMode) {
		return children;
	}

	if (host === DEMO_STOREFRONT_HOST) {
		const previewPath = await resolveDemoPreviewPath(host, headerStore.get("x-storefront-path"));
		if (previewPath) {
			redirect(previewPath);
		}
	}

	return (
		<>
			<Suspense fallback={<StorefrontPreloader />}>
				<StorefrontChromeRuntime>{children}</StorefrontChromeRuntime>
			</Suspense>
			<StorefrontInitialPreloader />
		</>
	);
}

async function StorefrontChromeRuntime({ children }: { children: ReactNode }) {
	const headerStore = await headers();
	const host = headerStore.get("host");
	const chromeData = await loadStorefrontChromeData(host);
	const headerSections = chromeData.headerSections?.length
		? chromeData.headerSections
		: chromeData.headerSection
			? [chromeData.headerSection]
			: [];
	const footerSections = chromeData.footerSections?.length
		? chromeData.footerSections
		: chromeData.footerSection
			? [chromeData.footerSection]
			: [];
	const selectedChromeKey = String(
		[...headerSections, ...footerSections]
			.map((section) => section?.component_key || section?.preset_key || "")
			.find(Boolean)
		|| "",
	).trim().toLowerCase();
	const inferredCategory = ecommerceCategoryKeys.find((key) => selectedChromeKey.startsWith(`${key}-`));
	const categoryKey = resolveEcommerceCategoryKey(
		chromeData.categoryKey || chromeData.storefrontTemplate?.category_key,
	) || inferredCategory || null;
	const primaryColor = String(chromeData.theme?.primary_color || "#7F00FF");
	const secondaryColor = String(chromeData.theme?.secondary_color || "#F5F3FF");
	const selectedFont = String(chromeData.theme?.font_family || "Inter");
	const fontDefinition = storefrontFonts[selectedFont];
	const themeStyle = {
		"--storefront-primary": primaryColor,
		"--storefront-secondary": secondaryColor,
		"--storefront-primary-soft": `color-mix(in srgb, ${primaryColor} 12%, white)`,
		"--storefront-secondary-soft": `color-mix(in srgb, ${secondaryColor} 18%, white)`,
		"--primary-black": secondaryColor,
		"--primary-body": secondaryColor,
		"--primary-blue": primaryColor,
		"--primary-green": primaryColor,
		"--secondary-red": primaryColor,
		"--theme-yellow": primaryColor,
		"--theme-coral": primaryColor,
		"--secondary-stroke": secondaryColor,
		"--bg": secondaryColor,
		"--fg": secondaryColor,
		"--primary": primaryColor,
		"--primary-foreground": "#ffffff",
		"--secondary": secondaryColor,
		"--secondary-foreground": "#212124",
		"--accent": "var(--storefront-primary-soft)",
		"--accent-foreground": primaryColor,
		"--ring": primaryColor,
		"--border": secondaryColor,
		"--input": secondaryColor,
		"--muted": "var(--storefront-secondary-soft)",
		"--muted-foreground": "#5a5a59",
		fontFamily: `'${selectedFont.replace(/'/g, "")}', sans-serif`,
		// Theme colors belong to storefront sections and controls. The page/body
		// canvas must remain white unless a section explicitly paints a background.
		backgroundColor: "#ffffff",
	} as CSSProperties;

	return (
		<div className="storefront-theme" style={themeStyle}>
			{fontDefinition ? (
				<link
					rel="stylesheet"
					href={`https://fonts.googleapis.com/css2?family=${fontDefinition}&display=swap`}
				/>
			) : null}
			<style>{`
				.storefront-theme {
					--storefront-font-family: '${selectedFont.replace(/'/g, "")}', sans-serif;
				}
				.storefront-theme .bg-primary-black,
				.storefront-theme .bg-primary-blue,
				.storefront-theme .bg-primary-green,
				.storefront-theme .bg-theme-coral { background-color: var(--storefront-primary) !important; }
				.storefront-theme .hover\\:bg-primary-black:hover,
				.storefront-theme .hover\\:bg-primary-blue:hover,
				.storefront-theme .hover\\:bg-primary-green:hover,
				.storefront-theme .hover\\:bg-theme-coral:hover { background-color: var(--storefront-primary) !important; }
				.storefront-theme .text-primary-blue,
				.storefront-theme .text-primary-green,
				.storefront-theme .text-theme-coral { color: var(--storefront-primary) !important; }
				.storefront-theme .text-primary-black,
				.storefront-theme .text-primary-body { color: var(--storefront-secondary) !important; }
				.storefront-theme .hover\\:text-primary-blue:hover,
				.storefront-theme .hover\\:text-primary-green:hover,
				.storefront-theme .hover\\:text-theme-coral:hover { color: var(--storefront-primary) !important; }
				.storefront-theme .border-primary-black,
				.storefront-theme .border-primary-blue,
				.storefront-theme .border-primary-green,
				.storefront-theme .border-theme-coral { border-color: var(--storefront-primary) !important; }
				.storefront-theme .bg-green-50 { background-color: color-mix(in srgb, var(--storefront-primary) 8%, white) !important; }
				.storefront-theme .bg-green-100 { background-color: color-mix(in srgb, var(--storefront-primary) 16%, white) !important; }
				.storefront-theme .bg-green-500,
				.storefront-theme .bg-green-600 { background-color: var(--storefront-primary) !important; }
				.storefront-theme .text-green-500,
				.storefront-theme .text-green-600,
				.storefront-theme .text-green-700 { color: var(--storefront-primary) !important; }
				.storefront-theme .border-green-500,
				.storefront-theme .border-green-600 { border-color: var(--storefront-primary) !important; }
				.storefront-theme .hover\\:bg-green-500:hover,
				.storefront-theme .hover\\:bg-green-600:hover { background-color: var(--storefront-primary) !important; }
				.storefront-theme .hover\\:text-green-500:hover,
				.storefront-theme .hover\\:text-green-600:hover,
				.storefront-theme .hover\\:text-green-700:hover { color: var(--storefront-primary) !important; }
				.storefront-theme .bg-red-500,
				.storefront-theme .bg-red-600,
				.storefront-theme .bg-blue-500,
				.storefront-theme .bg-blue-600 { background-color: var(--storefront-primary) !important; }
				.storefront-theme .text-red-500,
				.storefront-theme .text-red-600,
				.storefront-theme .text-blue-500,
				.storefront-theme .text-blue-600 { color: var(--storefront-primary) !important; }
				.storefront-theme .hover\\:bg-red-500:hover,
				.storefront-theme .hover\\:bg-red-600:hover,
				.storefront-theme .hover\\:bg-blue-500:hover,
				.storefront-theme .hover\\:bg-blue-600:hover { background-color: var(--storefront-primary) !important; }
				.storefront-theme .hover\\:text-red-500:hover,
				.storefront-theme .hover\\:text-red-600:hover,
				.storefront-theme .hover\\:text-blue-500:hover,
				.storefront-theme .hover\\:text-blue-600:hover { color: var(--storefront-primary) !important; }
			`}</style>
			<StorefrontAnalytics />
			<StorefrontMarketingScripts
				gtmId={String(chromeData.preferencesData?.gtm_id ?? "") || null}
				facebookPixelId={String(chromeData.preferencesData?.facebook_pixel_id ?? "") || null}
				facebookTestEventId={String(chromeData.preferencesData?.facebook_test_event_id ?? "") || null}
				tiktokPixelId={String(chromeData.preferencesData?.tiktok_pixel_id ?? "") || null}
			/>
			{headerSections.map((section, index) => (
				<StorefrontChrome
					key={`header-${section.id || section.component_key || index}`}
					categoryKey={categoryKey}
					slot="header"
					section={section}
					host={host}
					initialData={buildHeaderInitialData({ ...chromeData, headerSection: section })}
					preferencesData={chromeData.preferencesData}
				/>
			))}
			{children}
			{footerSections.map((section, index) => (
				<StorefrontChrome
					key={`footer-${section.id || section.component_key || index}`}
					categoryKey={categoryKey}
					slot="footer"
					section={section}
					host={host}
					preferencesData={chromeData.preferencesData}
				/>
			))}
		</div>
	);
}

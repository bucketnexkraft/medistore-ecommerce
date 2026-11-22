import { navMenuItems, socialLinks as defaultSocialLinks } from "@/data/header-data";
import { resolveStorefrontActionHref } from "@/lib/storefront-links";
import type { StorefrontChromeAction, StorefrontChromeData, StorefrontChromeSection } from "@/lib/storefront-chrome";

export type BrandState = {
	name: string;
	logoUrl: string | null;
};

export type SocialLinkState = {
	label: string;
	href: string;
	icon: string;
	iconType?: "image" | "lucide";
};

export type HeaderNavItem = {
	label: string;
	href: string;
	icon?: string;
	isButton?: boolean;
	isHighlighted?: boolean;
};

export type HeaderInitialData = {
	brand: BrandState;
	socialLinks: SocialLinkState[];
	navItems: HeaderNavItem[];
	hasBuilderHeader: boolean;
	searchPlaceholder: string;
};

type PreferenceItem = {
	key?: string;
	value?: unknown;
};

export const DEFAULT_BRAND: BrandState = {
	name: "e-Nex",
	logoUrl: null,
};

const SOCIAL_LINK_ICON_MAP: Record<string, { label: string; icon: string }> = {
	facebook_link: { label: "Facebook", icon: "/icons/social/fb.svg" },
	instagram_link: { label: "Instagram", icon: "/icons/social/ins.svg" },
	twitter_link: { label: "X (Twitter)", icon: "/icons/social/x.svg" },
	linkedin_link: { label: "LinkedIn", icon: "/icons/social/linkedin.svg" },
	youtube_link: { label: "YouTube", icon: "/icons/social/youtube.svg" },
};

export const getAllCategoriesNavItem = (): HeaderNavItem =>
	navMenuItems.find((item) => item.label === "All categories") || {
		label: "All categories",
		href: "",
		icon: "/images/header/ham.png",
		isButton: true,
	};

export const normalizePreferencesData = (data: unknown): Record<string, unknown> | null => {
	if (Array.isArray(data)) {
		return data.reduce<Record<string, unknown>>((accumulator, item) => {
			const key = String((item as PreferenceItem | null)?.key || "").trim();

			if (key !== "") {
				accumulator[key] = (item as PreferenceItem).value;
			}

			return accumulator;
		}, {});
	}

	if (data && typeof data === "object") {
		return data as Record<string, unknown>;
	}

	return null;
};

export const mapHeaderActionsToNavItems = (actions: StorefrontChromeAction[]): HeaderNavItem[] => {
	const allCategoriesItem = getAllCategoriesNavItem();

	const dynamicItems = actions
		.map((action) => {
			const label = String(action?.name || action?.slug || "").trim();
			const href = resolveStorefrontActionHref(action);

			if (label === "" || href === "#" || href === "") {
				return null;
			}

			return {
				label,
				href,
			};
		})
		.filter((item): item is HeaderNavItem => item !== null);

	if (dynamicItems.length === 0) {
		return [allCategoriesItem];
	}

	return [allCategoriesItem, ...dynamicItems];
};

export const buildDynamicSocialLinks = (
	data: Record<string, unknown> | null | undefined,
	headerSection?: StorefrontChromeSection | null,
): SocialLinkState[] => {
	const configuredItems = headerSection?.config?.content?.social_links;
	if (Array.isArray(configuredItems)) {
		const configuredLinks = configuredItems
			.map((item) => {
				if (!item || typeof item !== "object") return null;
				const record = item as Record<string, unknown>;
				const rawHref = String(record.url ?? record.href ?? "").trim();
				const href = rawHref && /^(https?:\/\/|\/\/|\/|#|mailto:|tel:)/i.test(rawHref) ? rawHref : (rawHref ? `https://${rawHref}` : "");
				const icon = String(
					typeof record.icon === "object" && record.icon !== null
						? (record.icon as Record<string, unknown>).name ?? ""
						: record.icon ?? "",
				).trim();
				if (!href || !icon) return null;
				const label = String(record.label ?? icon.replace(/[-_]+/g, " ")).trim();
				return { label: label || "Social link", href, icon, iconType: "lucide" as const };
			})
			.filter((item) => item !== null) as SocialLinkState[];

		// An explicitly configured empty repeater means the merchant wants no
		// social icons; only fall back when the builder has no social_links field.
		return configuredLinks;
	}

	if (!data || typeof data !== "object") {
		return defaultSocialLinks;
	}

	const resolvedLinks = Object.entries(SOCIAL_LINK_ICON_MAP)
		.map(([key, meta]) => {
			const href = String(data[key] ?? "").trim();

			if (href === "") {
				return null;
			}

			return {
				label: meta.label,
				href,
				icon: meta.icon,
				iconType: "image",
			};
		})
		.filter((item) => item !== null) as SocialLinkState[];

	return resolvedLinks.length > 0 ? resolvedLinks : defaultSocialLinks;
};

export const resolveHeaderSearchPlaceholder = (headerSection?: StorefrontChromeSection | null): string => {
	const content = headerSection?.config?.content;
	const value = String(content?.search_placeholder_text ?? content?.search_placeholder ?? content?.searchPlaceholder ?? "").trim();

	return value || "Search any product...";
};

export const resolveBrandName = (
	headerSection: StorefrontChromeSection | null,
	preferencesData: Record<string, unknown> | null | undefined,
	settingsData: Record<string, unknown> | null | undefined,
): string => {
	const headerTitle = String(headerSection?.title || "").trim();
	// Template section titles such as "Header Default" are configuration labels,
	// not the store's brand. Fall back to the company/store name for these values.
	const normalizedHeaderTitle = headerTitle.toLowerCase().replace(/[\-_]+/g, " ").replace(/\s+/g, " ").trim();
	const placeholderTitles = new Set(["header", "header default", "default header", "footer", "footer default", "default footer"]);
	const preferredPreferenceName = [
		preferencesData?.application_name,
		preferencesData?.name,
		preferencesData?.store_name,
		preferencesData?.company_name,
	].map((value) => String(value ?? "").trim()).find(Boolean) || "";
	const settingsSiteName = [
		settingsData?.brand_label,
		settingsData?.sitename,
		settingsData?.store_name,
		settingsData?.company_name,
	].map((value) => String(value ?? "").trim()).find(Boolean) || "";

	if (headerTitle !== "" && !placeholderTitles.has(normalizedHeaderTitle)) {
		return headerTitle;
	}

	if (preferredPreferenceName !== "") {
		return preferredPreferenceName;
	}

	if (settingsSiteName !== "") {
		return settingsSiteName;
	}

	return DEFAULT_BRAND.name;
};

export const resolveBrandLogo = (
	preferencesData: Record<string, unknown> | null | undefined,
	settingsData: Record<string, unknown> | null | undefined,
): string | null => {
	const companyLogo = String(preferencesData?.site_logo ?? "").trim();

	if (companyLogo !== "") {
		return companyLogo;
	}

	const settingsLogo = String(settingsData?.dark_logo_url ?? settingsData?.white_logo_url ?? "").trim();

	return settingsLogo !== "" ? settingsLogo : null;
};

export const buildHeaderInitialData = (chromeData: StorefrontChromeData): HeaderInitialData => {
	const { headerSection, preferencesData, settingsData } = chromeData;

	return {
		brand: {
			name: resolveBrandName(headerSection, preferencesData, settingsData),
			logoUrl: resolveBrandLogo(preferencesData, settingsData),
		},
		socialLinks: buildDynamicSocialLinks(preferencesData, headerSection),
		navItems: mapHeaderActionsToNavItems(Array.isArray(headerSection?.actions) ? headerSection.actions : []),
		hasBuilderHeader: Boolean(headerSection),
		searchPlaceholder: resolveHeaderSearchPlaceholder(headerSection),
	};
};

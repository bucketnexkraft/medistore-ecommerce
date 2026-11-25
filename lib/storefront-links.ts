export type StorefrontLinkType = "internal_route" | "custom_path" | "external_url" | "storefront_page";

export type StorefrontActionLink = {
	id?: string;
	name?: string;
	slug?: string;
	expression?: string;
	link_type?: string;
	route_key?: string;
	target_page_id?: string;
	target_page_slug?: string;
	target_page_route_mode?: string;
	target_page_route_key?: string;
};

export const STOREFRONT_INTERNAL_ROUTE_OPTIONS = [
	{ value: "/", label: "Home" },
	{ value: "/products", label: "Products" },
	{ value: "/categories", label: "Categories" },
	{ value: "/deals", label: "Deals" },
	{ value: "/new-arrival", label: "New Arrival" },
	{ value: "/limited-sale", label: "Limited Sale" },
	{ value: "/best-seller", label: "Best Seller" },
	{ value: "/group-purchase", label: "Group Purchase" },
	{ value: "/wishlist", label: "Wishlist" },
	{ value: "/cart", label: "Cart" },
	{ value: "/checkout", label: "Checkout" },
	{ value: "/user-dashboard", label: "User Dashboard" },
] as const;

const INTERNAL_ROUTE_SET: Set<string> = new Set(STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => option.value));

export function normalizeStorefrontNavHref(value: string): string {
	const href = value.trim();
	if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return "";
	if (/^(?:mailto:|tel:|[?#])/i.test(href)) return href;
	if (/^(?:https?:)?\/\//i.test(href)) {
		try {
			new URL(href, "https://storefront.local/");
			return href;
		} catch {
			return "";
		}
	}
	if (/^[a-z][a-z\d+.-]*:/i.test(href)) return "";

	const { pathname, search, hash } = new URL(href, "https://storefront.local/");
	const route = pathname.replace(/\/$/, "").toLowerCase();
	const resolvedPath = route === "/login" || route === "/sign-in" ? "/signin" : route === "/product" ? "/products" : pathname;
	return `${resolvedPath}${search}${hash}`;
}

export function normalizeStorefrontLinkType(value?: string | null): StorefrontLinkType {
	if (value === "internal_route" || value === "custom_path" || value === "external_url" || value === "storefront_page") {
		return value;
	}

	return "custom_path";
}

export function resolveStorefrontPageHref(slug?: string | null): string {
	const normalizedSlug = String(slug || "").trim().toLowerCase();

	if (normalizedSlug === "") {
		return "#";
	}

	if (normalizedSlug === "home") {
		return "/";
	}

	return `/${normalizedSlug}`;
}

export function resolveStorefrontActionHref(action?: StorefrontActionLink | null): string {
	const linkType = normalizeStorefrontLinkType(action?.link_type);
	const routeKey = String(action?.route_key || "").trim();
	const expression = String(action?.expression || "").trim();
	const targetPageSlug = String(action?.target_page_slug || "").trim();
	const targetPageRouteMode = String(action?.target_page_route_mode || "").trim();
	const targetPageRouteKey = String(action?.target_page_route_key || "").trim();

	if (linkType === "internal_route") {
		if (routeKey !== "" && INTERNAL_ROUTE_SET.has(routeKey)) {
			return routeKey;
		}

		if (expression !== "") {
			return expression;
		}

		return "#";
	}

	if (linkType === "external_url") {
		return expression || "#";
	}

	if (linkType === "storefront_page") {
		if (targetPageRouteMode === "internal_route" && targetPageRouteKey !== "") {
			return targetPageRouteKey;
		}

		return resolveStorefrontPageHref(targetPageSlug);
	}

	if (expression !== "") {
		return expression;
	}

	if (targetPageSlug !== "") {
		return resolveStorefrontPageHref(targetPageSlug);
	}

	if (routeKey !== "") {
		return routeKey;
	}

	return "#";
}

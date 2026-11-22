import { serverApiFetch } from "@/lib/api-client";

export type FlashDealProduct = {
	id: string;
	name: string;
	slug: string;
	brand: string;
	category: string;
	price: number;
	original_price: number;
	discount_percent: number;
	image: string;
	badge: string;
	rating: number | null;
	reviews: number;
	quantity?: number;
	ends_at?: string | null;
	url: string;
	accent?: string;
};

export type FlashDealsSection = {
	heading: string;
	subheading: string;
	button_text: string;
	button_link: string;
	ends_at?: string | null;
	products: FlashDealProduct[];
};

export const fallbackFlashDealsSection: FlashDealsSection = {
	heading: "Flash deal",
	subheading: "Limited-time picks moving fast across the storefront.",
	button_text: "Shop all products",
	button_link: "/products",
	ends_at: null,
	products: [],
};

const normalizeNumber = (value: unknown, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeFlashDealProducts = (data: unknown): FlashDealProduct[] => {
	if (!Array.isArray(data)) {
		return [];
	}

	return data.map((item) => {
		const product = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
		const slug = String(product.slug || "");

		return {
			id: String(product.id || ""),
			name: String(product.name || ""),
			slug,
			brand: String(product.brand || ""),
			category: String(product.category || ""),
			price: normalizeNumber(product.price, 0),
			original_price: normalizeNumber(product.original_price, 0),
			discount_percent: normalizeNumber(product.discount_percent, 0),
			image: String(product.image || ""),
			badge: String(product.badge || ""),
			rating: product.rating == null ? null : normalizeNumber(product.rating, 0),
			reviews: Math.max(0, Math.floor(normalizeNumber(product.reviews, 0))),
			quantity: Math.max(0, Math.floor(normalizeNumber(product.quantity, 0))),
			ends_at: typeof product.ends_at === "string" ? product.ends_at : null,
			url: String(product.url || (slug ? `/product/${slug}` : "#")),
			accent: typeof product.accent === "string" ? product.accent : undefined,
		};
	});
};

export async function fetchFlashDealsSectionServer(host: string | null, limit = 8, demoOnly = false): Promise<FlashDealsSection> {
	try {
		const safeLimit = Math.max(1, Math.min(limit, 12));
		const demoParam = demoOnly ? "&is_demo=1" : "";
		const response = await serverApiFetch(`/landing/sections/flash-deals?limit=${safeLimit}${demoParam}`, host, {
			next: { revalidate: 120 },
		});

		if (!response.ok) {
			return fallbackFlashDealsSection;
		}

		const result = await response.json();
		const data = result?.data;

		return {
			heading: String(data?.heading || fallbackFlashDealsSection.heading),
			subheading: String(data?.subheading || fallbackFlashDealsSection.subheading),
			button_text: String(data?.button_text || fallbackFlashDealsSection.button_text),
			button_link: String(data?.button_link || fallbackFlashDealsSection.button_link),
			ends_at: typeof data?.ends_at === "string" ? data.ends_at : null,
			products: normalizeFlashDealProducts(data?.products),
		};
	} catch {
		return fallbackFlashDealsSection;
	}
}

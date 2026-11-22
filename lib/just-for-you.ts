import { serverApiFetch } from "@/lib/api-client";

export type JustForYouProduct = {
	id: string;
	name: string;
	slug: string;
	category: string;
	price: number;
	original_price: number;
	discount_percent?: number;
	image: string;
	bg_image: string;
	badge: string;
	rating: number | null;
	reviews: number;
	quantity?: number;
	url: string;
};

export type JustForYouSection = {
	heading: string;
	subheading: string;
	categories: string[];
	demand_tag?: string | null;
	products: JustForYouProduct[];
};

export const fallbackJustForYouSection: JustForYouSection = {
	heading: "Just for you",
	subheading: "",
	categories: [],
	demand_tag: null,
	products: [],
};

export async function fetchJustForYouSectionServer(
	host: string | null,
	limit = 100,
	demandTag?: string | null,
	demoOnly = false,
): Promise<JustForYouSection> {
	try {
		const safeLimit = Math.max(1, Math.min(limit, 100));
		const normalizedDemandTag = String(demandTag || "").trim().toLowerCase();
		const demandTagQuery = normalizedDemandTag ? `&demand_tag=${encodeURIComponent(normalizedDemandTag)}` : "";
		const demoQuery = demoOnly ? "&is_demo=1" : "";
		const response = await serverApiFetch(`/landing/sections/just-for-you?limit=${safeLimit}${demandTagQuery}${demoQuery}`, host, {
			cache: "no-store",
		});

		if (!response.ok) {
			return fallbackJustForYouSection;
		}

		const result = await response.json();
		const data = result?.data;

		return {
			heading: String(data?.heading || fallbackJustForYouSection.heading),
			subheading: String(data?.subheading || fallbackJustForYouSection.subheading),
			categories: Array.isArray(data?.categories) ? data.categories : [],
			demand_tag: data?.demand_tag ? String(data.demand_tag) : null,
			products: Array.isArray(data?.products) ? data.products : [],
		};
	} catch {
		return fallbackJustForYouSection;
	}
}

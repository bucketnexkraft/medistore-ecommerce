import { apiFetch } from "@/lib/api-client";

export type StorefrontBrand = {
	id: string;
	name: string;
	slug: string;
	image: string;
	products_count: number;
	url: string;
};

export type BrandsSectionData = {
	heading: string;
	subheading: string;
	brands: StorefrontBrand[];
	stats: {
		brands_count: number;
		products_count: number;
	};
};

const fallbackBrandsSection: BrandsSectionData = {
	heading: "Popular Brands",
	subheading: "Trusted names, standout identities, and products people keep coming back for.",
	brands: [],
	stats: {
		brands_count: 0,
		products_count: 0,
	},
};

let cachedBrandsSection: BrandsSectionData | null = null;
let brandsSectionPromise: Promise<BrandsSectionData> | null = null;

const normalizeBrandsSection = (data: unknown): BrandsSectionData => {
	const payload = (data && typeof data === "object" ? data : {}) as {
		heading?: unknown;
		subheading?: unknown;
		brands?: unknown;
		stats?: {
			brands_count?: unknown;
			products_count?: unknown;
		};
	};

	return {
		heading: String(payload.heading || fallbackBrandsSection.heading),
		subheading: String(payload.subheading || fallbackBrandsSection.subheading),
		brands: Array.isArray(payload.brands) ? (payload.brands as StorefrontBrand[]) : [],
		stats: {
			brands_count: Number(payload.stats?.brands_count || 0),
			products_count: Number(payload.stats?.products_count || 0),
		},
	};
};

export async function fetchBrandsSectionClient(limit = 24): Promise<BrandsSectionData> {
	if (cachedBrandsSection && cachedBrandsSection.brands.length >= Math.min(limit, cachedBrandsSection.brands.length)) {
		return cachedBrandsSection;
	}

	if (!brandsSectionPromise) {
		brandsSectionPromise = apiFetch(`/landing/brands?limit=${limit}`)
			.then(async (response) => {
				const result = response.ok ? await response.json() : null;
				cachedBrandsSection = normalizeBrandsSection(result?.data);
				return cachedBrandsSection;
			})
			.catch(() => {
				brandsSectionPromise = null;
				return fallbackBrandsSection;
			});
	}

	return brandsSectionPromise;
}

import { headers } from "next/headers";
import { serverApiFetch } from "@/lib/api-client";
import { type BrandsSectionData } from "@/lib/brands";

const fallbackBrandsSection: BrandsSectionData = {
	heading: "Popular Brands",
	subheading: "Trusted names, standout identities, and products people keep coming back for.",
	brands: [],
	stats: {
		brands_count: 0,
		products_count: 0,
	},
};

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
		brands: Array.isArray(payload.brands)
			? payload.brands.map((item) => {
					const brand = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
					const slug = String(brand.slug || "");

					return {
						id: String(brand.id || ""),
						name: String(brand.name || ""),
						slug,
						image: String(brand.image || ""),
						products_count: Number(brand.products_count || 0),
						url: String(brand.url || (slug ? `/products?brand=${slug}` : "/brands")),
					};
			  }) as BrandsSectionData["brands"]
			: [],
		stats: {
			brands_count: Number(payload.stats?.brands_count || 0),
			products_count: Number(payload.stats?.products_count || 0),
		},
	};
};

export async function fetchBrandsSectionServer(limit = 24, demoOnly = false): Promise<BrandsSectionData> {
	try {
		const headerStore = await headers();
		const host = headerStore.get("host");
		const demoParam = demoOnly ? "&is_demo=1" : "";
		const response = await serverApiFetch(`/landing/brands?limit=${limit}${demoParam}`, host, { next: { revalidate: 120 } });
		const result = response.ok ? await response.json() : null;

		return normalizeBrandsSection(result?.data);
	} catch {
		return fallbackBrandsSection;
	}
}

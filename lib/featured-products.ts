import { serverApiFetch } from "@/lib/api-client";

export type FeaturedProduct = {
	id: string;
	name: string;
	slug: string;
	image: string;
	brand: string;
	url: string;
};

const normalizeFeaturedProducts = (data: unknown): FeaturedProduct[] => {
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
			image: String(product.image || ""),
			brand: String(product.brand || ""),
			url: String(product.url || (slug ? `/product/${slug}` : "#")),
		};
	});
};

export async function fetchFeaturedProductsServer(host: string | null, demoOnly = false) {
	try {
		const path = demoOnly
			? "/landing/sections/featured-products?is_demo=1"
			: "/landing/sections/featured-products";
		const response = await serverApiFetch(path, host, {
			next: { revalidate: 120 },
		});

		if (!response.ok) {
			return [];
		}

		const result = await response.json();
		return normalizeFeaturedProducts(result?.data);
	} catch {
		return [];
	}
}

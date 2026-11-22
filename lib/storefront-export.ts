import { serverApiFetch } from "@/lib/api-client";

const toRecord = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : null);
const toArray = (value: unknown) => (Array.isArray(value) ? value : []);

export const escapeXml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

export const resolveAbsoluteUrl = (origin: string, value: string) => {
	if (!value) {
		return origin;
	}

	if (/^https?:\/\//i.test(value)) {
		return value;
	}

	return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
};

export type StorefrontExportProduct = {
	id: string;
	name: string;
	slug: string;
	price: number;
	quantity: number;
	brand: string;
	categoryName: string;
	url: string;
	thumbnail: string;
	createdAt: string;
};

export async function loadAllStorefrontProducts(host: string | null) {
	const products: StorefrontExportProduct[] = [];
	let page = 1;
	let lastPage = 1;

	do {
		const response = await serverApiFetch(`/landing/products?perPage=24&page=${page}`, host, {
			next: { revalidate: 300 },
		});
		const payload = response.ok ? await response.json().catch(() => null) : null;
		const data = toRecord(payload?.data);
		const rows = toArray(data?.products);
		const meta = toRecord(data?.products_meta);
		lastPage = Number(meta?.last_page || 1);

		rows.forEach((row) => {
			const item = toRecord(row);
			if (!item) {
				return;
			}

			products.push({
				id: String(item.id || ""),
				name: String(item.name || ""),
				slug: String(item.slug || ""),
				price: Number(item.price || 0),
				quantity: Number(item.quantity || 0),
				brand: String(item.brand || ""),
				categoryName: String(toRecord(item.category)?.name || ""),
				url: String(item.url || ""),
				thumbnail: String(item.thumbnail || ""),
				createdAt: String(item.created_at || ""),
			});
		});

		page += 1;
	} while (page <= lastPage);

	return products;
}

export async function loadStorefrontCategories(host: string | null) {
	const response = await serverApiFetch("/landing/categories", host, { next: { revalidate: 300 } });
	const payload = response.ok ? await response.json().catch(() => null) : null;
	const data = toRecord(payload?.data);
	return toArray(data?.categories).map((row) => toRecord(row)).filter(Boolean) as Record<string, unknown>[];
}

export async function loadStorefrontBrands(host: string | null) {
	const response = await serverApiFetch("/landing/brands?limit=60", host, { next: { revalidate: 300 } });
	const payload = response.ok ? await response.json().catch(() => null) : null;
	const data = toRecord(payload?.data);
	return toArray(data?.brands).map((row) => toRecord(row)).filter(Boolean) as Record<string, unknown>[];
}

export async function loadStorefrontBlogs(host: string | null) {
	const response = await serverApiFetch("/landing/sections/blog?home=0&limit=24", host, { next: { revalidate: 300 } });
	const payload = response.ok ? await response.json().catch(() => null) : null;
	const data = toRecord(payload?.data);
	return toArray(data?.blogs).map((row) => toRecord(row)).filter(Boolean) as Record<string, unknown>[];
}

export async function loadStorefrontPreferences(host: string | null) {
	const response = await serverApiFetch("/landing/preferences", host, { next: { revalidate: 300 } });
	const payload = response.ok ? await response.json().catch(() => null) : null;
	return toRecord(payload?.data);
}

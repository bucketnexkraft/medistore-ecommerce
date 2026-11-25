"use client";

import { useEffect, useState } from "react";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import type { FashionSectionProps } from "../../types";

type Brand = {
	id: string;
	name: string;
	slug: string;
	image: string;
	productsCount: number;
	status?: string | number | boolean;
	featured?: boolean;
	createdAt?: string;
	url: string;
};

type BrandResponse = {
	brands?: unknown[];
	stats?: unknown;
};

export const FALLBACK_BRAND_IMAGE = "/images/placeholder.jpg";

const seededBrandImage = /\/images\/(?:brand-images|demo\/brand)\/b-\d+\.jpg(?:[?#]|$)/i;

export const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

export const textValue = (value: unknown, fallback: string) => {
	const normalized = String(value ?? "").trim();
	return normalized || fallback;
};

const hasValue = (value: unknown) => String(value ?? "").trim() !== "";

const toBoolean = (value: unknown) => {
	if (typeof value === "boolean") return value;
	return ["1", "true", "yes", "on", "featured"].includes(String(value ?? "").trim().toLowerCase());
};

const normalizeSort = (value: unknown) => {
	const sort = String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
	const aliases: Record<string, string> = {
		alpha: "name-asc",
		alphabetical: "name-asc",
		name: "name-asc",
		popular: "products-desc",
		products: "products-desc",
		"products-count": "products-desc",
		latest: "newest",
	};
	return aliases[sort] || sort || "products-desc";
};

function normalizeBrand(value: unknown): Brand | null {
	const item = asRecord(value);
	const id = textValue(item.id, textValue(item.slug, ""));
	const name = textValue(item.name, textValue(item.title, "Brand"));
	const slug = textValue(item.slug, "");

	if (!id) return null;

	return {
		id,
		name,
		slug,
		image: textValue(item.image, FALLBACK_BRAND_IMAGE),
		productsCount: Number(item.products_count ?? item.productsCount ?? 0) || 0,
		status: item.status as Brand["status"],
		featured: item.featured === undefined && item.is_featured === undefined
			? undefined
			: toBoolean(item.featured ?? item.is_featured),
		createdAt: textValue(item.created_at ?? item.createdAt, ""),
		url: textValue(item.url, slug ? `/products?brand=${encodeURIComponent(slug)}` : "/products"),
	};
}

function sortBrands(brands: Brand[], sortBy: string) {
	const sorted = [...brands];

	switch (normalizeSort(sortBy)) {
		case "name-desc":
			return sorted.sort((a, b) => b.name.localeCompare(a.name));
		case "newest":
			return sorted.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
		case "oldest":
			return sorted.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
		case "name-asc":
			return sorted.sort((a, b) => a.name.localeCompare(b.name));
		case "products-asc":
			return sorted.sort((a, b) => a.productsCount - b.productsCount || a.name.localeCompare(b.name));
		case "products-desc":
		default:
			return sorted.sort((a, b) => b.productsCount - a.productsCount || a.name.localeCompare(b.name));
	}
}

export function useBrandStripData({ section, host, demoOnly }: FashionSectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const configuredData = asRecord(config.data);
	const data = Object.keys(configuredData).length ? configuredData : config;
	const configuredFilter = asRecord(data.filter);
	const filter = Object.keys(configuredFilter).length ? configuredFilter : asRecord(config.filter);
	const itemsAllow = Math.max(1, Math.min(24, Math.trunc(Number(data.items_allow ?? config.items_allow) || 8)));
	const dataModel = textValue(data.data_model ?? config.data_model, "brands").toLowerCase();
	const featuredFilter = String(filter.featured ?? "").trim();
	const statusFilter = String(filter.status ?? "").trim();
	const sortFilter = String(filter.sort_by ?? "").trim();
	const params = new URLSearchParams({ limit: "60" });
	if (demoOnly) params.set("is_demo", "1");
	if (hasValue(featuredFilter)) params.set("featured", featuredFilter);
	if (hasValue(statusFilter)) params.set("status", statusFilter);
	if (hasValue(sortFilter)) params.set("sort_by", sortFilter);
	const query = params.toString();
	const [response, setResponse] = useState<{ host: string | null; query: string; brands: Brand[]; stats: Record<string, unknown> } | null>(null);
	const current = response?.host === host && response.query === query ? response : null;
	const loading = dataModel === "brands" && !current;

	useEffect(() => {
		if (dataModel !== "brands") return;

		let active = true;
		void fetchStorefrontJson<{ data?: BrandResponse }>(`/landing/brands?${query}`, host)
			.catch(() => null)
			.then((result) => {
				if (!active) return;
				const rows = Array.isArray(result?.data?.brands) ? result.data.brands : [];
				setResponse({
					host,
					query,
					brands: rows.map(normalizeBrand).filter((brand): brand is Brand => Boolean(brand)),
					stats: asRecord(result?.data?.stats),
				});
			});

		return () => {
			active = false;
		};
	}, [dataModel, host, query]);

	const visibleBrands = (() => {
		let nextBrands = current?.brands ?? [];

		if (demoOnly) {
			nextBrands = nextBrands.filter((brand) => !seededBrandImage.test(brand.image));
		}

		if (hasValue(featuredFilter)) {
			const featured = toBoolean(featuredFilter);
			const hasFeaturedMetadata = nextBrands.some((brand) => brand.featured !== undefined);
			if (hasFeaturedMetadata) nextBrands = nextBrands.filter((brand) => brand.featured === featured);
		}

		if (hasValue(statusFilter)) {
			const requestedStatus = statusFilter.toLowerCase();
			const hasStatusMetadata = nextBrands.some((brand) => brand.status !== undefined);
			if (hasStatusMetadata) {
				nextBrands = nextBrands.filter((brand) => {
					const status = String(brand.status ?? "").trim().toLowerCase();
					return requestedStatus === status || (toBoolean(requestedStatus) && ["1", "active", "enabled"].includes(status));
				});
			}
		}

		return sortBrands(nextBrands, sortFilter || "products-desc").slice(0, itemsAllow);
	})();

	return { config, content, dataModel, itemsAllow, loading, visibleBrands, stats: current?.stats };
}

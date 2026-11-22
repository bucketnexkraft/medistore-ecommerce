"use client";

import { useEffect, useState } from "react";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import type { FashionSectionProps } from "../../types";

export type CountdownParts = {
	days: string;
	hours: string;
	minutes: string;
	seconds: string;
};

export type FlashDealProduct = {
	id: string;
	name: string;
	slug: string;
	image: string;
	brand: string;
	category: string;
	price: number;
	originalPrice: number;
	discountPercent: number;
	rating: number | null;
	reviews: number;
	quantity: number;
	url: string;
	endsAt: string | null;
};

type ApiPayload = {
	products?: unknown[];
	ends_at?: unknown;
};

export const ZERO_PARTS: CountdownParts = {
	days: "00",
	hours: "00",
	minutes: "00",
	seconds: "00",
};

const FALLBACK_IMAGE = "/images/placeholder.jpg";

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const textValue = (value: unknown, fallback = "") => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const objectValue = asRecord(value);
		return textValue(objectValue.value ?? objectValue.slug ?? objectValue.id ?? objectValue.name, fallback);
	}

	const normalized = String(value ?? "").trim();
	return normalized || fallback;
};

const numberValue = (value: unknown, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const hasValue = (value: string) => value.trim() !== "";

const normalizeSort = (value: string) => {
	const sort = value.trim().toLowerCase().replace(/_/g, "-");
	const aliases: Record<string, string> = {
		latest: "newest",
		name: "name-a-z",
		alpha: "name-a-z",
		"name-asc": "name-a-z",
		"name-desc": "name-z-a",
		"price-asc": "price-low-high",
		"price-desc": "price-high-low",
	};

	return aliases[sort] || sort || "newest";
};

const normalizeStock = (value: string) => {
	const stock = value.trim().toLowerCase();

	if (["1", "true", "yes", "in-stock", "in_stock"].includes(stock)) return "in-stock";
	if (["0", "false", "no", "out-of-stock", "out_of_stock"].includes(stock)) return "out-of-stock";
	return stock;
};

const getCategoryName = (value: unknown) => {
	if (typeof value === "string") return value;
	const category = asRecord(value);
	return textValue(category.name ?? category.title ?? category.slug, "Flash Deal");
};

const getBrandName = (value: unknown) => {
	if (typeof value === "string") return value;
	const brand = asRecord(value);
	return textValue(brand.name ?? brand.title ?? brand.slug, "");
};

function normalizeProduct(value: unknown): FlashDealProduct | null {
	const item = asRecord(value);
	const slug = textValue(item.slug, "");
	const id = textValue(item.id, slug);

	if (!id) return null;

	return {
		id,
		name: textValue(item.name, "Flash Deal Product"),
		slug,
		image: textValue(item.image ?? item.thumbnail ?? item.featured_image, FALLBACK_IMAGE),
		brand: getBrandName(item.brand),
		category: getCategoryName(item.category),
		price: Math.max(0, numberValue(item.price)),
		originalPrice: Math.max(0, numberValue(item.original_price ?? item.originalPrice ?? item.price)),
		discountPercent: Math.max(0, Math.round(numberValue(item.discount_percent ?? item.discountPercent))),
		rating: item.rating == null ? null : numberValue(item.rating),
		reviews: Math.max(0, Math.floor(numberValue(item.reviews))),
		quantity: Math.max(0, Math.floor(numberValue(item.quantity ?? item.available_quantity))),
		url: textValue(item.url, slug ? `/product/${slug}` : "/products"),
		endsAt: textValue(item.ends_at ?? item.endsAt, "") || null,
	};
}

function normalizeProducts(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.map(normalizeProduct).filter((product): product is FlashDealProduct => Boolean(product));
}

export function getCountdownParts(target: string | null, currentMs: number): CountdownParts {
	if (!target) return ZERO_PARTS;

	const endTime = new Date(target).getTime();
	if (Number.isNaN(endTime)) return ZERO_PARTS;

	const totalSeconds = Math.floor(Math.max(endTime - currentMs, 0) / 1000);
	return {
		days: String(Math.floor(totalSeconds / 86400)).padStart(2, "0"),
		hours: String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0"),
		minutes: String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"),
		seconds: String(totalSeconds % 60).padStart(2, "0"),
	};
}

export function useFlashDealSection({ section, host, demoOnly }: Pick<FashionSectionProps, "section" | "host" | "demoOnly">) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const configuredData = asRecord(config.data);
	const data = Object.keys(configuredData).length > 0 ? configuredData : config;
	const configuredFilter = asRecord(data.filter);
	const filter = Object.keys(configuredFilter).length > 0 ? configuredFilter : asRecord(config.filter);
	const dataModel = textValue(data.data_model ?? config.data_model, "products").toLowerCase();
	const itemsAllow = Math.max(1, Math.min(24, Math.trunc(numberValue(data.items_allow ?? config.items_allow, 8)) || 8));

	const categoryFilter = textValue(filter.category_id);
	const brandFilter = textValue(filter.brand_id);
	const minPriceFilter = textValue(filter.min_price);
	const maxPriceFilter = textValue(filter.max_price);
	const stockFilter = textValue(filter.in_stock);
	const sortFilter = textValue(filter.sort_by);
	const demandTagFilters = (Array.isArray(filter.demand_tag) ? filter.demand_tag : textValue(filter.demand_tag).split(","))
		.map((tag) => textValue(tag).toLowerCase())
		.filter(Boolean);
	const demandTagFilter = demandTagFilters.join(",");
	const filterSignature = JSON.stringify({ categoryFilter, brandFilter, minPriceFilter, maxPriceFilter, stockFilter, sortFilter, demandTagFilter });
	const hasCatalogFilters = [categoryFilter, brandFilter, minPriceFilter, maxPriceFilter, stockFilter, sortFilter].some(hasValue) || demandTagFilters.length > 0;
	const configuredEndsAt = textValue(
		content.ends_at ?? content.end_at ?? content.end_date ?? data.ends_at ?? data.end_at ?? data.end_date ?? config.ends_at,
	);
	const requestKey = JSON.stringify({ dataModel, demoOnly: Boolean(demoOnly), host, itemsAllow, filterSignature, configuredEndsAt });

	const [products, setProducts] = useState<FlashDealProduct[]>([]);
	const [endsAt, setEndsAt] = useState<string | null>(configuredEndsAt || null);
	const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);

	useEffect(() => {
		if (dataModel !== "products") {
			return;
		}

		let active = true;
		const params = new URLSearchParams({ perPage: String(itemsAllow) });

		if (demoOnly) params.set("is_demo", "1");
		if (hasValue(categoryFilter)) params.set("category", categoryFilter);
		if (hasValue(brandFilter)) params.set("brand", brandFilter);
		if (hasValue(minPriceFilter)) params.set("minPrice", minPriceFilter);
		if (hasValue(maxPriceFilter)) params.set("maxPrice", maxPriceFilter);
		if (hasValue(stockFilter)) params.set("stock", normalizeStock(stockFilter));
		if (hasValue(sortFilter)) params.set("sort", normalizeSort(sortFilter));
		if (hasValue(demandTagFilter)) params.set("demand_tag", demandTagFilter);

		const catalogRequest = hasCatalogFilters
			? fetchStorefrontJson<{ data?: ApiPayload }>(`/landing/products?${params.toString()}`, host)
			: Promise.resolve(null);
		const flashRequest = !configuredEndsAt || !hasCatalogFilters
			? fetchStorefrontJson<{ data?: ApiPayload }>(`/landing/sections/flash-deals?limit=${hasCatalogFilters ? 1 : itemsAllow}${demoOnly ? "&is_demo=1" : ""}`, host)
			: Promise.resolve(null);

		Promise.all([catalogRequest, flashRequest])
			.then(([catalogResult, flashResult]) => {
				if (!active) return;

				const catalogData = asRecord(catalogResult?.data);
				const flashData = asRecord(flashResult?.data);
				const nextProducts = hasCatalogFilters
					? normalizeProducts(catalogData.products)
					: normalizeProducts(flashData.products);
				const nextEndsAt = configuredEndsAt || textValue(flashData.ends_at, "") || nextProducts.find((product) => product.endsAt)?.endsAt || null;

				setProducts(nextProducts.slice(0, itemsAllow));
				setEndsAt(nextEndsAt);
			})
			.catch(() => {
				if (!active) return;
				setProducts([]);
				setEndsAt(configuredEndsAt || null);
			})
			.finally(() => {
				if (active) setLoadedRequestKey(requestKey);
			});

		return () => {
			active = false;
		};
	}, [brandFilter, categoryFilter, configuredEndsAt, dataModel, demoOnly, demandTagFilter, filterSignature, hasCatalogFilters, host, itemsAllow, maxPriceFilter, minPriceFilter, requestKey, sortFilter, stockFilter]);

	const heading = textValue(content.heading ?? content.title ?? data.heading ?? config.heading, textValue(section.title, "Flash deal"));
	const subheading = textValue(content.subheading ?? content.sub_title ?? data.subheading ?? config.subheading, "Limited-time picks moving fast across the storefront.");
	const buttonText = textValue(content.button_text ?? data.button_text ?? config.button_text, "Shop all products");
	const buttonLink = textValue(content.button_link ?? data.button_link ?? config.button_link, "/products");
	const currency = textValue(content.currency ?? data.currency ?? config.currency, "$");
	const formatPrice = (value: number) => `${currency}${value.toFixed(2)}`;
	const loading = dataModel === "products" && loadedRequestKey !== requestKey;

	return { products, endsAt, loading, enabled: dataModel === "products", itemsAllow, heading, subheading, buttonText, buttonLink, formatPrice };
}

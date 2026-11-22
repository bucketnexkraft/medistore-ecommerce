"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SafeImage from "@/components/common/SafeImage";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import type { ElectronicsSectionProps } from "../../types";

type CountdownParts = {
	days: string;
	hours: string;
	minutes: string;
	seconds: string;
};

type Product = {
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

const ZERO_PARTS: CountdownParts = {
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

function normalizeProduct(value: unknown): Product | null {
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
	return value.map(normalizeProduct).filter((product): product is Product => Boolean(product));
}

function getCountdownParts(target: string | null, currentMs: number): CountdownParts {
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

function Countdown({ endsAt }: { endsAt: string | null }) {
	const [nowMs, setNowMs] = useState<number | null>(null);
	const countdown = useMemo(() => nowMs === null ? ZERO_PARTS : getCountdownParts(endsAt, nowMs), [endsAt, nowMs]);

	useEffect(() => {
		if (!endsAt) return;

		const initialTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
		const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
		return () => {
			window.clearTimeout(initialTimer);
			window.clearInterval(timer);
		};
	}, [endsAt]);

	return (
		<div className="flex flex-wrap gap-2" aria-label="Flash deal time remaining" aria-live="polite">
			{[
				["Days", countdown.days],
				["Hours", countdown.hours],
				["Min", countdown.minutes],
				["Sec", countdown.seconds],
			].map(([label, value]) => (
				<div key={label} className="min-w-16 rounded-2xl border border-[#f3d9c7] bg-white/85 px-2.5 py-2 text-center shadow-sm">
					<div className="text-lg font-bold leading-none text-primary-black">{value}</div>
					<div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-body">{label}</div>
				</div>
			))}
		</div>
	);
}

function ProductCard({ product, formatPrice }: { product: Product; formatPrice: (value: number) => string }) {
	const stockLabel = product.quantity > 0 ? `${product.quantity} in stock` : "Selling fast";
	const metaLabel = product.reviews > 0 && product.rating !== null ? `${product.rating.toFixed(1)} rating` : "Limited";

	return (
		<article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
			<Link href={product.url} className="relative block aspect-[4/3] overflow-hidden bg-gray-100" aria-label={product.name}>
				<SafeImage
					unoptimized
					src={product.image}
					alt={product.name}
					fill
					sizes="(min-width: 1280px) 280px, (min-width: 640px) 42vw, 90vw"
					className="object-cover transition duration-300 group-hover:scale-105"
				/>
				{product.discountPercent > 0 ? (
					<span className="absolute left-3 top-3 rounded-full bg-primary-green px-2.5 py-1 text-xs font-bold text-white">-{product.discountPercent}%</span>
				) : null}
			</Link>

			<div className="flex items-center justify-between gap-2 bg-primary-green px-3 py-2 text-xs text-white">
				<span className="truncate font-semibold">{product.brand || product.category}</span>
				<span className="shrink-0 rounded bg-white px-2 py-1 font-medium text-primary-black">{metaLabel}</span>
			</div>

			<Link href={product.url} className="flex flex-1 flex-col p-4">
				<h3 className="line-clamp-2 min-h-12 text-lg font-bold leading-snug text-primary-black transition-colors group-hover:text-secondary-red">{product.name}</h3>
				<div className="mt-3 flex flex-wrap items-baseline gap-2">
					<span className="text-xl font-bold text-primary-black">{formatPrice(product.price)}</span>
					{product.originalPrice > product.price ? <span className="text-sm text-gray-500 line-through">{formatPrice(product.originalPrice)}</span> : null}
				</div>
				<p className="mt-auto pt-3 text-sm font-medium text-primary-body">{stockLabel}</p>
			</Link>
		</article>
	);
}

function FlashDealSkeleton({ itemCount }: { itemCount: number }) {
	return (
		<section className="container mx-auto my-14 rounded-[30px] border border-[#f3d9c7] bg-white p-6 md:p-8" aria-busy="true">
			<div className="mb-8 space-y-3">
				<div className="h-8 w-52 animate-pulse rounded bg-gray-200" />
				<div className="h-4 w-full max-w-xl animate-pulse rounded bg-gray-100" />
			</div>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{Array.from({ length: itemCount }).map((_, index) => (
					<div key={index} className="overflow-hidden rounded-2xl border border-gray-100 p-3">
						<div className="aspect-[4/3] animate-pulse rounded-xl bg-gray-100" />
						<div className="mt-4 h-5 w-4/5 animate-pulse rounded bg-gray-200" />
						<div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-gray-100" />
					</div>
				))}
			</div>
		</section>
	);
}

export default function FlashDealCountdown({ section, host, demoOnly }: ElectronicsSectionProps) {
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

	const [products, setProducts] = useState<Product[]>([]);
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

	if (dataModel !== "products") return null;
	if (loading) return <FlashDealSkeleton itemCount={Math.min(itemsAllow, 4)} />;
	if (products.length === 0) return null;

	const heroProduct = products[0];
	const gridProducts = products.slice(1);

	return (
		<section data-storefront-section="electronics-gadgets-flash-deal-countdown" className="section my-14">
			<div className="overflow-hidden rounded-[30px] border border-[#f3d9c7] bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#fff1f2_100%)] p-6 shadow-[0_24px_60px_rgba(234,88,12,0.10)] md:p-8 lg:p-10">
				<div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl">
						<span className="inline-flex rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white">Flash deal</span>
						<h2 className="mt-4 text-3xl font-bold text-primary-black md:text-4xl">{heading}</h2>
						{subheading ? <p className="mt-3 text-base leading-7 text-primary-body">{subheading}</p> : null}
					</div>

					<div className="flex flex-col items-start gap-4 lg:items-end">
						<Countdown endsAt={endsAt} />
						<Link href={buttonLink} className="inline-flex items-center rounded-full bg-primary-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
							{buttonText}
						</Link>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)]">
					<Link href={heroProduct.url} className="group relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#1f2937_0%,#c2410c_52%,#fb7185_100%)] p-7 text-white">
						<div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_210px] md:items-center">
							<div className="flex h-full flex-col justify-between gap-6">
								<div>
									<span className="inline-flex rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">{heroProduct.discountPercent > 0 ? `${heroProduct.discountPercent}% off` : "Limited time"}</span>
									<h3 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">{heroProduct.name}</h3>
									<p className="mt-3 text-sm font-semibold text-white/80">{heroProduct.brand || heroProduct.category}</p>
								</div>
								<div>
									<p className="text-3xl font-bold">{formatPrice(heroProduct.price)}</p>
									{heroProduct.originalPrice > heroProduct.price ? <p className="mt-1 text-sm text-white/70 line-through">{formatPrice(heroProduct.originalPrice)}</p> : null}
								</div>
							</div>
							<div className="relative min-h-48 overflow-hidden rounded-2xl bg-white/10">
								<SafeImage unoptimized src={heroProduct.image} alt={heroProduct.name} fill sizes="240px" className="object-contain p-4 transition duration-300 group-hover:scale-105" />
							</div>
						</div>
					</Link>

					{gridProducts.length > 0 ? (
						<div className="grid gap-5 sm:grid-cols-2">
							{gridProducts.map((product) => <ProductCard key={product.id} product={product} formatPrice={formatPrice} />)}
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}

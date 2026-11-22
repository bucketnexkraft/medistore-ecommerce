"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
};

const FALLBACK_IMAGE = "/images/placeholder.jpg";

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const textValue = (value: unknown, fallback: string) => {
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

function BrandImage({ src, alt }: { src: string; alt: string }) {
	const [imageSrc, setImageSrc] = useState(src || FALLBACK_IMAGE);

	return (
		<Image
			src={imageSrc}
			alt={alt}
			fill
			sizes="(min-width: 1024px) 150px, (min-width: 640px) 22vw, 30vw"
			className="object-contain p-5 transition duration-300 group-hover:scale-105"
			onError={() => setImageSrc(FALLBACK_IMAGE)}
		/>
	);
}

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
		image: textValue(item.image, FALLBACK_IMAGE),
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

function BrandStripSkeleton({ itemCount }: { itemCount: number }) {
	return (
		<section className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8" aria-busy="true">
			<div className="mb-8 h-8 w-52 animate-pulse rounded bg-gray-200" />
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
				{Array.from({ length: itemCount }).map((_, index) => (
					<div key={index} className="space-y-3">
						<div className="aspect-[4/3] animate-pulse rounded-xl bg-gray-100" />
						<div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-gray-200" />
					</div>
				))}
			</div>
		</section>
	);
}

export default function BrandStripDefault({ section, host, demoOnly }: FashionSectionProps) {
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
	const navigationId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const previousClass = `brand-strip-prev-${navigationId}`;
	const nextClass = `brand-strip-next-${navigationId}`;
	const scrollRef = useRef<HTMLDivElement>(null);
	const [brands, setBrands] = useState<Brand[]>([]);
	const [loading, setLoading] = useState(dataModel === "brands");

	useEffect(() => {
		if (dataModel !== "brands") return;

		let active = true;
		const params = new URLSearchParams({ limit: "60" });
		if (demoOnly) params.set("is_demo", "1");

		if (hasValue(featuredFilter)) params.set("featured", featuredFilter);
		if (hasValue(statusFilter)) params.set("status", statusFilter);
		if (hasValue(sortFilter)) params.set("sort_by", sortFilter);

		fetchStorefrontJson<{ data?: BrandResponse }>(`/landing/brands?${params.toString()}`, host)
			.then((result) => {
				if (!active) return;
				const rows = Array.isArray(result?.data?.brands) ? result.data.brands : [];
				setBrands(rows.map(normalizeBrand).filter((brand): brand is Brand => Boolean(brand)));
			})
			.catch(() => {
				if (!active) return;
				setBrands([]);
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [dataModel, demoOnly, featuredFilter, host, sortFilter, statusFilter]);

	const visibleBrands = (() => {
		let nextBrands = [...brands];

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

	const heading = textValue(content.heading ?? content.title ?? config.heading, textValue(section.title, "Popular Brands"));
	const subheading = textValue(content.subheading ?? content.sub_title ?? config.subheading, textValue(section.subtitle, "Explore trusted brands from this store."));

	const scrollBy = (direction: number) => {
		scrollRef.current?.scrollBy({ left: direction * Math.max(scrollRef.current.clientWidth * 0.8, 280), behavior: "smooth" });
	};

	if (dataModel !== "brands") return null;
	if (loading) return <BrandStripSkeleton itemCount={Math.min(itemsAllow, 6)} />;

	return (
		<section data-storefront-section="fashion-apparel-brand-strip-default" className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8">
			<div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 className="text-2xl font-semibold text-primary-black">{heading}</h2>
					{subheading ? <p className="mt-2 text-primary-body">{subheading}</p> : null}
				</div>
				{visibleBrands.length > 1 ? (
					<div className="flex gap-2">
						<button type="button" aria-label="Previous brands" className={`${previousClass} inline-flex size-9 items-center justify-center rounded-full border border-gray-200 text-primary-black transition hover:border-primary-black hover:bg-primary-black hover:text-white`} onClick={() => scrollBy(-1)}>
							<ChevronLeft className="size-4" />
						</button>
						<button type="button" aria-label="Next brands" className={`${nextClass} inline-flex size-9 items-center justify-center rounded-full border border-gray-200 text-primary-black transition hover:border-primary-black hover:bg-primary-black hover:text-white`} onClick={() => scrollBy(1)}>
							<ChevronRight className="size-4" />
						</button>
					</div>
				) : null}
			</div>

			{visibleBrands.length ? (
				<div ref={scrollRef} className="grid grid-flow-col auto-cols-[calc(50%-0.5rem)] gap-4 overflow-x-auto pb-2 [scrollbar-width:none] sm:auto-cols-[calc(25%-0.75rem)] lg:auto-cols-[calc(16.666%-0.833rem)] [&::-webkit-scrollbar]:hidden">
					{visibleBrands.map((brand) => (
						<Link key={brand.id} href={brand.url} className="group min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3 transition hover:border-gray-300 hover:bg-white">
							<div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white">
								<BrandImage key={`${brand.id}-${brand.image}`} src={brand.image} alt={`${brand.name} logo`} />
							</div>
							<p className="mt-3 truncate text-center text-sm font-semibold text-primary-black">{brand.name}</p>
						</Link>
					))}
				</div>
			) : (
				<div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-primary-body">No brands found.</div>
			)}
		</section>
	);
}

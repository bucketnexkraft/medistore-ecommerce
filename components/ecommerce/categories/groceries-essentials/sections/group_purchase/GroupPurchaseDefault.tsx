"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import { useAmount } from "@/lib/amount";
import type { GroceriesSectionProps } from "../../types";

type Product = {
	id: string;
	name: string;
	slug: string;
	thumbnail?: string;
	price: number;
	original_price?: number;
	category?: { name?: string; slug?: string } | string | null;
	brand?: string | null;
};

type GroupPurchase = {
	is_available: boolean;
	discount_type: "fixed" | "percent" | string;
	discount_amount: number;
	minimum_users: number;
	discount_value: number;
	discounted_price: number;
};

type ActiveGroup = {
	id: string;
	status?: string;
	minimum_users: number;
	joined_count: number;
};

type GroupPurchaseCard = {
	product: Product;
	group_purchase: GroupPurchase;
	active_group?: ActiveGroup | null;
};

type GroupPurchaseResponse = {
	cards?: unknown[];
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

const normalizeSort = (value: unknown) => {
	const sort = String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
	const aliases: Record<string, string> = {
		latest: "newest",
		name: "name-asc",
		alpha: "name-asc",
		popular: "newest",
	};
	return aliases[sort] || sort || "newest";
};

function ProductImage({ src, alt }: { src: string; alt: string }) {
	const [imageSrc, setImageSrc] = useState(src || FALLBACK_IMAGE);

	return (
		<Image
			src={imageSrc}
			alt={alt}
			fill
			sizes="(min-width: 1280px) 260px, (min-width: 768px) 32vw, 80vw"
			className="object-cover transition duration-300 group-hover:scale-105"
			onError={() => setImageSrc(FALLBACK_IMAGE)}
		/>
	);
}

function normalizeCard(value: unknown): GroupPurchaseCard | null {
	const item = asRecord(value);
	const product = asRecord(item.product);
	const deal = asRecord(item.group_purchase);
	const activeGroup = item.active_group ? asRecord(item.active_group) : null;
	const productId = textValue(product.id, "");

	if (!productId) return null;

	return {
		product: {
			id: productId,
			name: textValue(product.name, "Group purchase product"),
			slug: textValue(product.slug, ""),
			thumbnail: textValue(product.thumbnail, FALLBACK_IMAGE),
			price: Number(product.price || 0),
			original_price: Number(product.original_price || product.price || 0),
			category: product.category as Product["category"],
			brand: product.brand ? String(product.brand) : null,
		},
		group_purchase: {
			is_available: Boolean(deal.is_available ?? true),
			discount_type: String(deal.discount_type || "percent"),
			discount_amount: Number(deal.discount_amount || 0),
			minimum_users: Math.max(2, Number(deal.minimum_users || 2)),
			discount_value: Number(deal.discount_value || 0),
			discounted_price: Number(deal.discounted_price || product.price || 0),
		},
		active_group: activeGroup && textValue(activeGroup.id, "")
			? {
					id: String(activeGroup.id),
					status: String(activeGroup.status || "open"),
					minimum_users: Math.max(2, Number(activeGroup.minimum_users || deal.minimum_users || 2)),
					joined_count: Math.max(0, Number(activeGroup.joined_count || 0)),
				}
			: null,
	};
}

function getCategoryName(category: Product["category"]) {
	return typeof category === "string" ? category : category?.name || "";
}

function GroupPurchaseImage({ src, alt }: { src: string; alt: string }) {
	return <ProductImage key={src} src={src} alt={alt} />;
}

function GroupPurchaseSkeleton({ itemCount }: { itemCount: number }) {
	return (
		<section className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8" aria-busy="true">
			<div className="mb-8 space-y-3">
				<div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
				<div className="h-4 w-full max-w-xl animate-pulse rounded bg-gray-100" />
			</div>
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
				{Array.from({ length: itemCount }).map((_, index) => (
					<div key={index} className="overflow-hidden rounded-2xl border border-gray-100 p-3">
						<div className="aspect-[4/3] animate-pulse rounded-xl bg-gray-100" />
						<div className="mt-4 h-5 w-4/5 animate-pulse rounded bg-gray-200" />
						<div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-gray-100" />
						<div className="mt-5 h-10 animate-pulse rounded-full bg-gray-100" />
					</div>
				))}
			</div>
		</section>
	);
}

export default function GroupPurchaseDefault({ section, host, demoOnly }: GroceriesSectionProps) {
	const { formatAmount } = useAmount();
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const configuredData = asRecord(config.data);
	const data = Object.keys(configuredData).length ? configuredData : config;
	const configuredFilter = asRecord(data.filter);
	const filter = Object.keys(configuredFilter).length ? configuredFilter : asRecord(config.filter);
	const itemsAllow = Math.max(1, Math.min(24, Math.trunc(Number(data.items_allow ?? config.items_allow) || 8)));
	const dataModel = textValue(data.data_model ?? config.data_model, "products").toLowerCase();
	const categoryFilter = String(filter.category_id ?? "").trim();
	const brandFilter = String(filter.brand_id ?? "").trim();
	const minPriceFilter = String(filter.min_price ?? "").trim();
	const maxPriceFilter = String(filter.max_price ?? "").trim();
	const stockFilter = String(filter.in_stock ?? "").trim();
	const sortFilter = String(filter.sort_by ?? "").trim();
	const demandTagFilter = String(filter.demand_tag ?? "").trim();
	const navigationId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const previousClass = `group-purchase-prev-${navigationId}`;
	const nextClass = `group-purchase-next-${navigationId}`;
	const scrollRef = useRef<HTMLDivElement>(null);
	const [cards, setCards] = useState<GroupPurchaseCard[]>([]);
	const [loading, setLoading] = useState(dataModel === "products");

	useEffect(() => {
		if (dataModel !== "products") return;

		let active = true;
		const params = new URLSearchParams({ limit: "24" });
		if (demoOnly) params.set("is_demo", "1");
		if (hasValue(categoryFilter)) params.set("category_id", categoryFilter);
		if (hasValue(brandFilter)) params.set("brand_id", brandFilter);
		if (hasValue(minPriceFilter)) params.set("min_price", minPriceFilter);
		if (hasValue(maxPriceFilter)) params.set("max_price", maxPriceFilter);
		if (hasValue(stockFilter)) params.set("in_stock", stockFilter);
		if (hasValue(sortFilter)) params.set("sort_by", sortFilter);
		if (hasValue(demandTagFilter)) params.set("demand_tag", demandTagFilter.toLowerCase());

		fetchStorefrontJson<{ data?: GroupPurchaseResponse }>(`/landing/group-purchases?${params.toString()}`, host)
			.then((result) => {
				if (!active) return;
				const rows = Array.isArray(result?.data?.cards) ? result.data.cards : [];
				setCards(rows.map(normalizeCard).filter((card): card is GroupPurchaseCard => Boolean(card)));
			})
			.catch(() => {
				if (!active) return;
				setCards([]);
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [brandFilter, categoryFilter, dataModel, demoOnly, demandTagFilter, host, maxPriceFilter, minPriceFilter, sortFilter, stockFilter]);

	const visibleCards = (() => {
		let nextCards = [...cards];
		const minPrice = Number(minPriceFilter);
		const maxPrice = Number(maxPriceFilter);

		if (Number.isFinite(minPrice) && hasValue(minPriceFilter)) nextCards = nextCards.filter((card) => card.product.price >= minPrice);
		if (Number.isFinite(maxPrice) && hasValue(maxPriceFilter)) nextCards = nextCards.filter((card) => card.product.price <= maxPrice);

		switch (normalizeSort(sortFilter)) {
			case "price-low-high":
				nextCards.sort((a, b) => a.group_purchase.discounted_price - b.group_purchase.discounted_price);
				break;
			case "price-high-low":
				nextCards.sort((a, b) => b.group_purchase.discounted_price - a.group_purchase.discounted_price);
				break;
			case "name-z-a":
				nextCards.sort((a, b) => b.product.name.localeCompare(a.product.name));
				break;
			case "name-a-z":
				nextCards.sort((a, b) => a.product.name.localeCompare(b.product.name));
				break;
		}

		return nextCards.slice(0, itemsAllow);
	})();

	const heading = textValue(content.heading ?? content.title ?? config.heading, textValue(section.title, "Group Purchase Deals"));
	const subheading = textValue(content.subheading ?? content.sub_title ?? config.subheading, textValue(section.subtitle, "Team up with friends and unlock a better price."));

	const scrollBy = (direction: number) => {
		scrollRef.current?.scrollBy({ left: direction * Math.max(scrollRef.current.clientWidth * 0.85, 300), behavior: "smooth" });
	};

	if (dataModel !== "products") return null;
	if (loading) return <GroupPurchaseSkeleton itemCount={Math.min(itemsAllow, 4)} />;

	return (
		<section data-storefront-section="groceries-essentials-group-purchase-default" className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8">
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 className="text-2xl font-semibold text-primary-black">{heading}</h2>
					{subheading ? <p className="mt-2 text-primary-body">{subheading}</p> : null}
				</div>
				{visibleCards.length > 1 ? (
					<div className="flex gap-2">
						<button type="button" aria-label="Previous group purchase deals" className={`${previousClass} inline-flex size-9 items-center justify-center rounded-full border border-gray-200 text-primary-black transition hover:border-primary-black hover:bg-primary-black hover:text-white`} onClick={() => scrollBy(-1)}>
							<ChevronLeft className="size-4" />
						</button>
						<button type="button" aria-label="Next group purchase deals" className={`${nextClass} inline-flex size-9 items-center justify-center rounded-full border border-gray-200 text-primary-black transition hover:border-primary-black hover:bg-primary-black hover:text-white`} onClick={() => scrollBy(1)}>
							<ChevronRight className="size-4" />
						</button>
					</div>
				) : null}
			</div>

			{visibleCards.length ? (
				<div ref={scrollRef} className="grid grid-flow-col auto-cols-[85%] gap-5 overflow-x-auto pb-2 [scrollbar-width:none] sm:auto-cols-[calc(50%-0.625rem)] xl:auto-cols-[calc(25%-0.9375rem)] [&::-webkit-scrollbar]:hidden">
					{visibleCards.map((card) => {
						const { product, group_purchase: deal, active_group: activeGroup } = card;
						const category = getCategoryName(product.category);
						const href = activeGroup?.id
							? `/group-purchase?group=${encodeURIComponent(activeGroup.id)}`
							: `/group-purchase?product=${encodeURIComponent(product.id)}`;
						const joinedCount = activeGroup?.joined_count || 0;
						const memberTarget = activeGroup?.minimum_users || deal.minimum_users;
						const progress = Math.min((joinedCount / memberTarget) * 100, 100);
						const savingText = deal.discount_type === "fixed"
							? `Save ${formatAmount(deal.discount_value)}`
							: `Save ${Number(deal.discount_amount || 0)}%`;

						return (
							<article key={product.id} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
								<Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-gray-100">
									<GroupPurchaseImage src={product.thumbnail || FALLBACK_IMAGE} alt={product.name} />
									<span className="absolute left-3 top-3 rounded-full bg-primary-black px-3 py-1 text-xs font-semibold text-white">{savingText}</span>
								</Link>

								<div className="flex flex-1 flex-col p-4">
									<div className="mb-3 flex items-center gap-2 text-xs text-primary-body">
										{product.brand ? <span className="truncate font-medium">{product.brand}</span> : null}
										{product.brand && category ? <span aria-hidden="true">•</span> : null}
										{category ? <span className="truncate">{category}</span> : null}
									</div>
									<Link href={href} className="line-clamp-2 min-h-12 text-base font-semibold text-primary-black hover:text-theme-coral">{product.name}</Link>

									<div className="mt-4 flex items-end gap-2">
										<span className="text-xl font-bold text-primary-black">{formatAmount(deal.discounted_price)}</span>
										{product.original_price && product.original_price > deal.discounted_price ? <del className="text-sm text-primary-body">{formatAmount(product.original_price)}</del> : null}
									</div>

									<div className="mt-4 flex items-center justify-between gap-3 text-xs text-primary-body">
										<span className="inline-flex items-center gap-1.5"><Users className="size-4" />{memberTarget} members</span>
										<span className="font-semibold text-primary-green">{savingText}</span>
									</div>

									{activeGroup ? (
										<div className="mt-4">
											<div className="mb-2 flex justify-between text-xs text-primary-body"><span>{joinedCount} of {memberTarget} joined</span><span>{Math.round(progress)}%</span></div>
											<div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary-black transition-all" style={{ width: `${progress}%` }} /></div>
										</div>
									) : null}

									<Link href={href} className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary-black px-5 text-sm font-semibold text-white transition hover:bg-foreground/90">
										{activeGroup ? "Join active group" : "Start a group"}
									</Link>
								</div>
							</article>
						);
					})}
				</div>
			) : (
				<div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-primary-body">No group purchase deals found.</div>
			)}
		</section>
	);
}

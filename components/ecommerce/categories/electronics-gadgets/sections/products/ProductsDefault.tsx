"use client";

import { useEffect, useMemo, useState } from "react";
import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";
import { Button } from "@/components/ui/button";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import { cn } from "@/lib/utils";
import type { ElectronicsSectionProps } from "../../types";

type Product = {
	id: string;
	name: string;
	slug: string;
	thumbnail?: string;
	image?: string;
	price: number;
	original_price?: number;
	discount_percent?: number;
	quantity?: number;
	brand?: string;
	rating?: number | null;
	reviews?: number;
	category?: { name?: string; slug?: string } | string | null;
	url?: string;
};

type ProductResponse = {
	products?: Product[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const textValue = (value: unknown, fallback: string) => {
	const normalized = String(value ?? "").trim();
	return normalized || fallback;
};

const hasValue = (value: unknown) => String(value ?? "").trim() !== "";

const normalizeSort = (value: unknown) => {
	const sort = String(value ?? "").trim().toLowerCase();
	const aliases: Record<string, string> = {
		price_asc: "price-low-high",
		price_desc: "price-high-low",
		name_asc: "name-a-z",
		name_desc: "name-z-a",
		latest: "newest",
	};
	return aliases[sort] || sort || "newest";
};

function ProductSkeleton() {
	return (
		<section className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8">
			<div className="mb-8 h-8 w-48 animate-pulse rounded bg-gray-200" />
			<div className="mb-8 flex gap-3 overflow-hidden">
				{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-gray-200" />)}
			</div>
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{Array.from({ length: 8 }).map((_, index) => (
					<div key={index} className="overflow-hidden rounded-lg bg-white shadow-md">
						<div className="h-64 animate-pulse bg-gray-200" />
						<div className="space-y-3 p-4"><div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" /><div className="h-5 w-1/2 animate-pulse rounded bg-gray-200" /></div>
					</div>
				))}
			</div>
		</section>
	);
}

export default function ProductsDefault({ section, host, demoOnly }: ElectronicsSectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const data = asRecord(config.data);
	const filters = asRecord(data.filter);
	const itemsAllow = Math.max(1, Math.min(24, Math.trunc(Number(data.items_allow) || 8)));
	const dataModel = textValue(data.data_model, "products");
	const filterSignature = JSON.stringify({ itemsAllow, dataModel, filters });
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(dataModel === "products");
	const [selectedCategory, setSelectedCategory] = useState("All");

	useEffect(() => {
		if (dataModel !== "products") {
			return;
		}

		let active = true;
		const loadingTimer = window.setTimeout(() => {
			if (active) setLoading(true);
		}, 0);
		const params = new URLSearchParams({ perPage: String(itemsAllow) });
		if (demoOnly) params.set("is_demo", "1");
		if (hasValue(filters.category_id)) params.set("category", String(filters.category_id).trim());
		if (hasValue(filters.brand_id)) params.set("brand", String(filters.brand_id).trim());
		if (hasValue(filters.min_price)) params.set("minPrice", String(filters.min_price).trim());
		if (hasValue(filters.max_price)) params.set("maxPrice", String(filters.max_price).trim());
		if (hasValue(filters.demand_tag)) params.set("demand_tag", String(filters.demand_tag).trim().toLowerCase());
		if (hasValue(filters.sort_by)) params.set("sort", normalizeSort(filters.sort_by));
		if (hasValue(filters.in_stock)) {
			const stock = String(filters.in_stock).trim().toLowerCase();
			const normalizedStock = ["1", "true", "yes", "in-stock", "in_stock"].includes(stock)
				? "in-stock"
				: ["0", "false", "no", "out-of-stock", "out_of_stock"].includes(stock)
					? "out-of-stock"
					: stock;
			params.set("stock", normalizedStock);
		}

		fetchStorefrontJson<{ data?: ProductResponse }>(`/landing/products?${params.toString()}`, host)
			.then((result) => {
				if (!active) return;
				setProducts(Array.isArray(result?.data?.products) ? result.data.products : []);
				setSelectedCategory("All");
				setLoading(false);
			})
			.catch(() => {
				if (!active) return;
				setProducts([]);
				setLoading(false);
			});

		return () => {
			active = false;
			window.clearTimeout(loadingTimer);
		};
	}, [
		dataModel,
		demoOnly,
		filterSignature,
		filters.brand_id,
		filters.category_id,
		filters.demand_tag,
		filters.in_stock,
		filters.max_price,
		filters.min_price,
		filters.sort_by,
		host,
		itemsAllow,
	]);

	const categories = useMemo(() => {
		const names = products.map((product) => typeof product.category === "string" ? product.category : product.category?.name || "").filter(Boolean);
		return ["All", ...Array.from(new Set(names))];
	}, [products]);

	const visibleProducts = useMemo(() => selectedCategory === "All" ? products : products.filter((product) => {
		const category = typeof product.category === "string" ? product.category : product.category?.name || "";
		return category === selectedCategory;
	}), [products, selectedCategory]);

	const heading = textValue(content.heading, textValue(section.title, "Products"));
	const subheading = textValue(content.subheading, textValue(section.subtitle, "Browse products from this store."));

	if (loading && dataModel === "products") return <ProductSkeleton />;

	return (
		<section data-storefront-section="electronics-gadgets-products-default" className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8">
			<h2 className="mb-2 text-2xl font-semibold text-primary-black">{heading}</h2>
			{subheading ? <p className="mb-8 text-primary-body">{subheading}</p> : null}
			{categories.length > 1 ? (
				<div className="mb-8 flex gap-3 overflow-x-auto pb-2">
					{categories.map((category) => <Button key={category} type="button" onClick={() => setSelectedCategory(category)} variant={selectedCategory === category ? "default" : "outline"} className={cn("whitespace-nowrap rounded-full", selectedCategory === category ? "bg-secondary-stroke text-primary-black hover:bg-secondary-stroke" : "border-0 shadow-none text-primary-body")}>{category}</Button>)}
				</div>
			) : null}
			{visibleProducts.length ? (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{visibleProducts.map((product) => {
						const category = typeof product.category === "string" ? product.category : product.category?.name || "Product";
						const href = product.url || `/product/${product.slug}`;
						return <StorefrontProductCard key={product.id} productId={String(product.id)} productSlug={product.slug} href={href} name={product.name} imageSrc={product.thumbnail || product.image || "/images/placeholder.jpg"} badgeText={category} metaText={product.reviews ? `* ${Number(product.rating || 0).toFixed(1)}` : "No reviews"} price={Number(product.price || 0)} originalPrice={product.original_price} discountPercent={product.discount_percent} footerText={product.reviews ? `${product.reviews} review${product.reviews === 1 ? "" : "s"}` : "Be the first to review"} availableQuantity={Number(product.quantity || 0)} />;
					})}
				</div>
			) : <div className="py-12 text-center text-lg text-gray-500">No products found.</div>}
		</section>
	);
}

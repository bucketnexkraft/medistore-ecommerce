"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { fallbackJustForYouSection, type JustForYouProduct, type JustForYouSection } from "@/lib/just-for-you";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE_PRODUCTS = 12;
const LOAD_MORE_COUNT = 12;

type ProductFeedSectionProductsProps = {
	title?: string;
	subtitle?: string;
	demandTag?: string;
	initialSection?: JustForYouSection | null;
};

async function fetchJustForYouSection(demandTag?: string) {
	const normalizedDemandTag = String(demandTag || "").trim().toLowerCase();
	const demandTagQuery = normalizedDemandTag ? `&demand_tag=${encodeURIComponent(normalizedDemandTag)}` : "";

	return apiFetch(`/landing/sections/just-for-you?limit=100${demandTagQuery}`, {
		cache: "no-store",
	})
		.then(async (response) => {
			if (!response.ok) {
				throw new Error("Failed to fetch just-for-you section");
			}

			const result = await response.json();
			const data = result?.data;

			return {
				heading: String(data?.heading || fallbackJustForYouSection.heading),
				subheading: String(data?.subheading || ""),
				categories: Array.isArray(data?.categories) ? data.categories : [],
				demand_tag: data?.demand_tag ? String(data.demand_tag) : normalizedDemandTag || null,
				products: Array.isArray(data?.products) ? data.products : [],
			};
		})
		.catch(() => fallbackJustForYouSection);
}

const getReviewMeta = (product: JustForYouProduct) => {
	if ((product.reviews || 0) > 0 && typeof product.rating === "number") {
		return `* ${product.rating.toFixed(1)}`;
	}

	return "No reviews";
};

const getReviewFooter = (product: JustForYouProduct) => {
	if ((product.reviews || 0) > 0) {
		return `${product.reviews} review${product.reviews === 1 ? "" : "s"}`;
	}

	return "Be the first to review";
};

export function ProductFeedSectionProducts({ title, subtitle, demandTag, initialSection }: ProductFeedSectionProductsProps) {
	const normalizedDemandTag = String(demandTag || "").trim().toLowerCase();
	const [section, setSection] = useState<JustForYouSection>(initialSection || fallbackJustForYouSection);
	const [selectedCategory, setSelectedCategory] = useState("All");
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PRODUCTS);
	const [loading, setLoading] = useState(!initialSection);

	useEffect(() => {
		if (initialSection) {
			return;
		}

		let mounted = true;

		fetchJustForYouSection(normalizedDemandTag).then((data) => {
			if (!mounted) return;
			setSection(data);
			setSelectedCategory("All");
			setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
			setLoading(false);
		});

		return () => {
			mounted = false;
		};
	}, [initialSection, normalizedDemandTag]);

	const resolvedSection = initialSection || section;
	const resolvedHeading = title || resolvedSection.heading || "Just for you";
	const resolvedSubheading = subtitle || resolvedSection.subheading;
	const categories = useMemo(() => ["All", ...resolvedSection.categories], [resolvedSection.categories]);

	const filteredProducts = useMemo(() => {
		if (selectedCategory === "All") {
			return resolvedSection.products;
		}

		return resolvedSection.products.filter((product) => product.category === selectedCategory);
	}, [resolvedSection.products, selectedCategory]);

	const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
	const hasMoreProducts = visibleCount < filteredProducts.length;

	if (loading) {
		return (
			<div>
				<div className="mb-8 flex gap-3 overflow-x-auto pb-2">
					{Array.from({ length: 5 }).map((_, index) => (
						<div key={index} className="h-10 w-28 animate-pulse rounded-full bg-gray-200" />
					))}
				</div>

				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="overflow-hidden rounded-lg bg-white shadow-md">
							<div className="h-64 animate-pulse bg-gray-200" />
							<div className="h-10 animate-pulse bg-gray-100" />
							<div className="p-4">
								<div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
								<div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-gray-200" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div>
			<h4 className="mb-8">{resolvedHeading}</h4>
			{resolvedSubheading && (
				<p className="-mt-4 mb-8 max-w-2xl text-base text-primary-body">{resolvedSubheading}</p>
			)}

			<div className="mb-8 flex gap-3 overflow-x-auto pb-2">
				{categories.map((category) => (
					<Button
						key={category}
						onClick={() => {
							startTransition(() => {
								setSelectedCategory(category);
								setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
							});
						}}
						variant={selectedCategory === category ? "default" : "outline"}
						className={cn(
							"whitespace-nowrap rounded-full",
							selectedCategory === category ? "bg-secondary-stroke text-primary-black hover:bg-secondary-stroke" : "border-0 shadow-none text-primary-body",
						)}
					>
						{category}
					</Button>
				))}
			</div>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{visibleProducts.map((product) => (
					<StorefrontProductCard
						key={product.id}
						productId={product.id}
						productSlug={product.url.match(/^\/product\/([^/?#]+)/)?.[1]}
						href={product.url}
						name={product.name}
						imageSrc={product.image}
						backgroundSrc={product.bg_image}
						badgeText={product.badge}
						metaText={getReviewMeta(product)}
						price={product.price}
						originalPrice={product.original_price}
						discountPercent={product.discount_percent}
						footerText={getReviewFooter(product)}
						availableQuantity={Number(product.quantity || 0)}
					/>
				))}
			</div>

			{hasMoreProducts ? (
				<div className="mt-8 flex justify-center">
					<Button variant="outline" className="rounded-full px-6" onClick={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}>
						Load more
					</Button>
				</div>
			) : null}

			{filteredProducts.length === 0 && (
				<div className="py-12 text-center">
					<p className="text-lg text-gray-500">No products found in this category</p>
				</div>
			)}
		</div>
	);
}

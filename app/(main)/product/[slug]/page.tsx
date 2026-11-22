import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductDetailsTopPart } from "@/components/common/BestSellingProducts/ProductDetailsTopPart";
import { ProductDetailsBottomPart } from "@/components/common/BestSellingProducts/ProductDetailsBottomPart";
import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";
import ThousandsOfShops from "@/components/common/ThousandsOfShops";
import { serverApiFetch } from "@/lib/api-client";
import type { ProductDetailsData } from "@/components/product/product-details.types";

interface ProductPageProps {
	params: Promise<{
		slug: string;
	}>;
}

type ProductCombinationItem = {
	id: string | number;
	combination: Record<string, string>;
	quantity?: number;
	price?: number | null;
};

export default async function ProductPage({ params }: ProductPageProps) {
	const { slug } = await params;
	const product = await getProductBySlug(slug);
	const initialCombinations = product?.combinations ?? [];

	if (!product) {
		notFound();
	}

	return (
		<main className="min-h-screen">
			<div className="sticky top-0 z-10">
				<div className="container mx-auto flex flex-wrap items-center gap-2 px-4 pt-8 text-sm">
					<Link href="/" className="text-primary-body">
						Home
					</Link>
					<ChevronRight size={20} />
					<Link href="/products" className="text-primary-body">
						Products
					</Link>
					{product.category ? (
						<>
							<ChevronRight size={20} />
							<Link href={`/categories/${product.category.slug}`} className="text-primary-body">
								{product.category.name}
							</Link>
						</>
					) : null}
					<div className="inline-flex items-center gap-2 font-medium text-primary-black">
						<ChevronRight size={20} />
						<span>Product details</span>
					</div>
				</div>
			</div>

			<div className="section py-12">
				<div className="mb-16">
					<ProductDetailsTopPart product={product} initialCombinations={initialCombinations} />
				</div>

				<div>
					<ProductDetailsBottomPart product={product} />
				</div>

				{product.related_products.length > 0 ? (
					<div className="pt-20 lg:pt-24">
						<section>
							<div className="mb-8">
								<h2 className="text-3xl font-bold text-primary-black">Similar Products</h2>
								<p className="mt-2 text-sm text-primary-body">More products you may like from the storefront.</p>
							</div>
							<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
								{product.related_products.map((item) => (
									<StorefrontProductCard
										key={String(item.id)}
										productId={String(item.id)}
										productSlug={String(item.slug || "")}
										href={String(item.url || `/product/${item.slug}`)}
										name={String(item.name || "Product")}
										imageSrc={String(item.thumbnail || "/images/placeholder.jpg")}
										badgeText={String(item.brand || item.category?.name || "Product")}
										metaText={Number(item.quantity || 0) > 0 ? `${Math.max(0, Math.floor(Number(item.quantity || 0)))}` : "0"}
										price={Number(item.price || 0)}
										originalPrice={
											item.original_price !== null && item.original_price !== undefined
												? Number(item.original_price)
												: undefined
										}
										discountPercent={Number(item.discount_percent || 0)}
										footerText={
											Number(item.quantity || 0) > 0
												? `${Math.max(0, Math.floor(Number(item.quantity || 0)))} available in stock`
												: "Currently out of stock"
										}
										availableQuantity={Math.max(0, Math.floor(Number(item.quantity || 0)))}
									/>
								))}
							</div>
						</section>
					</div>
				) : null}

				<div className="pt-20 lg:pt-24">
					<ThousandsOfShops />
				</div>
			</div>
		</main>
	);
}

async function getProductBySlug(slug: string): Promise<ProductDetailsData | null> {
	try {
		const headerStore = await headers();
		const host = headerStore.get("host");
		const response = await serverApiFetch(`/landing/products/${encodeURIComponent(slug)}`, host, {
			cache: "no-store",
		});

		if (!response.ok) {
			return null;
		}

		const result = await response.json();
		const item = result?.data;

		if (!item?.slug) {
			return null;
		}

		return {
			id: String(item.id),
			name: String(item.name || "Product"),
			slug: String(item.slug),
			code: item.code ? String(item.code) : null,
			thumbnail: String(item.thumbnail || "/images/placeholder.jpg"),
			featured_image: String(item.featured_image || item.thumbnail || "/images/placeholder.jpg"),
			images: Array.isArray(item.images) ? item.images : [],
			gallery: Array.isArray(item.gallery) ? item.gallery : [],
			category: item.category?.slug
				? {
						id: String(item.category.id),
						name: String(item.category.name),
						slug: String(item.category.slug),
					}
				: null,
			brand: item.brand?.name
				? {
						id: String(item.brand.id),
						name: String(item.brand.name),
						slug: String(item.brand.slug || ""),
					}
				: null,
			unit: item.unit?.name
				? {
						id: String(item.unit.id),
						name: String(item.unit.name),
						code: String(item.unit.code || ""),
					}
				: null,
			price: Number(item.price || 0),
			original_price: item.original_price !== null && item.original_price !== undefined ? Number(item.original_price) : null,
			discount_percent: Number(item.discount_percent || 0),
			description: String(item.description || ""),
			return_enabled: Boolean(item.return_enabled),
			return_day: item.return_day !== null && item.return_day !== undefined ? Number(item.return_day) : null,
			return_condition: Array.isArray(item.return_condition) ? item.return_condition.map(String) : [],
			is_featured: Boolean(item.is_featured),
			demand_tags: Array.isArray(item.demand_tags) ? item.demand_tags.map(String) : [],
			sales_channel: item.sales_channel && typeof item.sales_channel === "object" ? item.sales_channel : {},
			vat: Number(item.vat || 0),
			has_variant: Boolean(item.has_variant),
			variants: Array.isArray(item.variants) ? item.variants : [],
			variants_display: Array.isArray(item.variants_display) ? item.variants_display.map(String) : [],
			available_quantity: Number(item.available_quantity || 0),
			raw_total_quantity: Number(item.raw_total_quantity || 0),
			stock_visibility: Boolean(item.stock_visibility),
			stock_visibility_label: item.stock_visibility_label ? String(item.stock_visibility_label) : null,
			stock_display: item.stock_display || {
				stock_visibility: true,
				stock_visibility_label: null,
				stock_quantity: null,
				stock_display: null,
			},
			is_group_purchase_available: Boolean(item.is_group_purchase_available),
			group_purchase_discount_type:
				item.group_purchase_discount_type === "fixed" || item.group_purchase_discount_type === "percent"
					? item.group_purchase_discount_type
					: null,
			group_purchase_minimum_user: item.group_purchase_minimum_user ? Number(item.group_purchase_minimum_user) : null,
			group_purchase_discount_amount: item.group_purchase_discount_amount !== null && item.group_purchase_discount_amount !== undefined
				? Number(item.group_purchase_discount_amount)
				: null,
			reviews_count: Number(item.reviews_count || 0),
			average_rating: Number(item.average_rating || 0),
			reviews: Array.isArray(item.reviews)
				? item.reviews.map((review: Record<string, unknown>) => ({
						id: String(review.id || ""),
						rating: Number(review.rating || 0),
						comment: String(review.comment || ""),
						created_at: review.created_at ? String(review.created_at) : null,
						reviewer: String(review.reviewer || "Customer"),
				  }))
				: [],
			related_products: Array.isArray(item.related_products)
				? item.related_products.map((related: Record<string, unknown>) => ({
						...related,
						price: Number(related.price || 0),
						original_price: related.original_price !== null && related.original_price !== undefined ? Number(related.original_price) : null,
						discount_percent: Number(related.discount_percent || 0),
						quantity: Number(related.quantity || 0),
				  }))
				: [],
			combinations: Array.isArray(item.combinations)
				? item.combinations.map((combination: Record<string, unknown>) => ({
					id: String(combination.id || ""),
					combination: combination.combination && typeof combination.combination === "object" ? combination.combination as Record<string, string> : {},
					quantity: combination.quantity !== null && combination.quantity !== undefined ? Number(combination.quantity) : undefined,
					price: combination.price !== null && combination.price !== undefined ? Number(combination.price) : null,
				})).filter((combination: ProductCombinationItem) => Object.keys(combination.combination).length > 0)
				: [],
		};
	} catch {
		return null;
	}
}

async function getProductCombinations(productId: string): Promise<ProductCombinationItem[]> {
	try {
		const headerStore = await headers();
		const host = headerStore.get("host");
		const response = await serverApiFetch(`/landing/products/${encodeURIComponent(productId)}/combinations`, host, {
			cache: "no-store",
		});

		if (!response.ok) {
			return [];
		}

		const result = await response.json();
		const items = Array.isArray(result?.data) ? (result.data as Record<string, unknown>[]) : [];

		return items
			.filter((item: Record<string, unknown>) => item?.combination && typeof item.combination === "object")
			.map((item: Record<string, unknown>) => ({
				id: String(item.id || ""),
				combination: Object.fromEntries(
					Object.entries((item.combination as Record<string, unknown>) || {}).reduce<Array<[string, string]>>((acc, [key, value]) => {
						if (value === null || value === undefined) {
							return acc;
						}

						acc.push([key, String(value)]);
						return acc;
					}, []),
				),
				quantity: item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : undefined,
			}))
			.filter((item: ProductCombinationItem) => Object.keys(item.combination).length > 0);
	} catch {
		return [];
	}
}

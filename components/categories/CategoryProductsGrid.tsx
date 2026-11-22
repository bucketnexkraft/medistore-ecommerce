"use client";

import { Tag } from "lucide-react";
import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";

type CategoryProduct = {
	id: string;
	name: string;
	slug: string;
	thumbnail: string;
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	quantity: number;
	brand: string;
	rating?: number | null;
	reviews?: number;
	category: {
		name: string;
		slug: string;
	} | null;
	url: string;
};

export default function CategoryProductsGrid({
	products,
}: {
	products: CategoryProduct[];
}) {
	const formatStock = (quantity: number) => Math.max(0, Math.floor(Number(quantity) || 0));
	const getMetaText = (product: CategoryProduct) =>
		(product.reviews || 0) > 0 && typeof product.rating === "number" ? `★ ${product.rating.toFixed(1)}` : "New";
	const getFooterText = (product: CategoryProduct) => {
		const stockText = product.quantity > 0 ? `${formatStock(product.quantity)} available in stock` : "Currently out of stock";

		if ((product.reviews || 0) > 0) {
			return `${product.reviews} review${product.reviews === 1 ? "" : "s"} • ${stockText}`;
		}

		return `No reviews yet • ${stockText}`;
	};

	if (products.length === 0) {
		return (
			<div className="mt-5 rounded-[24px] border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eefbf0] text-primary-green">
					<Tag className="h-8 w-8" />
				</div>
				<h3 className="mt-5 text-2xl font-bold text-primary-black">No products found</h3>
				<p className="mt-3 text-primary-body">Products assigned to this category will show up here automatically.</p>
			</div>
		);
	}

	return (
		<div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
			{products.map((product) => (
				<StorefrontProductCard
					key={product.id}
					productId={product.id}
					productSlug={product.slug}
					href={product.url}
					name={product.name}
					imageSrc={product.thumbnail || "/images/placeholder.jpg"}
					badgeText={product.brand || product.category?.name || "Featured product"}
					metaText={getMetaText(product)}
					price={product.price}
					originalPrice={
						product.original_price !== null && product.original_price !== undefined
							? product.original_price
							: undefined
					}
					discountPercent={product.discount_percent}
					footerText={getFooterText(product)}
					availableQuantity={formatStock(product.quantity)}
				/>
			))}
		</div>
	);
}

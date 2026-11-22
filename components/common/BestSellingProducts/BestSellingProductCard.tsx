"use client";

import type { Product } from "@/data/products";
import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";

interface BestSellingProductCardProps {
	product: Product;
}

export function BestSellingProductCard({ product }: BestSellingProductCardProps) {
	const reviewMeta = product.reviews > 0 ? `* ${product.rating.toFixed(1)}` : "No reviews";
	const reviewFooter = product.reviews > 0 ? `${product.reviews} review${product.reviews === 1 ? "" : "s"}` : "Be the first to review";
	const discountPercent = product.originalPrice > product.price ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;

	return (
		<StorefrontProductCard
			productId={String(product.id)}
			productSlug={product.slug}
			href={`/product/${product.slug}`}
			name={product.name}
			imageSrc={product.image}
			backgroundSrc={product.bgImage}
			badgeText={product.badge}
			metaText={reviewMeta}
			price={product.price}
			originalPrice={product.originalPrice}
			discountPercent={discountPercent || undefined}
			footerText={reviewFooter}
		/>
	);
}

import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";
import Image from "next/image";

export type DashboardRecommendation = {
	id: string;
	name: string;
	category: string;
	slug: string;
	price: number;
	original_price: number;
	image: string;
	bg_image: string;
	badge: string;
	rating: number;
	reviews: number;
	quantity?: number;
	url?: string;
};

const getReviewMeta = (product: DashboardRecommendation) => {
	if ((product.reviews || 0) > 0 && typeof product.rating === "number") {
		return `* ${product.rating.toFixed(1)}`;
	}

	return "No reviews";
};

const getReviewFooter = (product: DashboardRecommendation) => {
	if ((product.reviews || 0) > 0) {
		return `${product.reviews} review${product.reviews === 1 ? "" : "s"}`;
	}

	return "Be the first to review";
};

export default function AIRecommend({ products }: { products: DashboardRecommendation[] }) {
	return (
		<div>
			<div className="rounded-xl border shadow bg-white p-6">
				<div className="flex items-center gap-2.5 mb-7">
					<div className="w-12 h-12 bg-primary-blue rounded-lg flex items-center justify-center">
						<Image src="/icons/user-dashboard/ai.svg" alt="ai recommended" width={20} height={20} />
					</div>
					<div>
						<h6 className="text-2xl font-bold">AI Recommended for You</h6>
						<p>Based on your browsing history and preferences</p>
					</div>
				</div>

				{products.length > 0 ? (
					<div className="w-full">
						<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
							{products.map((product) => (
								<StorefrontProductCard
									key={product.id}
									productId={product.id}
									productSlug={product.slug}
									href={product.url || `/product/${product.slug}`}
									name={product.name}
									imageSrc={product.image}
									backgroundSrc={product.bg_image}
									badgeText={product.badge || product.category}
									metaText={getReviewMeta(product)}
									price={product.price}
									originalPrice={product.original_price}
									discountPercent={product.original_price > product.price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : undefined}
									footerText={getReviewFooter(product)}
									availableQuantity={Number(product.quantity || 0)}
								/>
							))}
						</div>
					</div>
				) : (
					<p className="text-primary-body">No recommendations are available right now.</p>
				)}
			</div>
		</div>
	);
}

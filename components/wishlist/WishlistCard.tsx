"use client";

import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { useAmount } from "@/lib/amount";
import { addCartItem } from "@/lib/cart";
import { cn } from "@/lib/utils";
import type { WishlistItem } from "@/components/providers/WishlistProvider";

interface WishlistCardProps {
	product: WishlistItem;
	onRemove: (productId: string) => Promise<unknown> | unknown;
	isRemoving?: boolean;
}

export function WishlistCard({ product, onRemove, isRemoving = false }: WishlistCardProps) {
	const { formatAmount } = useAmount();
	const stockText = product.stock_display?.stock_display || "Stock info unavailable";
	const isOutOfStock = product.available_quantity <= 0;

	const handleAddToCart = () => {
		if (isOutOfStock) {
			return;
		}

		addCartItem({
			id: product.product_id,
			slug: product.slug,
			name: product.name,
			price: product.price,
			image: product.thumbnail,
			quantity: 1,
			maxQuantity: product.available_quantity > 0 ? product.available_quantity : null,
			brand: product.brand?.name || null,
			category: product.category,
		});
	};

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg">
			<div className="relative flex h-64 items-center justify-center overflow-hidden bg-[#f7f9fc] p-6">
				<Link href={product.url} className="absolute inset-0" aria-label={product.name} />
				<SafeImage unoptimized src={product.thumbnail || "/images/placeholder.jpg"} alt={product.name} width={180} height={180} className="h-full w-full object-contain" />
				<button
					type="button"
					onClick={() => onRemove(product.product_id)}
					className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:bg-gray-50"
					aria-label="Remove from wishlist"
					disabled={isRemoving}
				>
					<Heart className={cn("h-5 w-5", "fill-red-500 stroke-red-500")} />
				</button>
			</div>

			<div className="flex flex-1 flex-col p-5">
				<div className="mb-2 flex min-h-5 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">
					<span>{product.brand?.name || product.category?.name || "Wishlist"}</span>
				</div>

				<Link href={product.url} className="min-h-[3.5rem] line-clamp-2 text-xl font-bold leading-7 text-primary-black transition-colors hover:text-primary-green">
					{product.name}
				</Link>

				<p className="mt-3 min-h-5 text-sm text-primary-body">{stockText}</p>
				<p className="mt-4 text-2xl font-bold text-primary-black">{formatAmount(product.price)}</p>

				<div className="mt-auto grid grid-cols-2 gap-2 pt-6">
					<Link
						href={product.url}
						className="inline-flex min-w-0 min-h-12 items-center justify-center rounded-full border border-gray-200 px-3 text-center text-sm font-semibold leading-tight text-primary-black transition-colors hover:border-primary-green hover:text-primary-green"
					>
						View product
					</Link>
					<button
						type="button"
						onClick={handleAddToCart}
						disabled={isOutOfStock}
						className={cn(
							"inline-flex min-w-0 min-h-12 items-center justify-center gap-1.5 rounded-full px-3 text-center text-sm font-semibold leading-tight transition-colors",
							isOutOfStock ? "cursor-not-allowed bg-gray-200 text-gray-500" : "bg-primary-black text-white hover:bg-primary-green",
						)}
					>
						<ShoppingBag className="h-4 w-4 shrink-0" />
						{isOutOfStock ? "Out of stock" : "Add to cart"}
					</button>
				</div>
			</div>
		</div>
	);
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { WishlistCard } from "./WishlistCard";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useCart } from "@/lib/cart";
import { toast } from "@/hooks/use-toast";

export function Wishlist() {
	const { items, count, isLoading, removeItem, isMutating } = useWishlist();
	const { addItem } = useCart();
	const [isMovingAll, setIsMovingAll] = useState(false);
	const sortedItems = useMemo(
		() =>
			[...items].sort((left, right) => {
				const leftDate = left.added_at ? new Date(left.added_at).getTime() : 0;
				const rightDate = right.added_at ? new Date(right.added_at).getTime() : 0;
				return rightDate - leftDate;
			}),
		[items],
	);

	const handleMoveAllToBag = async () => {
		if (sortedItems.length === 0 || isMovingAll) {
			return;
		}

		setIsMovingAll(true);

		try {
			const movableItems = sortedItems.filter((item) => item.available_quantity > 0);
			const skippedCount = sortedItems.length - movableItems.length;

			if (movableItems.length === 0) {
				toast({
					title: "Nothing moved to bag",
					description: "All saved items are currently out of stock.",
				});
				return;
			}

			movableItems.forEach((item) => {
				addItem({
					id: item.product_id,
					slug: item.slug,
					name: item.name,
					price: item.price,
					image: item.thumbnail,
					quantity: 1,
					maxQuantity: item.available_quantity > 0 ? item.available_quantity : null,
					brand: item.brand?.name || null,
					category: item.category,
				});
			});

			const removalResults = await Promise.all(movableItems.map((item) => removeItem(item.product_id)));
			const removedCount = removalResults.filter(Boolean).length;
			const failedRemovals = movableItems.length - removedCount;

			if (removedCount > 0) {
				const detailParts = [
					`${removedCount} item${removedCount === 1 ? "" : "s"} moved to your bag`,
					skippedCount > 0 ? `${skippedCount} skipped (out of stock)` : null,
					failedRemovals > 0 ? `${failedRemovals} could not be removed from wishlist` : null,
				].filter(Boolean);

				toast({
					title: "Wishlist updated",
					description: detailParts.join(". "),
				});
				return;
			}

			toast({
				title: "Move to bag failed",
				description: "We could not move your saved items right now. Please try again.",
			});
		} finally {
			setIsMovingAll(false);
		}
	};

	return (
		<main className="section py-10">
			<div className="flex flex-col gap-4 border-b border-gray-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-green">Your saved picks</p>
					<h1 className="mt-2 text-3xl font-bold text-primary-black">
						Wishlist <span className="text-primary-body">({count})</span>
					</h1>
					<p className="mt-3 max-w-2xl text-primary-body">Keep track of products you want to compare, revisit, or move into your cart later.</p>
				</div>

				<button
					onClick={handleMoveAllToBag}
					disabled={sortedItems.length === 0 || isMovingAll}
					className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-primary-black transition-colors hover:border-primary-green hover:text-primary-green disabled:cursor-not-allowed disabled:opacity-50"
				>
					<ShoppingBag className="h-4 w-4" />
					{isMovingAll ? "Moving..." : "Move all to bag"}
				</button>
			</div>

			{isLoading ? (
				<div className="grid gap-6 py-12 sm:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="overflow-hidden rounded-[24px] border border-gray-200 bg-white">
							<div className="h-64 animate-pulse bg-gray-100" />
							<div className="space-y-3 p-5">
								<div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
								<div className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />
								<div className="h-4 w-full animate-pulse rounded bg-gray-100" />
								<div className="h-10 w-full animate-pulse rounded-full bg-gray-100" />
							</div>
						</div>
					))}
				</div>
			) : null}

			{!isLoading && sortedItems.length === 0 ? (
				<div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eefbf0] text-primary-green">
						<Heart className="h-8 w-8" />
					</div>
					<h2 className="mt-6 text-2xl font-bold text-primary-black">Your wishlist is empty</h2>
					<p className="mt-3 text-primary-body">Tap the heart on any product and it will appear here instantly.</p>
					<Link
						href="/products"
						className="mt-6 inline-flex items-center justify-center rounded-full bg-primary-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-green"
					>
						Browse products
					</Link>
				</div>
			) : null}

			{!isLoading && sortedItems.length > 0 ? (
				<div className="grid gap-6 py-12 sm:grid-cols-2 xl:grid-cols-3">
					{sortedItems.map((product) => (
						<WishlistCard key={product.id} product={product} onRemove={removeItem} isRemoving={isMutating(product.product_id)} />
					))}
				</div>
			) : null}
		</main>
	);
}

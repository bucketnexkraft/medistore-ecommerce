"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { GitCompareArrows, Heart } from "lucide-react";
import type { MouseEvent } from "react";
import SafeImage from "@/components/common/SafeImage";
import { useAmount } from "@/lib/amount";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useCompare } from "@/components/providers/CompareProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";

interface StorefrontProductCardProps {
	productId: string;
	productSlug?: string;
	href: string;
	name: string;
	imageSrc: string;
	backgroundSrc?: string;
	badgeText: string;
	metaText: string;
	price: number;
	originalPrice?: number;
	discountPercent?: number;
	footerText?: string;
	availableQuantity?: number;
}

export default function StorefrontProductCard({
	productId,
	productSlug,
	href,
	name,
	imageSrc,
	backgroundSrc = "/images/home/bestsell/p-bg.webp",
	badgeText,
	metaText,
	price,
	originalPrice,
	discountPercent,
	footerText,
	availableQuantity,
}: StorefrontProductCardProps) {
	const router = useRouter();
	const pathname = usePathname();
	const { formatAmount } = useAmount();
	const { isAuthenticated } = useAuth();
	const { isWishlisted, isMutating, toggleItem } = useWishlist();
	const { isCompared, toggleItem: toggleCompareItem, maxItems } = useCompare();
	const normalizedPrice = Number(price || 0);
	const normalizedOriginalPrice = originalPrice !== undefined && originalPrice !== null ? Number(originalPrice) : undefined;
	const normalizedDiscountPercent = Number(discountPercent || 0);
	const safeOriginalPrice =
		normalizedOriginalPrice !== undefined && Number.isFinite(normalizedOriginalPrice) && normalizedOriginalPrice > normalizedPrice
			? normalizedOriginalPrice
			: undefined;
	const resolvedDiscount =
		safeOriginalPrice && safeOriginalPrice > 0
			? Math.round(((safeOriginalPrice - normalizedPrice) / safeOriginalPrice) * 100)
			: normalizedDiscountPercent > 0
				? Math.round(normalizedDiscountPercent)
				: 0;
	const fallbackSlug = productSlug || href.match(/^\/product\/([^/?#]+)/)?.[1] || "";
	const wishlistTargetKey = productId || fallbackSlug;
	const isFavorite = isWishlisted(productId) || (fallbackSlug ? isWishlisted(fallbackSlug) : false);
	const isWishlistPending = isMutating(wishlistTargetKey);
	const isInCompare = isCompared(productId) || (fallbackSlug ? isCompared(fallbackSlug) : false);

	const handleWishlistClick = async (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();

		if (!isAuthenticated) {
			router.push(`/signin?redirect=${encodeURIComponent(pathname || href)}`);
			return;
		}

		const wasFavorite = isFavorite;
		const success = await toggleItem({
			productId,
			productSlug: fallbackSlug || undefined,
		});

		if (success) {
			toast({
				title: wasFavorite ? "Removed from wishlist" : "Added to wishlist",
				description: name,
			});
			return;
		}

		toast({
			title: "Wishlist update failed",
			description: `Could not update ${name}. Please try again.`,
		});
	};

	const handleCompareClick = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();

		const result = toggleCompareItem({
			product_id: productId,
			slug: fallbackSlug || undefined,
			name,
			thumbnail: imageSrc,
			price: normalizedPrice,
			brand: badgeText ? { name: badgeText } : null,
			available_quantity: Number(availableQuantity ?? 0) || 0,
			stock_label: footerText || null,
			url: href,
		});

		if (!result.success && result.reason === "limit") {
			toast({
				title: "Compare list is full",
				description: `You can compare up to ${maxItems} products at a time.`,
			});
			return;
		}

		toast({
			title: result.added ? "Added to compare" : "Removed from compare",
			description: name,
		});
	};

	return (
		<div className="group h-full">
			<div className="relative flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 hover:shadow-xl">
				<div className="relative h-64 overflow-hidden bg-gray-900">
					<Link href={href} className="absolute inset-0 z-0" aria-label={name} />
					<SafeImage unoptimized src={backgroundSrc} alt="background" fill sizes="320px" className="object-cover opacity-40" />

					<div className="relative h-full w-full">
						<SafeImage
							unoptimized
							src={imageSrc || "/images/placeholder.jpg"}
							alt={name}
							fill
							sizes="320px"
							className="object-cover drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
						/>
					</div>

					<button
						type="button"
						onClick={handleWishlistClick}
						className="absolute right-4 top-4 z-20 cursor-pointer rounded-full bg-primary-blue p-2 backdrop-blur-sm transition-all duration-200 hover:bg-primary-blue/90"
						aria-label="Add to favorites"
						disabled={isWishlistPending}
					>
						<Heart size={20} className={cn("transition-all duration-200", isFavorite ? "fill-red-500 stroke-red-500" : "stroke-white")} />
					</button>
					<button
						type="button"
						onClick={handleCompareClick}
						className="absolute left-4 top-4 z-20 cursor-pointer rounded-full bg-primary-blue p-2 backdrop-blur-sm transition-all duration-200 hover:bg-primary-blue/90"
						aria-label="Add to compare"
					>
						<GitCompareArrows size={20} className={cn("stroke-white transition-all duration-200", isInCompare && "scale-110")} />
					</button>
				</div>

				<div className="flex items-center justify-between gap-3 bg-primary-green px-4 py-3 text-white">
					<span className="truncate text-sm font-semibold">{badgeText}</span>
					<div className="shrink-0 rounded-md bg-white px-3 py-1 text-sm font-medium text-primary-black shadow-sm">{metaText}</div>
				</div>

				<Link href={href} className="flex flex-1 flex-col p-5">
					<h3 className="min-h-[3.25rem] text-xl font-bold leading-snug text-primary-black transition-colors group-hover:text-secondary-red line-clamp-2">{name}</h3>

					<hr className="my-3" />

					<div className="min-h-[4.75rem]">
						<h6 className="mb-2 text-xl font-bold text-gray-900">{formatAmount(normalizedPrice)}</h6>

						{safeOriginalPrice ? (
							<>
								<span className="text-sm text-gray-500 line-through">{formatAmount(safeOriginalPrice)}</span>{" "}
								<span className="text-sm font-semibold text-primary-green">{resolvedDiscount}% off</span>
							</>
						) : resolvedDiscount > 0 ? (
							<span className="text-sm font-semibold text-primary-green">{resolvedDiscount}% off</span>
						) : null}
					</div>

					<div className="min-h-[1.75rem] pt-1">
						{footerText ? <p className="text-sm font-medium leading-6 text-primary-body">{footerText}</p> : null}
					</div>
				</Link>
			</div>
		</div>
	);
}

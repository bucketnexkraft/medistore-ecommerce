"use client";

import { useEffect, useMemo, useState } from "react";
import { Forward, GitCompareArrows, Handbag, Heart, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import SafeImage from "@/components/common/SafeImage";
import { useAmount } from "@/lib/amount";
import type { ProductDetailsData } from "@/components/product/product-details.types";
import { addCartItem } from "@/lib/cart";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { useCompare } from "@/components/providers/CompareProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { trackStorefrontEvent } from "@/lib/analytics";

interface ProductDetailsTopPartProps {
	product: ProductDetailsData;
	initialCombinations?: ProductCombinationItem[];
}

type ProductCombinationItem = {
	id: string | number;
	combination: Record<string, string>;
	quantity?: number;
	price?: number | null;
};

type CombinationDataResponse = {
	status?: number;
	data?: {
		quantity?: number;
		selling_price?: number;
	};
};

export function ProductDetailsTopPart({ product, initialCombinations = [] }: ProductDetailsTopPartProps) {
	const [quantity, setQuantity] = useState(1);
	const [selectedImageIndex, setSelectedImageIndex] = useState(0);
	const [zoom, setZoom] = useState(100);
	const [cartMessage, setCartMessage] = useState("");
	const [combinations] = useState<ProductCombinationItem[]>(() => initialCombinations);
	const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>(() => {
		const firstAvailableCombination = initialCombinations.find((item) => (item.quantity ?? 1) > 0)?.combination;
		return firstAvailableCombination ?? initialCombinations[0]?.combination ?? {};
	});
	const selectionKey = JSON.stringify([product.id, selectedVariant]);
	const hasVariantSelection = product.has_variant || combinations.length > 0;
	const selectedCombination = combinations.find((item) =>
		Object.entries(item.combination).every(([key, value]) => selectedVariant[key] === value)
	);
	const [variantData, setVariantData] = useState<{ key: string; quantity: number; price: number | null } | null>(() => {
		const first = initialCombinations.find((item) => Object.keys(item.combination || {}).length > 0);
		return first && first.price !== undefined
			? { key: JSON.stringify([product.id, first.combination]), quantity: Number(first.quantity || 0), price: first.price }
			: null;
	});
	const router = useRouter();
	const pathname = usePathname();
	const { formatAmount } = useAmount();
	const { isAuthenticated } = useAuth();
	const { isWishlisted, isMutating, toggleItem } = useWishlist();
	const { isCompared, toggleItem: toggleCompareItem, maxItems } = useCompare();

	const thumbnailImages = product.gallery.length > 0 ? product.gallery : [product.featured_image || product.thumbnail || "/images/placeholder.jpg"];
	const activeImage = thumbnailImages[selectedImageIndex] || thumbnailImages[0];
	const variantGroups = useMemo(() => {
		const grouped = new Map<string, Set<string>>();

		for (const item of combinations) {
			for (const [key, value] of Object.entries(item.combination || {})) {
				if (!grouped.has(key)) {
					grouped.set(key, new Set());
				}

				if (value) {
					grouped.get(key)?.add(value);
				}
			}
		}

		return Array.from(grouped.entries()).map(([name, values]) => ({
			name,
			values: Array.from(values),
		}));
	}, [combinations]);
	const selectedVariantLabel = useMemo(() => {
		const entries = Object.entries(selectedVariant).filter(([, value]) => value.trim() !== "");
		return entries.length > 0 ? entries.map(([key, value]) => `${key}: ${value}`).join(", ") : null;
	}, [selectedVariant]);
	const currentVariantData = variantData?.key === selectionKey ? variantData : null;
	const variantLoading = hasVariantSelection && !currentVariantData;
	const variantUnavailable = hasVariantSelection && currentVariantData?.price == null;
	const displayedPrice = hasVariantSelection ? currentVariantData?.price ?? 0 : product.price;
	const displayedStock = hasVariantSelection
		? currentVariantData?.quantity ?? selectedCombination?.quantity ?? 0
		: product.available_quantity;
	const availableStock = displayedStock > 0 ? displayedStock : null;
	const effectiveQuantity = availableStock ? Math.min(quantity, availableStock) : quantity;
	const totalPrice = displayedPrice * effectiveQuantity;
	const priceText = variantLoading ? "Loading price..." : variantUnavailable ? "Price unavailable" : formatAmount(displayedPrice);
	const stockText = hasVariantSelection
		? displayedStock > 0
			? `${Math.max(0, Math.floor(displayedStock))} available in stock`
			: variantLoading ? "Loading stock..." : "Currently out of stock"
		: product.stock_display?.stock_display || product.stock_visibility_label || "Stock info unavailable";
	const badgeText = product.brand?.name || product.code || product.category?.name || "Featured Product";
	const isOutOfStock = displayedStock <= 0;
	const purchaseDisabled = isOutOfStock || variantLoading || variantUnavailable;
	const originalPrice = !hasVariantSelection && product.original_price && product.original_price > displayedPrice ? product.original_price : null;
	const isFavorite = isWishlisted(product.id);
	const isWishlistPending = isMutating(product.id);
	const isInCompare = isCompared(product.id) || isCompared(product.slug);

	useEffect(() => {
		trackStorefrontEvent("view_item", {
			productId: product.id,
			productName: product.name,
			value: product.price,
			metadata: { category: product.category?.name, brand: product.brand?.name },
		});
	}, [product.id, product.name, product.price, product.category?.name, product.brand?.name]);

	useEffect(() => {
		if (Object.keys(selectedVariant).length === 0) {
			return;
		}

		let isMounted = true;
		const controller = new AbortController();

		const loadVariantData = async () => {
			try {
				if (selectedCombination?.price !== undefined) {
					setVariantData({ key: selectionKey, quantity: Number(selectedCombination.quantity || 0), price: selectedCombination.price ?? null });
					return;
				}
				const searchParams = new URLSearchParams();
				searchParams.set("product_id", product.id);

				for (const [key, value] of Object.entries(selectedVariant)) {
					if (value.trim() !== "") {
						searchParams.append(`combination[${key}]`, value);
					}
				}

				const response = await apiFetch(`/landing/products/combination-data?${searchParams.toString()}`, {
					cache: "no-store",
					signal: controller.signal,
				});
				const payload = (await response.json().catch(() => null)) as CombinationDataResponse | null;

				if (!isMounted) {
					return;
				}

				if (response.ok && payload?.status === 1 && payload.data) {
					setVariantData({ key: selectionKey, price: Number(payload.data.selling_price || 0), quantity: Math.max(0, Math.floor(Number(payload.data.quantity || 0))) });
				} else {
					setVariantData({ key: selectionKey, price: null, quantity: 0 });
				}
			} catch (error) {
				if (isMounted && !(error instanceof DOMException && error.name === "AbortError")) {
					setVariantData({ key: selectionKey, price: null, quantity: 0 });
				}
			}
		};

		void loadVariantData();

		return () => {
			isMounted = false;
			controller.abort();
		};
	}, [product.id, selectedVariant, selectionKey]);

	const copyTextToClipboard = async (value: string) => {
		if (typeof window === "undefined") {
			throw new Error("Clipboard is unavailable.");
		}

		if (window.isSecureContext && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(value);
			return;
		}

		const textarea = document.createElement("textarea");
		textarea.value = value;
		textarea.setAttribute("readonly", "");
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		textarea.style.pointerEvents = "none";
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();

		const copied = document.execCommand("copy");
		document.body.removeChild(textarea);

		if (!copied) {
			throw new Error("Clipboard copy failed.");
		}
	};

	const handleShare = async () => {
		const url = typeof window !== "undefined" ? window.location.href : "";

		try {
			if (navigator.share) {
				await navigator.share({
					title: product.name,
					text: `Check out this product: ${product.name}`,
					url,
				});

				toast({
					title: "Share opened",
					description: "Choose where you want to share this product.",
				});
				return;
			}

			await copyTextToClipboard(url);
			toast({
				title: "Link copied",
				description: "Product link copied to clipboard.",
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}

			toast({
				title: "Share failed",
				description: "Could not share this product right now.",
			});
		}
	};

	const handleQuantityChange = (value: number) => {
		if (value >= 1) {
			if (availableStock) {
				setQuantity(Math.min(value, availableStock));
				return;
			}

			setQuantity(value);
		}
	};

	const handleAddToCart = () => {
		if (purchaseDisabled) {
			setCartMessage("This product is currently out of stock.");
			return;
		}

		addCartItem({
			id: product.id,
			slug: product.slug,
			name: product.name,
			price: displayedPrice,
			image: product.featured_image || product.thumbnail || "/images/placeholder.jpg",
			quantity,
			maxQuantity: availableStock,
			brand: product.brand?.name || null,
			variantLabel: selectedVariantLabel,
			variantSelection: selectedVariantLabel ? selectedVariant : null,
			category: product.category,
			taxRate: product.vat,
		});

		toast({
			title: "Added to cart",
			description: product.name,
		});
		setCartMessage("Added to cart.");
	};

	const handleBuyNow = () => {
		if (purchaseDisabled) {
			setCartMessage("This product is currently out of stock.");
			return;
		}

		addCartItem({
			id: product.id,
			slug: product.slug,
			name: product.name,
			price: displayedPrice,
			image: product.featured_image || product.thumbnail || "/images/placeholder.jpg",
			quantity,
			maxQuantity: availableStock,
			brand: product.brand?.name || null,
			variantLabel: selectedVariantLabel,
			variantSelection: selectedVariantLabel ? selectedVariant : null,
			category: product.category,
			taxRate: product.vat,
		});

		router.push("/checkout-one?payment=cod");
	};

	const handleWishlistToggle = async () => {
		if (!isAuthenticated) {
			router.push(`/signin?redirect=${encodeURIComponent(pathname || `/product/${product.slug}`)}`);
			return;
		}

		const wasFavorite = isFavorite;
		const success = await toggleItem({
			productId: product.id,
			productSlug: product.slug,
		});

		if (success) {
			toast({
				title: wasFavorite ? "Removed from wishlist" : "Added to wishlist",
				description: product.name,
			});
			return;
		}

		toast({
			title: "Wishlist update failed",
			description: `Could not update ${product.name}. Please try again.`,
		});
	};

	const handleCompareToggle = () => {
		const result = toggleCompareItem({
			product_id: product.id,
			slug: product.slug,
			name: product.name,
			thumbnail: product.featured_image || product.thumbnail,
			price: displayedPrice,
			brand: product.brand ? { name: product.brand.name } : null,
			category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
			available_quantity: displayedStock,
			stock_label: stockText,
			url: `/product/${product.slug}`,
			code: product.code,
			unit: product.unit ? `${product.unit.name}${product.unit.code ? ` (${product.unit.code})` : ""}` : null,
			vat: product.vat,
			description: product.description,
			variants_display: selectedVariantLabel ? [selectedVariantLabel] : product.variants_display,
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
			description: product.name,
		});
	};

	const isOptionAvailable = (attributeName: string, value: string) => {
		if (combinations.length === 0) {
			return true;
		}

		return combinations.some((item) =>
			(item.quantity ?? 1) > 0 &&
			item.combination?.[attributeName] === value,
		);
	};

	const handleVariantSelect = (attributeName: string, value: string) => {
		if (!isOptionAvailable(attributeName, value)) {
			return;
		}

		setCartMessage("");
		setQuantity(1);
		setSelectedVariant((current) => {
			// Switch to a saved combination, retaining as many other selections as possible.
			const candidates = combinations.filter((item) =>
				(item.quantity ?? 1) > 0 && item.combination?.[attributeName] === value,
			);
			const matchCount = (item: ProductCombinationItem) => Object.entries(current)
				.filter(([key, selectedValue]) => key !== attributeName && item.combination[key] === selectedValue).length;
			const bestMatch = candidates.reduce<ProductCombinationItem | undefined>((best, item) =>
				!best || matchCount(item) > matchCount(best) ? item : best, undefined,
			);
			return bestMatch ? { ...bestMatch.combination } : { ...current, [attributeName]: value };
		});
	};

	return (
		<div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
			<div className="flex flex-col">
				<div className="relative mb-6 flex h-80 w-full items-center justify-center overflow-hidden rounded-20 bg-gray-200 lg:h-96 xl:h-140">
					<div className="relative h-full w-full cursor-zoom-in transition-transform duration-300" style={{ transform: `scale(${zoom / 100})` }}>
						<SafeImage unoptimized src={activeImage} alt={product.name} fill sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 45vw, 100vw" className="object-contain" />
					</div>

					{product.is_featured ? <div className="absolute left-4 top-4 rounded-full bg-primary-green px-3 py-1 text-xs font-semibold text-white">Featured</div> : null}

					<div className="absolute bottom-4 right-4 flex gap-2">
						<button
							onClick={() => setZoom(Math.max(100, zoom - 20))}
							className="cursor-pointer rounded-lg bg-white p-2 shadow transition-shadow hover:shadow-lg"
							aria-label="Zoom out"
						>
							<ZoomOut size={18} />
						</button>
						<button
							onClick={() => setZoom(Math.min(200, zoom + 20))}
							className="cursor-pointer rounded-lg bg-white p-2 shadow transition-shadow hover:shadow-lg"
							aria-label="Zoom in"
						>
							<ZoomIn size={18} />
						</button>
					</div>
				</div>

				<div className="flex justify-center gap-3 overflow-x-auto">
					{thumbnailImages.map((img, index) => (
						<button
							key={`${img}-${index}`}
							onClick={() => {
								setSelectedImageIndex(index);
								setZoom(100);
							}}
							className={cn(
								"h-20 w-20 shrink-0 overflow-hidden rounded-lg border p-1 transition-all cursor-pointer",
								selectedImageIndex === index ? "border-primary-blue" : "border-gray-200",
							)}
						>
							<SafeImage unoptimized src={img} alt={`${product.name} ${index + 1}`} width={80} height={80} className="h-full w-full object-contain" />
						</button>
					))}
				</div>
			</div>

			<div className="flex flex-col">
				<div className="mb-4 flex items-start justify-between">
					<h2 className="flex-1 text-3xl font-bold text-primary-black lg:text-4xl">{product.name}</h2>
					<div className="flex gap-2">
						<button onClick={handleCompareToggle} className="rounded-sm border bg-white p-2 transition-colors hover:bg-gray-100 cursor-pointer" aria-label="Compare product">
							<GitCompareArrows size={20} className={cn("transition-all", isInCompare ? "stroke-primary-green" : "stroke-gray-600")} />
						</button>
						<button onClick={handleShare} className="rounded-sm border bg-white p-2 transition-colors hover:bg-gray-100 cursor-pointer" aria-label="Share">
							<Forward size={20} className="text-gray-600" />
						</button>
						<button
							onClick={handleWishlistToggle}
							className="rounded-sm border bg-white p-2 transition-colors hover:bg-gray-100 cursor-pointer"
							aria-label="Add to favorites"
							disabled={isWishlistPending}
						>
							<Heart size={20} className={cn("transition-all", isFavorite ? "fill-red-500 stroke-red-500" : "stroke-gray-600")} />
						</button>
					</div>
				</div>

				<div className="mb-6 flex items-center gap-2">
					<div className="flex text-yellow-400">
						{[...Array(5)].map((_, i) => (
							<span key={i}>{i < Math.round(product.average_rating || 0) ? "★" : "☆"}</span>
						))}
					</div>
					<span className="text-sm text-primary-black">
						{product.reviews_count > 0
							? `${product.average_rating.toFixed(1)} (${product.reviews_count} review${product.reviews_count === 1 ? "" : "s"})`
							: product.is_featured
								? "Featured pick"
								: "Storefront product"}
					</span>
				</div>

				<div className="mb-6">
					<h5 className="mb-2 text-3xl font-medium">{priceText}</h5>
					{originalPrice ? (
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<span className="text-primary-body line-through">{formatAmount(originalPrice)}</span>
							{product.discount_percent && product.discount_percent > 0 ? (
								<span className="font-semibold text-primary-green">{product.discount_percent}% off</span>
							) : null}
						</div>
					) : null}
					<p className="text-sm text-primary-body">{stockText}</p>
				</div>

				<div className="mb-8 border-y py-6 leading-relaxed text-gray-700">
					{product.description ? (
						<div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
					) : (
						<p>Product details will be updated soon.</p>
					)}
				</div>

				{variantGroups.length > 0 ? (
					<div className="mb-8 space-y-4">
						{variantGroups.map((group) => (
							<div key={group.name} className="flex items-start gap-4">
								<p className="min-w-16 pt-1 text-sm font-semibold text-primary-black!">{group.name}:</p>
								<div className="flex flex-wrap gap-2">
									{group.values.map((value) => {
										const isSelected = selectedVariant[group.name] === value;
										const disabled = !isOptionAvailable(group.name, value);

										return (
											<button
												key={`${group.name}-${value}`}
												type="button"
												onClick={() => handleVariantSelect(group.name, value)}
												disabled={disabled}
												className={cn(
													"rounded-full border px-3 py-1 text-sm font-medium transition-colors",
													isSelected ? "border-primary-black bg-primary-black text-white" : "border-gray-200 bg-white text-primary-black",
													disabled ? "cursor-not-allowed opacity-40" : "hover:border-primary-black",
												)}
											>
												{value}
											</button>
										);
									})}
								</div>
							</div>
						))}
						{selectedVariantLabel ? <p className="text-sm text-primary-body">Selected: {selectedVariantLabel}</p> : null}
					</div>
				) : product.variants_display.length > 0 ? (
					<div className="mb-8 flex items-start gap-4">
						<p className="pt-1 text-sm font-semibold text-primary-black!">Variants:</p>
						<div className="flex flex-wrap gap-2">
							{product.variants_display.map((variant) => (
								<span key={variant} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-primary-black">
									{variant}
								</span>
							))}
						</div>
					</div>
				) : thumbnailImages.length > 1 ? (
					<div className="mb-8 flex items-center gap-4">
						<p className="text-sm font-semibold text-primary-black!">Gallery:</p>
						<div className="flex gap-4">
							{thumbnailImages.slice(0, 3).map((img, i) => (
								<button
									key={`${img}-${i}`}
									onClick={() => {
										setSelectedImageIndex(i);
										setZoom(100);
									}}
									className={cn(
										"w-18 h-18 shrink-0 overflow-hidden rounded-sm border bg-gray-200 p-1 transition-all hover:shadow-lg",
										selectedImageIndex === i ? "border-primary-blue" : "border-gray-300",
									)}
								>
									<SafeImage unoptimized src={img} alt={`Gallery ${i + 1}`} width={64} height={64} className="h-full w-full object-contain" />
								</button>
							))}
						</div>
					</div>
				) : null}

				<div className="mb-8 flex w-full items-center justify-between gap-6">
					<div className="flex items-center gap-4">
						<span className="text-sm font-semibold text-gray-900">Quantity:</span>
						<div className="flex items-center overflow-hidden rounded-sm border border-gray-300">
							<button onClick={() => handleQuantityChange(quantity - 1)} className="border-r px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100">
								-
							</button>
							<input
								type="number"
								value={quantity}
								onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
								className="w-12 border-0 pl-3 text-center focus:outline-none focus:ring-0"
								min="1"
							/>
							<button onClick={() => handleQuantityChange(quantity + 1)} className="border-l px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100">
								+
							</button>
						</div>
					</div>
					<div>
						<h6 className="text-xl font-medium text-primary-black">{variantLoading || variantUnavailable ? priceText : formatAmount(totalPrice)}</h6>
					</div>
				</div>

				<div className="flex flex-col gap-4 sm:flex-row">
				<Button type="button" className="h-12 flex-1 bg-black font-semibold text-white hover:bg-gray-900" onClick={handleBuyNow} disabled={purchaseDisabled}>
					Buy now
				</Button>
				<Button type="button" variant="outline" className="h-12 flex-1 border border-gray-300 font-semibold" onClick={handleAddToCart} disabled={purchaseDisabled}>
					<Handbag />
					{variantLoading ? "Loading..." : variantUnavailable ? "Unavailable" : isOutOfStock ? "Out of stock" : "Add to cart"}
				</Button>
				</div>

				{product.is_group_purchase_available ? (
					<div className="mt-4 rounded-2xl border border-[#e7dfd6] bg-[#fbf7f1] p-4">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-green">Shop Together</p>
								<p className="mt-2 text-sm text-primary-body">
									Group discount:{" "}
									{product.group_purchase_discount_type === "percent"
										? `${product.group_purchase_discount_amount || 0}% off`
										: formatAmount(product.group_purchase_discount_amount || 0)}{" "}
									with at least {product.group_purchase_minimum_user || 2} members.
								</p>
							</div>
							<Button type="button" className="bg-primary-blue text-white hover:bg-primary-black" onClick={() => router.push(`/group-purchase?product=${encodeURIComponent(product.id)}`)}>
								Start Group Purchase
							</Button>
						</div>
					</div>
				) : null}

				{cartMessage ? <p className="mt-3 text-sm font-medium text-primary-green">{cartMessage}</p> : null}

				<div className="mt-6 flex flex-wrap gap-2">
					<span className="rounded-full bg-[#f5f7fa] px-3 py-1 text-xs font-semibold text-primary-black">{badgeText}</span>
					{selectedVariantLabel ? <span className="rounded-full bg-[#f5f7fa] px-3 py-1 text-xs font-semibold text-primary-black">{selectedVariantLabel}</span> : null}
					{product.unit ? (
						<span className="rounded-full bg-[#f5f7fa] px-3 py-1 text-xs font-semibold text-primary-black">
							{product.unit.name}
							{product.unit.code ? ` (${product.unit.code})` : ""}
						</span>
					) : null}
					<span className="rounded-full bg-[#f5f7fa] px-3 py-1 text-xs font-semibold text-primary-black">VAT {product.vat}%</span>
				</div>
			</div>
		</div>
	);
}

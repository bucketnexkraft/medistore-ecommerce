"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Eye, GitCompare, Heart, Minus, Plus, ShoppingCart, Star, X } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCompare } from "@/components/providers/CompareProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { toast } from "@/hooks/use-toast";
import { useAmount } from "@/lib/amount";
import { addCartItem } from "@/lib/cart";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import { cn } from "@/lib/utils";
import type { FashionSectionProps } from "../../types";

type Category = { name: string; slug: string };

type Product = {
	id: string;
	name: string;
	slug: string;
	thumbnail?: string;
	image?: string;
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	quantity?: number;
	brand?: string;
	category?: Category | string | null;
	url?: string;
};

type Combination = {
	id: string | number;
	combination: Record<string, string>;
	quantity: number;
	price: number | null;
};

type ProductDetails = {
	id: string | number;
	thumbnail?: string;
	featured_image?: string;
	gallery?: string[];
	images?: string[];
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	available_quantity: number;
	has_variant?: boolean;
	combinations?: Combination[];
	brand?: { name: string } | null;
	category?: Category | null;
	vat?: number;
	description?: string;
	average_rating?: number;
	reviews_count?: number;
};

const placeholder = "/images/placeholder.jpg";
const gridClass = "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 lg:gap-4";
const purchaseButtonClass = "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:bg-neutral-100 disabled:text-neutral-500 sm:min-h-12 sm:px-3 sm:text-sm";
const actionButtonClass = "flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md backdrop-blur-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50 motion-safe:hover:scale-105 motion-safe:active:scale-95 sm:size-11";
const quantityButtonClass = "flex size-11 cursor-pointer items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:text-neutral-300 disabled:hover:bg-transparent";

const filterKeys = {
	category_id: "category",
	brand_id: "brand",
	min_price: "minPrice",
	max_price: "maxPrice",
	demand_tag: "demand_tag",
	in_stock: "stock",
	sort_by: "sort",
} as const;

const sortAliases: Record<string, string> = {
	price_asc: "price-low-high",
	price_desc: "price-high-low",
	name_asc: "name-a-z",
	name_desc: "name-z-a",
	latest: "newest",
};

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown, fallback = "") {
	return String(value ?? "").trim() || fallback;
}

function catalogParams(filters: Record<string, unknown>, demoOnly?: boolean) {
	const params = new URLSearchParams();
	if (demoOnly) params.set("is_demo", "1");
	for (const [key, param] of Object.entries(filterKeys)) {
		let value = textValue(filters[key]);
		if (!value) continue;
		if (param === "sort" || param === "demand_tag" || param === "stock") value = value.toLowerCase();
		if (param === "sort") value = sortAliases[value] || value;
		if (param === "stock") {
			if (["1", "true", "yes", "in_stock"].includes(value)) value = "in-stock";
			if (["0", "false", "no", "out_of_stock"].includes(value)) value = "out-of-stock";
		}
		params.set(param, value);
	}
	return params;
}

function productImage(product: Product) {
	return product.thumbnail || product.image || placeholder;
}

function productHref(product: Product) {
	return product.url || `/product/${encodeURIComponent(product.slug)}`;
}

function stockQuantity(quantity?: number) {
	return Math.max(0, Math.floor(Number(quantity) || 0));
}

function originalPrice(price: number, original?: number | null) {
	const amount = Number(original);
	return Number.isFinite(amount) && amount > price ? amount : null;
}

function requiresOptions(details: ProductDetails) {
	return Boolean(details.has_variant || details.combinations?.length);
}

async function loadDetails(product: Product, host: string | null, demoOnly?: boolean) {
	const query = demoOnly ? "?is_demo=1" : "";
	const result = await fetchStorefrontJson<{ data?: ProductDetails }>(`/landing/products/${encodeURIComponent(product.slug)}${query}`, host);
	const details = result?.data;
	return details && String(details.id) === String(product.id) ? details : null;
}

function availableStock(details: ProductDetails, variant?: Combination) {
	return stockQuantity(variant ? Math.min(variant.quantity, details.available_quantity) : details.available_quantity);
}

function addProductToCart(product: Product, details: ProductDetails, variant?: Combination, quantity = 1) {
	const price = variant ? variant.price : details.price;
	const available = availableStock(details, variant);
	if (available < 1 || price == null || !Number.isFinite(price)) {
		toast({ title: "Product unavailable", description: product.name });
		return false;
	}

	const selection = variant ? Object.fromEntries(Object.entries(variant.combination).map(([key, value]) => [key, String(value)])) : undefined;
	addCartItem({
		id: String(product.id),
		slug: product.slug,
		name: product.name,
		price,
		taxRate: details.vat,
		image: details.featured_image || details.thumbnail || productImage(product),
		quantity: Math.min(quantity, available),
		maxQuantity: available,
		brand: details.brand?.name || product.brand || null,
		category: details.category || (typeof product.category === "object" ? product.category : null),
		variantSelection: selection,
		variantLabel: variant ? combinationLabel(variant) : undefined,
	});
	return true;
}

function combinationLabel(variant: Combination) {
	return Object.entries(variant.combination).map(([attribute, value]) => `${attribute}: ${value}`).join(", ");
}

function Price({ price, original, large }: { price: number; original?: number | null; large?: boolean }) {
	const { formatAmount } = useAmount();
	const previous = originalPrice(price, original);

	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
			<span className={cn("font-bold", large ? "text-2xl sm:text-3xl" : "text-sm sm:text-lg", previous === null ? "text-neutral-900" : "text-red-700")}>{formatAmount(price)}</span>
			{previous !== null && <s className={cn("text-neutral-500", large ? "text-sm sm:text-base" : "text-xs")}>{formatAmount(previous)}</s>}
		</div>
	);
}

type DetailsLoader = (product: Product) => Promise<ProductDetails | null>;
type OpenProduct = { product: Product; details?: ProductDetails };

function WishlistButton({ product, card }: { product: Product; card?: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	const { isAuthenticated } = useAuth();
	const { isWishlisted, isMutating, toggleItem } = useWishlist();
	const id = String(product.id);
	const favorite = isWishlisted(id) || isWishlisted(product.slug);

	async function handleWishlist() {
		if (!isAuthenticated) {
			router.push(`/signin?redirect=${encodeURIComponent(pathname || "/")}`);
			return;
		}

		const success = await toggleItem({ productId: id, productSlug: product.slug });
		toast({
			title: success ? (favorite ? "Removed from wishlist" : "Added to wishlist") : "Wishlist update failed",
			description: product.name,
		});
	}

	return (
		<button
			type="button"
			onClick={() => void handleWishlist()}
			disabled={isMutating(id)}
			aria-label="Wishlist"
			aria-pressed={favorite}
			className={cn(
				card ? actionButtonClass : "flex size-11 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50",
				"hover:text-red-700",
				favorite && "text-red-700",
			)}
		>
			<Heart aria-hidden="true" className={cn(card ? "size-3.5 sm:size-4" : "size-5", favorite && "fill-current")} />
		</button>
	);
}

function ProductCard({ product, getDetails, onQuickView }: {
	product: Product;
	getDetails: DetailsLoader;
	onQuickView: (selection: OpenProduct) => void;
}) {
	const { isCompared, toggleItem: toggleCompare, maxItems } = useCompare();
	const [alternate, setAlternate] = useState<string | null>();
	const [adding, setAdding] = useState(false);
	const [feedback, setFeedback] = useState<"button" | "image" | null>(null);
	const hoverTimer = useRef<number | undefined>(undefined);
	const addPending = useRef(false);
	const id = String(product.id);
	const href = productHref(product);
	const image = productImage(product);
	const quantity = stockQuantity(product.quantity);
	const outOfStock = product.quantity != null && quantity < 1;
	const compared = isCompared(id) || isCompared(product.slug);
	const price = Number(product.price);
	const previous = originalPrice(price, product.original_price);
	const discount = previous !== null
		? Math.round((1 - price / previous) * 100)
		: Math.round(Number(product.discount_percent) || 0);

	useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
	useEffect(() => {
		if (!feedback) return;
		const timer = window.setTimeout(() => setFeedback(feedback === "button" ? "image" : null), 1000);
		return () => window.clearTimeout(timer);
	}, [feedback]);

	function previewOnHover(event: PointerEvent<HTMLElement>) {
		if (alternate !== undefined || event.pointerType !== "mouse") return;
		hoverTimer.current = window.setTimeout(async () => {
			const details = await getDetails(product);
			if (!details) return;
			const otherImage = [...(details.gallery ?? []), ...(details.images ?? [])].find(
				(url) => url && url !== image && url !== details.thumbnail && url !== details.featured_image && url !== placeholder,
			);
			setAlternate(otherImage ?? null);
		}, 180);
	}

	function handleCompare() {
		const result = toggleCompare({
			product_id: id,
			slug: product.slug,
			name: product.name,
			thumbnail: image,
			price,
			available_quantity: quantity,
			brand: product.brand ? { name: product.brand } : null,
			category: typeof product.category === "string" ? { name: product.category } : product.category,
			url: href,
		});
		if (result.reason === "limit") {
			toast({ title: "Compare list is full", description: `You can compare up to ${maxItems} products at a time.` });
		} else if (result.success) {
			toast({ title: result.added ? "Added to compare" : "Removed from compare", description: product.name });
		}
	}

	async function handleAddToCart() {
		if (addPending.current) return;
		addPending.current = true;
		setAdding(true);
		try {
			const details = await getDetails(product);
			if (!details) {
				toast({ title: "Could not load product options", description: product.name });
				return;
			}
			if (requiresOptions(details)) {
				onQuickView({ product, details });
			} else if (addProductToCart(product, details)) {
				setFeedback("button");
			}
		} catch {
			toast({ title: "Could not add to cart", description: product.name });
		} finally {
			addPending.current = false;
			setAdding(false);
		}
	}

	return (
		<article
			className="group flex min-w-0 flex-col rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-lg motion-safe:transition-[box-shadow,translate] motion-safe:hover:-translate-y-1"
			onPointerEnter={previewOnHover}
			onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
		>
			<div className="relative aspect-square overflow-hidden rounded-t-[inherit] bg-neutral-100">
				<Link href={href} aria-label={product.name} className="absolute inset-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
					<SafeImage src={image} alt="" fallbackSrc={placeholder} fill unoptimized sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw" className="object-contain p-2 sm:p-3" />
					{alternate && (
						<div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none">
							<SafeImage src={alternate} alt="" fallbackSrc={image} fill unoptimized className="object-contain p-2 sm:p-3" />
						</div>
					)}
				</Link>
				{discount > 0 && <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-red-700 px-2 py-1 text-[10px] leading-none font-bold text-white sm:text-xs">−{discount}%</span>}
				<div className="absolute top-2 right-2 z-30 flex flex-col gap-0.5 sm:top-3 sm:right-3">
					<WishlistButton product={product} card />
					<button
						type="button"
						onClick={handleCompare}
						aria-label="Compare"
						aria-pressed={compared}
						title={compared ? "Remove from compare" : "Add to compare"}
						className={cn(
							actionButtonClass,
							"focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
							compared ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-white text-neutral-800 hover:bg-neutral-100",
						)}
					>
						<GitCompare aria-hidden="true" className="size-3.5 sm:size-4" />
					</button>
				</div>
				<button
					type="button"
					onClick={() => onQuickView({ product })}
					aria-haspopup="dialog"
					className="absolute inset-x-2 bottom-2 z-10 flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-white px-2 text-xs font-semibold text-neutral-900 shadow-sm transition-opacity hover:text-primary focus-visible:outline-2 focus-visible:outline-primary sm:text-sm pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-hover:pointer-events-auto pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:pointer-events-auto pointer-fine:group-focus-within:opacity-100"
				>
					<Eye aria-hidden="true" className="size-4 shrink-0" /> Quick View
				</button>
				{feedback && (
					<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-emerald-500/20 backdrop-blur-sm">
						<span className="grid size-14 place-items-center rounded-full bg-emerald-700 text-white shadow-lg motion-safe:animate-bounce sm:size-16">
							<Check className="size-7 sm:size-8" strokeWidth={3} />
						</span>
					</div>
				)}
			</div>
			<div className="flex flex-1 flex-col gap-2 p-2.5 sm:gap-3 sm:p-3.5">
				<div>
					{product.brand && <div className="mb-1 truncate text-[10px] font-medium tracking-wide text-neutral-500 uppercase sm:text-xs">{product.brand}</div>}
					<h3 className="text-xs leading-snug font-semibold text-neutral-900 sm:text-sm">
						<Link href={href} className="line-clamp-2 transition-colors group-hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{product.name}</Link>
					</h3>
				</div>
				<div className="mt-auto"><Price price={price} original={previous} /></div>
				<button
					type="button"
					onFocus={() => { if (!addPending.current) void getDetails(product); }}
					onPointerDown={(event) => { if (event.button === 0 && !addPending.current) void getDetails(product); }}
					onClick={() => void handleAddToCart()}
					aria-busy={adding || undefined}
					aria-disabled={adding || undefined}
					disabled={outOfStock || feedback === "button"}
					className={cn(purchaseButtonClass, feedback === "button" && "disabled:bg-emerald-700 disabled:text-white")}
				>
					{feedback === "button" ? <Check aria-hidden="true" className="size-4 shrink-0" /> : <ShoppingCart aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />}
					{feedback === "button" ? "Added to Cart!" : outOfStock ? "Out of stock" : "Add to Cart"}
				</button>
				<span role="status" className="sr-only">{feedback ? `${product.name} added to cart.` : ""}</span>
			</div>
		</article>
	);
}

function descriptionText(html?: string) {
	if (!html || typeof document === "undefined") return "";
	const template = document.createElement("template");
	template.innerHTML = html;
	template.content.querySelectorAll("script, style").forEach((element) => element.remove());
	return template.content.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function QuickViewGallery({ images, name }: { images: string[]; name: string }) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const image = images[selectedIndex] ?? images[0];
	const galleryArrowClass = "absolute top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-primary";

	return (
		<div className="min-w-0 space-y-3">
			<div className="relative aspect-square max-h-[42dvh] overflow-hidden rounded-xl bg-neutral-100 md:max-h-none">
				<SafeImage src={image} alt={name} fallbackSrc={placeholder} fill unoptimized sizes="(min-width: 768px) 400px, 90vw" className="object-contain p-3" />
				{images.length > 1 && (
					<>
						<button type="button" aria-label="Previous image" onClick={() => setSelectedIndex((selectedIndex - 1 + images.length) % images.length)} className={cn(galleryArrowClass, "left-2")}>
							<ChevronLeft aria-hidden="true" className="size-5" />
						</button>
						<button type="button" aria-label="Next image" onClick={() => setSelectedIndex((selectedIndex + 1) % images.length)} className={cn(galleryArrowClass, "right-2")}>
							<ChevronRight aria-hidden="true" className="size-5" />
						</button>
					</>
				)}
			</div>
			{images.length > 1 && (
				<div className="flex gap-2 overflow-x-auto p-1">
					{images.map((src, index) => (
						<button
							key={src}
							type="button"
							onClick={() => setSelectedIndex(index)}
							aria-label={`Show image ${index + 1}`}
							aria-pressed={selectedIndex === index}
							className={cn("relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:size-16", selectedIndex === index && "border-primary ring-1 ring-primary")}
						>
							<SafeImage src={src} alt="" fallbackSrc={placeholder} fill unoptimized sizes="64px" className="object-contain" />
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function QuickView({ selection, getDetails, onClose }: {
	selection: OpenProduct;
	getDetails: DetailsLoader;
	onClose: () => void;
}) {
	const { product, details: initialDetails } = selection;
	const [details, setDetails] = useState<ProductDetails | null | undefined>(initialDetails);
	const [variantId, setVariantId] = useState("");
	const [quantity, setQuantity] = useState(1);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();

	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.open) dialog.showModal();
	}, []);

	useEffect(() => {
		if (initialDetails) return;
		let active = true;
		void getDetails(product).then((result) => {
			if (active) setDetails(result);
		});
		return () => { active = false; };
	}, [getDetails, initialDetails, product]);

	const variants = details?.combinations ?? [];
	const variant = variants.find((option) => String(option.id) === variantId);
	const price = variant?.price ?? details?.price ?? product.price;
	const needsOptions = details ? requiresOptions(details) : false;
	const stock = details ? availableStock(details, variant) : 0;
	const unavailable = Boolean(details && (stock < 1 || (variant && variant.price === null)));
	const canPurchase = details && (!needsOptions || variant) && !unavailable;
	const selectedQuantity = Math.min(quantity, Math.max(1, stock));
	const description = useMemo(() => descriptionText(details?.description), [details?.description]);
	const images = [...new Set([
		details?.featured_image || details?.thumbnail || productImage(product),
		...(details?.gallery ?? []),
		...(details?.images ?? []),
	].filter(Boolean))];
	const brand = details?.brand?.name || product.brand;
	const reviewCount = Math.max(0, Number(details?.reviews_count) || 0);
	const rating = Math.min(5, Math.max(0, Number(details?.average_rating) || 0));

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			onClose={onClose}
			onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
			className="fixed inset-0 m-auto max-h-[90dvh] w-11/12 max-w-4xl overflow-y-auto overscroll-contain rounded-2xl bg-white text-neutral-900 shadow-xl backdrop:bg-black/50"
		>
			<div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2 sm:px-6">
				<h2 id={titleId} className="text-lg font-semibold">Quick View</h2>
				<form method="dialog">
					<button type="submit" aria-label="Close quick view" className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-primary">
						<X aria-hidden="true" className="size-5" />
					</button>
				</form>
			</div>
			<div className="grid gap-5 p-4 md:grid-cols-2 md:gap-7 md:p-6">
				<QuickViewGallery images={images} name={product.name} />
				<div className="min-w-0 space-y-3">
					{brand && <div className="text-sm text-neutral-600">{brand}</div>}
					<h3 className="text-xl leading-tight font-bold sm:text-2xl">{product.name}</h3>
					{details && (
						<div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
							<span className="flex gap-0.5" aria-label={`Rated ${rating} out of 5`} role="img">
								{Array.from({ length: 5 }, (_, index) => (
									<Star key={index} aria-hidden="true" className={cn("size-4 text-neutral-300", index < Math.round(rating) && "fill-amber-400 text-amber-500")} />
								))}
							</span>
							<span>({reviewCount} {reviewCount === 1 ? "review" : "reviews"})</span>
						</div>
					)}
					<Price price={price} original={variant ? null : details?.original_price ?? product.original_price} large />
					{description && <div className="line-clamp-4 text-sm leading-relaxed wrap-break-word text-neutral-600">{description}</div>}
					{details === undefined && <div role="status" className="text-sm text-neutral-600">Loading product details…</div>}
					{details === null && <div role="status" className="text-sm text-neutral-600">Product details are temporarily unavailable.</div>}
					{details && (
						<div className="flex flex-wrap items-center gap-x-2 text-sm">
							<span className="text-neutral-600">Availability:</span>
							<span className={cn("font-semibold", unavailable ? "text-red-700" : "text-emerald-700")}>{unavailable ? "Out of Stock" : "In Stock"}</span>
						</div>
					)}
					{variants.length > 0 && (
						<label className="block space-y-1.5 text-sm font-medium">
							<span>Product options</span>
							<select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="min-h-11 w-full rounded-lg border border-neutral-300 px-2">
								<option value="">Choose an option</option>
								{variants.map((option) => {
									const soldOut = !details || availableStock(details, option) < 1 || option.price == null;
									return <option key={option.id} value={String(option.id)} disabled={soldOut}>{combinationLabel(option)}{soldOut ? " (Unavailable)" : ""}</option>;
								})}
							</select>
						</label>
					)}
					{needsOptions && !variants.length && <div className="text-sm text-neutral-600">See available options on the product page.</div>}
					{details && (
						<>
							<div className="flex flex-wrap items-center gap-3">
								<div role="group" aria-label="Quantity" className="inline-flex items-center rounded-lg border border-neutral-200">
									<button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(selectedQuantity - 1)} disabled={!canPurchase || selectedQuantity <= 1} className={quantityButtonClass}>
										<Minus aria-hidden="true" className="size-4" />
									</button>
									<output className="min-w-8 text-center text-sm font-medium tabular-nums">{selectedQuantity}</output>
									<button type="button" aria-label="Increase quantity" onClick={() => setQuantity(selectedQuantity + 1)} disabled={!canPurchase || selectedQuantity >= stock} className={quantityButtonClass}>
										<Plus aria-hidden="true" className="size-4" />
									</button>
								</div>
								<WishlistButton product={product} />
							</div>
							<button type="button" disabled={!canPurchase} onClick={() => { if (canPurchase && addProductToCart(product, details, variant, selectedQuantity)) dialogRef.current?.close(); }} className={purchaseButtonClass}>
								<ShoppingCart aria-hidden="true" className="size-5" />
								{unavailable ? "Out of Stock" : "Add to Cart"}
							</button>
						</>
					)}
					<Link href={productHref(product)} className="flex min-h-10 items-center justify-center text-sm font-semibold text-primary hover:underline">
						View Full Details
					</Link>
				</div>
			</div>
		</dialog>
	);
}

function ProductSkeleton({ count }: { count: number }) {
	return (
		<div className={gridClass} aria-hidden="true">
			{Array.from({ length: count }, (_, index) => (
				<div key={index} className="overflow-hidden rounded-xl border border-neutral-200 bg-white motion-safe:animate-pulse">
					<div className="aspect-square bg-neutral-100" />
					<div className="space-y-2 p-2.5 sm:p-3.5">
						<div className="h-8 w-4/5 rounded bg-neutral-100" />
						<div className="h-5 w-1/2 rounded bg-neutral-100" />
						<div className="h-11 rounded-lg bg-neutral-100" />
					</div>
				</div>
			))}
		</div>
	);
}

function ProductCards({ products, getDetails }: { products: Product[]; getDetails: DetailsLoader }) {
	const [quickView, setQuickView] = useState<OpenProduct | null>(null);

	return (
		<>
			<div className={gridClass}>
				{products.map((product) => (
					<ProductCard key={product.id} product={product} getDetails={getDetails} onQuickView={setQuickView} />
				))}
			</div>
			{quickView && <QuickView selection={quickView} getDetails={getDetails} onClose={() => setQuickView(null)} />}
		</>
	);
}

export default function ProductsGrid({ section, host, demoOnly }: FashionSectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const data = asRecord(config.data);
	const params = catalogParams(asRecord(data.filter), demoOnly);
	const maxItems = demoOnly ? 5 : 24;
	const itemsAllow = Math.max(1, Math.min(maxItems, Math.trunc(Number(data.items_allow) || 8)));
	const catalogSearch = params.toString();
	params.set("perPage", String(itemsAllow));
	const query = textValue(data.data_model, "products") === "products" ? params.toString() : "";
	const [catalog, setCatalog] = useState<{ host: string | null; query: string; products: Product[] } | null>(null);
	const headingId = useId();
	const current = query && catalog?.query === query && catalog.host === host ? catalog : null;
	const loading = Boolean(query && !current);
	const heading = textValue(content.heading, textValue(section.title, "Products"));
	const subheading = textValue(content.subheading, textValue(section.subtitle, "Browse products from this store."));
	const viewAll = textValue(content.button_link, catalogSearch ? `/products?${catalogSearch}` : "/products");
	const getDetails = useCallback((product: Product) => loadDetails(product, host, demoOnly), [host, demoOnly]);

	useEffect(() => {
		if (!query) return;
		let active = true;
		void fetchStorefrontJson<{ data?: { products?: Product[] } }>(`/landing/products?${query}`, host).then((result) => {
			if (active) {
				const products = result?.data?.products;
				setCatalog({ host, query, products: Array.isArray(products) ? products : [] });
			}
		});
		return () => { active = false; };
	}, [host, query]);

	return (
		<section data-storefront-section="fashion-apparel-products-grid" aria-labelledby={headingId} className="bg-neutral-50 py-8 md:py-12">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 md:mb-8">
					<div className="min-w-0">
						<h2 id={headingId} className="text-2xl leading-tight font-bold text-neutral-900 md:text-3xl">{heading}</h2>
						<p className="mt-1 text-sm font-normal! text-neutral-600! md:text-base">{subheading}</p>
					</div>
					<Link href={viewAll} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary md:text-base">
						{textValue(content.button_text, "View All")} <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
					</Link>
				</div>
				{loading ? (
					<ProductSkeleton count={Math.min(itemsAllow, 5)} />
				) : current?.products.length ? (
					<ProductCards products={current.products} getDetails={getDetails} />
				) : (
					<div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-600">No products found.</div>
				)}
			</div>
		</section>
	);
}

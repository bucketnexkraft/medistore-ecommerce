"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Forward, GitCompareArrows, Heart, Minus, Package, Plus, ShieldCheck, Truck } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import StorefrontProductCard from "@/components/common/product/StorefrontProductCard";
import { useAmount } from "@/lib/amount";
import { cn } from "@/lib/utils";
import { useCompare } from "@/components/providers/CompareProvider";
import { toast } from "@/hooks/use-toast";
import { trackStorefrontEvent } from "@/lib/analytics";

type RelatedProduct = {
	id: string;
	name: string;
	slug: string;
	thumbnail: string;
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	quantity: number;
	brand: string;
	category: {
		name: string;
		slug: string;
	} | null;
	url: string;
};

export type ProductDetailsData = {
	id: string;
	name: string;
	slug: string;
	code: string | null;
	thumbnail: string;
	featured_image: string;
	images: string[];
	gallery: string[];
	category: {
		id: string;
		name: string;
		slug: string;
	} | null;
	brand: {
		id: string;
		name: string;
		slug: string;
	} | null;
	unit: {
		id: string;
		name: string;
		code: string;
	} | null;
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	description: string;
	return_enabled: boolean;
	return_day: number | null;
	return_condition: string[];
	is_featured: boolean;
	demand_tags: string[];
	sales_channel: Record<string, number>;
	vat: number;
	has_variant: boolean;
	variants: Array<Record<string, string>>;
	variants_display: string[];
	available_quantity: number;
	raw_total_quantity: number;
	stock_visibility: boolean;
	stock_visibility_label: string | null;
	stock_display: {
		stock_visibility: boolean;
		stock_visibility_label: string | null;
		stock_quantity: number | null;
		stock_display: string | null;
	};
	related_products: RelatedProduct[];
};

const TABS = [
	{ id: "overview", label: "Overview", icon: Package },
	{ id: "specs", label: "Specifications", icon: ShieldCheck },
	{ id: "delivery", label: "Delivery", icon: Truck },
] as const;

export default function ProductDetailsView({ product }: { product: ProductDetailsData }) {
	const [selectedImageIndex, setSelectedImageIndex] = useState(0);
	const [quantity, setQuantity] = useState(1);
	const [isFavorite, setIsFavorite] = useState(false);
	const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("overview");
	const { formatAmount } = useAmount();
	const { isCompared, toggleItem, maxItems } = useCompare();
	const formatStock = (stock: number) => Math.max(0, Math.floor(Number(stock) || 0));

	const gallery = product.gallery.length > 0 ? product.gallery : [product.featured_image || product.thumbnail || "/images/placeholder.jpg"];
	const selectedImage = gallery[selectedImageIndex] || gallery[0];
	const totalPrice = useMemo(() => product.price * quantity, [product.price, quantity]);
	const stockText = product.stock_display?.stock_display || product.stock_visibility_label || "Stock info unavailable";
	const originalPrice = product.original_price && product.original_price > product.price ? product.original_price : null;
	const isInCompare = isCompared(product.id) || isCompared(product.slug);
	const normalizedReturnConditions = Array.isArray(product.return_condition)
		? product.return_condition.filter((item) => item.trim() !== "")
		: [];

	useEffect(() => {
		trackStorefrontEvent("view_item", {
			productId: product.id,
			productName: product.name,
			value: product.price,
			metadata: { category: product.category?.name, brand: product.brand?.name },
		});
	}, [product.id, product.name, product.price, product.category?.name, product.brand?.name]);

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
					text: `Check out ${product.name}`,
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

	const handleCompareToggle = () => {
		const result = toggleItem({
			product_id: product.id,
			slug: product.slug,
			name: product.name,
			thumbnail: product.featured_image || product.thumbnail,
			price: product.price,
			brand: product.brand ? { name: product.brand.name } : null,
			category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
			available_quantity: product.available_quantity,
			stock_label: stockText,
			url: `/product/${product.slug}`,
			code: product.code,
			unit: product.unit ? `${product.unit.name}${product.unit.code ? ` (${product.unit.code})` : ""}` : null,
			vat: product.vat,
			description: product.description,
			variants_display: product.variants_display,
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

	return (
		<div className="space-y-12">
			<div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr]">
				<div>
					<div className="relative mb-5 flex min-h-[360px] items-center justify-center overflow-hidden rounded-[28px] border border-gray-200 bg-[#f6f8fb] p-6 md:min-h-[520px]">
						<SafeImage
							unoptimized
							src={selectedImage}
							alt={product.name}
							width={520}
							height={520}
							className="max-h-[440px] w-auto object-contain"
						/>

						{product.is_featured ? (
							<div className="absolute left-5 top-5 rounded-full bg-primary-green px-3 py-1 text-xs font-semibold text-white">Featured</div>
						) : null}
					</div>

					<div className="flex gap-3 overflow-x-auto pb-1">
						{gallery.map((image, index) => (
							<button
								key={`${image}-${index}`}
								onClick={() => setSelectedImageIndex(index)}
								className={cn(
									"relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-white p-2 transition-all",
									selectedImageIndex === index ? "border-primary-green shadow-sm" : "border-gray-200",
								)}
							>
								<SafeImage unoptimized src={image} alt={`${product.name} ${index + 1}`} fill sizes="96px" className="object-contain p-2" />
							</button>
						))}
					</div>
				</div>

				<div className="rounded-[28px] border border-gray-200 bg-white p-6 md:p-8">
					<div className="flex items-start justify-between gap-4">
						<div>
							<div className="flex flex-wrap items-center gap-2 text-sm text-primary-body">
								{product.category ? <Link href={`/categories/${product.category.slug}`}>{product.category.name}</Link> : <span>Product</span>}
								{product.brand ? <span className="rounded-full bg-[#f5f7fa] px-3 py-1 font-medium text-primary-black">{product.brand.name}</span> : null}
							</div>
							<h1 className="mt-3 text-3xl font-bold text-primary-black md:text-4xl">{product.name}</h1>
						</div>

						<div className="flex gap-2">
							<button
								onClick={handleCompareToggle}
								className="rounded-full border border-gray-200 p-2.5 transition-colors hover:bg-gray-50"
								aria-label="Compare product"
							>
								<GitCompareArrows className={cn("h-5 w-5", isInCompare ? "text-primary-green" : "text-primary-body")} />
							</button>
							<button onClick={handleShare} className="rounded-full border border-gray-200 p-2.5 transition-colors hover:bg-gray-50" aria-label="Share product">
								<Forward className="h-5 w-5 text-primary-body" />
							</button>
							<button
								onClick={() => setIsFavorite((current) => !current)}
								className="rounded-full border border-gray-200 p-2.5 transition-colors hover:bg-gray-50"
								aria-label="Wishlist"
							>
								<Heart className={cn("h-5 w-5", isFavorite ? "fill-red-500 stroke-red-500" : "text-primary-body")} />
							</button>
						</div>
					</div>

					<div className="mt-5 flex flex-wrap gap-3">
						{product.code ? <InfoChip label="SKU" value={product.code} /> : null}
						{product.unit ? <InfoChip label="Unit" value={`${product.unit.name}${product.unit.code ? ` (${product.unit.code})` : ""}`} /> : null}
						<InfoChip label="VAT" value={`${product.vat}%`} />
					</div>

					<div className="mt-6">
						<p className="text-3xl font-bold text-primary-black">{formatAmount(product.price)}</p>
						{originalPrice ? (
							<div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
								<span className="text-primary-body line-through">{formatAmount(originalPrice)}</span>
								{product.discount_percent && product.discount_percent > 0 ? (
									<span className="font-semibold text-primary-green">{product.discount_percent}% off</span>
								) : null}
							</div>
						) : null}
						<p className="mt-2 text-sm text-primary-body">{stockText}</p>
					</div>

					{product.demand_tags.length > 0 ? (
						<div className="mt-6">
							<p className="mb-3 text-sm font-semibold text-primary-black">Demand tags</p>
							<div className="flex flex-wrap gap-2">
								{product.demand_tags.map((tag) => (
									<span key={tag} className="rounded-full bg-[#eefbf0] px-3 py-1 text-xs font-semibold capitalize text-primary-green">
										{tag.replaceAll("_", " ")}
									</span>
								))}
							</div>
						</div>
					) : null}

					{product.variants_display.length > 0 ? (
						<div className="mt-6">
							<p className="mb-3 text-sm font-semibold text-primary-black">Available variants</p>
							<div className="flex flex-wrap gap-2">
								{product.variants_display.map((variant) => (
									<span key={variant} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-primary-body">
										{variant}
									</span>
								))}
							</div>
						</div>
					) : null}

					<div className="mt-8 flex flex-col gap-5 border-y border-gray-100 py-6 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-sm font-semibold text-primary-black">Quantity</p>
							<div className="mt-2 inline-flex items-center overflow-hidden rounded-full border border-gray-200">
								<button
									onClick={() => setQuantity((current) => Math.max(1, current - 1))}
									className="px-4 py-2 text-primary-body transition-colors hover:bg-gray-50"
								>
									<Minus className="h-4 w-4" />
								</button>
								<span className="min-w-12 px-4 text-center text-sm font-semibold text-primary-black">{quantity}</span>
								<button onClick={() => setQuantity((current) => current + 1)} className="px-4 py-2 text-primary-body transition-colors hover:bg-gray-50">
									<Plus className="h-4 w-4" />
								</button>
							</div>
						</div>

						<div className="text-right">
							<p className="text-sm text-primary-body">Subtotal</p>
							<p className="text-2xl font-bold text-primary-black">{formatAmount(totalPrice)}</p>
						</div>
					</div>

					<div className="mt-6 grid gap-3 sm:grid-cols-2">
						<button className="rounded-full bg-[#212124] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">Buy Now</button>
						<button className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-primary-black transition-colors hover:border-primary-green hover:text-primary-green">
							Add to Cart
						</button>
					</div>
				</div>
			</div>

			<div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white">
				<div className="grid grid-cols-3 border-b border-gray-200">
					{TABS.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;

						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									"flex items-center justify-center gap-2 px-4 py-5 text-sm font-semibold transition-colors",
									isActive ? "border-b border-primary-black text-primary-black" : "text-primary-body hover:text-primary-black",
								)}
							>
								<Icon className="h-4 w-4" />
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>

				<div className="p-6 md:p-8">
					{activeTab === "overview" ? (
						<div className="space-y-6">
							<div>
								<h3 className="text-lg font-bold text-primary-black">Description</h3>
								<div className="mt-3 leading-7 text-primary-body">
									{product.description ? (
										<div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
									) : (
										<p>Detailed product description will be added soon.</p>
									)}
								</div>
							</div>

							{product.sales_channel && Object.keys(product.sales_channel).length > 0 ? (
								<div>
									<h3 className="text-lg font-bold text-primary-black">Sales channel allocation</h3>
									<div className="mt-4 grid gap-3 sm:grid-cols-3">
										{Object.entries(product.sales_channel).map(([channel, percentage]) => (
											<div key={channel} className="rounded-2xl bg-[#f8fafc] p-4">
												<p className="text-sm font-medium capitalize text-primary-body">{channel.replaceAll("_", " ")}</p>
												<p className="mt-2 text-xl font-bold text-primary-black">{percentage}%</p>
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					) : null}

					{activeTab === "specs" ? (
						<div className="grid gap-4 md:grid-cols-2">
							<SpecRow label="Product name" value={product.name} />
							<SpecRow label="SKU" value={product.code || "N/A"} />
							<SpecRow label="Category" value={product.category?.name || "N/A"} />
							<SpecRow label="Brand" value={product.brand?.name || "N/A"} />
							<SpecRow label="Unit" value={product.unit ? `${product.unit.name} (${product.unit.code})` : "N/A"} />
							<SpecRow label="Stock" value={stockText} />
							<SpecRow label="Available quantity" value={product.available_quantity} />
							<SpecRow label="Variant enabled" value={product.has_variant ? "Yes" : "No"} />
						</div>
					) : null}

					{activeTab === "delivery" ? (
						<div className="space-y-4 text-primary-body">
							<div className="rounded-2xl bg-[#f8fafc] p-5">
								<p className="font-semibold text-primary-black">Return Policy</p>
								<div className="mt-2 leading-7">
									{product.return_enabled ? (
										<div className="space-y-3">
											<p>
												{product.return_day && product.return_day > 0
													? `Returns are available within ${product.return_day} day${product.return_day === 1 ? "" : "s"} of delivery.`
													: "This product is currently marked as returnable."}
											</p>
											{normalizedReturnConditions.length > 0 ? (
												<ul className="list-disc space-y-2 pl-5">
													{normalizedReturnConditions.map((condition) => (
														<li key={condition}>{condition}</li>
													))}
												</ul>
											) : (
												<p>Return approval may depend on item condition and seller verification.</p>
											)}
										</div>
									) : (
										<p>This product is currently not marked as returnable. If you receive a damaged or incorrect item, please contact support with your order details for assistance.</p>
									)}
								</div>
							</div>
						</div>
					) : null}
				</div>
			</div>

			{product.related_products.length > 0 ? (
				<section>
					<div className="mb-6 flex items-center justify-between gap-4">
						<div>
							<h2 className="text-2xl font-bold text-primary-black">Related Products</h2>
							<p className="mt-1 text-sm text-primary-body">More items from the same category.</p>
						</div>
					</div>

					<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
						{product.related_products.map((item) => (
							<StorefrontProductCard
								key={item.id}
								productId={item.id}
								productSlug={item.slug}
								href={item.url}
								name={item.name}
								imageSrc={item.thumbnail || "/images/placeholder.jpg"}
								badgeText={item.brand || item.category?.name || "Product"}
								metaText={item.quantity > 0 ? `${formatStock(item.quantity)}` : "0"}
								price={item.price}
								originalPrice={item.original_price && item.original_price > item.price ? item.original_price : undefined}
								footerText={item.quantity > 0 ? `${formatStock(item.quantity)} available in stock` : "Currently out of stock"}
								availableQuantity={formatStock(item.quantity)}
							/>
						))}
					</div>
				</section>
			) : null}
		</div>
	);
}

function InfoChip({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-full bg-[#f5f7fa] px-4 py-2 text-sm">
			<span className="font-medium text-primary-body">{label}: </span>
			<span className="font-semibold text-primary-black">{value}</span>
		</div>
	);
}

function SpecRow({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-2xl border border-gray-100 bg-[#fbfcfd] p-4">
			<p className="text-sm font-medium text-primary-body">{label}</p>
			<p className="mt-2 text-base font-semibold text-primary-black">{value}</p>
		</div>
	);
}

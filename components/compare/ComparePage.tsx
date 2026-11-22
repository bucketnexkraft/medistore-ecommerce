"use client";

import Link from "next/link";
import { GitCompareArrows, RotateCcw, Scale, ShoppingBag, Trash2 } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { useCompare } from "@/components/providers/CompareProvider";
import { addCartItem } from "@/lib/cart";
import { useAmount } from "@/lib/amount";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";

const SPEC_ROWS = [
	{ id: "price", label: "Price" },
	{ id: "brand", label: "Brand" },
	{ id: "category", label: "Category" },
	{ id: "stock", label: "Stock" },
	{ id: "sku", label: "SKU" },
	{ id: "unit", label: "Unit" },
	{ id: "vat", label: "VAT" },
	{ id: "variants", label: "Variants" },
] as const;

export function ComparePage() {
	const { items, count, isLoading, maxItems, removeItem, clearItems } = useCompare();
	const { formatAmount } = useAmount();

	if (isLoading) {
		return (
			<div className="space-y-8">
				<UserDashTitle title="Compare" subtitle="Review your saved products side by side" />
				<div className="grid gap-6 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, index) => (
						<div key={index} className="h-72 animate-pulse rounded-[28px] border border-gray-200 bg-white" />
					))}
				</div>
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="space-y-8">
				<UserDashTitle title="Compare" subtitle="Review your saved products side by side" />
				<div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eefbf0] text-primary-green">
						<Scale className="h-8 w-8" />
					</div>
					<h2 className="mt-6 text-2xl font-bold text-primary-black">No products in compare yet</h2>
					<p className="mx-auto mt-3 max-w-2xl text-primary-body">Add up to {maxItems} products from any product card or details page to compare price, stock, brand, and key specs.</p>
					<Link
						href="/products"
						className="mt-6 inline-flex items-center justify-center rounded-full bg-primary-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-green"
					>
						Browse products
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
				<UserDashTitle title="Compare" subtitle="Review your saved products side by side" />
				<div className="flex flex-wrap items-center gap-3">
					<div className="rounded-full bg-[#eefbf0] px-4 py-2 text-sm font-semibold text-primary-green">
						{count} of {maxItems} selected
					</div>
					<button
						onClick={clearItems}
						className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-black transition-colors hover:border-red-200 hover:text-red-500"
					>
						<RotateCcw className="h-4 w-4" />
						Clear all
					</button>
				</div>
			</div>

			<div className="grid gap-6 xl:grid-cols-[minmax(180px,220px)_1fr]">
				<div className="rounded-[28px] border border-gray-200 bg-[#f8fafc] p-5">
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-green shadow-sm">
							<GitCompareArrows className="h-6 w-6" />
						</div>
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-green">Compare panel</p>
							<h2 className="mt-1 text-xl font-bold text-primary-black">Quick scan</h2>
						</div>
					</div>
					<div className="mt-6 space-y-3 text-sm text-primary-body">
						<p>Compare price, stock, and product basics in one place.</p>
						<p>Use this page to decide faster before adding to cart.</p>
					</div>
				</div>

				<div className="overflow-x-auto pb-2">
					<div className="grid min-w-[720px] gap-6" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(220px, 1fr))` }}>
						{items.map((item) => {
							const isOutOfStock = item.available_quantity <= 0;

							return (
								<div key={item.product_id} className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
									<div className="relative h-60 bg-[#f7f9fc]">
										<SafeImage
											unoptimized
											fill
											sizes="(min-width: 1280px) 220px, 100vw"
											src={item.thumbnail || "/images/placeholder.jpg"}
											alt={item.name}
											className="object-contain p-6"
										/>
										<button
											onClick={() => removeItem(item.product_id)}
											className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-primary-body transition-colors hover:text-red-500"
											aria-label={`Remove ${item.name} from compare`}
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>

									<div className="p-5">
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">{item.brand?.name || item.category?.name || "Compare item"}</p>
										<Link href={item.url} className="mt-2 line-clamp-2 block text-xl font-bold text-primary-black transition-colors hover:text-primary-green">
											{item.name}
										</Link>

										<div className="mt-5 space-y-3">
											{SPEC_ROWS.map((row) => (
												<div key={row.id} className="flex items-start justify-between gap-4 rounded-2xl bg-[#fbfcfd] px-4 py-3">
													<span className="text-sm font-medium text-primary-body">{row.label}</span>
													<span className="max-w-[60%] text-right text-sm font-semibold text-primary-black">{getCompareValue(item, row.id, formatAmount)}</span>
												</div>
											))}
										</div>

										<div className="mt-5 grid gap-3 sm:grid-cols-2">
											<Link
												href={item.url}
												className="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-primary-black transition-colors hover:border-primary-green hover:text-primary-green"
											>
												View details
											</Link>
											<button
												onClick={() =>
													addCartItem({
														id: item.product_id,
														slug: item.slug,
														name: item.name,
														price: item.price,
														image: item.thumbnail,
														quantity: 1,
														maxQuantity: item.available_quantity > 0 ? item.available_quantity : null,
														brand: item.brand?.name || null,
														category: item.category
															? {
																	name: item.category.name,
																	slug: item.category.slug || "",
																}
															: null,
													})
												}
												disabled={isOutOfStock}
												className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
													isOutOfStock ? "cursor-not-allowed bg-gray-200 text-gray-500" : "bg-primary-black text-white hover:bg-primary-green"
												}`}
											>
												<ShoppingBag className="h-4 w-4" />
												{isOutOfStock ? "Out of stock" : "Add to cart"}
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

function getCompareValue(
	item: {
		price: number;
		brand: { name: string } | null;
		category: { name: string } | null;
		stock_label: string | null;
		code?: string | null;
		unit?: string | null;
		vat?: number | null;
		variants_display?: string[];
		available_quantity: number;
	},
	key: (typeof SPEC_ROWS)[number]["id"],
	formatAmount: (amount: number) => string,
) {
	switch (key) {
		case "price":
			return formatAmount(item.price);
		case "brand":
			return item.brand?.name || "N/A";
		case "category":
			return item.category?.name || "N/A";
		case "stock":
			return item.stock_label || (item.available_quantity > 0 ? `${item.available_quantity} available` : "Out of stock");
		case "sku":
			return item.code || "N/A";
		case "unit":
			return item.unit || "N/A";
		case "vat":
			return typeof item.vat === "number" ? `${item.vat}%` : "N/A";
		case "variants":
			return item.variants_display && item.variants_display.length > 0 ? item.variants_display.join(", ") : "N/A";
		default:
			return "N/A";
	}
}

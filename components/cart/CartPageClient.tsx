"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { useAmount } from "@/lib/amount";
import { useCart } from "@/lib/cart";

export default function CartPageClient() {
	const { items, subtotal, count, updateItemQuantity, removeItem, clear } = useCart();
	const { formatAmount } = useAmount();

	if (items.length === 0) {
		return (
			<div className="rounded-[24px] border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f7fa] text-primary-black">
					<ShoppingBag className="h-7 w-7" />
				</div>
				<h1 className="mt-6 text-3xl font-bold text-primary-black">Your cart is empty</h1>
				<p className="mt-3 text-primary-body">Add products to your cart and they will appear here for checkout.</p>
				<Link
					href="/products"
					className="mt-6 inline-flex rounded-full bg-primary-black px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
				>
					Browse products
				</Link>
			</div>
		);
	}

	return (
		<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
			<div className="space-y-6">
				<section className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-green">Cart</p>
							<h1 className="mt-2 text-3xl font-bold text-primary-black">Shopping Cart</h1>
							<p className="mt-2 text-sm text-primary-body">{count} item(s) ready for checkout</p>
						</div>

						<button onClick={clear} className="text-sm font-semibold text-primary-green transition-opacity hover:opacity-80">
							Clear cart
						</button>
					</div>
				</section>

				<section className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
					<div className="space-y-4">
						{items.map((item) => (
							<article key={item.id} className="rounded-[20px] border border-gray-200 p-4 transition-colors hover:border-[#d7e4db]">
								<div className="flex flex-col gap-4 md:flex-row">
									<div className="relative h-28 w-full overflow-hidden rounded-2xl bg-[#f6f8fa] md:w-28">
										<SafeImage unoptimized src={item.image} alt={item.name} fill sizes="112px" className="object-cover" />
									</div>

									<div className="min-w-0 flex-1">
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div className="min-w-0">
												<Link href={`/product/${item.slug}`} className="line-clamp-2 text-lg font-bold text-primary-black transition-colors hover:text-primary-green">
													{item.name}
												</Link>
												<p className="mt-1 text-sm text-primary-body">
													{item.brand || "Storefront product"}
													{item.category?.name ? ` • ${item.category.name}` : ""}
												</p>
												{item.variantLabel ? <p className="mt-1 text-sm text-primary-body">Variant: {item.variantLabel}</p> : null}
												<p className="mt-3 text-base font-semibold text-primary-black">{formatAmount(item.price)}</p>
											</div>

											<button
												onClick={() => removeItem(item.id, item.variantSelection ?? null)}
												className="inline-flex items-center gap-2 text-sm font-medium text-red-500 transition-colors hover:text-red-600"
											>
												<Trash2 className="h-4 w-4" />
												Remove
											</button>
										</div>

										<div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
											<div className="flex items-center overflow-hidden rounded-full border border-gray-300">
												<button
													onClick={() => updateItemQuantity(item.id, item.quantity - 1, item.variantSelection ?? null)}
													disabled={item.quantity <= 1}
													className="px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
												>
													<Minus className="h-4 w-4" />
												</button>
												<span className="min-w-12 px-3 text-center text-sm font-semibold text-primary-black">{item.quantity}</span>
												<button
													onClick={() => updateItemQuantity(item.id, item.quantity + 1, item.variantSelection ?? null)}
													disabled={typeof item.maxQuantity === "number" && item.quantity >= item.maxQuantity}
													className="px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
												>
													<Plus className="h-4 w-4" />
												</button>
											</div>

											<p className="text-xl font-bold text-primary-black">{formatAmount(item.price * item.quantity)}</p>
										</div>
									</div>
								</div>
							</article>
						))}
					</div>
				</section>
			</div>

			<aside className="h-fit rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm md:p-6 xl:sticky xl:top-24">
				<h2 className="text-xl font-bold text-primary-black">Order Summary</h2>
				<div className="mt-6 space-y-3 border-b border-gray-200 pb-5">
					<SummaryRow label="Items" value={count.toString()} />
					<SummaryRow label="Subtotal" value={formatAmount(subtotal)} />
					<SummaryRow label="Delivery" value="Calculated at checkout" />
				</div>

				<div className="mt-5 flex items-center justify-between">
					<span className="text-base font-semibold text-primary-black">Total</span>
					<span className="text-2xl font-bold text-primary-black">{formatAmount(subtotal)}</span>
				</div>

				<Link
					href="/checkout-one?payment=cod"
					className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary-black px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
				>
					Proceed to checkout
				</Link>

				<Link
					href="/products"
					className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-primary-black transition-colors hover:border-primary-green hover:text-primary-green"
				>
					Continue shopping
				</Link>
			</aside>
		</div>
	);
}

function SummaryRow({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center justify-between gap-4 text-sm">
			<span className="text-primary-body">{label}</span>
			<span className="font-semibold text-primary-black">{value}</span>
		</div>
	);
}

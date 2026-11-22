"use client";

import type { CheckoutDeliverySelection } from "@/data/checkout-data";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { useCheckoutPricing } from "@/lib/checkout";
import { useAmount } from "@/lib/amount";
import SafeImage from "@/components/common/SafeImage";

interface OrderItem {
	id: string;
	name: string;
	sku: string;
	image: string;
	variants: string[];
	combination?: Record<string, string> | null;
	price: number;
	quantity: number;
	taxRate: number;
	lineTotal: number;
}

interface OrderSummaryProps {
	onOrderChange?: (items: OrderItem[]) => void;
	onCouponChange?: (couponCode: string | null) => void;
	onCompleteOrder?: () => void;
	isSubmitting?: boolean;
	shippingContext?: CheckoutDeliverySelection | null;
	overrideItems?: OrderItem[] | null;
	overrideTotals?: {
		subtotal: number;
		tax: number;
		shipping: number;
		total: number;
	} | null;
	pricingNote?: string | null;
	buttonLabel?: string;
	submittingLabel?: string;
	allowCoupons?: boolean;
}

export function OrderSummary({
	onOrderChange,
	onCouponChange,
	onCompleteOrder,
	isSubmitting = false,
	shippingContext = null,
	overrideItems = null,
	overrideTotals = null,
	pricingNote = null,
	buttonLabel = "Complete Order",
	submittingLabel = "Processing Order...",
	allowCoupons = true,
}: OrderSummaryProps) {
	const { items: cartItems } = useCart();
	const [couponInput, setCouponInput] = useState("");
	const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
	const { formatAmount, isReady: isCurrencyReady } = useAmount();
	const isOverrideMode = Boolean(overrideItems && overrideTotals);
	const { items: pricedItems, subtotal, tax, shipping, total, coupon, couponDiscount, couponError, isLoading } = useCheckoutPricing(
		cartItems,
		isOverrideMode ? null : appliedCouponCode,
		isOverrideMode ? null : shippingContext,
	);

	const items = useMemo<OrderItem[]>(
		() => {
			if (overrideItems) {
				return overrideItems;
			}

			return pricedItems.map((item) => ({
				id: item.id,
				name: item.name,
				sku: item.slug,
				image: item.image,
				variants: item.variantLabel ? [item.variantLabel, item.brand || "Storefront"] : [item.brand || "Storefront", item.category?.name || "General"],
				combination: item.variantSelection || null,
				price: item.unitPrice,
				quantity: item.quantity,
				taxRate: item.taxRate,
				lineTotal: item.lineTotal,
			}));
		},
		[overrideItems, pricedItems],
	);

	const summary = (() => {
		if (overrideTotals) {
			return overrideTotals;
		}

		if (shippingContext?.charge === null || typeof shippingContext?.charge === "undefined") {
			return { subtotal, tax, shipping, total };
		}

		const effectiveShipping = shippingContext.charge;

		return {
			subtotal,
			tax,
			shipping: effectiveShipping,
			total: total - shipping + effectiveShipping,
		};
	})();

	useEffect(() => {
		onOrderChange?.(items);
	}, [items, onOrderChange]);

	useEffect(() => {
		if (isOverrideMode || !allowCoupons) {
			onCouponChange?.(null);
			return;
		}

		onCouponChange?.(coupon?.code || null);
	}, [allowCoupons, coupon?.code, isOverrideMode, onCouponChange]);

	const handleApplyCoupon = () => {
		const normalizedCode = couponInput.trim().toUpperCase();

		if (!normalizedCode) {
			return;
		}

		setAppliedCouponCode(normalizedCode);
	};

	const handleRemoveCoupon = () => {
		setAppliedCouponCode(null);
		setCouponInput("");
	};

	const renderAmount = (amount: number) => {
		if (!isCurrencyReady) {
			return <span className="inline-block min-w-16 text-right tabular-nums text-transparent">000</span>;
		}

		return formatAmount(amount);
	};

	return (
		<div className="sticky top-20 h-fit">
			<h2 className="mb-6 text-xl font-bold">Order Summary</h2>

			<div className="mb-6 space-y-4">
				{!isOverrideMode && (isLoading || !isCurrencyReady) ? <div className="rounded-lg bg-white p-6 text-center text-sm text-muted-foreground">Loading checkout totals...</div> : null}
				{items.length > 0 ? (
					items.map((item) => (
						<div key={item.id} className="rounded-lg bg-white p-4">
							<div className="flex gap-4 pr-2">
								<div className="h-30 w-30 shrink-0 overflow-hidden rounded-lg bg-gray-100">
									<SafeImage unoptimized src={item.image} alt={item.name} width={140} height={140} className="h-full w-full object-cover" />
								</div>
								<div className="min-w-0 flex-1">
									<h5 className="text-lg font-bold lg:text-xl">{item.name}</h5>
									<p className="my-1 text-sm">SKU: {item.sku}</p>
									<div className="flex flex-wrap gap-2">
										{item.variants.map((variant, idx) => (
											<span key={idx} className={`text-sm font-medium ${idx === 1 ? "border-x border-secondary-stroke px-2" : ""}`}>
												{variant}
											</span>
										))}
									</div>

									<div className="mt-3 grid gap-2 text-sm text-primary-body">
										<div className="flex items-center justify-between">
											<span>Qty</span>
											<span className="font-semibold text-primary-black">{item.quantity}</span>
										</div>
										<div className="flex items-center justify-between">
											<span>Unit price</span>
											<span className="font-semibold text-primary-black">{renderAmount(item.price)}</span>
										</div>
										<div className="flex items-center justify-between">
											<span>VAT</span>
											<span className="font-semibold text-primary-black">{item.taxRate}%</span>
										</div>
										<div className="flex items-center justify-between border-t pt-2">
											<span className="font-medium text-primary-black">Line total (incl. VAT)</span>
											<h6 className="text-sm font-extrabold text-primary-black">{renderAmount(item.lineTotal)}</h6>
										</div>
									</div>
								</div>
							</div>
						</div>
					))
				) : (
					<div className="rounded-lg bg-white p-6 text-center text-sm text-muted-foreground">Your cart is empty. Add products before checkout.</div>
				)}
			</div>

			<div className="mb-6 rounded-lg bg-white p-4">
				<div className="flex items-center justify-between">
					<div>
						<h6 className="font-bold">Pricing source</h6>
						<p className="text-sm text-primary-body">
							{pricingNote || (shippingContext?.label
								? `Totals use your latest cart pricing plus the ${shippingContext.label} delivery rule from company setup.`
								: "All totals are calculated from your latest cart products, active offers, coupons, and system VAT.")}
						</p>
					</div>
				</div>
			</div>

			{!isOverrideMode && allowCoupons ? (
				<div className="mb-6 rounded-lg bg-white p-4">
					<h6 className="mb-3 font-bold">Coupon code</h6>
					<div className="flex gap-2">
						<input
							type="text"
							value={couponInput}
							onChange={(event) => setCouponInput(event.target.value)}
							placeholder="Enter coupon code"
							className="h-11 flex-1 rounded-md border border-gray-200 px-3 text-sm outline-none transition focus:border-primary-blue"
						/>
						<button
							type="button"
							onClick={handleApplyCoupon}
							disabled={!couponInput.trim() || isLoading}
							className="rounded-md bg-primary-blue px-4 text-sm font-semibold text-white transition hover:bg-primary-black disabled:cursor-not-allowed disabled:opacity-50"
						>
							Apply
						</button>
					</div>
					{coupon?.code ? (
						<div className="mt-3 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
							<span>
								Applied `{coupon.code}` and saved {formatAmount(coupon.discountAmount)}.
							</span>
							<button type="button" onClick={handleRemoveCoupon} className="font-semibold text-green-800">
								Remove
							</button>
						</div>
					) : null}
					{couponError ? <p className="mt-3 text-sm text-red-600">{couponError}</p> : null}
				</div>
			) : null}

				<div className="mb-6 rounded-lg bg-white p-4">
					<div className="mb-2 space-y-3 border-b pb-2">
						<div className="flex justify-between font-bold">
							<span>Subtotal (excl. VAT)</span>
							<span>{renderAmount(summary.subtotal)}</span>
						</div>
						<div className="flex justify-between text-sm font-medium">
							<span>Shipping</span>
							<span>{renderAmount(summary.shipping)}</span>
						</div>
						<div className="flex justify-between text-sm font-medium">
							<span>VAT / Tax</span>
							<span>{renderAmount(summary.tax)}</span>
						</div>
						{!isOverrideMode && couponDiscount > 0 ? (
							<div className="flex justify-between text-sm font-medium text-green-700">
								<span>Coupon discount</span>
								<span>-{renderAmount(couponDiscount)}</span>
							</div>
						) : null}
					</div>

					<div className="flex items-center justify-between font-bold">
						<h6>TOTAL</h6>
						<h6>{renderAmount(summary.total)}</h6>
					</div>
				</div>

			<button
				onClick={onCompleteOrder}
				disabled={items.length === 0 || isSubmitting}
				className="w-full cursor-pointer rounded-md bg-primary-blue px-4 py-4 font-semibold text-white transition-colors hover:bg-primary-black disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isSubmitting ? submittingLabel : buttonLabel}
			</button>
		</div>
	);
}

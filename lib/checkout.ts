"use client";

import type { CartItem } from "@/lib/cart";
import type { CheckoutDeliverySelection } from "@/data/checkout-data";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useMemo, useState } from "react";

type CheckoutPreviewResponse = {
	status?: number;
	message?: string;
	data?: {
		items?: Array<{
			id?: string | number;
			name?: string;
			slug?: string;
			image?: string;
			brand_name?: string | null;
			category_name?: string | null;
			quantity?: number;
			unit_price?: number;
			tax_rate?: number;
			tax_amount?: number;
			line_subtotal?: number;
			line_total?: number;
			available_quantity?: number | null;
		}>;
		subtotal?: number;
		tax?: number;
		shipping?: number;
		total?: number;
		coupon_code?: string | null;
		coupon_discount_amount?: number;
		coupon?: {
			code?: string;
			name?: string;
			discount_type?: string;
			discount_value?: number;
			discount_amount?: number;
			eligible_subtotal?: number;
		} | null;
	};
	errors?: string[];
};

export type CheckoutPricingItem = CartItem & {
	unitPrice: number;
	taxRate: number;
	lineSubtotal: number;
	taxAmount: number;
	lineTotal: number;
	availableQuantity: number | null;
};

export type CheckoutPricingSummary = {
	items: CheckoutPricingItem[];
	subtotal: number;
	tax: number;
	shipping: number;
	total: number;
	couponCode: string | null;
	couponDiscount: number;
	coupon: {
		code: string;
		name: string | null;
		discountType: string | null;
		discountValue: number;
		discountAmount: number;
		eligibleSubtotal: number;
	} | null;
};

const EMPTY_SUMMARY: CheckoutPricingSummary = {
	items: [],
	subtotal: 0,
	tax: 0,
	shipping: 0,
	total: 0,
	couponCode: null,
	couponDiscount: 0,
	coupon: null,
};

function normalizeNumber(value: unknown, fallback = 0) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function buildFallbackSummary(cartItems: CartItem[]): CheckoutPricingSummary {
	const items: CheckoutPricingItem[] = cartItems.map((item) => {
		const unitPrice = normalizeNumber(item.price, 0);
		const taxRate = normalizeNumber(item.taxRate, 0);
		const lineSubtotal = unitPrice * item.quantity;
		const taxAmount = lineSubtotal * (taxRate / 100);
		const lineTotal = lineSubtotal + taxAmount;

		return {
			...item,
			unitPrice,
			taxRate,
			lineSubtotal,
			taxAmount,
			lineTotal,
			availableQuantity: item.maxQuantity,
		};
	});

	return {
		items,
		subtotal: items.reduce((sum, item) => sum + item.lineSubtotal, 0),
		tax: items.reduce((sum, item) => sum + item.taxAmount, 0),
		shipping: 0,
		total: items.reduce((sum, item) => sum + item.lineTotal, 0),
		couponCode: null,
		couponDiscount: 0,
		coupon: null,
	};
}

function mapResponseToSummary(cartItems: CartItem[], response: CheckoutPreviewResponse["data"]): CheckoutPricingSummary {
	const responseItems = Array.isArray(response?.items) ? response.items : [];
	const responseBySlug = new Map(responseItems.map((item) => [String(item.slug || ""), item]));

	const items: CheckoutPricingItem[] = cartItems.map((cartItem) => {
		const responseItem = responseBySlug.get(cartItem.slug);

		return {
			...cartItem,
			id: String(responseItem?.id || cartItem.id),
			name: responseItem?.name || cartItem.name,
			image: responseItem?.image || cartItem.image,
			brand: responseItem?.brand_name || cartItem.brand,
			category: responseItem?.category_name
				? {
						name: responseItem.category_name,
						slug: cartItem.category?.slug || "",
				  }
				: cartItem.category,
			quantity: Math.max(1, Math.floor(normalizeNumber(responseItem?.quantity, cartItem.quantity))),
			unitPrice: normalizeNumber(responseItem?.unit_price, cartItem.price),
			taxRate: normalizeNumber(responseItem?.tax_rate, cartItem.taxRate ?? 0),
			lineSubtotal: normalizeNumber(responseItem?.line_subtotal, cartItem.price * cartItem.quantity),
			taxAmount: normalizeNumber(responseItem?.tax_amount, 0),
			lineTotal: normalizeNumber(responseItem?.line_total, cartItem.price * cartItem.quantity),
			availableQuantity:
				responseItem?.available_quantity == null ? cartItem.maxQuantity : Math.max(0, Math.floor(Number(responseItem.available_quantity))),
		};
	});

	return {
		items,
		subtotal: normalizeNumber(response?.subtotal, 0),
		tax: normalizeNumber(response?.tax, 0),
		shipping: normalizeNumber(response?.shipping, 0),
		total: normalizeNumber(response?.total, 0),
		couponCode: response?.coupon_code || null,
		couponDiscount: normalizeNumber(response?.coupon_discount_amount, 0),
		coupon: response?.coupon?.code
			? {
					code: response.coupon.code,
					name: response.coupon.name || null,
					discountType: response.coupon.discount_type || null,
					discountValue: normalizeNumber(response.coupon.discount_value, 0),
					discountAmount: normalizeNumber(response.coupon.discount_amount, 0),
					eligibleSubtotal: normalizeNumber(response.coupon.eligible_subtotal, 0),
			  }
			: null,
	};
}

export function useCheckoutPricing(
	cartItems: CartItem[],
	couponCode?: string | null,
	shippingContext?: CheckoutDeliverySelection | null,
) {
	const [summary, setSummary] = useState<CheckoutPricingSummary>(EMPTY_SUMMARY);
	const [isLoading, setIsLoading] = useState(true);
	const [couponError, setCouponError] = useState<string | null>(null);
	const cartItemsKey = cartItems.map((item) => `${item.slug}:${item.quantity}:${JSON.stringify(item.variantSelection || {})}`).join("|");
	const shippingContextKey = shippingContext
		? [
				shippingContext.divisionName,
				shippingContext.districtId,
				shippingContext.districtName,
				shippingContext.upazilaId,
				shippingContext.upazilaName,
				shippingContext.charge,
				shippingContext.codAvailable,
			  ].join("|")
		: "";

	useEffect(() => {
		if (cartItems.length === 0) {
			setSummary(EMPTY_SUMMARY);
			setCouponError(null);
			setIsLoading(false);
			return;
		}

		const controller = new AbortController();
		const normalizedCouponCode = couponCode?.trim() || null;

		const fetchPricing = async (activeCouponCode: string | null) => {
			const response = await apiFetch("/landing/checkout-preview", {
				method: "POST",
				signal: controller.signal,
				cache: "no-store",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					coupon_code: activeCouponCode,
					shipping: shippingContext
						? {
							division_name: shippingContext.divisionName || undefined,
							district_id: shippingContext.districtId || undefined,
							district_name: shippingContext.districtName || undefined,
							upazila_id: shippingContext.upazilaId || undefined,
							upazila_name: shippingContext.upazilaName || undefined,
							delivery_charge: shippingContext.charge,
							cash_on_delivery: shippingContext.codAvailable,
						}
						: undefined,
					items: cartItems.map((item) => ({
						slug: item.slug,
						quantity: item.quantity,
						combination: item.variantSelection || undefined,
					})),
				}),
			});
			const payload = (await response.json().catch(() => null)) as CheckoutPreviewResponse | null;

			if (!response.ok || payload?.status !== 1 || !payload.data) {
				throw new Error(payload?.message || payload?.errors?.[0] || "Checkout pricing could not be loaded.");
			}

			return payload.data;
		};

		const loadPricing = async () => {
			setIsLoading(true);

			try {
				const response = await fetchPricing(normalizedCouponCode);
				setSummary(mapResponseToSummary(cartItems, response));
				setCouponError(null);
			} catch (error) {
				if (normalizedCouponCode) {
					try {
						const fallbackResponse = await fetchPricing(null);
						setSummary(mapResponseToSummary(cartItems, fallbackResponse));
					} catch {
						setSummary(buildFallbackSummary(cartItems));
					}
				} else {
					setSummary(buildFallbackSummary(cartItems));
				}

				if (!(error instanceof DOMException && error.name === "AbortError")) {
					setCouponError(normalizedCouponCode ? (error instanceof Error ? error.message : "Coupon could not be applied.") : null);
				}
			} finally {
				setIsLoading(false);
			}
		};

		void loadPricing();

		return () => controller.abort();
	}, [cartItemsKey, couponCode, shippingContextKey]);

	return useMemo(
		() => ({
			...summary,
			isLoading,
			couponError,
		}),
		[summary, isLoading, couponError],
	);
}

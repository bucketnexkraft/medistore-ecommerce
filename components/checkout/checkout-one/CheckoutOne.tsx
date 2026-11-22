"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { extractApiError, getAuthHeaders, readStoredAuthToken } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { apiFetch, withPaymentScopeHeaders } from "@/lib/api-client";
import { fetchCheckoutSettingsPayload } from "@/lib/checkout-delivery";
import { isValidPhoneNumber } from "libphonenumber-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BuyerInformation } from "./BuyerInformation";
import { OrderSummary } from "./OrderSummary";
import { ShippingFormData, BillingData, CheckoutDeliverySelection, CheckoutGateway } from "@/data/checkout-data";
import type { BillingFieldErrors, ShippingFieldErrors } from "./BuyerInformation";

type CheckoutOrderItem = {
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
};

type GroupCheckoutDetails = {
	id: string;
	status: "open" | "completed" | "cancelled";
	purchase_status: "awaiting_members" | "awaiting_purchases" | "discount_unlocked" | "discount_failed";
	has_purchased: boolean;
	minimum_users?: number;
	joined_count?: number;
	remaining_members?: number;
	remaining_purchases?: number;
	purchase_deadline_at?: string | null;
	discount_unlocked_at?: string | null;
	base_price: number;
	discounted_price: number;
	product: {
		id: string;
		name: string;
		slug: string;
		thumbnail: string;
		vat?: number;
		category: { name: string; slug: string } | null;
	brand: string | null;
	} | null;
};

type CheckoutSettingsPayload = {
	allow_guest_checkout?: boolean | number | string | null;
	cod_enabled?: boolean | number | string | null;
	default_charge?: number | string | null;
	location_delivery_supported?: boolean | number | string | null;
	payment_gateway_supported?: boolean | number | string | null;
	payment_gateway_settings?: unknown[] | Record<string, unknown> | null;
	specific_charges?: unknown[] | Record<string, unknown> | null;
};

function hasConfiguredItems(value: CheckoutSettingsPayload["payment_gateway_settings"] | CheckoutSettingsPayload["specific_charges"]) {
	if (Array.isArray(value)) {
		return value.length > 0;
	}

	return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function isGatewayEnabled(gateway: CheckoutGateway) {
	if (typeof gateway.is_active !== "undefined") {
		return gateway.is_active === true || gateway.is_active === 1 || String(gateway.is_active).toLowerCase() === "true";
	}

	if (typeof gateway.active !== "undefined") {
		return gateway.active === true || gateway.active === 1 || String(gateway.active).toLowerCase() === "true";
	}

	if (typeof gateway.enabled !== "undefined") {
		return gateway.enabled === true || gateway.enabled === 1 || String(gateway.enabled).toLowerCase() === "true";
	}

	if (typeof gateway.status !== "undefined" && gateway.status !== null) {
		const normalizedStatus = String(gateway.status).trim().toLowerCase();

		if (["0", "disabled", "inactive", "off"].includes(normalizedStatus)) {
			return false;
		}

		if (["1", "enabled", "active", "on"].includes(normalizedStatus)) {
			return true;
		}
	}

	return true;
}

function getGroupCheckoutUnavailableMessage(groupPurchase: GroupCheckoutDetails) {
	if (groupPurchase.status === "cancelled") {
		return "This group purchase was cancelled.";
	}

	if (groupPurchase.purchase_status === "awaiting_members" || groupPurchase.status === "open") {
		const remainingMembers = Number(groupPurchase.remaining_members || 0);

		if (remainingMembers > 0) {
			return `This group still needs ${remainingMembers} more member${remainingMembers > 1 ? "s" : ""} before checkout opens.`;
		}

		return "This group is still waiting for all required members to join.";
	}

	if (groupPurchase.purchase_status === "discount_failed") {
		return "This group purchase did not reach a valid checkout state, so member checkout is no longer available.";
	}

	if (groupPurchase.purchase_status === "discount_unlocked") {
		return "This group purchase has already been completed.";
	}

	if (groupPurchase.status === "completed" && groupPurchase.purchase_status !== "awaiting_purchases") {
		return "This group purchase is no longer accepting member orders.";
	}

	return "This group purchase is not currently accepting member orders.";
}

export function CheckoutOne() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { token, isAuthenticated, isLoading, refreshSession } = useAuth();
	const { clear } = useCart();
	const [buyerData, setBuyerData] = useState<{ shipping: ShippingFormData; billing: BillingData; delivery: CheckoutDeliverySelection } | null>(null);
	const [orderItems, setOrderItems] = useState<CheckoutOrderItem[]>([]);
	const [couponCode, setCouponCode] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [groupPurchase, setGroupPurchase] = useState<GroupCheckoutDetails | null>(null);
	const [isGroupLoading, setIsGroupLoading] = useState(false);
	const [gateways, setGateways] = useState<CheckoutGateway[]>([]);
	const [isLoadingGateways, setIsLoadingGateways] = useState(true);
	const [shippingErrors, setShippingErrors] = useState<ShippingFieldErrors>({});
	const [billingErrors, setBillingErrors] = useState<BillingFieldErrors>({});
	const [guestCheckoutAllowed, setGuestCheckoutAllowed] = useState(false);
	const [supportsPaymentGateway, setSupportsPaymentGateway] = useState(false);
	const [supportsLocationDelivery, setSupportsLocationDelivery] = useState(false);
	const [defaultDeliveryCharge, setDefaultDeliveryCharge] = useState<number | null>(null);
	const [isLoadingCheckoutSettings, setIsLoadingCheckoutSettings] = useState(true);

	const groupPurchaseId = searchParams.get("groupPurchase");
	const requestedPaymentMethod = searchParams.get("payment") === "gateway" ? "gateway" : "cod";
	const resolvedToken = token || readStoredAuthToken();

	useEffect(() => {
		let ignore = false;

		const loadCheckoutSettings = async () => {
			setIsLoadingCheckoutSettings(true);

			try {
				const payload = await fetchCheckoutSettingsPayload();
				const data = (payload?.data ?? {}) as CheckoutSettingsPayload;
				const paymentGatewaySupported = typeof data.payment_gateway_supported === "boolean"
					? data.payment_gateway_supported
					: hasConfiguredItems(data.payment_gateway_settings);
				const deliverySupported = typeof data.location_delivery_supported === "boolean"
					? data.location_delivery_supported
					: false;
				const parsedDefaultCharge = Number(data.default_charge);

				if (!ignore) {
					setGuestCheckoutAllowed(Boolean(data.allow_guest_checkout));
					setSupportsPaymentGateway(paymentGatewaySupported);
					setSupportsLocationDelivery(deliverySupported);
					setDefaultDeliveryCharge(Number.isFinite(parsedDefaultCharge) ? parsedDefaultCharge : null);
				}
			} catch {
				if (!ignore) {
					setGuestCheckoutAllowed(false);
					setSupportsPaymentGateway(false);
					setSupportsLocationDelivery(false);
					setDefaultDeliveryCharge(null);
				}
			} finally {
				if (!ignore) {
					setIsLoadingCheckoutSettings(false);
				}
			}
		};

		void loadCheckoutSettings();

		return () => {
			ignore = true;
		};
	}, []);

	useEffect(() => {
		if (!supportsPaymentGateway) {
			setGateways([]);
			setIsLoadingGateways(false);
			return;
		}

		let ignore = false;

		const loadGateways = async () => {
			setIsLoadingGateways(true);

			try {
				const response = await apiFetch("/landing/payment-gateways", {
					cache: "no-store",
					headers: withPaymentScopeHeaders(undefined, "ecommerce_order"),
				});
				const payload = await response.json().catch(() => null);

				if (!ignore) {
					const nextGateways = Array.isArray(payload?.data) ? (payload.data as CheckoutGateway[]) : [];
					setGateways(nextGateways.filter(isGatewayEnabled));
				}
			} catch {
				if (!ignore) {
					setGateways([]);
				}
			} finally {
				if (!ignore) {
					setIsLoadingGateways(false);
				}
			}
		};

		void loadGateways();

		return () => {
			ignore = true;
		};
	}, [supportsPaymentGateway]);

	useEffect(() => {
		if (!groupPurchaseId || !resolvedToken || !isAuthenticated) {
			setGroupPurchase(null);
			setIsGroupLoading(false);
			return;
		}

		let ignore = false;

		const loadGroupPurchase = async () => {
			setIsGroupLoading(true);

			try {
				const response = await apiFetch(`/group-purchases/${encodeURIComponent(groupPurchaseId)}`, {
					headers: getAuthHeaders(resolvedToken),
					cache: "no-store",
				});
				const payload = await response.json().catch(() => null);

				if (!response.ok || payload?.status !== 1 || !payload?.data) {
					throw new Error(extractApiError(payload, "Could not load the selected group purchase."));
				}

				if (!ignore) {
					setGroupPurchase(payload.data as GroupCheckoutDetails);
				}
			} catch (error) {
				if (!ignore) {
					setGroupPurchase(null);
					toast({
						title: "Group checkout unavailable",
						description: error instanceof Error ? error.message : "Could not load the selected group purchase.",
					});
				}
			} finally {
				if (!ignore) {
					setIsGroupLoading(false);
				}
			}
		};

		void loadGroupPurchase();

		return () => {
			ignore = true;
		};
	}, [groupPurchaseId, isAuthenticated, resolvedToken]);

	const handleDataChange = useCallback((data: { shipping: ShippingFormData; billing: BillingData; delivery: CheckoutDeliverySelection }) => {
		setBuyerData(data);
	}, []);

	const effectiveDeliverySelection = useMemo(() => {
		if (!buyerData) {
			return null;
		}

		if (supportsLocationDelivery || buyerData.billing.paymentMethod === "cod") {
			return buyerData.delivery;
		}

		return {
			...buyerData.delivery,
			charge: defaultDeliveryCharge ?? buyerData.delivery.charge ?? 0,
		};
	}, [buyerData, defaultDeliveryCharge, supportsLocationDelivery]);

	const clearShippingFieldError = useCallback((field: keyof ShippingFormData) => {
		setShippingErrors((current) => {
			if (!current[field]) {
				return current;
			}

			const next = { ...current };
			delete next[field];
			return next;
		});
	}, []);

	const clearBillingFieldError = useCallback((field: keyof BillingFieldErrors) => {
		setBillingErrors((current) => {
			if (!current[field]) {
				return current;
			}

			const next = { ...current };
			delete next[field];
			return next;
		});
	}, []);

	const validateCheckoutFields = useCallback((data: { shipping: ShippingFormData; billing: BillingData; delivery: CheckoutDeliverySelection } | null) => {
		const nextShippingErrors: ShippingFieldErrors = {};
		const nextBillingErrors: BillingFieldErrors = {};

		if (!data) {
			nextShippingErrors.firstName = "First name is required.";
			nextShippingErrors.phone = "Phone number is required.";
			nextShippingErrors.address = "Address is required.";
			nextShippingErrors.city = "City is required.";
			nextShippingErrors.country = "Country is required.";
		} else {
			if (!data.shipping.firstName.trim()) nextShippingErrors.firstName = "First name is required.";
			if (!data.shipping.phone.trim()) {
				nextShippingErrors.phone = "Phone number is required.";
			} else if (!isValidPhoneNumber(data.shipping.phone)) {
				nextShippingErrors.phone = "Enter a valid phone number with country code.";
			}
			if (!data.shipping.address.trim()) nextShippingErrors.address = "Address is required.";
			if (!data.shipping.city.trim()) nextShippingErrors.city = "City is required.";
			if (!data.shipping.country.trim()) nextShippingErrors.country = "Country is required.";

			if (data.billing.paymentMethod === "gateway" && !data.billing.gatewayId) {
				nextBillingErrors.gatewayId = "Please select an online payment gateway.";
			}
		}

		setShippingErrors(nextShippingErrors);
		setBillingErrors(nextBillingErrors);

		return {
			isValid: Object.keys(nextShippingErrors).length === 0 && Object.keys(nextBillingErrors).length === 0,
			nextShippingErrors,
			nextBillingErrors,
		};
	}, []);

	const applyServerValidationErrors = useCallback((payload: unknown) => {
		const normalizedPayload = payload && typeof payload === "object"
			? payload as { errors?: unknown; data?: { errors?: unknown } }
			: null;
		const validationBag = normalizedPayload?.errors && typeof normalizedPayload.errors === "object"
			? normalizedPayload.errors
			: normalizedPayload?.data?.errors && typeof normalizedPayload.data.errors === "object"
				? normalizedPayload.data.errors
				: null;

		if (!validationBag) {
			return false;
		}

		const nextShippingErrors: ShippingFieldErrors = {};
		const nextBillingErrors: BillingFieldErrors = {};

		const normalizeMessage = (value: unknown) =>
			Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");

		for (const [key, value] of Object.entries(validationBag)) {
			const message = normalizeMessage(value);

			switch (key) {
				case "shipping.first_name":
				case "shipping.firstName":
					nextShippingErrors.firstName = message;
					break;
				case "shipping.last_name":
				case "shipping.lastName":
					nextShippingErrors.lastName = message;
					break;
				case "shipping.email":
					nextShippingErrors.email = message;
					break;
				case "shipping.phone":
					nextShippingErrors.phone = message;
					break;
				case "shipping.address":
					nextShippingErrors.address = message;
					break;
				case "shipping.city":
					nextShippingErrors.city = message;
					break;
				case "shipping.country":
					nextShippingErrors.country = message;
					break;
				case "shipping.postal_code":
				case "shipping.postalCode":
					nextShippingErrors.postalCode = message;
					break;
				case "gateway_id":
				case "billing.gateway_id":
					nextBillingErrors.gatewayId = message;
					break;
				default:
					break;
			}
		}

		if (Object.keys(nextShippingErrors).length === 0 && Object.keys(nextBillingErrors).length === 0) {
			return false;
		}

		setShippingErrors(nextShippingErrors);
		setBillingErrors(nextBillingErrors);
		return true;
	}, []);

	const groupOrderItems = useMemo<CheckoutOrderItem[]>(() => {
		if (!groupPurchase?.product) {
			return [];
		}

		const price = Number(groupPurchase.discounted_price || 0);
		const taxRate = Number(groupPurchase.product.vat || 0);
		const taxAmount = price * (taxRate / 100);
		const lineTotal = price + taxAmount;

		return [
			{
				id: groupPurchase.product.id,
				name: groupPurchase.product.name,
				sku: groupPurchase.product.slug,
				image: groupPurchase.product.thumbnail,
				variants: [groupPurchase.product.brand || "Storefront", groupPurchase.product.category?.name || "General"],
				price,
				quantity: 1,
				taxRate,
				lineTotal,
			},
		];
	}, [groupPurchase]);

	const groupTotals = useMemo(() => {
		if (!groupOrderItems.length) {
			return null;
		}

		const subtotal = groupOrderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
		const tax = groupOrderItems.reduce((sum, item) => sum + item.price * item.quantity * (item.taxRate / 100), 0);
		const shipping = 0;
		const total = subtotal + tax + shipping;

		return { subtotal, tax, shipping, total };
	}, [groupOrderItems]);

	const handleCompleteOrder = async () => {
		if (isLoading || isSubmitting || isGroupLoading || isLoadingCheckoutSettings) {
			return;
		}

		if (!isAuthenticated && !guestCheckoutAllowed) {
			router.push(`/signin?redirect=${encodeURIComponent(pathname || "/checkout-one")}`);
			return;
		}

		if (!isAuthenticated && groupPurchaseId) {
			router.push(`/signin?redirect=${encodeURIComponent(pathname || "/checkout-one")}`);
			return;
		}

		const validationResult = validateCheckoutFields(buyerData);
		if (!validationResult.isValid) {
			return;
		}

		const checkoutData = buyerData && effectiveDeliverySelection
			? {
					...buyerData,
					delivery: effectiveDeliverySelection,
			  }
			: null;
		if (!checkoutData) {
			return;
		}

		const activeOrderItems = groupPurchase ? groupOrderItems : orderItems;

		if (activeOrderItems.length === 0) {
			toast({
				title: "Your cart is empty",
				variant: "error",
				description: groupPurchase ? "This group purchase is missing its product information." : "Add products to your cart before placing an order.",
			});
			return;
		}

		if (groupPurchase) {
			if (groupPurchase.status !== "completed" || groupPurchase.purchase_status !== "awaiting_purchases") {
				toast({
					title: "Group checkout not ready",
					variant: "error",
					description: getGroupCheckoutUnavailableMessage(groupPurchase),
				});
				return;
			}

			if (groupPurchase.has_purchased) {
				toast({
					title: "Order already placed",
					variant: "error",
					description: "You have already placed your order for this group purchase.",
				});
				return;
			}
		}

		setIsSubmitting(true);

		try {
			let activeToken = resolvedToken;
			const endpoint = isAuthenticated && activeToken ? "/customer/orders" : "/landing/orders";
			const frontendUrl = typeof window !== "undefined" ? window.location.origin : undefined;
			const effectivePaymentMethod = supportsPaymentGateway && checkoutData.billing.paymentMethod === "gateway" ? "gateway" : "cod";
			const requestBody = {
				payment_method: effectivePaymentMethod,
				gateway_id: effectivePaymentMethod === "gateway" ? checkoutData.billing.gatewayId : undefined,
				frontend_url: frontendUrl,
				shipping: {
					first_name: checkoutData.shipping.firstName,
					last_name: checkoutData.shipping.lastName,
					email: checkoutData.shipping.email,
					phone: checkoutData.shipping.phone,
					address: checkoutData.shipping.address,
					city: checkoutData.shipping.city,
					division_name: checkoutData.delivery.divisionName || undefined,
					country: checkoutData.shipping.country,
					postal_code: checkoutData.shipping.postalCode,
					district_id: checkoutData.delivery.districtId || undefined,
					district_name: checkoutData.delivery.districtName || undefined,
					upazila_id: checkoutData.delivery.upazilaId || undefined,
					upazila_name: checkoutData.delivery.upazilaName || undefined,
				},
				delivery: {
					division_name: checkoutData.delivery.divisionName || undefined,
					district_id: checkoutData.delivery.districtId || undefined,
					district_name: checkoutData.delivery.districtName || undefined,
					upazila_id: checkoutData.delivery.upazilaId || undefined,
					upazila_name: checkoutData.delivery.upazilaName || undefined,
					delivery_charge: checkoutData.delivery.charge,
					cash_on_delivery: checkoutData.delivery.codAvailable,
				},
				group_purchase_id: groupPurchase?.id || undefined,
				coupon_code: groupPurchase ? undefined : couponCode || undefined,
				items: activeOrderItems.map((item) => ({
					slug: item.sku,
					quantity: item.quantity,
					combination: item.combination || undefined,
				})),
			};

			let response = await apiFetch(endpoint, {
				method: "POST",
				headers: withPaymentScopeHeaders(getAuthHeaders(activeToken), "ecommerce_order"),
				body: JSON.stringify(requestBody),
			});

			let payload = await response.json().catch(() => null);

			if (
				response.status === 401 &&
				(typeof payload?.message === "string" && payload.message.toLowerCase().includes("unauthenticated"))
			) {
				await refreshSession();
				activeToken = readStoredAuthToken();

				if (!activeToken) {
					router.push(`/signin?redirect=${encodeURIComponent(pathname || "/checkout-one")}`);
					return;
				}

				response = await apiFetch("/customer/orders", {
					method: "POST",
					headers: withPaymentScopeHeaders(getAuthHeaders(activeToken), "ecommerce_order"),
					body: JSON.stringify(requestBody),
				});
				payload = await response.json().catch(() => null);
			}

			if (!response.ok || payload?.status !== 1) {
				if (applyServerValidationErrors(payload)) {
					return;
				}
				throw new Error(extractApiError(payload, "Order could not be placed."));
			}

			const payment = payload?.data?.payment;

			if (payment?.type === "redirect" && payment?.redirect_url) {
				window.location.assign(String(payment.redirect_url));
				return;
			}

			if (!groupPurchase) {
				clear();
			}
			toast({
				title: "Order placed successfully",
				variant: "success",
				description: checkoutData.billing.paymentMethod === "gateway"
					? "Continue in the payment gateway to complete your order."
					: groupPurchase
					? "Your group order is placed. The discount will unlock after all required members complete checkout."
					: payload?.data?.order_id
						? `Your COD order ${payload.data.order_id} has been created.`
						: "Your COD order has been created.",
			});
			if (groupPurchase) {
				router.push(`/group-purchase?group=${encodeURIComponent(groupPurchase.id)}`);
				return;
			}

			const successPath =
				effectivePaymentMethod === "cod"
					? `/order-success?method=${encodeURIComponent("cod")}${payload?.data?.order_id ? `&orderId=${encodeURIComponent(String(payload.data.order_id))}` : ""}`
					: "/order-success";

			if (typeof window !== "undefined") {
				window.location.assign(successPath);
				return;
			}

			router.push(successPath);
		} catch (error) {
			toast({
				title: "Checkout failed",
				variant: "error",
				description: error instanceof Error ? error.message : "Order could not be placed.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen">
			<div className="section py-14">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 xl:px-12">
					{/* Left Column - Buyer Information */}
					<div>
						<BuyerInformation
							onDataChange={handleDataChange}
							shippingErrors={shippingErrors}
							billingErrors={billingErrors}
							onShippingFieldChange={clearShippingFieldError}
							onBillingFieldChange={clearBillingFieldError}
							gateways={gateways}
							isLoadingGateways={isLoadingGateways}
							defaultPaymentMethod={supportsPaymentGateway && requestedPaymentMethod === "gateway" ? "gateway" : "cod"}
							supportsPaymentGateway={supportsPaymentGateway}
							supportsLocationDelivery={supportsLocationDelivery}
							isAuthenticated={isAuthenticated}
						/>
						{!isAuthenticated && !isLoadingCheckoutSettings ? (
							<div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
								{guestCheckoutAllowed
									? "Guest checkout is enabled for this store. You can place the order directly without signing in."
									: "This store requires sign in before checkout. Please sign in to continue."}
							</div>
						) : null}
					</div>

					{/* Right Column - Order Summary */}
					<div>
						<OrderSummary
							onOrderChange={setOrderItems}
							onCouponChange={setCouponCode}
							onCompleteOrder={handleCompleteOrder}
							isSubmitting={isSubmitting}
							shippingContext={effectiveDeliverySelection}
							overrideItems={groupPurchase ? groupOrderItems : null}
							overrideTotals={groupPurchase ? groupTotals : null}
							allowCoupons={!groupPurchase}
							pricingNote={
								groupPurchase
									? "This is the discounted group-purchase price. Every required member must place an order for the group to complete successfully."
									: null
							}
							buttonLabel={
								supportsPaymentGateway && buyerData?.billing.paymentMethod === "gateway"
									? "Continue to Payment"
									: groupPurchase
										? "Place Group Order"
										: "Complete Order"
							}
							submittingLabel={
								supportsPaymentGateway && buyerData?.billing.paymentMethod === "gateway"
									? "Redirecting to Payment..."
									: groupPurchase
										? "Placing Group Order..."
										: "Placing COD Order..."
							}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

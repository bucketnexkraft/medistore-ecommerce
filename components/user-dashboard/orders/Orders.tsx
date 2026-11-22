"use client";

import { useEffect, useMemo, useState } from "react";
import { Order } from "@/data/user-dashboard-data";
import { useAuth } from "@/components/providers/AuthProvider";
import { apiFetch } from "@/lib/api-client";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { OrderCard } from "./OrderCard";

export function Orders() {
	const { token, isAuthenticated, isLoading } = useAuth();
	const [activeFilter, setActiveFilter] = useState("all");
	const [orders, setOrders] = useState<Order[]>([]);
	const [isFetching, setIsFetching] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isLoading) {
			return;
		}

		if (!isAuthenticated || !token) {
			setOrders([]);
			setIsFetching(false);
			return;
		}

		const controller = new AbortController();

		const loadOrders = async () => {
			setIsFetching(true);
			setError(null);

			try {
				const response = await apiFetch("/customer/orders", {
					headers: getAuthHeaders(token),
					signal: controller.signal,
					cache: "no-store",
				});
				const payload = await response.json().catch(() => null);

				if (!response.ok || payload?.status !== 1) {
					throw new Error(extractApiError(payload, "Orders could not be loaded."));
				}

				const nextOrders = Array.isArray(payload?.data)
					? payload.data.map((order: Record<string, unknown>) => ({
							id: String(order.id || ""),
							orderId: String(order.order_id || ""),
							date: String(order.date || ""),
							total: Number(order.total_amount || 0),
							status: String(order.status || "processing"),
							statusLabel: String(order.status_label || ""),
							paymentMethod: String(order.payment_method || "cod"),
							paymentStatus: String(order.payment_status || "pending"),
							subtotal: Number(order.subtotal || 0),
							taxAmount: Number(order.tax_amount || 0),
							shippingAmount: Number(order.shipping_amount || 0),
							couponCode: order.coupon_code ? String(order.coupon_code) : null,
							couponDiscountAmount: Number(order.coupon_discount_amount || 0),
							groupDiscountAmount: Number(order.group_discount_amount || 0),
							groupPurchaseDiscountStatus: order.group_purchase_discount_status ? String(order.group_purchase_discount_status) : undefined,
							placedAt: String(order.placed_at || ""),
							estimatedDelivery: order.estimated_delivery ? String(order.estimated_delivery) : null,
							trackingNote: String(order.tracking_note || ""),
							trackingSteps: Array.isArray(order.tracking_steps)
								? order.tracking_steps.map((step: Record<string, unknown>) => ({
										id: Number(step.id || 0),
										label: String(step.label || ""),
										completed: Boolean(step.completed),
										current: Boolean(step.current),
								  }))
								: [],
							shipping: order.shipping && typeof order.shipping === "object"
								? {
										id: "id" in order.shipping ? String((order.shipping as Record<string, unknown>).id || "") : "",
										fullName: String((order.shipping as Record<string, unknown>).full_name || ""),
										email: ((order.shipping as Record<string, unknown>).email as string | null | undefined) || null,
										phone: String((order.shipping as Record<string, unknown>).phone || ""),
										address: String((order.shipping as Record<string, unknown>).address || ""),
										divisionName: ((order.shipping as Record<string, unknown>).division_name as string | null | undefined) || null,
										districtName: ((order.shipping as Record<string, unknown>).district_name as string | null | undefined) || null,
										upazilaName: ((order.shipping as Record<string, unknown>).upazila_name as string | null | undefined) || null,
										city: String((order.shipping as Record<string, unknown>).city || ""),
										country: String((order.shipping as Record<string, unknown>).country || ""),
										postalCode: ((order.shipping as Record<string, unknown>).postal_code as string | null | undefined) || null,
								  }
								: null,
							seller: order.seller && typeof order.seller === "object"
								? {
										name: String((order.seller as Record<string, unknown>).name || "Seller support"),
										contactName: String((order.seller as Record<string, unknown>).contact_name || "Support Team"),
										email: ((order.seller as Record<string, unknown>).email as string | null | undefined) || null,
										phone: ((order.seller as Record<string, unknown>).phone as string | null | undefined) || null,
										address: ((order.seller as Record<string, unknown>).address as string | null | undefined) || null,
								  }
								: null,
							groupPurchase: order.group_purchase && typeof order.group_purchase === "object"
								? {
										id: String((order.group_purchase as Record<string, unknown>).id || ""),
										status: String((order.group_purchase as Record<string, unknown>).status || "open"),
										purchaseStatus: String((order.group_purchase as Record<string, unknown>).purchase_status || "awaiting_members"),
										discountedPrice: Number((order.group_purchase as Record<string, unknown>).discounted_price || 0),
										purchaseDeadlineAt: ((order.group_purchase as Record<string, unknown>).purchase_deadline_at as string | null | undefined) || null,
										discountUnlockedAt: ((order.group_purchase as Record<string, unknown>).discount_unlocked_at as string | null | undefined) || null,
								  }
								: null,
							items: Array.isArray(order.items)
								? order.items.map((item: Record<string, unknown>) => ({
										id: String(item.id || ""),
										name: String(item.name || ""),
										image: String(item.image || "/images/placeholder.jpg"),
										quantity: Number(item.quantity || 0),
										price: Number(item.price || 0),
										lineTotal: Number(item.line_total || item.price || 0),
										taxRate: Number(item.tax_rate || 0),
										taxAmount: Number(item.tax_amount || 0),
										brandName: String(item.brand_name || ""),
										categoryName: String(item.category_name || ""),
										slug: String(item.slug || ""),
										productId: String(item.product_id || ""),
										return_info: item.return_info && typeof item.return_info === "object"
											? {
													return_enabled: Boolean((item.return_info as Record<string, unknown>).return_enabled),
													return_day: (item.return_info as Record<string, unknown>).return_day !== null && (item.return_info as Record<string, unknown>).return_day !== undefined
														? Number((item.return_info as Record<string, unknown>).return_day)
														: null,
													return_condition: Array.isArray((item.return_info as Record<string, unknown>).return_condition)
														? ((item.return_info as Record<string, unknown>).return_condition as unknown[]).map(String)
														: [],
													can_request_return: Boolean((item.return_info as Record<string, unknown>).can_request_return),
													message: String((item.return_info as Record<string, unknown>).message || ""),
													expires_at: ((item.return_info as Record<string, unknown>).expires_at as string | null | undefined) || null,
													request: (item.return_info as Record<string, unknown>).request && typeof (item.return_info as Record<string, unknown>).request === "object"
														? {
																id: String(((item.return_info as Record<string, unknown>).request as Record<string, unknown>).id || ""),
																status: String(((item.return_info as Record<string, unknown>).request as Record<string, unknown>).status || ""),
																reason: String(((item.return_info as Record<string, unknown>).request as Record<string, unknown>).reason || ""),
																refund_amount: Number(((item.return_info as Record<string, unknown>).request as Record<string, unknown>).refund_amount || 0),
																rejection_reason: ((((item.return_info as Record<string, unknown>).request as Record<string, unknown>).rejection_reason as string | null | undefined) || null),
																requested_at: ((((item.return_info as Record<string, unknown>).request as Record<string, unknown>).requested_at as string | null | undefined) || null),
																resolved_at: ((((item.return_info as Record<string, unknown>).request as Record<string, unknown>).resolved_at as string | null | undefined) || null),
														  }
														: null,
											  }
											: undefined,
										review: item.review && typeof item.review === "object"
											? {
													id: String((item.review as Record<string, unknown>).id || ""),
													rating: Number((item.review as Record<string, unknown>).rating || 0),
													comment: ((item.review as Record<string, unknown>).comment as string | null | undefined) || null,
													createdAt: ((item.review as Record<string, unknown>).created_at as string | null | undefined) || null,
											  }
											: null,
								  }))
								: [],
					  }))
					: [];

				setOrders(nextOrders);
			} catch (fetchError) {
				if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
					return;
				}

				setError(fetchError instanceof Error ? fetchError.message : "Orders could not be loaded.");
				setOrders([]);
			} finally {
				setIsFetching(false);
			}
		};

		void loadOrders();

		return () => controller.abort();
	}, [isAuthenticated, isLoading, token]);

	const filteredOrders = activeFilter === "all" ? orders : orders.filter((order) => order.status === activeFilter);
	const orderFilters = useMemo(
		() => [
			{ id: "all", label: "All Orders", count: orders.length },
			{ id: "processing", label: "Processing", count: orders.filter((order) => order.status === "processing").length },
			{ id: "shipped", label: "Shipped", count: orders.filter((order) => order.status === "shipped").length },
			{ id: "delivered", label: "Delivered", count: orders.filter((order) => order.status === "delivered").length },
			{ id: "cancelled", label: "Cancelled", count: orders.filter((order) => order.status === "cancelled").length },
			{ id: "returned", label: "Returned", count: orders.filter((order) => order.status === "returned").length },
		],
		[orders],
	);

	return (
		<main>
			{/* Filter Buttons */}
			<div className="mb-8 flex flex-wrap gap-3 p-1.5 border rounded-lg bg-white">
				{orderFilters.map((filter) => (
					<button
						key={filter.id}
						onClick={() => setActiveFilter(filter.id)}
						className={`px-4 py-2 rounded-sm font-semibold transition-colors text-sm cursor-pointer ${
							activeFilter === filter.id ? "bg-purple-100 text-purple-700" : " text-gray-700 hover:bg-purple-100"
						}`}
					>
						{filter.label} ({filter.count})
					</button>
				))}
			</div>

			{/* Orders List */}
			<div>
				{isFetching ? (
					<div className="text-center py-12 bg-white rounded-lg border border-gray-200">
						<p className="text-gray-600">Loading your orders...</p>
					</div>
				) : null}
				{!isFetching && error ? (
					<div className="text-center py-12 bg-white rounded-lg border border-gray-200">
						<p className="font-semibold text-gray-900">Could not load orders</p>
						<p className="mt-2 text-sm text-gray-600">{error}</p>
					</div>
				) : null}
				{!isFetching && !error && !isAuthenticated ? (
					<div className="text-center py-12 bg-white rounded-lg border border-gray-200">
						<p className="text-gray-600">Sign in to view your order history.</p>
					</div>
				) : null}
				{!isFetching && !error && isAuthenticated && filteredOrders.length > 0 ? (
					filteredOrders.map((order) => <OrderCard key={order.id} order={order} token={token} />)
				) : null}
				{!isFetching && !error && isAuthenticated && filteredOrders.length === 0 ? (
					<div className="text-center py-12 bg-white rounded-lg border border-gray-200">
						<p className="text-gray-600">No orders found</p>
					</div>
				) : null}
			</div>
		</main>
	);
}

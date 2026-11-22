"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { useAuth } from "@/components/providers/AuthProvider";
import { Order } from "@/data/user-dashboard-data";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { Check, CircleDashed, Clock, MapPin, PackageCheck, Receipt, Search, Truck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export default function TrackingPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const orderId = searchParams.get("orderId");
	const { token, isAuthenticated, isLoading } = useAuth();
	const [orders, setOrders] = useState<Order[]>([]);
	const [isFetching, setIsFetching] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchValue, setSearchValue] = useState(orderId || "");
	const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

	useEffect(() => {
		setSearchValue(orderId || "");
		setSearchFeedback(null);
	}, [orderId]);

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
					throw new Error(extractApiError(payload, "Tracking information could not be loaded."));
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
							items: Array.isArray(order.items)
								? order.items.map((item: Record<string, unknown>) => ({
										id: String(item.id || ""),
										name: String(item.name || ""),
										image: String(item.image || "/images/placeholder.jpg"),
										quantity: Number(item.quantity || 0),
										price: Number(item.price || 0),
										lineTotal: Number(item.line_total || item.price || 0),
								  }))
								: [],
					  }))
					: [];

				setOrders(nextOrders);
			} catch (fetchError) {
				if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
					return;
				}

				setError(fetchError instanceof Error ? fetchError.message : "Tracking information could not be loaded.");
				setOrders([]);
			} finally {
				setIsFetching(false);
			}
		};

		void loadOrders();

		return () => controller.abort();
	}, [isAuthenticated, isLoading, token]);

	const sortedOrders = useMemo(() => {
		if (!orders.length) {
			return [];
		}

		return [...orders].sort((left, right) => {
			const leftDate = new Date(left.placedAt || left.date || 0).getTime();
			const rightDate = new Date(right.placedAt || right.date || 0).getTime();

			return rightDate - leftDate;
		});
	}, [orders]);

	const selectedOrder = useMemo(() => {
		if (!sortedOrders.length || !orderId) {
			return null;
		}

		return sortedOrders.find((order) => order.orderId.toLowerCase() === orderId.toLowerCase()) || null;
	}, [orderId, sortedOrders]);

	const hasExactMatch = useMemo(() => {
		if (!orderId) {
			return false;
		}

		return sortedOrders.some((order) => order.orderId.toLowerCase() === orderId.toLowerCase());
	}, [orderId, sortedOrders]);

	const handleSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const normalizedValue = searchValue.trim();
		if (!normalizedValue) {
			setSearchFeedback("Enter your order ID first.");
			router.push("/user-dashboard/tracking");
			return;
		}

		const matchedOrder = sortedOrders.find((order) => order.orderId.toLowerCase() === normalizedValue.toLowerCase());
		if (!matchedOrder) {
			setSearchFeedback("No tracking details found for this order ID.");
			router.push(`/user-dashboard/tracking?orderId=${encodeURIComponent(normalizedValue)}`);
			return;
		}

		setSearchFeedback(null);
		router.push(`/user-dashboard/tracking?orderId=${encodeURIComponent(matchedOrder.orderId)}`);
	};

	return (
		<RequireAuth>
			<div>
				<UserDashTitle title="Order Tracking" subtitle="Track package progress and delivery updates" />
				<div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="max-w-3xl">
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-body">Search Tracking</p>
						<h2 className="mt-2 text-2xl font-bold text-primary-black">Find your order with order ID</h2>
						<p className="mt-2 text-primary-body">Enter the order number from your order history or invoice to view live delivery progress.</p>
					</div>
					<form className="mt-5 flex flex-col gap-3 md:flex-row" onSubmit={handleSearch}>
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary-body" size={18} />
							<input
								type="text"
								value={searchValue}
								onChange={(event) => setSearchValue(event.target.value)}
								placeholder="Enter order ID, example: ORD-20260629-0001"
								className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-primary-black outline-none transition-colors focus:border-primary-blue"
							/>
						</div>
						<button
							type="submit"
							className="inline-flex h-12 items-center justify-center rounded-xl bg-primary-blue px-6 font-semibold text-white transition-opacity hover:opacity-90"
						>
							Track Order
						</button>
					</form>
					{searchFeedback ? <p className="mt-3 text-sm text-red-500">{searchFeedback}</p> : null}
					{!searchFeedback && orderId && hasExactMatch ? (
						<p className="mt-3 text-sm text-emerald-600">Tracking details found for {orderId}.</p>
					) : null}
				</div>
				{isFetching ? <StateCard title="Loading tracking" body="Fetching the latest order progress for your account." /> : null}
				{!isFetching && error ? <StateCard title="Tracking unavailable" body={error} /> : null}
				{!isFetching && !error && !orderId ? <SearchPromptState /> : null}
				{!isFetching && !error && orderId && !hasExactMatch ? <EmptyTrackingState orderId={orderId} /> : null}
				{!isFetching && !error && selectedOrder ? <TrackingDetails order={selectedOrder} orders={sortedOrders} /> : null}
			</div>
		</RequireAuth>
	);
}

function StateCard({ title, body }: { title: string; body: string }) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<h2 className="text-xl font-bold text-primary-black">{title}</h2>
			<p className="mt-2 text-primary-body">{body}</p>
		</div>
	);
}

function SearchPromptState() {
	return (
		<div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 shadow-sm">
			<div className="max-w-2xl">
				<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-body">Tracking Center</p>
				<h2 className="mt-3 text-3xl font-bold text-primary-black">Search an order to start tracking</h2>
				<p className="mt-3 text-primary-body">
					Use your order ID to open package status, shipping updates, estimated delivery, and seller information.
				</p>
			</div>
		</div>
	);
}

function EmptyTrackingState({ orderId }: { orderId: string }) {
	return (
		<div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 shadow-sm">
			<div className="max-w-2xl">
				<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-body">Tracking Center</p>
				<h2 className="mt-3 text-3xl font-bold text-primary-black">No tracking details found</h2>
				<p className="mt-3 text-primary-body">
					We could not find any tracking information for <span className="font-semibold text-primary-black">{orderId}</span>. Please check the order ID and try again.
				</p>
			</div>
		</div>
	);
}

function TrackingDetails({ order, orders }: { order: Order; orders: Order[] }) {
	const steps = order.trackingSteps || [];
	const shippingAddress = order.shipping
		? [order.shipping.address, order.shipping.upazilaName || order.shipping.city, order.shipping.districtName, order.shipping.divisionName, order.shipping.country, order.shipping.postalCode].filter(Boolean).join(", ")
		: "No shipping address available.";
	const nextStep = ["delivered", "cancelled", "returned"].includes(order.status.toLowerCase())
		? undefined
		: steps.find((step) => !step.completed && !step.current);

	return (
		<div className="space-y-6">
			<div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-body">Tracking for</p>
							<h2 className="mt-2 text-2xl font-bold text-primary-black">{order.orderId}</h2>
							<p className="mt-2 text-primary-body">{order.statusLabel || order.status}</p>
						</div>
						<div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-primary-black">
							<p className="font-semibold">Estimated delivery</p>
							<p className="mt-1">{order.estimatedDelivery || "Not available"}</p>
						</div>
					</div>

					<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<SummaryCard icon={<Truck size={18} />} label="Current Status" value={order.statusLabel || order.status} />
						<SummaryCard icon={<PackageCheck size={18} />} label="Next Step" value={nextStep?.label || "No further steps"} />
						<SummaryCard icon={<Receipt size={18} />} label="Payment" value={`${(order.paymentMethod || "cod").toUpperCase()} / ${order.paymentStatus || "pending"}`} />
						<SummaryCard icon={<MapPin size={18} />} label="Destination" value={order.shipping?.upazilaName || order.shipping?.districtName || order.shipping?.city || order.shipping?.country || "Not available"} />
					</div>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-body">Recent Orders</p>
							<h3 className="mt-2 text-xl font-bold text-primary-black">Switch tracking</h3>
						</div>
						<div className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-primary-black">{orders.length}</div>
					</div>
					<div className="mt-5 space-y-3">
						{orders.slice(0, 5).map((candidate) => {
							const isActive = candidate.id === order.id;

							return (
								<a
									key={candidate.id}
									href={`/user-dashboard/tracking?orderId=${encodeURIComponent(candidate.orderId)}`}
									className={`block rounded-xl border p-4 transition-colors ${
										isActive ? "border-primary-blue bg-blue-50" : "border-gray-200 hover:border-primary-blue/40 hover:bg-zinc-50"
									}`}
								>
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="font-semibold text-primary-black">{candidate.orderId}</p>
											<p className="mt-1 text-sm text-primary-body">{candidate.statusLabel || candidate.status}</p>
										</div>
										<p className="text-xs text-primary-body">{candidate.date || candidate.placedAt}</p>
									</div>
								</a>
							);
						})}
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div>
						<h3 className="text-xl font-bold text-primary-black">Shipping and seller details</h3>
						<p className="mt-2 text-primary-body">Everything related to this order in one place.</p>
					</div>
				</div>

				<div className="mt-6 grid gap-4 md:grid-cols-4">
					<div className="rounded-xl border border-gray-200 p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Payment</p>
						<p className="mt-2 font-semibold text-primary-black">{(order.paymentMethod || "cod").toUpperCase()}</p>
						<p className="mt-1 text-sm text-primary-body">{order.paymentStatus || "pending"}</p>
					</div>
					<div className="rounded-xl border border-gray-200 p-4 md:col-span-2">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Shipping Address</p>
						<p className="mt-2 text-sm text-primary-black">{order.shipping?.fullName || "N/A"}</p>
						<p className="mt-1 text-sm text-primary-body">{shippingAddress}</p>
					</div>
					<div className="rounded-xl border border-gray-200 p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Seller</p>
						<p className="mt-2 font-semibold text-primary-black">{order.seller?.name || "Seller support"}</p>
						<p className="mt-1 text-sm text-primary-body">{order.seller?.contactName || "Support Team"}</p>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
				<h3 className="text-xl font-bold text-primary-black">Package Status</h3>
				<div className="mt-6 grid gap-4 md:grid-cols-4">
					{steps.map((step) => (
						<div key={step.id} className="rounded-xl border border-gray-200 p-4">
							<div
								className={`flex h-12 w-12 items-center justify-center rounded-full ${
									step.completed ? "bg-primary-blue text-white" : step.current ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-primary-body"
								}`}
							>
								{step.completed ? <Check size={18} /> : step.current ? <Clock size={18} /> : <CircleDashed size={18} />}
							</div>
							<p className="mt-4 font-semibold text-primary-black">{step.label}</p>
							<p className="mt-2 text-sm text-primary-body">
								{step.completed ? "Completed" : step.current ? "Current step" : "Waiting"}
							</p>
						</div>
					))}
				</div>
				<div className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm text-primary-body">
					{order.trackingNote || "Tracking updates will appear here as the order moves forward."}
				</div>
			</div>
		</div>
	);
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<div className="rounded-xl border border-gray-200 p-4">
			<div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-primary-black">{icon}</div>
			<p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">{label}</p>
			<p className="mt-2 font-semibold text-primary-black">{value}</p>
		</div>
	);
}

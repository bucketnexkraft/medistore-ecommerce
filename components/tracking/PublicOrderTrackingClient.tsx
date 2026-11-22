"use client";

import { extractApiError } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { CheckCircle2, CircleDashed, Clock3, PackageCheck, ReceiptText, Search, Truck, User, ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

type TrackingStep = {
	id: number;
	label: string;
	completed: boolean;
	current: boolean;
};

type TrackingOrder = {
	order_id: string;
	status: string;
	status_label: string;
	payment_method: string;
	payment_status: string;
	shipping_amount: number;
	delivery_charge?: number | null;
	total_amount: number;
	estimated_delivery?: string | null;
	tracking_note?: string | null;
	tracking_steps?: TrackingStep[];
	shipping?: {
		full_name?: string | null;
		email?: string | null;
		phone?: string | null;
		address?: string | null;
		division_name?: string | null;
		district_name?: string | null;
		upazila_name?: string | null;
		city?: string | null;
		country?: string | null;
		postal_code?: string | null;
	} | null;
	seller?: {
		name?: string | null;
		contact_name?: string | null;
		email?: string | null;
		phone?: string | null;
		address?: string | null;
	} | null;
	items?: Array<{
		id: string;
		name: string;
		brand_name?: string | null;
		category_name?: string | null;
		quantity: number;
		price: number;
		line_total: number;
		variant_label?: string | null;
		variant_selection?: Record<string, string> | null;
	}>;
};

const formatCurrency = (value: number | string | null | undefined) => Number(value || 0).toFixed(2);
const formatDeliveryCharge = (value: number | string | null | undefined) => {
	const amount = Number(value || 0);

	return amount <= 0 ? "Free" : formatCurrency(amount);
};

const statusToneMap: Record<
	string,
	{
		label: string;
		className: string;
		icon: ReactNode;
	}
> = {
	pending: {
		label: "Pending",
		className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
		icon: <Clock3 size={14} />,
	},
	processing: {
		label: "Processing",
		className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
		icon: <CircleDashed size={14} />,
	},
	shipped: {
		label: "Shipped",
		className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
		icon: <Truck size={14} />,
	},
	delivered: {
		label: "Delivered",
		className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
		icon: <CheckCircle2 size={14} />,
	},
	cancelled: {
		label: "Cancelled",
		className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
		icon: <CircleDashed size={14} />,
	},
};

function getStatusBadge(order: TrackingOrder | null) {
	if (!order) {
		return null;
	}

	const key = order.status?.trim().toLowerCase() || "pending";
	const tone = statusToneMap[key] || {
		label: order.status_label || "In progress",
		className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
		icon: <CircleDashed size={14} />,
	};

	return tone;
}

export function PublicOrderTrackingClient() {
	const searchParams = useSearchParams();
	const [orderNo, setOrderNo] = useState(searchParams.get("orderId") || "");
	const [trackingData, setTrackingData] = useState<TrackingOrder | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const shippingAddress = useMemo(() => {
		if (!trackingData?.shipping) {
			return "Not available";
		}

		return [
			trackingData.shipping.address,
			trackingData.shipping.upazila_name || trackingData.shipping.city,
			trackingData.shipping.district_name,
			trackingData.shipping.division_name,
			trackingData.shipping.country,
			trackingData.shipping.postal_code,
		]
			.filter(Boolean)
			.join(", ");
	}, [trackingData]);

	const statusBadge = getStatusBadge(trackingData);
	const steps = trackingData?.tracking_steps || [];
	const nextStep = trackingData && ["delivered", "cancelled", "returned"].includes(trackingData.status.toLowerCase())
		? undefined
		: steps.find((step) => !step.completed && !step.current);
	const deliveryCharge = trackingData?.delivery_charge ?? trackingData?.shipping_amount ?? 0;

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!orderNo.trim()) {
			setError("Enter your order number.");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await apiFetch("/landing/orders/track", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					order_no: orderNo.trim(),
				}),
			});

			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Tracking details could not be found."));
			}

			setTrackingData(payload.data as TrackingOrder);
		} catch (submitError) {
			setTrackingData(null);
			setError(submitError instanceof Error ? submitError.message : "Tracking details could not be found.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="section py-10 lg:py-14">
			<div className="mx-auto max-w-7xl space-y-8">
				<div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
					<div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(255,255,255,1)_100%)] px-6 py-6 sm:px-8">
						<div className="max-w-3xl">
							<p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Guest Tracking</p>
							<h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
								Track your order with a real-time delivery view
							</h1>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
								Enter your order number to see status, shipping details, and progress updates.
							</p>
						</div>

						<form className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]" onSubmit={handleSubmit}>
							<div className="relative">
								<Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
								<input
									type="text"
									value={orderNo}
									onChange={(event) => setOrderNo(event.target.value)}
									placeholder="Order number, e.g. ORD-20260629-0001"
									className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
								/>
							</div>
							<button
								type="submit"
								disabled={loading}
								className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
							>
								{loading ? "Tracking..." : "Track order"}
								<ArrowRight size={16} />
							</button>
						</form>

						{error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
					</div>

					<div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-8">
						<QuickStat label="Search by" value="Order ID" />
						<QuickStat label="Best for" value="COD and online orders" />
						<QuickStat label="View" value="Delivery progress and summary" />
					</div>
				</div>

				{trackingData ? (
					<div className="space-y-6">
						<div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
							<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
								<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
									<div className="max-w-2xl">
										<div className="flex flex-wrap items-center gap-3">
											{statusBadge ? (
												<span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}>
													{statusBadge.icon}
													{statusBadge.label}
												</span>
											) : null}
											<span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Order tracking</span>
										</div>
										<h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{trackingData.order_id}</h2>
										<p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
											{trackingData.status_label || trackingData.status || "Tracking information updated from the company system."}
										</p>
									</div>

									<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estimated delivery</p>
										<p className="mt-2 text-sm font-semibold text-slate-950">{trackingData.estimated_delivery || "Not available"}</p>
									</div>
								</div>

								<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
									<SummaryCard icon={<Truck size={18} />} label="Current status" value={trackingData.status_label || trackingData.status} />
									<SummaryCard icon={<PackageCheck size={18} />} label="Next step" value={nextStep?.label || "No further steps"} />
									<SummaryCard icon={<ReceiptText size={18} />} label="Payment" value={`${(trackingData.payment_method || "cod").toUpperCase()} / ${trackingData.payment_status || "pending"}`} />
									<SummaryCard icon={<Truck size={18} />} label="Delivery charge" value={formatDeliveryCharge(deliveryCharge)} />
								</div>
							</div>

							<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
								<div className="flex items-center gap-3">
									<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
										<User size={18} />
									</div>
									<div>
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Customer</p>
										<h3 className="mt-1 text-xl font-semibold text-slate-950">{trackingData.shipping?.full_name || "Customer"}</h3>
									</div>
								</div>

								<div className="mt-5 space-y-3 text-sm text-slate-600">
									<p>{trackingData.shipping?.phone || "No phone"}</p>
									<p>{trackingData.shipping?.email || "No email"}</p>
									<p>{shippingAddress}</p>
								</div>

								<div className="mt-6 rounded-2xl bg-slate-50 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seller support</p>
									<p className="mt-2 text-sm font-semibold text-slate-950">{trackingData.seller?.name || "Seller support"}</p>
									<p className="mt-1 text-sm text-slate-600">{trackingData.seller?.contact_name || "Support Team"}</p>
									<p className="mt-1 text-sm text-slate-600">{trackingData.seller?.phone || "No phone"}</p>
									<p className="mt-1 text-sm text-slate-600">{trackingData.seller?.email || "No email"}</p>
									<p className="mt-3 text-sm text-slate-600">
										<span className="font-medium text-slate-950">Delivery charge:</span> {formatDeliveryCharge(deliveryCharge)}
									</p>
									<p className="mt-1 text-sm text-slate-600">
										<span className="font-medium text-slate-950">Destination:</span>{" "}
										{trackingData.shipping?.upazila_name || trackingData.shipping?.district_name || trackingData.shipping?.city || "Not available"}
									</p>
								</div>
							</div>
						</div>

						<div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
							<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
									<div>
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Delivery path</p>
										<h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Package status timeline</h3>
									</div>
									<p className="text-sm text-slate-500">The latest step is highlighted automatically.</p>
								</div>

								<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
									{steps.map((step) => (
										<div key={step.id} className="rounded-2xl border border-slate-200 p-4">
											<div
												className={`flex h-11 w-11 items-center justify-center rounded-full ${
													step.completed
														? "bg-emerald-50 text-emerald-700"
														: step.current
															? "bg-slate-950 text-white"
															: "bg-slate-100 text-slate-500"
												}`}
											>
												{step.completed ? <CheckCircle2 size={18} /> : step.current ? <Clock3 size={18} /> : <CircleDashed size={18} />}
											</div>
											<p className="mt-4 text-sm font-semibold text-slate-950">{step.label}</p>
											<p className="mt-2 text-sm text-slate-500">
												{step.completed ? "Completed" : step.current ? "Current step" : "Waiting"}
											</p>
										</div>
									))}
								</div>

								<div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
									{trackingData.tracking_note || "Tracking updates will appear here as the order moves forward."}
								</div>
							</div>

							<div className="space-y-6">
								<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
									<h3 className="text-xl font-semibold text-slate-950">Recent orders</h3>
									<p className="mt-2 text-sm text-slate-500">Quick switch between your latest tracked orders.</p>
									<div className="mt-5 space-y-3">
										{trackingData.order_id ? (
											<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
												<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active order</p>
												<p className="mt-2 font-semibold text-slate-950">{trackingData.order_id}</p>
												<p className="mt-1 text-sm text-slate-600">{trackingData.status_label || trackingData.status}</p>
											</div>
										) : null}
										<div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
											Recent orders will appear here after you search from the same browser session.
										</div>
									</div>
								</div>

								<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
									<h3 className="text-xl font-semibold text-slate-950">Delivery snapshot</h3>
								<div className="mt-5 space-y-4">
									<DetailRow label="Order total" value={formatCurrency(trackingData.total_amount)} />
									<DetailRow label="Delivery charge" value={formatDeliveryCharge(deliveryCharge)} />
									<DetailRow label="Payment method" value={(trackingData.payment_method || "cod").toUpperCase()} />
									<DetailRow label="Shipping address" value={shippingAddress} />
								</div>
							</div>
							</div>
						</div>

						<div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
							<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
								<div className="flex items-center justify-between gap-4">
									<div>
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Items</p>
										<h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Order contents</h3>
									</div>
									<div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
										{trackingData.items?.length || 0} item(s)
									</div>
								</div>

								<div className="mt-5 space-y-3">
									{(trackingData.items || []).map((item) => (
										<div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div>
													<p className="font-semibold text-slate-950">{item.name}</p>
													<p className="mt-1 text-sm text-slate-600">
														{item.brand_name || "Storefront"} / {item.category_name || "General"}
													</p>
													{item.variant_label ? <p className="mt-1 text-sm text-slate-600">Variant: {item.variant_label}</p> : null}
													<p className="mt-1 text-sm text-slate-600">Qty: {item.quantity}</p>
												</div>
												<div className="text-left sm:text-right">
													<p className="font-semibold text-slate-950">{formatCurrency(item.line_total)}</p>
													<p className="mt-1 text-sm text-slate-600">Unit: {formatCurrency(item.price)}</p>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>

							<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Need help?</p>
								<h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Support summary</h3>
								<div className="mt-5 space-y-4 text-sm text-slate-600">
									<p>
										<span className="font-medium text-slate-950">Payment:</span> {trackingData.payment_status || "pending"}
									</p>
									<p>
										<span className="font-medium text-slate-950">Seller:</span> {trackingData.seller?.name || "Seller support"}
									</p>
									<p>
										<span className="font-medium text-slate-950">Address:</span> {shippingAddress}
									</p>
									<div className="rounded-2xl bg-slate-50 p-4">
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total amount</p>
										<p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(trackingData.total_amount)}</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 shadow-sm sm:p-10">
						<p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Tracking center</p>
						<h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Search an order to see delivery progress</h2>
						<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
							This page is designed for live customer support. Enter an order number to pull the latest status, delivery estimate, and package steps.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function QuickStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
			<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
			<p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
		</div>
	);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
			<p className="text-sm text-slate-500">{label}</p>
			<p className="max-w-[65%] text-right text-sm font-medium text-slate-950">{value}</p>
		</div>
	);
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4">
			<div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-900">{icon}</div>
			<p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
			<p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
		</div>
	);
}

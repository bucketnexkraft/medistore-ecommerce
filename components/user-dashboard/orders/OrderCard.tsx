import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Truck, Download, Undo2, Star } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAmount } from "@/lib/amount";
import { apiFetch } from "@/lib/api-client";
import { Order } from "@/data/user-dashboard-data";
import { toast } from "@/hooks/use-toast";
import { extractApiError, getAuthHeaders } from "@/lib/auth";

interface OrderCardProps {
	order: Order;
	token: string | null;
}

const statusConfig = {
	pending: { bg: "bg-amber-100", border: "border-amber-700", text: "text-amber-700", label: "Pending" },
	processing: { bg: "bg-blue-100", border: "border-blue-700", text: "text-blue-700", label: "Processing" },
	shipped: { bg: "bg-blue-100", border: "border-purple-700", text: "text-purple-700", label: "Shipped" },
	delivered: { bg: "bg-green-100", border: "border-green-700", text: "text-green-700", label: "Delivered" },
	cancelled: { bg: "bg-red-100", border: "border-red-700", text: "text-red-700", label: "Cancelled" },
	returned: { bg: "bg-orange-100", border: "border-orange-700", text: "text-orange-700", label: "Returned" },
	active: { bg: "bg-blue-100", border: "border-blue-700", text: "text-blue-700", label: "Processing" },
};

export function OrderCard({ order, token }: OrderCardProps) {
	const { formatAmount } = useAmount();
	const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.processing;
	const [isDetailsOpen, setIsDetailsOpen] = useState(false);
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [isReturnOpen, setIsReturnOpen] = useState(false);
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const [isSubmittingReview, setIsSubmittingReview] = useState(false);
	const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
	const [returnReason, setReturnReason] = useState("");
	const [selectedReturnItemId, setSelectedReturnItemId] = useState("");
	const [selectedReviewProductId, setSelectedReviewProductId] = useState(order.items[0]?.productId || "");
	const [reviewRating, setReviewRating] = useState(5);
	const [reviewComment, setReviewComment] = useState("");
	const [itemReturnInfo, setItemReturnInfo] = useState<Record<string, NonNullable<Order["items"][number]["return_info"]>>>(
		Object.fromEntries(
			order.items
				.filter((item) => item.return_info)
				.map((item) => [item.id, item.return_info as NonNullable<Order["items"][number]["return_info"]>]),
		),
	);
	const [localReviews, setLocalReviews] = useState<Record<string, { id: string; rating: number; comment?: string | null; createdAt?: string | null }>>(
		Object.fromEntries(order.items.filter((item) => item.productId && item.review).map((item) => [item.productId as string, item.review as NonNullable<typeof item.review>])),
	);
	const shippingAddress = useMemo(() => {
		if (!order.shipping) {
			return "No shipping address saved.";
		}

		return [
			order.shipping.address,
			order.shipping.upazilaName || order.shipping.city,
			order.shipping.districtName,
			order.shipping.divisionName,
			order.shipping.country,
			order.shipping.postalCode,
		].filter(Boolean).join(", ");
	}, [order.shipping]);

	const deliveredItems = useMemo(() => order.items.filter((item) => item.productId), [order.items]);
	const selectedReviewItem = deliveredItems.find((item) => item.productId === selectedReviewProductId) || deliveredItems[0] || null;
	const enrichedItems = useMemo(
		() =>
			order.items.map((item) => ({
				...item,
				return_info: itemReturnInfo[item.id] || item.return_info,
			})),
		[itemReturnInfo, order.items],
	);
	const returnableItems = useMemo(
		() => enrichedItems.filter((item) => item.return_info?.can_request_return),
		[enrichedItems],
	);
	const itemsWithReturnHistory = useMemo(
		() => enrichedItems.filter((item) => item.return_info?.request),
		[enrichedItems],
	);
	const selectedReturnItem = enrichedItems.find((item) => item.id === selectedReturnItemId) || returnableItems[0] || null;
	const canOpenReturnFlow = returnableItems.length > 0;
	const showReturnAction = canOpenReturnFlow || itemsWithReturnHistory.length > 0;
	const returnActionLabel = canOpenReturnFlow ? "Return Product" : "Return Requested";

	useEffect(() => {
		const nextReviews = Object.fromEntries(order.items.filter((item) => item.productId && item.review).map((item) => [item.productId as string, item.review as NonNullable<typeof item.review>]));
		setLocalReviews(nextReviews);
	}, [order.items]);

	useEffect(() => {
		setItemReturnInfo(
			Object.fromEntries(
				order.items
					.filter((item) => item.return_info)
					.map((item) => [item.id, item.return_info as NonNullable<Order["items"][number]["return_info"]>]),
			),
		);
	}, [order.items]);

	useEffect(() => {
		const preferredItem = deliveredItems.find((item) => item.productId && !localReviews[item.productId]) || deliveredItems[0];
		if (preferredItem?.productId) {
			setSelectedReviewProductId(preferredItem.productId);
		}
	}, [deliveredItems, localReviews]);

	useEffect(() => {
		if (!selectedReviewItem?.productId) {
			setReviewRating(5);
			setReviewComment("");
			return;
		}

		const existingReview = localReviews[selectedReviewItem.productId];
		setReviewRating(existingReview?.rating || 5);
		setReviewComment(existingReview?.comment || "");
	}, [localReviews, selectedReviewItem?.productId]);

	useEffect(() => {
		if (!selectedReturnItemId && returnableItems[0]?.id) {
			setSelectedReturnItemId(returnableItems[0].id);
		}
	}, [returnableItems, selectedReturnItemId]);

	const handleDownloadInvoice = async () => {
		if (!token || isDownloadingInvoice) {
			return;
		}

		setIsDownloadingInvoice(true);

		try {
			const response = await apiFetch(`/customer/orders/${order.id}/invoice`, {
				headers: {
					Accept: "application/pdf",
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				let errorMessage = "Invoice PDF could not be downloaded.";

				try {
					const payload = (await response.json()) as { message?: string };
					if (payload?.message) {
						errorMessage = payload.message;
					}
				} catch {
				}

				throw new Error(errorMessage);
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${order.orderId.toLowerCase()}-invoice.pdf`;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			toast({
				title: "Invoice download failed",
				description: error instanceof Error ? error.message : "Invoice PDF could not be downloaded.",
			});
		} finally {
			setIsDownloadingInvoice(false);
		}
	};

	const handleSubmitReview = async () => {
		if (!token || !selectedReviewItem?.productId || isSubmittingReview) {
			return;
		}

		setIsSubmittingReview(true);

		try {
			const response = await apiFetch(`/customer/orders/${order.id}/reviews`, {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					product_id: selectedReviewItem.productId,
					rating: reviewRating,
					comment: reviewComment.trim() || undefined,
				}),
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Review could not be saved."));
			}

			setLocalReviews((current) => ({
				...current,
				[selectedReviewItem.productId as string]: {
					id: String(payload.data?.id || ""),
					rating: Number(payload.data?.rating || reviewRating),
					comment: (payload.data?.comment as string | null | undefined) || null,
					createdAt: (payload.data?.created_at as string | null | undefined) || null,
				},
			}));
			toast({
				title: "Review saved",
				description: "Thanks for rating this product.",
			});
			setIsReviewOpen(false);
		} catch (error) {
			toast({
				title: "Review failed",
				description: error instanceof Error ? error.message : "Review could not be saved.",
			});
		} finally {
			setIsSubmittingReview(false);
		}
	};

	const handleOpenReturn = () => {
		if (!canOpenReturnFlow) {
			return;
		}

		setSelectedReturnItemId(returnableItems[0]?.id || "");
		setReturnReason("");
		setIsReturnOpen(true);
	};

	const handleSubmitReturn = async () => {
		if (!token || !selectedReturnItem || isSubmittingReturn) {
			return;
		}

		const trimmedReason = returnReason.trim();
		if (trimmedReason.length < 3) {
			toast({
				title: "Return reason is required",
				description: "Please describe why you want to return this product.",
			});
			return;
		}

		setIsSubmittingReturn(true);

		try {
			const response = await apiFetch(`/customer/orders/${order.id}/items/${selectedReturnItem.id}/return`, {
				method: "POST",
				headers: getAuthHeaders(token),
				body: JSON.stringify({
					reason: trimmedReason,
				}),
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Return request could not be submitted."));
			}

			setItemReturnInfo((current) => ({
				...current,
				[selectedReturnItem.id]: {
					return_enabled: true,
					return_day: selectedReturnItem.return_info?.return_day ?? null,
					return_condition: selectedReturnItem.return_info?.return_condition ?? [],
					can_request_return: false,
					message: "A return request for this item is already pending.",
					expires_at: selectedReturnItem.return_info?.expires_at ?? null,
					request: payload.data
						? {
								id: String(payload.data.id || ""),
								status: String(payload.data.status || "pending"),
								reason: String(payload.data.reason || trimmedReason),
								refund_amount: Number(payload.data.refund_amount || selectedReturnItem.lineTotal || selectedReturnItem.price || 0),
								rejection_reason: (payload.data.rejection_reason as string | null | undefined) || null,
								requested_at: (payload.data.requested_at as string | null | undefined) || null,
								resolved_at: (payload.data.resolved_at as string | null | undefined) || null,
						  }
						: null,
				},
			}));
			toast({
				title: "Return submitted",
				description: "Your return request has been sent to the company for review.",
			});
			setIsReturnOpen(false);
			setReturnReason("");
		} catch (error) {
			toast({
				title: "Return failed",
				description: error instanceof Error ? error.message : "Return request could not be submitted.",
			});
		} finally {
			setIsSubmittingReturn(false);
		}
	};

	return (
		<div className="bg-white rounded-lg border border-gray-200 shadow overflow-hidden mb-6">
			{/* Header */}
			<div className="py-4 px-6 bg-zinc-100 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div className="flex flex-col sm:flex-row xl:gap-10 gap-6 flex-1">
					<div>
						<p className="tracking-wide mb-1">Order ID</p>
						<h6 className="text-xl font-bold">{order.orderId}</h6>
					</div>
					<div>
						<p className="tracking-wide mb-1">Date</p>
						<h6 className="text-xl font-bold">{order.date}</h6>
					</div>
					<div>
						<p className="tracking-wide mb-1">Total</p>
						<h6 className="text-xl font-bold">{formatAmount(order.total)}</h6>
					</div>
				</div>
				<div className={`${status.bg} ${status.text} ${status.border} border px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap`}>
					{order.statusLabel || status.label}
				</div>
			</div>

			{/* Items */}
			<div className="p-4 sm:p-6 space-y-6">
				{enrichedItems.map((item) => (
					<div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div className="flex items-center gap-4 flex-1">
							<div className="w-16 h-16 p-2 sm:w-20 sm:h-20 shrink-0 bg-gray-100 rounded-lg overflow-hidden">
								<SafeImage unoptimized src={item.image} alt={item.name} width={80} height={80} className="w-full h-full object-contain" />
							</div>
							<div className="flex-1">
								<h3 className="font-bold text-xl">{item.name}</h3>
								<p className="font-medium!">Quantity: {item.quantity}</p>
								{item.return_info?.request ? (
									<p className="mt-1 text-sm font-medium text-primary-blue">
										Return {item.return_info.request.status}
										{item.return_info.request.refund_amount > 0 ? ` • Refund ${formatAmount(item.return_info.request.refund_amount)}` : ""}
									</p>
								) : item.return_info?.return_enabled ? (
									<p className="mt-1 text-sm text-primary-body">
										{item.return_info.can_request_return
											? `Return available${item.return_info.return_day ? ` within ${item.return_info.return_day} day${item.return_info.return_day === 1 ? "" : "s"}` : ""}`
											: item.return_info.message || "Return is not available right now."}
									</p>
								) : null}
							</div>
						</div>
						<p className="text-lg font-bold text-gray-900">{formatAmount(item.price)}</p>
					</div>
				))}
			</div>

			{/* Actions */}
			<div className="w-[96%] h-px bg-secondary-stroke mx-auto" />
			<div className="px-4 sm:px-6 py-5 flex flex-wrap gap-3">
				<button
					onClick={() => setIsDetailsOpen(true)}
					className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer text-gray-900 font-medium hover:bg-gray-100 transition-colors text-sm"
				>
					<Eye size={18} />
					<span className="hidden sm:inline">View Details</span>
				</button>
				<Link
					href={`/user-dashboard/tracking?orderId=${encodeURIComponent(order.orderId)}`}
					className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer text-gray-900 font-medium hover:bg-gray-100 transition-colors text-sm"
				>
					<Truck size={18} />
					<span className="hidden sm:inline">Track Package</span>
				</Link>
				<button
					onClick={handleDownloadInvoice}
					disabled={isDownloadingInvoice || !token}
					className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer text-gray-900 font-medium hover:bg-gray-100 transition-colors text-sm"
				>
					<Download size={18} />
					<span className="hidden sm:inline">{isDownloadingInvoice ? "Downloading PDF..." : "Download Invoice"}</span>
				</button>

				{showReturnAction ? (
					<>
						<button
							onClick={handleOpenReturn}
							disabled={!canOpenReturnFlow}
							className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer text-gray-900 font-medium hover:bg-gray-100 transition-colors text-sm disabled:cursor-not-allowed disabled:opacity-60"
						>
							<Undo2 size={18} />
							<span className="hidden sm:inline">{returnActionLabel}</span>
						</button>
					</>
				) : null}

				{order.status === "delivered" && (
					<>
						<button
							onClick={() => setIsReviewOpen(true)}
							className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer text-gray-900 font-medium hover:bg-gray-100 transition-colors text-sm"
						>
							<Star size={18} />
							<span className="hidden sm:inline">
								{deliveredItems.every((item) => item.productId && localReviews[item.productId]) ? "Update Review" : "Rate Product"}
							</span>
						</button>
					</>
				)}
			</div>

			<Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
				<SheetContent className="w-full max-w-2xl overflow-y-auto p-0 sm:max-w-2xl">
					<SheetHeader className="border-b border-gray-200 bg-zinc-50">
						<SheetTitle className="text-xl">Order Details</SheetTitle>
						<SheetDescription>Full information for order {order.orderId}</SheetDescription>
					</SheetHeader>
					<div className="space-y-6 p-6">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-xl border border-gray-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Order Summary</p>
								<div className="mt-4 space-y-2 text-sm">
									<p><span className="font-semibold text-primary-black">Status:</span> {order.statusLabel || status.label}</p>
									<p><span className="font-semibold text-primary-black">Payment:</span> {(order.paymentMethod || "cod").toUpperCase()} / {order.paymentStatus || "pending"}</p>
									<p><span className="font-semibold text-primary-black">Placed:</span> {order.date}</p>
									<p><span className="font-semibold text-primary-black">Estimated delivery:</span> {order.estimatedDelivery || "Not available"}</p>
									{order.groupPurchase ? (
										<p><span className="font-semibold text-primary-black">Order type:</span> Group Purchase</p>
									) : null}
								</div>
							</div>
							<div className="rounded-xl border border-gray-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Shipping Address</p>
								<div className="mt-4 space-y-2 text-sm">
									<p className="font-semibold text-primary-black">{order.shipping?.fullName || "N/A"}</p>
									<p>{shippingAddress}</p>
									<p>{order.shipping?.phone || "No phone"}</p>
									<p>{order.shipping?.email || "No email"}</p>
								</div>
							</div>
						</div>

						{order.groupPurchase ? (
							<div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Group Purchase</p>
								<div className="mt-4 grid gap-3 text-sm text-primary-black md:grid-cols-2">
									<p><span className="font-semibold">Group status:</span> {order.groupPurchase.status}</p>
									<p><span className="font-semibold">Purchase stage:</span> {order.groupPurchase.purchaseStatus.replaceAll("_", " ")}</p>
									<p><span className="font-semibold">Group price:</span> {formatAmount(order.groupPurchase.discountedPrice)}</p>
									<p><span className="font-semibold">Discount status:</span> {String(order.groupPurchaseDiscountStatus || "pending").replaceAll("_", " ")}</p>
									{order.groupPurchase.purchaseDeadlineAt ? (
										<p><span className="font-semibold">Checkout deadline:</span> {new Date(order.groupPurchase.purchaseDeadlineAt).toLocaleString()}</p>
									) : null}
									{order.groupPurchase.discountUnlockedAt ? (
										<p><span className="font-semibold">Discount unlocked:</span> {new Date(order.groupPurchase.discountUnlockedAt).toLocaleString()}</p>
									) : null}
								</div>
							</div>
						) : null}

						<div className="rounded-xl border border-gray-200 p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Items</p>
							<div className="mt-4 space-y-4">
								{order.items.map((item) => (
									<div key={item.id} className="flex items-start gap-4 rounded-lg border border-gray-100 p-3">
										<div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 p-2">
											<SafeImage unoptimized src={item.image} alt={item.name} width={64} height={64} className="h-full w-full object-contain" />
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-semibold text-primary-black">{item.name}</p>
											<p className="mt-1 text-sm text-primary-body">
												Qty {item.quantity}
												{item.brandName ? ` • ${item.brandName}` : ""}
												{item.categoryName ? ` • ${item.categoryName}` : ""}
											</p>
											<p className="mt-2 text-sm text-primary-body">
												Unit: {formatAmount(item.price)} • Tax: {formatAmount(item.taxAmount ?? 0)}
											</p>
										</div>
										<p className="font-semibold text-primary-black">{formatAmount(item.lineTotal ?? item.price)}</p>
									</div>
								))}
							</div>
						</div>

						<div className="ml-auto w-full rounded-xl border border-gray-200 p-4 md:w-80">
							<div className="flex items-center justify-between text-sm">
								<span>Subtotal</span>
								<span>{formatAmount(order.subtotal ?? order.total)}</span>
							</div>
							<div className="mt-2 flex items-center justify-between text-sm">
								<span>Tax</span>
								<span>{formatAmount(order.taxAmount ?? 0)}</span>
							</div>
							<div className="mt-2 flex items-center justify-between text-sm">
								<span>Shipping</span>
								<span>{formatAmount(order.shippingAmount ?? 0)}</span>
							</div>
							{(order.couponDiscountAmount ?? 0) > 0 ? (
								<div className="mt-2 flex items-center justify-between text-sm text-green-700">
									<span>{order.couponCode ? `Coupon (${order.couponCode})` : "Coupon Discount"}</span>
									<span>-{formatAmount(order.couponDiscountAmount ?? 0)}</span>
								</div>
							) : null}
							{(order.groupDiscountAmount ?? 0) > 0 ? (
								<div className="mt-2 flex items-center justify-between text-sm text-violet-700">
									<span>Group Purchase Discount</span>
									<span>-{formatAmount(order.groupDiscountAmount ?? 0)}</span>
								</div>
							) : null}
							<div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 font-semibold text-primary-black">
								<span>Total</span>
								<span>{formatAmount(order.total)}</span>
							</div>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			<Sheet open={isReturnOpen} onOpenChange={setIsReturnOpen}>
				<SheetContent className="w-full max-w-xl overflow-y-auto p-0 sm:max-w-xl">
					<SheetHeader className="border-b border-gray-200 bg-zinc-50">
						<SheetTitle className="text-xl">Request Return</SheetTitle>
						<SheetDescription>Tell the company why you want to return an item from order {order.orderId}</SheetDescription>
					</SheetHeader>
					<div className="space-y-5 p-6">
						<div className="space-y-3">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Eligible Products</p>
							<div className="space-y-3">
								{returnableItems.map((item) => {
									const isSelected = item.id === selectedReturnItem?.id;

									return (
										<button
											key={item.id}
											type="button"
											onClick={() => setSelectedReturnItemId(item.id)}
											className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
												isSelected ? "border-primary-blue bg-blue-50" : "border-gray-200 hover:bg-gray-50"
											}`}
										>
											<div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100 p-2">
												<SafeImage unoptimized src={item.image} alt={item.name} width={56} height={56} className="h-full w-full object-contain" />
											</div>
											<div className="min-w-0 flex-1">
												<p className="font-semibold text-primary-black">{item.name}</p>
												<p className="mt-1 text-xs text-primary-body">
													Refund {formatAmount(item.lineTotal ?? item.price)}
													{item.return_info?.return_day ? ` • ${item.return_info.return_day} day window` : ""}
												</p>
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{selectedReturnItem ? (
							<div className="space-y-3">
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Return Cause</p>
								<textarea
									value={returnReason}
									onChange={(event) => setReturnReason(event.target.value)}
									rows={6}
									maxLength={2000}
									placeholder={`Why do you want to return ${selectedReturnItem.name}?`}
									className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-blue"
								/>
								{selectedReturnItem.return_info?.return_condition?.length ? (
									<p className="text-xs text-primary-body">
										Return conditions: {selectedReturnItem.return_info.return_condition.join(", ")}
									</p>
								) : null}
								<Button type="button" onClick={handleSubmitReturn} disabled={isSubmittingReturn || !token} className="bg-primary-blue text-white hover:bg-primary-black">
									{isSubmittingReturn ? "Submitting Return..." : "Submit Return Request"}
								</Button>
							</div>
						) : (
							<p className="text-sm text-primary-body">No items are currently eligible for return.</p>
						)}
					</div>
				</SheetContent>
			</Sheet>

			<Sheet open={isReviewOpen} onOpenChange={setIsReviewOpen}>
				<SheetContent className="w-full max-w-xl overflow-y-auto p-0 sm:max-w-xl">
					<SheetHeader className="border-b border-gray-200 bg-zinc-50">
						<SheetTitle className="text-xl">Rate Product</SheetTitle>
						<SheetDescription>Share your feedback for delivered items in order {order.orderId}</SheetDescription>
					</SheetHeader>
					<div className="space-y-5 p-6">
						<div className="space-y-3">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Select Product</p>
							<div className="space-y-3">
								{deliveredItems.map((item) => {
									const isSelected = item.productId === selectedReviewProductId;
									const review = item.productId ? localReviews[item.productId] : null;

									return (
										<button
											key={item.id}
											type="button"
											onClick={() => setSelectedReviewProductId(item.productId || "")}
											className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
												isSelected ? "border-primary-blue bg-blue-50" : "border-gray-200 hover:bg-gray-50"
											}`}
										>
											<div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100 p-2">
												<SafeImage unoptimized src={item.image} alt={item.name} width={56} height={56} className="h-full w-full object-contain" />
											</div>
											<div className="min-w-0 flex-1">
												<p className="font-semibold text-primary-black">{item.name}</p>
												<p className="mt-1 text-xs text-primary-body">
													{review ? `Rated ${review.rating}/5` : "Not rated yet"}
												</p>
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{selectedReviewItem ? (
							<>
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Your Rating</p>
									<div className="mt-3 flex gap-2">
										{[1, 2, 3, 4, 5].map((star) => (
											<button
												key={star}
												type="button"
												onClick={() => setReviewRating(star)}
												className={`rounded-lg border px-3 py-2 transition-colors ${
													star <= reviewRating ? "border-amber-400 bg-amber-50 text-amber-600" : "border-gray-200 text-gray-400 hover:bg-gray-50"
												}`}
											>
												<Star size={18} fill={star <= reviewRating ? "currentColor" : "none"} />
											</button>
										))}
									</div>
								</div>

								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Comment</p>
									<textarea
										value={reviewComment}
										onChange={(event) => setReviewComment(event.target.value)}
										rows={5}
										maxLength={1000}
										placeholder={`Tell others what you think about ${selectedReviewItem.name}`}
										className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-blue"
									/>
								</div>

								<Button type="button" onClick={handleSubmitReview} disabled={isSubmittingReview || !token} className="bg-primary-blue text-white hover:bg-primary-black">
									{isSubmittingReview ? "Saving Review..." : "Save Review"}
								</Button>
							</>
						) : (
							<p className="text-sm text-primary-body">No delivered items are available for rating.</p>
						)}
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}

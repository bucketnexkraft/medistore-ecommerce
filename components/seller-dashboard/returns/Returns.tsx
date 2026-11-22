"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAmount } from "@/lib/amount";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";

type ReturnRequest = {
	id: string;
	status: string;
	reason: string;
	refund_amount: number;
	rejection_reason?: string | null;
	requested_at?: string | null;
	resolved_at?: string | null;
	order?: {
		order_no: string;
		order_status: string;
		placed_at_label?: string | null;
	} | null;
	customer?: {
		name: string;
		email?: string | null;
		phone?: string | null;
	} | null;
	item?: {
		id: string;
		name: string;
		image: string;
		quantity: number;
		line_total: number;
	} | null;
};

const FILTERS = [
	{ id: "all", label: "All" },
	{ id: "pending", label: "Pending" },
	{ id: "approved", label: "Approved" },
	{ id: "rejected", label: "Rejected" },
];

export function Returns() {
	const { token, isAuthenticated, isLoading } = useAuth();
	const { formatAmount } = useAmount();
	const [activeFilter, setActiveFilter] = useState("pending");
	const [requests, setRequests] = useState<ReturnRequest[]>([]);
	const [isFetching, setIsFetching] = useState(true);
	const [isMutatingId, setIsMutatingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const loadRequests = async () => {
		if (!token) {
			setRequests([]);
			setIsFetching(false);
			return;
		}

		setIsFetching(true);
		setError(null);

		try {
			const response = await apiFetch("/company/returns", {
				headers: getAuthHeaders(token),
				cache: "no-store",
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Return requests could not be loaded."));
			}

			setRequests(Array.isArray(payload?.data) ? (payload.data as ReturnRequest[]) : []);
		} catch (fetchError) {
			setError(fetchError instanceof Error ? fetchError.message : "Return requests could not be loaded.");
			setRequests([]);
		} finally {
			setIsFetching(false);
		}
	};

	useEffect(() => {
		if (isLoading) {
			return;
		}

		if (!isAuthenticated || !token) {
			setRequests([]);
			setIsFetching(false);
			return;
		}

		void loadRequests();
	}, [isAuthenticated, isLoading, token]);

	const counts = useMemo(
		() => ({
			all: requests.length,
			pending: requests.filter((item) => item.status === "pending").length,
			approved: requests.filter((item) => item.status === "approved").length,
			rejected: requests.filter((item) => item.status === "rejected").length,
		}),
		[requests],
	);
	const filteredRequests = useMemo(
		() => (activeFilter === "all" ? requests : requests.filter((item) => item.status === activeFilter)),
		[activeFilter, requests],
	);

	const handleApprove = async (requestId: string) => {
		if (!token || isMutatingId) {
			return;
		}

		setIsMutatingId(requestId);

		try {
			const response = await apiFetch(`/company/returns/${requestId}/approve`, {
				method: "PUT",
				headers: getAuthHeaders(token),
				body: JSON.stringify({}),
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Return request could not be approved."));
			}

			setRequests((current) => current.map((item) => (item.id === requestId ? { ...item, ...(payload.data as ReturnRequest) } : item)));
			toast({
				title: "Return approved",
				description: "Refund amount has been credited to the customer balance.",
			});
		} catch (mutationError) {
			toast({
				title: "Approval failed",
				description: mutationError instanceof Error ? mutationError.message : "Return request could not be approved.",
			});
		} finally {
			setIsMutatingId(null);
		}
	};

	const handleReject = async (requestId: string) => {
		if (!token || isMutatingId) {
			return;
		}

		setIsMutatingId(requestId);

		try {
			const response = await apiFetch(`/company/returns/${requestId}/reject`, {
				method: "PUT",
				headers: getAuthHeaders(token),
				body: JSON.stringify({}),
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Return request could not be rejected."));
			}

			setRequests((current) => current.map((item) => (item.id === requestId ? { ...item, ...(payload.data as ReturnRequest) } : item)));
			toast({
				title: "Return rejected",
				description: "The customer return request has been declined.",
			});
		} catch (mutationError) {
			toast({
				title: "Reject failed",
				description: mutationError instanceof Error ? mutationError.message : "Return request could not be rejected.",
			});
		} finally {
			setIsMutatingId(null);
		}
	};

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<UserDashTitle title="Returns" subtitle="Review return requests and credit customer balances after approval" />
				<Button type="button" variant="outline" className="w-fit border-primary-blue text-primary-blue hover:bg-blue-50" onClick={() => void loadRequests()}>
					<RefreshCw size={16} />
					Refresh
				</Button>
			</div>

			<div className="flex flex-wrap gap-3 rounded-lg border bg-white p-2">
				{FILTERS.map((filter) => (
					<button
						key={filter.id}
						type="button"
						onClick={() => setActiveFilter(filter.id)}
						className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
							activeFilter === filter.id ? "bg-purple-100 text-primary-blue" : "text-gray-700 hover:bg-gray-100"
						}`}
					>
						{filter.label} ({counts[filter.id as keyof typeof counts] ?? 0})
					</button>
				))}
			</div>

			{isFetching ? (
				<div className="rounded-xl border bg-white p-8 text-center text-primary-body">Loading return requests...</div>
			) : error ? (
				<div className="rounded-xl border bg-white p-8 text-center">
					<p className="font-semibold text-primary-black">Could not load return requests</p>
					<p className="mt-2 text-sm text-primary-body">{error}</p>
				</div>
			) : filteredRequests.length === 0 ? (
				<div className="rounded-xl border bg-white p-8 text-center text-primary-body">No return requests found for this filter.</div>
			) : (
				<div className="space-y-5">
					{filteredRequests.map((request) => {
						const isPending = request.status === "pending";
						const isBusy = isMutatingId === request.id;

						return (
							<div key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
								<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
									<div className="flex gap-4">
										<div className="h-20 w-20 overflow-hidden rounded-xl bg-gray-100 p-2">
											<SafeImage unoptimized src={request.item?.image || "/images/placeholder.jpg"} alt={request.item?.name || "Returned item"} width={80} height={80} className="h-full w-full object-contain" />
										</div>
										<div className="space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<h3 className="text-lg font-bold text-primary-black">{request.item?.name || "Returned product"}</h3>
												<span className={`rounded-full px-3 py-1 text-xs font-semibold ${
													request.status === "approved"
														? "bg-green-100 text-green-700"
														: request.status === "rejected"
															? "bg-red-100 text-red-700"
															: "bg-amber-100 text-amber-700"
												}`}>
													{request.status}
												</span>
											</div>
											<p className="text-sm text-primary-body">
												Order {request.order?.order_no || "N/A"} • Customer {request.customer?.name || "N/A"}
											</p>
											<p className="text-sm text-primary-body">
												Requested {request.order?.placed_at_label || "recently"} • Qty {request.item?.quantity || 0}
											</p>
											<p className="text-sm text-primary-black">
												<span className="font-semibold">Reason:</span> {request.reason}
											</p>
										</div>
									</div>

									<div className="space-y-3 lg:text-right">
										<div>
											<p className="text-sm text-primary-body">Refund Amount</p>
											<p className="text-2xl font-bold text-primary-black">{formatAmount(request.refund_amount)}</p>
										</div>
										{isPending ? (
											<div className="flex flex-wrap gap-3 lg:justify-end">
												<Button type="button" onClick={() => void handleApprove(request.id)} disabled={isBusy} className="bg-primary-blue text-white hover:bg-primary-black">
													<CheckCircle2 size={16} />
													{isBusy ? "Approving..." : "Approve"}
												</Button>
												<Button type="button" variant="outline" onClick={() => void handleReject(request.id)} disabled={isBusy} className="border-red-300 text-red-600 hover:bg-red-50">
													<XCircle size={16} />
													{isBusy ? "Updating..." : "Reject"}
												</Button>
											</div>
										) : (
											<p className="text-sm text-primary-body">
												{request.status === "approved" ? "Customer balance already credited." : request.rejection_reason || "Return request was rejected."}
											</p>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

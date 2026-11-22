"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BanknoteArrowDown, CircleCheckBig, Clock3, RefreshCw, Wallet } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAmount } from "@/lib/amount";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";

type PayoutRequest = {
	id: string;
	status: string;
	amount: number;
	description: string;
	rejection_reason?: string | null;
	requested_at?: string | null;
	resolved_at?: string | null;
};

type PayoutSummary = {
	wallet_balance: number;
	pending_amount: number;
	completed_amount: number;
	requestable_balance: number;
};

const defaultSummary: PayoutSummary = {
	wallet_balance: 0,
	pending_amount: 0,
	completed_amount: 0,
	requestable_balance: 0,
};

const formatDateTime = (value?: string | null) => {
	if (!value) {
		return "N/A";
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
};

const formatRetryDelay = (seconds: number) => {
	if (seconds < 60) {
		return `${seconds} second${seconds === 1 ? "" : "s"}`;
	}

	const minutes = Math.ceil(seconds / 60);
	return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

const getPayoutErrorMessage = (response: Response, payload: unknown, fallbackMessage: string) => {
	if (response.status === 429) {
		const retryAfter = Number(response.headers.get("retry-after"));
		const waitMessage = Number.isFinite(retryAfter) && retryAfter > 0
			? ` Please wait ${formatRetryDelay(retryAfter)} and try again.`
			: " Please wait a moment and try again.";

		return `You're refreshing too quickly.${waitMessage}`;
	}

	return extractApiError(payload, fallbackMessage);
};

export default function Page() {
	const { token, isAuthenticated, isLoading } = useAuth();
	const { formatAmount } = useAmount();
	const [requests, setRequests] = useState<PayoutRequest[]>([]);
	const [summary, setSummary] = useState<PayoutSummary>(defaultSummary);
	const [amount, setAmount] = useState("");
	const [description, setDescription] = useState("");
	const [isFetching, setIsFetching] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadRequests = useCallback(async (signal?: AbortSignal) => {
		if (!token) {
			setRequests([]);
			setSummary(defaultSummary);
			setIsFetching(false);
			return;
		}

		setIsFetching(true);
		setError(null);

		try {
			const response = await apiFetch("/customer/payout-requests", {
				headers: getAuthHeaders(token),
				cache: "no-store",
				signal,
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(getPayoutErrorMessage(response, payload, "Payout requests could not be loaded."));
			}

			setRequests(Array.isArray(payload?.data) ? (payload.data as PayoutRequest[]) : []);
			setSummary({
				...defaultSummary,
				...(payload?.summary || {}),
			});
		} catch (fetchError) {
			if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
				return;
			}

			setError(fetchError instanceof Error ? fetchError.message : "Payout requests could not be loaded.");
			setRequests([]);
			setSummary(defaultSummary);
		} finally {
			if (!signal?.aborted) {
				setIsFetching(false);
			}
		}
	}, [token]);

	useEffect(() => {
		if (isLoading) {
			return;
		}

		if (!isAuthenticated || !token) {
			setRequests([]);
			setSummary(defaultSummary);
			setIsFetching(false);
			return;
		}

		const controller = new AbortController();
		void loadRequests(controller.signal);

		return () => {
			controller.abort();
		};
	}, [isAuthenticated, isLoading, loadRequests, token]);

	const statusCounts = useMemo(
		() => ({
			pending: requests.filter((item) => item.status === "pending").length,
			completed: requests.filter((item) => item.status === "completed").length,
			rejected: requests.filter((item) => item.status === "rejected").length,
		}),
		[requests],
	);

	const handleSubmit = async () => {
		if (!token || isSubmitting) {
			return;
		}

		const numericAmount = Number(amount);
		if (!numericAmount || numericAmount <= 0) {
			toast({
				title: "Amount required",
				description: "Please enter a valid payout amount.",
			});
			return;
		}

		if (numericAmount > Number(summary.requestable_balance || 0)) {
			toast({
				title: "Amount too high",
				description: "Payout amount cannot exceed your requestable balance.",
			});
			return;
		}

		if (description.trim().length < 3) {
			toast({
				title: "Description required",
				description: "Please tell the company why you are requesting this payout.",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await apiFetch("/customer/payout-requests", {
				method: "POST",
				headers: getAuthHeaders(token),
				body: JSON.stringify({
					amount: numericAmount,
					description: description.trim(),
				}),
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(getPayoutErrorMessage(response, payload, "Payout request could not be submitted."));
			}

			setRequests((current) => [payload.data as PayoutRequest, ...current]);
			setSummary({
				...defaultSummary,
				...(payload?.summary || {}),
			});
			setAmount("");
			setDescription("");
			toast({
				title: "Payout request sent",
				description: "Your request has been sent to the company for approval.",
			});
		} catch (submitError) {
			toast({
				title: "Payout request failed",
				description: submitError instanceof Error ? submitError.message : "Payout request could not be submitted.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<UserDashTitle title="Payouts" subtitle="Request payout from your approved balance and track approval status" />
				<Button type="button" variant="outline" className="w-fit border-primary-blue text-primary-blue hover:bg-blue-50" onClick={() => void loadRequests()}>
					<RefreshCw size={16} />
					Refresh
				</Button>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-blue-100 p-3 text-primary-blue">
							<Wallet size={22} />
						</div>
						<div>
							<p className="text-sm text-primary-body">Current Wallet Balance</p>
							<h2 className="text-3xl font-bold text-primary-black">{formatAmount(summary.wallet_balance)}</h2>
						</div>
					</div>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-amber-100 p-3 text-amber-600">
							<Clock3 size={22} />
						</div>
						<div>
							<p className="text-sm text-primary-body">Pending Payouts</p>
							<h2 className="text-3xl font-bold text-primary-black">{formatAmount(summary.pending_amount)}</h2>
						</div>
					</div>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-green-100 p-3 text-green-600">
							<BanknoteArrowDown size={22} />
						</div>
						<div>
							<p className="text-sm text-primary-body">Available For Request</p>
							<h2 className="text-3xl font-bold text-primary-black">{formatAmount(summary.requestable_balance)}</h2>
						</div>
					</div>
				</div>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 className="text-xl font-bold text-primary-black">Request a Payout</h3>
					<p className="mt-2 text-sm text-primary-body">
						Enter the amount you want to withdraw and a short description. The company will review your request and complete the payout after approval.
					</p>

					<div className="mt-6 space-y-4">
						<div>
							<label className="mb-2 block text-sm font-semibold text-primary-black">Amount</label>
							<input
								type="number"
								min="0"
								step="0.01"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								placeholder="Enter payout amount"
								className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-blue"
							/>
							<p className="mt-2 text-xs text-primary-body">Maximum requestable now: {formatAmount(summary.requestable_balance)}</p>
						</div>

						<div>
							<label className="mb-2 block text-sm font-semibold text-primary-black">Description</label>
							<textarea
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								rows={5}
								maxLength={1000}
								placeholder="Why are you requesting this payout?"
								className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-primary-blue"
							/>
						</div>

						<Button type="button" onClick={handleSubmit} disabled={isSubmitting || Number(summary.requestable_balance || 0) <= 0} className="bg-primary-blue text-white hover:bg-primary-black">
							{isSubmitting ? "Sending Request..." : "Submit Payout Request"}
						</Button>
					</div>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 className="text-xl font-bold text-primary-black">Request Snapshot</h3>
					<div className="mt-5 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
						<div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
							<p className="text-sm text-primary-body">Pending</p>
							<p className="mt-2 text-2xl font-bold text-primary-black">{statusCounts.pending}</p>
						</div>
						<div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
							<p className="text-sm text-primary-body">Completed</p>
							<p className="mt-2 text-2xl font-bold text-primary-black">{statusCounts.completed}</p>
						</div>
						<div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
							<p className="text-sm text-primary-body">Rejected</p>
							<p className="mt-2 text-2xl font-bold text-primary-black">{statusCounts.rejected}</p>
						</div>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
				<h3 className="text-xl font-bold text-primary-black">Payout History</h3>
				<p className="mt-2 text-sm text-primary-body">Track every payout request, approval, and rejection reason from the company.</p>

				{isFetching ? (
					<div className="mt-6 rounded-xl border bg-gray-50 p-8 text-center text-primary-body">Loading payout requests...</div>
				) : error ? (
					<div className="mt-6 rounded-xl border bg-gray-50 p-8 text-center">
						<p className="font-semibold text-primary-black">Could not load payout requests</p>
						<p className="mt-2 text-sm text-primary-body">{error}</p>
					</div>
				) : requests.length === 0 ? (
					<div className="mt-6 rounded-xl border bg-gray-50 p-8 text-center text-primary-body">No payout requests found yet.</div>
				) : (
					<div className="mt-6 space-y-4">
						{requests.map((request) => (
							<div key={request.id} className="rounded-2xl border border-gray-200 p-5">
								<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
									<div className="space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<h4 className="text-lg font-bold text-primary-black">{formatAmount(request.amount)}</h4>
											<span
												className={`rounded-full px-3 py-1 text-xs font-semibold ${
													request.status === "completed"
														? "bg-green-100 text-green-700"
														: request.status === "rejected"
															? "bg-red-100 text-red-700"
															: "bg-amber-100 text-amber-700"
												}`}
											>
												{request.status}
											</span>
										</div>
										<p className="text-sm text-primary-body">{request.description}</p>
										<p className="text-xs text-primary-body">Requested at {formatDateTime(request.requested_at)}</p>
										{request.resolved_at ? <p className="text-xs text-primary-body">Resolved at {formatDateTime(request.resolved_at)}</p> : null}
									</div>

									<div className="md:text-right">
										{request.status === "completed" ? (
											<div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
												<CircleCheckBig size={16} />
												Payout completed
											</div>
										) : request.status === "rejected" ? (
											<div className="max-w-sm rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
												<p className="font-semibold">Rejection reason</p>
												<p className="mt-1">{request.rejection_reason || "The company rejected this payout request."}</p>
											</div>
										) : (
											<p className="text-sm text-primary-body">Waiting for company approval.</p>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

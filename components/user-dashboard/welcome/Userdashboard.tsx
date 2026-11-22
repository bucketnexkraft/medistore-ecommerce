"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { UserDashTitle } from "../common/UserDashTitle";
import { DashboardCardsGrid, type DashboardCardItem } from "./DashboardCards";
import { OrderTracking, type CurrentOrderData } from "./OrderTracking";
import AIRecommend, { type DashboardRecommendation } from "./AIRecommend";

type DashboardPayload = {
	summary: {
		active_orders_count: number;
		wishlist_count: number;
		reward_points: number;
		available_coupons_count: number;
	};
	current_order: CurrentOrderData | null;
	recommendations: DashboardRecommendation[];
};

const formatRetryDelay = (seconds: number) => {
	if (seconds < 60) {
		return `${seconds} second${seconds === 1 ? "" : "s"}`;
	}

	const minutes = Math.ceil(seconds / 60);
	return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

const getDashboardErrorMessage = (response: Response, result: unknown) => {
	if (response.status === 429) {
		const retryAfter = Number(response.headers.get("retry-after"));
		const waitMessage = Number.isFinite(retryAfter) && retryAfter > 0
			? ` Please wait ${formatRetryDelay(retryAfter)} and try again.`
			: " Please wait a moment and try again.";

		return `You're refreshing too quickly.${waitMessage}`;
	}

	if (result && typeof result === "object" && "message" in result && typeof result.message === "string") {
		return result.message;
	}

	return "Could not load dashboard data.";
};

export default function Userdashboard() {
	const { token, isAuthenticated, isLoading: isAuthLoading, clearAuthSession } = useAuth();
	const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isAuthLoading) {
			setIsLoading(true);
			return;
		}

		if (!token || !isAuthenticated) {
			setDashboard(null);
			setIsLoading(false);
			return;
		}

		let isCancelled = false;
		const controller = new AbortController();

		const loadDashboard = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const response = await apiFetch("/customer/dashboard", {
					headers: getAuthHeaders(token),
					cache: "no-store",
					signal: controller.signal,
				});
				const result = await response.json().catch(() => null);

				if (response.status === 401 && !isCancelled) {
					clearAuthSession(token);
				}

				if (!response.ok || result?.status !== 1 || !result?.data) {
					throw new Error(getDashboardErrorMessage(response, result));
				}

				if (!isCancelled) {
					setDashboard(result.data as DashboardPayload);
				}
			} catch (fetchError) {
				if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
					return;
				}

				if (!isCancelled) {
					setDashboard(null);
					setError(fetchError instanceof Error ? fetchError.message : "Could not load dashboard data.");
				}
			} finally {
				if (!isCancelled) {
					setIsLoading(false);
				}
			}
		};

		void loadDashboard();

		return () => {
			isCancelled = true;
			controller.abort();
		};
	}, [clearAuthSession, isAuthLoading, isAuthenticated, token]);

	const cards: DashboardCardItem[] = dashboard
		? [
				{
					id: "active-orders",
					title: "Active Orders",
					value: dashboard.summary.active_orders_count.toLocaleString(),
					description: "Orders on your account",
					iconColor: "bg-blue-100",
					icon: "/icons/user-dashboard/dashboard/box.svg",
				},
				{
					id: "wishlist",
					title: "Wishlist",
					value: dashboard.summary.wishlist_count.toLocaleString(),
					description: "Saved products",
					iconColor: "bg-red-100",
					icon: "/icons/user-dashboard/dashboard/heart.svg",
				},
				{
					id: "reward-points",
					title: "Reward Points",
					value: dashboard.summary.reward_points.toLocaleString(),
					description: "Available reward balance",
					iconColor: "bg-orange-100",
					icon: "/icons/user-dashboard/dashboard/award.svg",
				},
				{
					id: "coupons",
					title: "Available Coupons",
					value: dashboard.summary.available_coupons_count.toLocaleString(),
					description: "Valid coupons today",
					iconColor: "bg-green-100",
					icon: "/icons/user-dashboard/dashboard/tag.svg",
				},
			]
		: [];

	return (
		<div className="overflow-y-auto">
			<UserDashTitle title="Dashboard" subtitle="Discover your dashboard" />

			{isLoading ? (
				<div className="space-y-8">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
						{Array.from({ length: 4 }).map((_, index) => (
							<div key={index} className="h-40 rounded-xl border bg-white shadow animate-pulse" />
						))}
					</div>
					<div className="h-72 rounded-xl border bg-white shadow animate-pulse" />
					<div className="h-96 rounded-xl border bg-white shadow animate-pulse" />
				</div>
			) : error ? (
				<div className="rounded-xl border bg-white p-6 shadow">
					<h2 className="text-2xl font-bold mb-2">Dashboard unavailable</h2>
					<p className="text-primary-body">{error}</p>
				</div>
			) : (
				<>
					<DashboardCardsGrid cards={cards} />
					<OrderTracking order={dashboard?.current_order || null} />
					<AIRecommend products={dashboard?.recommendations || []} />
				</>
			)}
		</div>
	);
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getAuthHeaders, extractApiError } from "@/lib/auth";
import { useAmount } from "@/lib/amount";
import { apiFetch } from "@/lib/api-client";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";

type MyGroupPurchase = {
	id: string;
	status: string;
	joined_count: number;
	minimum_users: number;
	discounted_price: number;
	product: {
		name: string;
		slug: string;
		thumbnail: string;
	} | null;
};

export function UserDashboardGroupPurchases() {
	const { token, isAuthenticated, isLoading: isAuthLoading } = useAuth();
	const { formatAmount } = useAmount();
	const [groups, setGroups] = useState<MyGroupPurchase[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isAuthLoading) {
			return;
		}

		if (!isAuthenticated || !token) {
			setGroups([]);
			setIsLoading(false);
			return;
		}

		let ignore = false;

		const loadGroups = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const response = await apiFetch("/group-purchases/my", {
					headers: getAuthHeaders(token),
					cache: "no-store",
				});
				const payload = await response.json();

				if (!response.ok || payload?.status !== 1) {
					throw new Error(extractApiError(payload, "Could not load your group purchases."));
				}

				if (!ignore) {
					setGroups(Array.isArray(payload?.data) ? payload.data : []);
				}
			} catch (loadError) {
				if (!ignore) {
					setError(loadError instanceof Error ? loadError.message : "Could not load your group purchases.");
				}
			} finally {
				if (!ignore) {
					setIsLoading(false);
				}
			}
		};

		void loadGroups();

		return () => {
			ignore = true;
		};
	}, [isAuthLoading, isAuthenticated, token]);

	return (
		<div className="overflow-y-auto">
			<UserDashTitle title="Group Purchase" subtitle="Track the shopping groups you joined" />

			{isLoading ? (
				<div className="grid gap-4 md:grid-cols-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="h-44 animate-pulse rounded-3xl border bg-white shadow" />
					))}
				</div>
			) : error ? (
				<div className="rounded-3xl border bg-white p-6 shadow">
					<p className="font-semibold text-primary-black">Could not load your group purchases.</p>
					<p className="mt-2 text-primary-body">{error}</p>
				</div>
			) : groups.length === 0 ? (
				<div className="rounded-3xl border bg-white p-8 text-center shadow">
					<p className="text-2xl font-semibold text-primary-black">No active groups yet</p>
					<p className="mt-3 text-primary-body">Start a new group purchase from the shop-together page when you are ready.</p>
					<Link href="/group-purchase" className="mt-5 inline-flex rounded-full bg-primary-blue px-5 py-3 text-sm font-semibold text-white">
						Browse Group Deals
					</Link>
				</div>
			) : (
				<div className="grid gap-5 md:grid-cols-2">
					{groups.map((group) => (
						<Link key={group.id} href={`/group-purchase?group=${encodeURIComponent(group.id)}`} className="rounded-3xl border bg-white p-5 shadow transition hover:-translate-y-1 hover:shadow-lg">
							<p className="text-sm uppercase tracking-[0.18em] text-primary-body">{group.status}</p>
							<h2 className="mt-3 text-xl font-semibold text-primary-black">{group.product?.name || "Group Purchase"}</h2>
							<div className="mt-4 flex items-center gap-2 text-primary-body">
								<Users className="h-4 w-4" />
								<span>
									{group.joined_count} of {group.minimum_users} joined
								</span>
							</div>
							<p className="mt-4 text-2xl font-semibold text-primary-black">{formatAmount(group.discounted_price)}</p>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

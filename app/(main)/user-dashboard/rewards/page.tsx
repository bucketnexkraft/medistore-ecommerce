"use client";

import Link from "next/link";
import { Wallet, Gift } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { useAmount } from "@/lib/amount";
import { getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";

export default function Page() {
	const { user, token } = useAuth();
	const { formatAmount } = useAmount();
	const walletBalance = Number(user?.wallet_balance || 0);
	const [rewardPoints, setRewardPoints] = useState(Number(user?.total_reword || 0));

	useEffect(() => {
		if (!token) return;

		let active = true;
		const loadRewardPoints = async () => {
			try {
				const response = await apiFetch("/customer/dashboard", {
					headers: getAuthHeaders(token),
					cache: "no-store",
				});
				const result = await response.json().catch(() => null);

				if (active && response.ok && result?.status === 1) {
					setRewardPoints(Number(result?.data?.summary?.reward_points || 0));
				}
			} catch {
				// Keep the locally cached value if the refresh request fails.
			}
		};

		void loadRewardPoints();
		return () => {
			active = false;
		};
	}, [token]);

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<UserDashTitle title="Rewards & Balance" subtitle="Track your available return balance and reward points" />
				<Link
					href="/user-dashboard/payouts"
					className="inline-flex w-fit items-center justify-center rounded-md border border-primary-blue px-4 py-2 text-sm font-semibold text-primary-blue transition-colors hover:bg-blue-50"
				>
					Request payout
				</Link>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-blue-100 p-3 text-primary-blue">
							<Wallet size={22} />
						</div>
						<div>
							<p className="text-sm text-primary-body">Available Balance</p>
							<h2 className="text-3xl font-bold text-primary-black">{formatAmount(walletBalance)}</h2>
						</div>
					</div>
					<p className="mt-4 text-sm text-primary-body">Approved product returns are credited here automatically by the company.</p>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-orange-100 p-3 text-orange-600">
							<Gift size={22} />
						</div>
						<div>
							<p className="text-sm text-primary-body">Reward Points</p>
							<h2 className="text-3xl font-bold text-primary-black">{rewardPoints.toLocaleString()}</h2>
						</div>
					</div>
					<p className="mt-4 text-sm text-primary-body">This area combines your loyalty rewards and any return balance visibility in one place.</p>
				</div>
			</div>
		</div>
	);
}

"use client";

import { apiFetch } from "@/lib/api-client";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Copy, Link2, Network, PiggyBank, TrendingUp, Users } from "lucide-react";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { useRouter } from "next/navigation";

type ReferralNode = {
	company_id: string;
	company_name: string;
	referral_code: string;
	level: number;
	wallet_balance: number;
	direct_referrals: number;
	children: ReferralNode[];
};

type ReferralEarning = {
	id: string;
	level: number;
	reward_type: string;
	amount: number;
	status: string;
	credited_at?: string | null;
	source_company?: {
		company_id: string;
		name: string;
		referral_code: string;
	} | null;
	plan_payment?: {
		id: string;
		trx: string;
		amount: number;
		status: string;
	} | null;
};

type ReferralDashboardResponse = {
	referral_code: string;
	referral_link: string;
	wallet_balance: number;
	overview: {
		direct_referrals: number;
		total_downlines: number;
		active_downlines: number;
		wallet_balance: number;
		total_earnings: number;
		pending_earnings: number;
		max_levels: number;
	};
	levels: Array<{ level: number; percentage: number }>;
	tree: ReferralNode[];
	uplines: ReferralNode[];
	recent_earnings: ReferralEarning[];
};

const skeletonClass = "animate-pulse rounded-2xl bg-slate-100";

function formatMoney(value: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 2,
	}).format(Number(value || 0));
}

function NodeCard({ node }: { node: ReferralNode }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-sm font-semibold text-slate-900">{node.company_name}</p>
					<p className="mt-1 text-xs text-slate-500">{node.referral_code || "No code yet"}</p>
				</div>
				<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
					Level {node.level}
				</span>
			</div>
			<div className="mt-4 grid grid-cols-2 gap-3 text-sm">
				<div className="rounded-xl bg-slate-50 p-3">
					<p className="text-xs text-slate-500">Direct</p>
					<p className="mt-1 font-semibold text-slate-900">{node.direct_referrals}</p>
				</div>
				<div className="rounded-xl bg-slate-50 p-3">
					<p className="text-xs text-slate-500">Wallet</p>
					<p className="mt-1 font-semibold text-slate-900">{formatMoney(node.wallet_balance)}</p>
				</div>
			</div>

			{node.children.length > 0 ? (
				<div className="mt-4 space-y-3 border-l border-slate-200 pl-4">
					{node.children.map((child) => (
						<NodeCard key={child.company_id} node={child} />
					))}
				</div>
			) : null}
		</div>
	);
}

export function ReferralDashboard() {
	const router = useRouter();
	const { token } = useAuth();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);
	const [dashboard, setDashboard] = useState<ReferralDashboardResponse | null>(null);

	useEffect(() => {
		let cancelled = false;

		const loadDashboard = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await apiFetch("/referrals/dashboard", {
					headers: getAuthHeaders(token),
					cache: "no-store",
				});

				const payload = await response.json().catch(() => null);

				if (!response.ok || payload?.status !== 1) {
					throw new Error(payload?.message || "Referral dashboard is unavailable right now.");
				}

				if (!cancelled) {
					setDashboard(payload.data as ReferralDashboardResponse);
				}
			} catch (caughtError) {
				if (!cancelled) {
					setError(caughtError instanceof Error ? caughtError.message : "Referral dashboard is unavailable.");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void loadDashboard();

		return () => {
			cancelled = true;
		};
	}, [token]);

	const shareLink = useMemo(() => dashboard?.referral_link || "", [dashboard?.referral_link]);

	const handleCopy = async () => {
		if (!shareLink) {
			return;
		}

		try {
			await navigator.clipboard.writeText(shareLink);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
		}
	};

	if (loading) {
		return (
			<section className="space-y-6">
				<div className="flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
						<ChevronLeft className="h-5 w-5 text-slate-400" />
					</div>
					<div className="space-y-2">
						<div className="h-6 w-56 rounded-full bg-slate-100" />
						<div className="h-4 w-80 rounded-full bg-slate-100" />
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<div className={`${skeletonClass} h-4 w-24`} />
							<div className={`${skeletonClass} mt-4 h-8 w-28`} />
							<div className={`${skeletonClass} mt-3 h-3 w-40`} />
						</div>
					))}
				</div>

				<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
					<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div className={`${skeletonClass} h-5 w-40`} />
						<div className={`${skeletonClass} mt-4 h-48 w-full`} />
					</div>
					<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div className={`${skeletonClass} h-5 w-40`} />
						<div className="mt-4 space-y-3">
							{Array.from({ length: 4 }).map((_, index) => (
								<div key={index} className={`${skeletonClass} h-16 w-full`} />
							))}
						</div>
					</div>
				</div>
			</section>
		);
	}

	if (error) {
		return (
			<section className="space-y-6">
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => router.push("/seller-dashboard")}
						className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
					>
						<ChevronLeft className="h-5 w-5" />
					</button>
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-slate-900">Referrals</h1>
						<p className="text-slate-500">Referral network and earnings dashboard</p>
					</div>
				</div>

				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
					{error}
				</div>
			</section>
		);
	}

	if (!dashboard) {
		return null;
	}

	const stats = [
		{ label: "Direct referrals", value: dashboard.overview.direct_referrals, icon: Users },
		{ label: "All downlines", value: dashboard.overview.total_downlines, icon: Network },
		{ label: "Wallet balance", value: formatMoney(dashboard.overview.wallet_balance), icon: PiggyBank },
		{ label: "Total earnings", value: formatMoney(dashboard.overview.total_earnings), icon: TrendingUp },
	];

	return (
		<section className="space-y-6">
			<UserDashTitle title="Referrals" subtitle="Track the MLM chain, earnings, and invite link from one place." />

			<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">Your referral code</p>
						<div className="mt-2 flex flex-wrap items-center gap-3">
							<span className="rounded-2xl bg-slate-900 px-4 py-2 text-lg font-semibold text-white">
								{dashboard.referral_code || "Not generated yet"}
							</span>
							<button
								type="button"
								onClick={handleCopy}
								className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
							>
								<Copy className="h-4 w-4" />
								{copied ? "Copied" : "Copy invite link"}
							</button>
						</div>
						<p className="mt-3 max-w-2xl text-sm text-slate-500">
							Share this link with new company owners. When they activate a plan, the upline chain receives rewards automatically.
						</p>
					</div>

					<div className="rounded-2xl bg-slate-50 p-4">
						<p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Invite link</p>
						<div className="mt-2 flex max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
							<Link2 className="h-4 w-4 shrink-0 text-slate-400" />
							<p className="truncate text-sm text-slate-700">{shareLink || "No invite link available"}</p>
						</div>
					</div>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{stats.map((stat) => {
					const Icon = stat.icon;

					return (
						<div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<div className="flex items-center justify-between">
								<p className="text-sm font-medium text-slate-500">{stat.label}</p>
								<Icon className="h-4 w-4 text-violet-600" />
							</div>
							<div className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{stat.value}</div>
						</div>
					);
				})}
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
				<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Referral tree</p>
							<h2 className="mt-2 text-2xl font-semibold text-slate-900">Chain structure</h2>
						</div>
						<span className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
							{dashboard.levels.map((level) => `L${level.level} ${level.percentage}%`).join(" / ")}
						</span>
					</div>

					<div className="mt-6 space-y-4">
						{dashboard.tree.length > 0 ? (
							dashboard.tree.map((node) => <NodeCard key={node.company_id} node={node} />)
						) : (
							<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
								No downlines yet. Share your invite link to start building the chain.
							</div>
						)}
					</div>
				</div>

				<div className="space-y-6">
					<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
						<p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Upline chain</p>
						<div className="mt-4 space-y-3">
							{dashboard.uplines.length > 0 ? (
								dashboard.uplines.map((node) => (
									<div key={node.company_id} className="rounded-2xl bg-slate-50 p-4">
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className="text-sm font-semibold text-slate-900">{node.company_name}</p>
												<p className="text-xs text-slate-500">{node.referral_code}</p>
											</div>
											<span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
												Level {node.level}
											</span>
										</div>
									</div>
								))
							) : (
								<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
									This company does not have an upline yet.
								</div>
							)}
						</div>
					</div>

					<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
						<p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Reward rules</p>
						<div className="mt-4 space-y-3">
							{dashboard.levels.map((level) => (
								<div key={level.level} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
									<span className="text-sm font-medium text-slate-700">Level {level.level}</span>
									<span className="text-sm font-semibold text-slate-900">{level.percentage}%</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Recent earnings</p>
						<h2 className="mt-2 text-2xl font-semibold text-slate-900">Ledger</h2>
					</div>
				</div>

				<div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
					<div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
						<div className="col-span-3">Source</div>
						<div className="col-span-2">Type</div>
						<div className="col-span-1">Lvl</div>
						<div className="col-span-2">Amount</div>
						<div className="col-span-2">Status</div>
						<div className="col-span-2">Date</div>
					</div>

					{dashboard.recent_earnings.length > 0 ? (
						dashboard.recent_earnings.map((earning) => (
							<div key={earning.id} className="grid grid-cols-12 gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
										<div className="col-span-3 truncate text-slate-900">
									{earning.source_company?.name || earning.source_company?.company_id || "-"}
								</div>
								<div className="col-span-2 text-slate-600">{earning.reward_type}</div>
								<div className="col-span-1 text-slate-600">{earning.level}</div>
								<div className="col-span-2 font-semibold text-slate-900">{formatMoney(earning.amount)}</div>
								<div className="col-span-2 text-slate-600">{earning.status}</div>
								<div className="col-span-2 text-slate-500">{earning.credited_at ? new Date(earning.credited_at).toLocaleDateString() : "-"}</div>
							</div>
						))
					) : (
						<div className="px-4 py-6 text-sm text-slate-500">No rewards recorded yet.</div>
					)}
				</div>
			</div>
		</section>
	);
}

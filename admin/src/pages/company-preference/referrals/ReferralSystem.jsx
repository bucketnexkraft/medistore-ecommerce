import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Pagination from "../../../components/common/Pagination";
import { createReferralPayout, getReferralDashboard, getReferralPayouts } from "../../../api/referral";
import {
  PiCoins,
  PiCopy,
  PiNetwork,
  PiPiggyBank,
  PiUsersThree,
} from "react-icons/pi";
import { hasPermission } from "../../../utils/permissions";

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(amount);
};

const buildEmptyRecentMeta = () => ({
  current_page: 1,
  last_page: 1,
});

function TreeNode({ node, level = 0 }) {
  const children = Array.isArray(node?.children) ? node.children : [];

  return (
    <div className={level === 0 ? "space-y-3" : "ml-5 border-l border-slate-200 pl-4 space-y-3"}>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {node?.company_name || node?.name || node?.owner_name || "Unnamed company"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Code: {node?.referral_code || "N/A"} · Level: {node?.level ?? level}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Direct: {formatNumber(node?.direct_referrals || 0)}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Active: {formatNumber(node?.active_referrals || 0)}
            </span>
          </div>
        </div>
      </div>

      {children.length > 0 ? (
        <div className="space-y-3">
          {children.map((child, index) => (
            <TreeNode key={`${child?.company_id || child?.id || index}`} node={child} level={level + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReferralSystem() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [dashboard, setDashboard] = useState(null);
  const [recentMeta, setRecentMeta] = useState(buildEmptyRecentMeta());
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [copyState, setCopyState] = useState("");
  const [payoutData, setPayoutData] = useState({ data: [], settings: {}, summary: {} });
  const [payoutForm, setPayoutForm] = useState({ amount: "", payout_method: "", account_information: "", description: "" });
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const loadDashboard = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const response = await getReferralDashboard(accessToken, { page });
        const payload = response?.data || response || {};
        const data = payload?.data || payload;

        setDashboard(data || null);
        setRecentMeta(data?.pagination || buildEmptyRecentMeta());
      } catch (error) {
        toast.error(error.message || "Failed to load referral dashboard");
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    loadDashboard(currentPage);
  }, [currentPage, loadDashboard]);

  const loadPayouts = useCallback(async () => {
    try {
      const result = await getReferralPayouts(accessToken);
      setPayoutData(result || { data: [], settings: {}, summary: {} });
      const methods = result?.settings?.methods || [];
      setPayoutForm((current) => ({ ...current, payout_method: current.payout_method || methods[0] || "" }));
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to load payout settings");
    }
  }, [accessToken]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const submitPayout = async (event) => {
    event.preventDefault();
    setSubmittingPayout(true);
    try {
      const result = await createReferralPayout(accessToken, {
        amount: payoutForm.amount,
        payout_method: payoutForm.payout_method,
        payout_details: { account_information: payoutForm.account_information },
        description: payoutForm.description,
      });
      toast.success(result?.message || "Payout request submitted");
      setPayoutForm((current) => ({ ...current, amount: "", account_information: "", description: "" }));
      await Promise.all([loadPayouts(), loadDashboard(currentPage)]);
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error.message || "Payout request failed");
    } finally {
      setSubmittingPayout(false);
    }
  };

  const recentEarnings = useMemo(() => {
    const source = dashboard?.recent_earnings;
    if (Array.isArray(source)) {
      return source;
    }
    if (Array.isArray(source?.data)) {
      return source.data;
    }
    return [];
  }, [dashboard]);

  const levels = useMemo(() => (Array.isArray(dashboard?.levels) ? dashboard.levels : []), [dashboard]);
  const uplines = useMemo(() => (Array.isArray(dashboard?.uplines) ? dashboard.uplines : []), [dashboard]);
  const tree = useMemo(() => (Array.isArray(dashboard?.tree) ? dashboard.tree : []), [dashboard]);
  const rules = useMemo(() => dashboard?.rules || {}, [dashboard]);

  const copyReferralCode = async () => {
    const referralCode = dashboard?.referral_code || "";
    if (!referralCode) {
      toast.error("Referral code is not available yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(referralCode);
      setCopyState("Copied");
      toast.success("Referral code copied");
      window.setTimeout(() => setCopyState(""), 1500);
    } catch {
      toast.error("Unable to copy referral code");
    }
  };

  const summaryCards = [
    {
      label: "Direct referrals",
      value: dashboard?.overview?.direct_referrals ?? 0,
      icon: PiUsersThree,
      tone: "from-blue-500 to-cyan-500",
    },
    {
      label: "Total downlines",
      value: dashboard?.overview?.total_downlines ?? 0,
      icon: PiNetwork,
      tone: "from-violet-500 to-fuchsia-500",
    },
    {
      label: "Active downlines",
      value: dashboard?.overview?.active_downlines ?? 0,
      icon: PiPiggyBank,
      tone: "from-emerald-500 to-teal-500",
    },
    {
      label: "Wallet balance",
      value: formatCurrency(dashboard?.overview?.wallet_balance ?? 0),
      icon: PiCoins,
      tone: "from-amber-500 to-orange-500",
    },
  ];

  if (!hasPermission("general-preferences.view")) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 figtree-regular">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Company Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Referral System</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Track the MLM chain, referral code, rewards, and activation earnings from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={copyReferralCode}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <PiCopy className="text-base" />
            {copyState || "Copy Code"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.tone} text-white`}>
                    <Icon className="text-xl" />
                  </div>
                  <p className="mt-4 text-sm text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{card.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Referral Bonus Payout</h2>
              <p className="mt-1 text-sm text-slate-500">
                Available: {formatCurrency(payoutData?.summary?.requestable_balance ?? dashboard?.overview?.wallet_balance ?? 0)}
              </p>

              {payoutData?.settings?.enabled ? (
                <form className="mt-4 space-y-3" onSubmit={submitPayout}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="number" min={payoutData.settings.minimum_amount || 0.01} max={payoutData.settings.maximum_amount || undefined} step="0.01" required className="input input-bordered w-full" placeholder={`Amount (min ${payoutData.settings.minimum_amount || 0})`} value={payoutForm.amount} onChange={(e) => setPayoutForm((current) => ({ ...current, amount: e.target.value }))} />
                    <select required className="select select-bordered w-full" value={payoutForm.payout_method} onChange={(e) => setPayoutForm((current) => ({ ...current, payout_method: e.target.value }))}>
                      {(payoutData.settings.methods || []).map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </div>
                  <textarea required rows={3} className="textarea textarea-bordered w-full" placeholder="Account number, wallet number, bank and account name" value={payoutForm.account_information} onChange={(e) => setPayoutForm((current) => ({ ...current, account_information: e.target.value }))} />
                  <input className="input input-bordered w-full" placeholder="Optional note" value={payoutForm.description} onChange={(e) => setPayoutForm((current) => ({ ...current, description: e.target.value }))} />
                  {payoutData.settings.instructions ? <p className="text-xs text-slate-500">{payoutData.settings.instructions}</p> : null}
                  <button type="submit" className="btn btn-primary w-full" disabled={submittingPayout}>{submittingPayout ? "Submitting..." : "Request Payout"}</button>
                </form>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Referral payouts are currently disabled by backoffice.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Payout History</h2>
              <div className="mt-4 space-y-3">
                {(payoutData?.data || []).length ? payoutData.data.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                    <div><p className="font-semibold text-slate-900">{item.payout_method || "Payout"}</p><p className="text-xs text-slate-500">{item.requested_at || "N/A"}</p></div>
                    <div className="text-right"><p className="font-semibold">{formatCurrency(item.amount)}</p><p className="text-xs capitalize text-slate-500">{item.status}</p></div>
                  </div>
                )) : <p className="text-sm text-slate-500">No payout requests yet.</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Referral Code</h2>
                  <p className="mt-1 text-sm text-slate-500">Share this code with new company signups.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {dashboard?.referral_code || "N/A"}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Referral Code</p>
                  <p className="mt-2 break-all text-sm font-medium text-slate-900">
                    {dashboard?.referral_code || "Not available yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyReferralCode}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <PiCopy />
                  Copy
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">Total earnings</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {formatCurrency(dashboard?.overview?.total_earnings || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">Pending earnings</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {formatCurrency(dashboard?.overview?.pending_earnings || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Reward Rules</h2>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Signup bonus</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {formatCurrency(rules?.signup_bonus || 0)}
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {levels.length > 0 ? (
                  levels.map((level) => (
                    <div key={`${level.level}-${level.reward_type}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Level {level.level}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {level.reward_type || "Reward"} · {Number(level.percentage || 0).toFixed(2)}%
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Active
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No reward rules found.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Upline Chain</h2>
              <div className="mt-4 space-y-3">
                {uplines.length > 0 ? (
                  uplines.map((upline, index) => (
                    <div key={`${upline?.company_id || index}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {upline?.company_name || upline?.name || "Upline"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Level {upline?.level ?? index + 1}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {formatCurrency(upline?.reward_amount || 0)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No upline chain yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">Recent Earnings</h2>
                <span className="text-xs font-medium text-slate-500">
                  {formatNumber(recentMeta?.current_page || 1)} / {formatNumber(recentMeta?.last_page || 1)}
                </span>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="divide-y divide-slate-200">
                  {recentEarnings.length > 0 ? (
                    recentEarnings.map((earning) => (
                      <div key={earning.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {earning?.source_company?.name || earning?.sourceCompany?.name || "Referral reward"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Level {earning?.level ?? 0} · {earning?.reward_type || "Reward"} · {earning?.credited_at || "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-950">
                            {formatCurrency(earning?.amount || 0)}
                          </p>
                          <p className="text-xs text-slate-500">{earning?.status || "N/A"}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      No referral earnings yet.
                    </div>
                  )}
                </div>
              </div>

              {recentMeta?.last_page > 1 ? (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    lastPage={recentMeta.last_page || 1}
                    handlePrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    handlePageChange={(page) => setCurrentPage(page)}
                    handleNextPage={() => setCurrentPage((prev) => Math.min(recentMeta.last_page || 1, prev + 1))}
                    showPrevious={currentPage > 1}
                    showNext={currentPage < (recentMeta.last_page || 1)}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Referral Tree</h2>
            <p className="mt-1 text-sm text-slate-500">Nested chain below the current company.</p>

            <div className="mt-5 space-y-4">
              {tree.length > 0 ? (
                tree.map((node, index) => <TreeNode key={`${node?.company_id || index}`} node={node} />)
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No referral tree data found.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

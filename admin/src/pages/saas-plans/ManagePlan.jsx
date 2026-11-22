import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  PiArrowLeft,
  PiArrowRight,
  PiCheckCircle,
  PiClock,
  PiCoins,
  PiReceipt,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import { getAvailablePlans, getPlanPayments } from "../../api/companyOnboarding";
import { setPlanAccess } from "../../slice/authSlice";

const formatPlanPrice = (plan) => {
  if (!plan) return "-";
  if (plan?.plan_type === "commission") {
    return `${Number(plan?.commission_rate || 0).toFixed(2)}${plan?.commission_type === "fixed" ? "" : "%"} per order`;
  }
  if (plan?.is_free === "free") return "Free";
  return `${Number(plan?.price || 0).toFixed(2)} / ${plan?.billing_period || "plan"}`;
};

export default function ManagePlan() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const selectedPlanId = useSelector((state) => state.auth.selected_plan_id);

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === String(selectedPlanId)) || null,
    [plans, selectedPlanId]
  );

  const pendingPlanPayment = useMemo(
    () =>
      payments.find(
        (payment) => String(payment?.status || "").toLowerCase() === "pending"
      ) || null,
    [payments]
  );

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.price || 0) - Number(b.price || 0)),
    [plans]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResult, paymentsResult] = await Promise.all([
        getAvailablePlans(accessToken),
        getPlanPayments(accessToken, { perPage: 20 }),
      ]);

      if (!plansResult?.status) {
        throw new Error(plansResult?.message || "Failed to load plans");
      }

      setPlans(Array.isArray(plansResult?.data) ? plansResult.data : []);
      setPayments(Array.isArray(paymentsResult?.data?.payments) ? paymentsResult.data.payments : []);

      dispatch(
        setPlanAccess({
          selected_plan_id: plansResult?.selected_plan_id || null,
          has_active_plan: !!plansResult?.has_active_plan,
          needs_plan_selection:
            typeof plansResult?.needs_plan_selection === "boolean"
              ? plansResult.needs_plan_selection
              : !plansResult?.has_active_plan,
          selected_plan: plansResult?.selected_plan || null,
          selected_plan_features: plansResult?.selected_plan?.effective_features || plansResult?.selected_plan?.features || [],
        })
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, [accessToken, dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-4">
        <TableLoading />
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-slate-50 p-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          to="/subscription/overview"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          <PiArrowLeft size={16} />
          Back to subscription
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">Manage plan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Upgrade to a higher plan right away, or review the current and pending subscription requests.
        </p>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Change plan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your current plan is highlighted. Upgrade actions will continue to the proper purchase flow.
        </p>

        <div className="mt-6 divide-y divide-slate-200">
          {sortedPlans.map((plan) => {
            const isCurrent = String(plan.id) === String(selectedPlanId);
            const isPending = String(plan.id) === String(pendingPlanPayment?.saas_plan_id || pendingPlanPayment?.plan?.id || "");
            const buttonLabel = isCurrent ? "Current" : isPending ? "Pending" : "Upgrade";
            const buttonDisabled = isCurrent || isPending;

            return (
              <div key={plan.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-bold text-slate-950">{plan.name}</h3>
                    {isCurrent && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Current
                      </span>
                    )}
                    {isPending && !isCurrent && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-lg text-slate-700">{formatPlanPrice(plan)}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {plan.description || "Plan details are available in the plans page."}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={buttonDisabled}
                  onClick={() => navigate("/subscription/plans")}
                  className={`btn h-12 min-h-12 rounded-2xl px-5 ${
                    isCurrent
                      ? "btn-disabled border-slate-200 bg-slate-100 text-slate-500"
                      : "border-0 bg-violet-700 text-white hover:bg-violet-800"
                  }`}
                >
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Subscription controls</h2>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <PiClock size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Pause subscription</h3>
                  <p className="text-sm text-slate-500">
                    Subscription pause is not available yet in this workflow.
                  </p>
                </div>
              </div>
              <button type="button" disabled className="btn h-11 min-h-11 rounded-2xl border border-slate-200 bg-white text-slate-400">
                Pause
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                  <PiCoins size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Payment method</h3>
                  <p className="text-sm text-slate-500">
                    Paid plans use checkout. Commission plans do not require checkout and are settled later from billing.
                  </p>
                </div>
              </div>
              <button type="button" disabled className="btn h-11 min-h-11 rounded-2xl border border-slate-200 bg-white text-slate-400">
                Change method
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-3xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-rose-700">
                  <PiCheckCircle size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Cancel subscription</h3>
                  <p className="text-sm text-slate-500">
                    Cancellation flow is not enabled yet. Contact backoffice if needed.
                  </p>
                </div>
              </div>
              <button type="button" disabled className="btn h-11 min-h-11 rounded-2xl border border-rose-200 bg-white text-rose-300">
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <PiCheckCircle size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Current status</h2>
                <p className="text-sm text-slate-500">
                  {selectedPlan ? `${selectedPlan.name} is active on this workspace.` : "No active plan is selected yet."}
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/subscription/billing-history"
            className="flex items-center justify-between rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <PiReceipt size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Billing history</h2>
                <p className="text-sm text-slate-500">View invoices and subscription payment requests.</p>
              </div>
            </div>
            <PiArrowRight size={20} className="text-slate-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}

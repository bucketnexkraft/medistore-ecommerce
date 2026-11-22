import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  PiArrowRight,
  PiCheckCircle,
  PiClock,
  PiCoins,
  PiReceipt,
  PiRows,
} from "react-icons/pi";
import { formatFeatureLabel } from "../../config/constants";
import { normalizePlanFeatures } from "../../utils/planFeatures";

export default function SubscriptionOverview() {
  const selectedPlan = useSelector((state) => state.auth.selected_plan);
  const hasActivePlan = useSelector((state) => state.auth.has_active_plan);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const currentFeatures = normalizePlanFeatures(selectedPlanFeatures).slice(0, 6);

  return (
    <div className="space-y-5 bg-slate-50 p-4">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
            <PiCoins size={14} />
            Subscription
          </div>
          <h1 className="mt-4 text-3xl font-bold">Your current subscription</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100/90">
            Review your active plan, see what is unlocked, and jump straight to
            upgrade or billing actions.
          </p>
        </div>

        <div className="grid gap-4 p-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Active Plan
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {selectedPlan?.name || "No active plan"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {hasActivePlan
                ? "Your workspace can keep using the features included in this plan."
                : "Choose a subscription plan to unlock company features."}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Billing
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {selectedPlan?.plan_type === "commission"
                ? `${Number(selectedPlan?.commission_rate || 0).toFixed(2)}${selectedPlan?.commission_type === "fixed" ? "" : "%"} commission`
                : selectedPlan?.is_free === "free"
                ? `${selectedPlan?.trial_period || 0} day trial`
                : selectedPlan?.billing_period || "Not selected"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {selectedPlan?.plan_type === "commission"
                ? "Commission plans generate payable dues from each ecommerce order."
                : "Free plans use trial period. Paid plans use billing period."}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Quick Actions
            </p>
            <div className="mt-4 space-y-2">
              <Link to="/subscription/plans" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                <span>Compare plans</span>
                <PiArrowRight size={18} />
              </Link>
              <Link to="/subscription/billing-history" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                <span>Billing history</span>
                <PiArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <PiRows size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Unlocked features</h2>
              <p className="text-sm text-slate-500">The modules currently included in your subscription.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {currentFeatures.length > 0 ? (
              currentFeatures.map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
                >
                  <PiCheckCircle size={16} />
                  {formatFeatureLabel(feature)}
                </span>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No feature modules are unlocked yet in the current plan.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Link to="/subscription/plans" className="block rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <PiClock size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Manage plan</h2>
                <p className="text-sm text-slate-500">Upgrade your current plan or review subscription status.</p>
              </div>
            </div>
          </Link>

          <Link to="/subscription/billing-history" className="block rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <PiReceipt size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Billing history</h2>
                <p className="text-sm text-slate-500">Review submitted payments and approval status.</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

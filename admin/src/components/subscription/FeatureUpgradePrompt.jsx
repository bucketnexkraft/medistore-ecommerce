import { Link } from "react-router-dom";
import { PiArrowRight, PiCheckCircle, PiLockKey, PiRocketLaunch } from "react-icons/pi";
import { formatFeatureLabel } from "../../config/constants";

export default function FeatureUpgradePrompt({
  featureCode,
  currentPlanName = "",
}) {
  const featureLabel = formatFeatureLabel(featureCode);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
            <PiLockKey size={14} />
            Upgrade Required
          </div>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl">
            {featureLabel} is not included in your current plan
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100/90 md:text-base">
            This module stays visible so your team can discover it, but access
            needs a plan upgrade before you can open and use it.
          </p>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-bold text-slate-950">What happens next</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <PiCheckCircle size={18} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Compare available plans</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Review plan features and pick one that unlocks {featureLabel}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <PiRocketLaunch size={18} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Upgrade from subscription</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Once the new plan is active, this module will open normally.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Current Plan
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {currentPlanName || "No active plan"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Upgrade from the subscription center to unlock this feature for your company.
            </p>

            <div className="mt-6 space-y-3">
              <Link
                to="/subscription/plans"
                className="btn h-12 w-full rounded-2xl border-0 bg-slate-950 text-white hover:bg-slate-800"
              >
                View Plans
                <PiArrowRight size={18} />
              </Link>
              <Link
                to="/subscription/plans"
                className="btn h-12 w-full rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                Manage Subscription
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiArrowLeft, PiCheckCircle, PiPercent, PiRocketLaunch } from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import { getAvailablePlans, selectCompanyPlan } from "../../api/companyOnboarding";
import { clearProductSettingsCache } from "../../api/productSettings";
import { setPlanAccess } from "../../slice/authSlice";
import { formatFeatureLabel } from "../../config/constants";
import { normalizePlanFeatures } from "../../utils/planFeatures";

export default function CommissionPlanCheckout() {
  const { planId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const selectedPlanId = useSelector((state) => state.auth.selected_plan_id);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [plans, setPlans] = useState([]);

  const chosenPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === String(planId)) || null,
    [planId, plans]
  );

  const features = useMemo(() => normalizePlanFeatures(chosenPlan), [chosenPlan]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAvailablePlans(accessToken);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load plans");
      }

      const nextPlans = Array.isArray(result?.data) ? result.data : [];
      setPlans(nextPlans);

      if (!nextPlans.some((plan) => String(plan.id) === String(planId) && plan?.plan_type === "commission")) {
        toast.error("Selected commission plan was not found.");
        navigate("/subscription/plans", { replace: true });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load commission plan");
      navigate("/subscription/plans", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [accessToken, navigate, planId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleActivate = async () => {
    if (!chosenPlan) return;

    setProcessing(true);
    try {
      const result = await selectCompanyPlan(accessToken, { plan_id: chosenPlan.id });
      if (!result?.status) {
        throw new Error(result?.message || "Failed to activate commission plan");
      }

      dispatch(
        setPlanAccess({
          selected_plan_id: chosenPlan.id,
          has_active_plan: true,
          needs_plan_selection: false,
          selected_plan: chosenPlan,
          selected_plan_features: chosenPlan.effective_features || chosenPlan.features || [],
          needs_ecommerce_setup: Boolean(result?.data?.needs_ecommerce_setup),
        })
      );
      clearProductSettingsCache();
      toast.success(result?.message || "Commission plan activated successfully.");
      navigate("/subscription/overview", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to activate commission plan");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 md:p-8">
        <div className="mx-auto max-w-[1344px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <TableLoading />
        </div>
      </div>
    );
  }

  if (!chosenPlan) {
    return null;
  }

  const isCurrent = String(chosenPlan.id) === String(selectedPlanId);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 md:p-8">
      <div className="mx-auto max-w-[1344px] space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <Link to="/subscription/plans" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
            <PiArrowLeft size={16} />
            Back to plans
          </Link>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
            <PiPercent size={14} />
            Commission based plan
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-950">{chosenPlan.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            This plan activates instantly. Instead of fixed subscription billing, your company will pay commission on each ecommerce order.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-bold text-slate-950">Unlocked features</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {features.length > 0 ? (
                features.map((feature) => (
                  <span key={feature} className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                    <PiCheckCircle size={16} />
                    {formatFeatureLabel(feature)}
                  </span>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No explicit feature list was configured for this plan yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Commission Rate
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">
                {Number(chosenPlan?.commission_rate || 0).toFixed(2)}
                {chosenPlan?.commission_type === "fixed" ? "" : "%"}
              </h2>
              <p className="mt-2 text-sm text-slate-500 capitalize">
                Charged on {String(chosenPlan?.commission_base || "total_amount").replace(/_/g, " ")} for each ecommerce order.
              </p>
            </div>

            <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
              <div className="flex items-start gap-3">
                <PiRocketLaunch size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">How billing works</p>
                  <p className="mt-1 text-sm">
                    Orders create commission dues automatically. Your company can review and pay them from the subscription billing page using bank or MFS instructions.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={processing || isCurrent}
                onClick={handleActivate}
                className="btn h-12 w-full rounded-2xl border-0 bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-300"
              >
                {isCurrent ? "Current Plan" : processing ? "Activating..." : "Activate Commission Plan"}
              </button>
              <Link to="/subscription/plans" className="btn h-12 w-full rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                Choose another plan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

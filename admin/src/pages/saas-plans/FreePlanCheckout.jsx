import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiArrowLeft, PiCheckCircle, PiCoins, PiRocketLaunch } from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import { getAvailablePlans, selectCompanyPlan } from "../../api/companyOnboarding";
import { clearProductSettingsCache } from "../../api/productSettings";
import { setPlanAccess } from "../../slice/authSlice";
import { formatFeatureLabel } from "../../config/constants";
import { normalizePlanFeatures } from "../../utils/planFeatures";

export default function FreePlanCheckout() {
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

      if (!nextPlans.some((plan) => String(plan.id) === String(planId) && plan?.is_free === "free")) {
        toast.error("Selected free plan was not found.");
        navigate("/subscription/plans", { replace: true });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load free plan");
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
        throw new Error(result?.message || "Failed to activate free plan");
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
      toast.success(result?.message || "Free plan activated successfully.");
      navigate("/subscription/overview", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to activate free plan");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-[#FCFBF7] px-6 pb-24 pt-8 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-xl rounded-[28px] border border-[#EADFD5] bg-white p-8 text-center shadow-[0_20px_70px_rgba(17,24,39,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6E26F2]">
            Free Plan Activation
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-black">
            Preparing your plan
          </h1>
          <TableLoading />
        </div>
      </section>
    );
  }

  if (!chosenPlan) {
    return null;
  }

  const isCurrent = String(chosenPlan.id) === String(selectedPlanId);

  return (
    <section className="min-h-screen bg-[#FCFBF7] px-6 pb-24 pt-8 lg:px-8 lg:pb-32">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-[28px] border border-[#EADFD5] bg-white p-6 shadow-[0_20px_70px_rgba(17,24,39,0.06)]">
          <Link
            to="/subscription/plans"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#5A5A59] hover:text-black"
          >
            <PiArrowLeft size={16} />
            Back to plans
          </Link>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6E26F2]">
            <PiCoins size={14} />
            Free Plan Activation
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-black">
            Review your free plan
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5A5A59]">
            Activate {chosenPlan.name} instantly. No checkout or payment gateway is required.
          </p>

          <div className="mt-8 rounded-2xl border border-[#EADFD5] p-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              Active plan
            </span>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-black">
              {chosenPlan.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5A5A59]">
              Free access for your company account with instant activation.
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-black">
              Included in this plan
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {features.length > 0 ? features.map((feature) => (
                <span key={feature} className="inline-flex items-center gap-2 rounded-full border border-[#D8C6FF] bg-[#F7F2FF] px-3 py-2 text-sm font-semibold text-[#5D1FE0]">
                  <PiCheckCircle size={16} />
                  {formatFeatureLabel(feature)}
                </span>
              )) : (
                <div className="rounded-2xl border border-dashed border-[#EADFD5] bg-[#FCFBF7] px-4 py-6 text-sm text-[#6B7280]">
                  This free plan does not include premium feature modules.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-[28px] border border-[#EADFD5] bg-white p-6 shadow-[0_20px_70px_rgba(17,24,39,0.06)]">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-black">Activation summary</h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#F0E7DE] pb-3">
              <span className="text-[#5A5A59]">Plan</span>
              <strong className="text-right text-black">{chosenPlan.name}</strong>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#F0E7DE] pb-3">
              <span className="text-[#5A5A59]">Access</span>
              <strong className="text-black">Free</strong>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2">
              <span className="text-base font-semibold text-black">Trial period</span>
              <strong className="text-2xl tracking-[-0.04em] text-[#6E26F2]">{chosenPlan?.trial_period || 0} days</strong>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <div className="flex items-start gap-3">
              <PiRocketLaunch size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Instant activation</p>
                <p className="mt-1 text-sm">Selecting this plan activates it immediately for your company account.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button type="button" disabled={processing || isCurrent} onClick={handleActivate} className="w-full rounded-full bg-[#6E26F2] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(84,35,231,0.22)] transition hover:bg-[#5D1FE0] disabled:cursor-not-allowed disabled:opacity-50">
              {isCurrent ? "Current Plan" : processing ? "Activating..." : "Activate Free Plan"}
            </button>
            <Link to="/subscription/plans" className="block w-full rounded-full border border-[#EADFD5] bg-white px-6 py-3 text-center text-sm font-semibold text-[#5A5A59] hover:bg-[#FCFBF7]">
              Choose another plan
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

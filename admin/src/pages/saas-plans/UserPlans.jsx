import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getAvailablePlans, getPlanPayments } from "../../api/companyOnboarding";
import { setPlanAccess } from "../../slice/authSlice";
import TableLoading from "../../components/loadings/TableLoading";
import {
  PiArrowDown,
  PiArrowUp,
  PiCheck,
  PiCheckCircle,
  PiClock,
  PiX,
} from "react-icons/pi";
import { formatFeatureLabel } from "../../config/constants";
import { formatPrice } from "../../hooks/currency";
import { normalizePlanFeatures } from "../../utils/planFeatures";

const planWeight = (plan) => {
  if (plan?.is_free === "free") return 0;
  if (plan?.plan_type === "commission") return 2;
  return 1;
};

const sortPlans = (plans) =>
  [...plans].sort(
    (left, right) =>
      planWeight(left) - planWeight(right) ||
      Number(left?.price || 0) - Number(right?.price || 0),
  );

const normalizeFeatureValue = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const hasFeature = (plan, keywords) => {
  const features = normalizePlanFeatures(plan).map(normalizeFeatureValue);

  return keywords.some((keyword) =>
    features.some((feature) => feature.includes(normalizeFeatureValue(keyword))),
  );
};

const featureItem = (label, enabled, highlighted = false) => ({
  label,
  enabled,
  highlighted,
});

const getPlanFeatures = (plan) => {
  const isCommissionPlan = plan?.plan_type === "commission";
  const warehouseLimit = Number(plan?.warehouse_limit || 0);
  const inventoryLimit = Number(plan?.inventory_item_limit || 0);
  const posLimit = Number(plan?.monthly_pos_transaction_limit || 0);
  const userLimit = Number(plan?.user_limit || 0);
  const domainSetupEnabled =
    isCommissionPlan || hasFeature(plan, ["domain setup", "domain", "dns"]);
  const storefrontBuilderEnabled =
    isCommissionPlan ||
    hasFeature(plan, ["storefront builder", "store builder", "homepage builder"]);
  const chatSupportEnabled =
    isCommissionPlan || hasFeature(plan, ["chat support", "live chat", "support chat"]);
  const seoMarketingEnabled =
    isCommissionPlan || hasFeature(plan, ["seo marketing", "seo", "search marketing"]);
  const deliverySupportEnabled =
    isCommissionPlan || hasFeature(plan, ["delivery support", "delivery", "shipping"]);
  const smsSupportEnabled =
    isCommissionPlan || hasFeature(plan, ["sms support", "sms", "text notification"]);
  const aiFeaturesEnabled =
    isCommissionPlan || hasFeature(plan, ["ai features", "ai", "copilot", "assistant"]);
  const referralSystemEnabled =
    isCommissionPlan || hasFeature(plan, ["referral system", "referral", "affiliate"]);
  const inventoryCopilotEnabled =
    isCommissionPlan ||
    hasFeature(plan, ["inventory copilot", "inventory assistant", "inventory ai"]);

  const features = [
    featureItem(`Warehouse limit: ${warehouseLimit}`, isCommissionPlan || warehouseLimit > 0, true),
    featureItem(`Inventory items limit: ${inventoryLimit}`, isCommissionPlan || inventoryLimit > 0),
    featureItem(`POS transactions: ${posLimit}`, isCommissionPlan || posLimit > 0),
    featureItem(`User limit: ${userLimit}`, isCommissionPlan || userLimit > 0),
    featureItem("Domain Setup", domainSetupEnabled, true),
    featureItem("Storefront Builder", storefrontBuilderEnabled),
    featureItem("Chat Support", chatSupportEnabled),
    featureItem("SEO Marketing", seoMarketingEnabled),
    featureItem("Delivery Support", deliverySupportEnabled),
    featureItem("SMS Support", smsSupportEnabled),
    featureItem("AI Features", aiFeaturesEnabled),
    featureItem("Referral System", referralSystemEnabled),
    featureItem("Inventory Copilot", inventoryCopilotEnabled),
    featureItem(
      isCommissionPlan
        ? `Commission Based: ${Number(plan?.commission_rate || 0).toFixed(2)}${plan?.commission_type === "fixed" ? "" : "%"}`
        : "Commission Based",
      isCommissionPlan,
      isCommissionPlan,
    ),
  ];

  if (plan?.is_free === "free" && Number(plan?.trial_period || 0) > 0) {
    features.splice(4, 0, featureItem(`Trial access: ${Number(plan.trial_period)} days`, true, true));
  }

  return features;
};

const formatPlanPrice = (plan) => {
  if (plan?.plan_type === "commission") {
    return plan?.commission_type === "fixed"
      ? formatPrice(plan?.commission_rate || 0)
      : `${Number(plan?.commission_rate || 0).toFixed(2)}%`;
  }

  if (plan?.is_free === "free") return "Free";

  const price = Number(plan?.price || 0);
  const discount = Number(plan?.discount_amount || 0);
  const discountValue = plan?.discount_type === "percent" ? price * (discount / 100) : discount;

  return formatPrice(Math.max(price - discountValue, 0));
};

const getPlanPath = (plan) => {
  return `/plans/checkout/${plan.id}`;
};

export default function UserPlans() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const selectedPlanId = useSelector((state) => state.auth.selected_plan_id);
  const currency = useSelector((state) => state.preferences.data?.currency);
  const [plans, setPlans] = useState([]);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [pendingPlanPayment, setPendingPlanPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  const sortedPlans = useMemo(() => sortPlans(plans), [plans]);
  const filteredPlans = useMemo(
    () =>
      sortedPlans.filter(
        (plan) =>
          plan?.is_free === "free" ||
          plan?.plan_type === "commission" ||
          String(plan?.billing_period || "monthly").toLowerCase() === billingPeriod,
      ),
    [billingPeriod, sortedPlans],
  );
  const selectedPlanIndex = sortedPlans.findIndex(
    (plan) => String(plan.id) === String(selectedPlanId),
  );
  const selectedPlan = selectedPlanIndex >= 0 ? sortedPlans[selectedPlanIndex] : null;
  const pendingPlanId = pendingPlanPayment?.saas_plan_id || pendingPlanPayment?.plan?.id || null;

  useEffect(() => {
    if (selectedPlan?.billing_period) {
      setBillingPeriod(String(selectedPlan.billing_period).toLowerCase());
    }
  }, [selectedPlan?.billing_period]);

  const getPlanAction = (plan) => {
    const isCurrent = String(plan.id) === String(selectedPlanId);
    const hasPendingRequest = String(pendingPlanPayment?.status || "").toLowerCase() === "pending";

    if (isCurrent) {
      return {
        label: "Current plan",
        icon: <PiCheckCircle size={17} />,
        disabled: true,
        className: "bg-[#F3F4F6] text-[#4B5563] ring-1 ring-[#D1D5DB]",
      };
    }

    if (hasPendingRequest && String(plan.id) === String(pendingPlanId)) {
      return {
        label: "Approval pending",
        icon: <PiClock size={17} />,
        disabled: true,
        className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      };
    }

    if (hasPendingRequest) {
      return {
        label: "Change pending",
        icon: <PiClock size={17} />,
        disabled: true,
        className: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
      };
    }

    if (selectedPlanIndex < 0) {
      return {
        label:
          plan?.plan_type === "commission"
            ? "Activate"
            : plan?.is_free === "free"
              ? "Start free"
              : "Purchase",
        icon: <PiArrowUp size={17} />,
        disabled: false,
        className:
          plan?.is_free === "free"
            ? "bg-white text-[#212124] ring-1 ring-[#E5E7EB]"
            : "bg-[#7C3AED] text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] hover:bg-[#6D28D9]",
      };
    }

    const targetIndex = sortedPlans.findIndex(
      (item) => String(item.id) === String(plan.id),
    );
    const isDowngrade = targetIndex >= 0 && targetIndex < selectedPlanIndex;

    return {
      label:
        isDowngrade
          ? "Downgrade"
          : plan?.plan_type === "commission"
            ? "Activate"
            : "Upgrade",
      icon: isDowngrade ? <PiArrowDown size={17} /> : <PiArrowUp size={17} />,
      disabled: false,
      className: isDowngrade
        ? "bg-white text-[#212124] ring-1 ring-[#E5E7EB] hover:bg-[#FFF8F1]"
        : "bg-[#7C3AED] text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] hover:bg-[#6D28D9]",
    };
  };

  const loadPlans = useCallback(async () => {
    setLoading(true);

    try {
      const result = await getAvailablePlans(accessToken);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load plans");
      }

      setPlans(Array.isArray(result?.data) ? result.data : []);
      dispatch(
        setPlanAccess({
          selected_plan_id: result?.selected_plan_id || null,
          has_active_plan: !!result?.has_active_plan,
          needs_plan_selection:
            typeof result?.needs_plan_selection === "boolean"
              ? result.needs_plan_selection
              : !result?.has_active_plan,
          selected_plan: result?.selected_plan || null,
          selected_plan_features:
            result?.selected_plan?.effective_features || result?.selected_plan?.features || [],
        }),
      );

      try {
        const paymentsResult = await getPlanPayments(accessToken, { perPage: 20 });
        const pendingPayment = paymentsResult?.data?.payments?.find(
          (payment) => String(payment?.status || "").toLowerCase() === "pending",
        );
        setPendingPlanPayment(pendingPayment || null);
      } catch {
        setPendingPlanPayment(null);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [accessToken, dispatch]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        loadPlans();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [loadPlans]);

  if (loading) {
    return (
      <div className="bg-[#FCFBF7] p-5">
        <TableLoading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFBF7] px-5 pb-24 pt-8 sm:px-8 lg:px-10 lg:pb-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C3AED]">
              Plan center
            </p>
            <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-[-0.04em] text-[#212124]">
              Choose your plan
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#4B5563]">
              Compare every plan feature and upgrade or downgrade whenever your business needs change.
            </p>
          </div>

          <div className="inline-flex self-start rounded-full border border-[#7C3AED] bg-white p-1 sm:self-auto">
            {["monthly", "yearly"].map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setBillingPeriod(period)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold capitalize transition ${
                  billingPeriod === period
                    ? "bg-[#7C3AED] text-white"
                    : "text-[#212124] hover:bg-[#F6F1FF]"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {pendingPlanPayment ? (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <PiClock size={20} />
              <div>
                <p className="font-semibold">Subscription approval pending</p>
                <p className="text-sm text-amber-800">
                  {pendingPlanPayment?.plan?.name || "Requested plan"} is waiting for approval.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100"
              onClick={() => navigate("/plan-payments")}
            >
              View request
            </button>
          </div>
        ) : null}

        {filteredPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8C6FF] bg-white p-10 text-center text-[#6B7280]">
            No {billingPeriod} plans found.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filteredPlans.map((plan, index) => {
              const isCurrent = String(plan.id) === String(selectedPlanId);
              const action = getPlanAction(plan);
              const features = getPlanFeatures(plan);
              const featureCodes = normalizePlanFeatures(plan);
                  const originalPrice =
                plan?.is_free !== "free" &&
                plan?.plan_type !== "commission" &&
                Number(plan?.discount_amount || 0) > 0
                  ? formatPrice(plan?.price || 0)
                  : null;
              const featureIntro = plan?.included_plan?.name
                ? `Everything in ${plan.included_plan.name}, and:`
                : plan?.plan_type === "commission"
                  ? "Everything in the base plan, and:"
                  : plan?.is_free === "free"
                    ? "Start with the basics"
                    : "Everything included in this plan";

              return (
                <article
                  key={plan.id}
                  className={`relative flex h-full min-h-[560px] flex-col rounded-2xl border p-5 shadow-[0_8px_24px_rgba(17,24,39,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(17,24,39,0.09)] ${
                    index === 1
                      ? "border-[#7C3AED] bg-[#F6F1FF] ring-1 ring-[#7C3AED]/15"
                      : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  {index === 1 ? (
                    <span className="absolute right-5 top-5 rounded-full bg-[#7C3AED] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                      Most popular
                    </span>
                  ) : null}
                  {isCurrent ? (
                    <span className="absolute right-5 top-14 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                      Active
                    </span>
                  ) : null}

                  <div>
                    <h2 className="max-w-[78%] text-[24px] font-semibold leading-tight tracking-[-0.03em] text-[#212124]">
                      {plan.name}
                    </h2>
                    <p className="mt-2 min-h-[2.5rem] text-[14px] leading-[1.5] text-[#4B5563]">
                      {plan.description || "Store plan with inventory and POS support."}
                    </p>
                    <div className="mt-4 border-t border-[#E5E7EB] pt-4">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {originalPrice ? (
                          <span className="text-[16px] font-medium text-[#9CA3AF] line-through">
                            {originalPrice}
                          </span>
                        ) : null}
                        <span className="text-[36px] font-semibold leading-none tracking-[-0.05em] text-[#212124]">
                          {formatPlanPrice(plan, currency)}
                        </span>
                        <span className="text-[13px] leading-none text-[#6B7280]">
                          {plan?.plan_type === "commission"
                            ? `per order on ${String(plan?.commission_base || "total_amount").replace(/_/g, " ")}`
                            : plan?.is_free === "free"
                              ? `Trial ${Number(plan?.trial_period || 0)} days`
                              : `/${plan?.billing_period || "monthly"}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-6 text-[13px] font-semibold text-[#374151]">{featureIntro}</p>

                  <ul className="mt-3 flex-1 sm:grid sm:grid-cols-2 sm:gap-x-5 sm:gap-y-2.5 xl:block">
                    {features.map((feature) => (
                      <li key={feature.label} className="mb-2.5 flex items-start gap-3 last:mb-0">
                        {feature.enabled ? (
                          <PiCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
                        ) : (
                          <PiX className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
                        )}
                        <span
                          className={`text-[13px] leading-[1.45] ${
                            feature.highlighted
                              ? feature.enabled
                                ? "font-semibold text-[#5B21B6]"
                                : "font-semibold text-[#B91C1C]"
                              : feature.enabled
                                ? "text-[#374151]"
                                : "text-[#9CA3AF]"
                          }`}
                        >
                          {featureCodes.length > 0 &&
                          !/^(Warehouse|Inventory|POS|User|Domain|Storefront|Chat|SEO|Delivery|SMS|AI|Referral|Commission|Trial)/.test(feature.label)
                            ? formatFeatureLabel(feature.label)
                            : feature.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <button
                      type="button"
                      disabled={action.disabled}
                      onClick={() => navigate(getPlanPath(plan))}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold leading-none transition disabled:cursor-default ${action.className}`}
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

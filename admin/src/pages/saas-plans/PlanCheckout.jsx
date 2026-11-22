import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  PiArrowRight,
  PiCheck,
  PiX,
} from "react-icons/pi";
import { getAvailablePlans, getPlanGateways, selectCompanyPlan } from "../../api/companyOnboarding";
import { getEcommerceSetupData } from "../../api/ecommerceSetup";
import { clearProductSettingsCache } from "../../api/productSettings";
import { formatPrice } from "../../hooks/currency";
import TableLoading from "../../components/loadings/TableLoading";
import { setPlanAccess } from "../../slice/authSlice";
import { normalizePlanFeatures } from "../../utils/planFeatures";

const formatRate = (value) => Number(value || 0).toLocaleString("en-US", {
  maximumFractionDigits: 2,
});
const getPlanPriceAfterDiscount = (plan) => {
  const price = Number(plan?.price || 0);
  const discount = Number(plan?.discount_amount || 0);
  const discountValue = plan?.discount_type === "percent" ? price * (discount / 100) : discount;
  return Math.max(price - discountValue, 0);
};

export default function PlanCheckout() {
  const { planId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const selectedPlanId = useSelector((state) => state.auth.selected_plan_id);
  const currency = useSelector((state) => state.preferences.data?.currency);
  const formatCurrency = useMemo(() => (value) => formatPrice(value), [currency]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState("");
  const [paymentFields, setPaymentFields] = useState({});
  const [paymentFiles, setPaymentFiles] = useState({});
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [selectedTemplateDetails, setSelectedTemplateDetails] = useState([]);
  const [seedDemoData, setSeedDemoData] = useState(false);

  const chosenPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === String(planId)) || null,
    [planId, plans]
  );

  const selectedGateway = useMemo(
    () => gateways.find((gateway) => String(gateway.id) === String(selectedGatewayId)) || null,
    [gateways, selectedGatewayId]
  );

  const manualParams = useMemo(() => {
    if (!selectedGateway || selectedGateway.gateway_type !== "manual") {
      return [];
    }

    return Array.isArray(selectedGateway.parameters) ? selectedGateway.parameters : [];
  }, [selectedGateway]);

  const planFeatures = useMemo(() => normalizePlanFeatures(chosenPlan), [chosenPlan]);

  const loadCheckoutData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResult, gatewaysResult] = await Promise.all([
        getAvailablePlans(accessToken),
        getPlanGateways(accessToken),
      ]);

      if (!plansResult?.status) {
        throw new Error(plansResult?.message || "Failed to load plans");
      }

      if (!gatewaysResult?.status) {
        throw new Error(gatewaysResult?.message || "Failed to load gateways");
      }

      const nextPlans = Array.isArray(plansResult?.data) ? plansResult.data : [];
      const nextGateways = Array.isArray(gatewaysResult?.data) ? gatewaysResult.data : [];
      setPlans(nextPlans);
      setGateways(nextGateways);
      setSelectedGatewayId(nextGateways[0]?.id || "");

      if (!nextPlans.some((plan) => String(plan.id) === String(planId))) {
        toast.error("Selected plan was not found.");
        navigate("/subscription/plans", { replace: true });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load checkout");
      navigate("/subscription/plans", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [accessToken, navigate, planId]);

  useEffect(() => {
    loadCheckoutData();
  }, [loadCheckoutData]);

  const openTemplateModal = async () => {
    setTemplateModalOpen(true);
    if (templates.length > 0) return;

    setTemplateLoading(true);
    try {
      const result = await getEcommerceSetupData(accessToken, { includePaid: true });
      const usedTemplateId = Number(result?.data?.company?.selected_e_template_id || 0);
      const availableTemplates = Array.isArray(result?.data?.templates)
        ? result.data.templates.filter((template) => {
          const type = String(template?.template_type || "").toUpperCase();
          const isSingleUse = type === "PTSU" || type === "PREMIUM_SINGLE_USE";
          const alreadyUsed = Boolean(
            template?.has_access ||
            template?.is_used ||
            template?.used ||
            Number(template?.id) === usedTemplateId,
          );

          return type !== "FREE" && !(isSingleUse && alreadyUsed);
        })
        : [];
      setTemplates(availableTemplates);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load templates.");
    } finally {
      setTemplateLoading(false);
    }
  };

  const toggleTemplate = (template) => {
    const templateId = Number(template.id);
    const alreadySelected = selectedTemplateIds.includes(templateId);

    setSelectedTemplateIds((current) => alreadySelected
      ? current.filter((id) => id !== templateId)
      : [...current, templateId]);
    setSelectedTemplateDetails((current) => alreadySelected
      ? current.filter((item) => Number(item.id) !== templateId)
      : current.some((item) => Number(item.id) === templateId)
        ? current
        : [...current, template]);
  };

  const removeTemplate = (templateId) => {
    setSelectedTemplateIds((current) => current.filter((id) => Number(id) !== Number(templateId)));
    setSelectedTemplateDetails((current) => current.filter((item) => Number(item.id) !== Number(templateId)));
  };

  const handlePaymentFieldChange = (name, value) => {
    setPaymentFields((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePaymentFileChange = (name, file) => {
    setPaymentFiles((prev) => ({
      ...prev,
      [name]: file || null,
    }));
  };

  const handleSubmitPlanPurchase = async () => {
    if (!chosenPlan) {
      toast.error("Please choose a valid plan.");
      return;
    }

    const selectedTemplatesAmount = selectedTemplateDetails.reduce(
      (total, template) => total + Number(template?.discounted_price ?? template?.price ?? 0),
      0,
    );
    const requiresPayment = getPlanPriceAfterDiscount(chosenPlan) + selectedTemplatesAmount > 0;

    if (requiresPayment && !selectedGatewayId) {
      toast.error("Please select a payment gateway.");
      return;
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("plan_id", chosenPlan.id);
      if (selectedGatewayId && requiresPayment) formData.append("gateway_id", selectedGatewayId);
      formData.append("post_payment_redirect", "/subscription/overview?plan_payment=success");
      formData.append("seed_demo_data", seedDemoData ? "1" : "0");
      formData.append("payment_fields", JSON.stringify(paymentFields || {}));
      selectedTemplateIds.forEach((templateId) => formData.append("template_ids[]", templateId));
      const templateCategoryId = selectedTemplateDetails[0]?.category_id || selectedTemplateDetails[0]?.categories?.[0]?.id;
      if (templateCategoryId) formData.append("category_id", templateCategoryId);

      Object.entries(paymentFiles).forEach(([key, file]) => {
        if (file instanceof File) {
          formData.append(`payment_files[${key}]`, file, file.name);
        }
      });

      const payload = requiresPayment || selectedTemplateIds.length > 0 || seedDemoData
        ? formData
        : { plan_id: chosenPlan.id };
      const result = await selectCompanyPlan(accessToken, payload);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to submit plan purchase");
      }

      const payment = result?.data?.payment || {};
      const accessGranted = Boolean(result?.data?.access_granted);

      dispatch(
        setPlanAccess({
          selected_plan_id: accessGranted ? chosenPlan.id : null,
          has_active_plan: accessGranted,
          needs_plan_selection: !accessGranted,
          selected_plan: accessGranted ? chosenPlan : null,
          selected_plan_features: accessGranted ? chosenPlan.effective_features || chosenPlan.features || [] : [],
          needs_ecommerce_setup: Boolean(result?.data?.needs_ecommerce_setup),
        })
      );
      clearProductSettingsCache();

      if (accessGranted) {
        toast.success(result?.message || "Plan activated successfully.");
        navigate("/subscription/overview", { replace: true });
        return;
      }

      if (payment?.type === "redirect" && payment?.redirect_url) {
        toast.info("Redirecting to payment gateway...");
        window.location.assign(String(payment.redirect_url));
        return;
      }

      if (payment?.type === "pending") {
        toast.success(result?.message || "Payment request submitted. Waiting for admin approval.");
        navigate("/plan-payments", { replace: true });
        return;
      }

      toast.error(payment?.message || "Payment gateway did not return a checkout URL. Please try another gateway.");
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      if (Array.isArray(apiErrors) && apiErrors.length) {
        toast.error(apiErrors.join(" | "));
      } else {
        toast.error(error?.response?.data?.message || error?.message || "Failed to submit purchase request");
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-[#FCFBF7] px-6 pb-24 pt-8 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-xl rounded-[28px] border border-[#EADFD5] bg-white p-8 text-center shadow-[0_20px_70px_rgba(17,24,39,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6E26F2]">Plan Checkout</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-black">Checking payment options</h1>
          <TableLoading />
        </div>
      </section>
    );
  }

  if (!chosenPlan) {
    return null;
  }

  const isSubscribed = String(chosenPlan.id) === String(selectedPlanId);
  const planAmount = getPlanPriceAfterDiscount(chosenPlan);
  const selectedTemplateTotal = selectedTemplateDetails.reduce(
    (total, template) => total + Number(template?.discounted_price ?? template?.price ?? 0),
    0,
  );
  const checkoutSubtotal = planAmount + selectedTemplateTotal;
  const gatewayFee = selectedGateway
    ? selectedGateway.charge_type === "percent"
      ? checkoutSubtotal * (Number(selectedGateway.charge || 0) / 100)
      : Number(selectedGateway.charge || 0)
    : 0;
  const totalAmount = checkoutSubtotal + gatewayFee;
  const requiresPayment = totalAmount > 0;
  const visibleTemplates = templates.filter((template) => {
    const keyword = templateSearch.trim().toLowerCase();
    return !keyword || `${template?.template_name || ""} ${template?.short_description || ""}`.toLowerCase().includes(keyword);
  });
  const hasFeature = (code) => planFeatures.length === 0 || planFeatures.includes(code);
  const featureItems = [
    { label: `Warehouse limit: ${chosenPlan.warehouse_limit || "Unlimited"}`, included: true },
    { label: `Inventory items limit: ${chosenPlan.inventory_item_limit || "Unlimited"}`, included: true },
    { label: `POS transactions: ${chosenPlan.monthly_pos_transaction_limit || "Unlimited"}`, included: true },
    { label: `User limit: ${chosenPlan.user_limit || "Unlimited"}`, included: true },
    { label: "Domain Setup", included: hasFeature("ftr_shop_domain_setup") },
    { label: "Storefront Builder", included: hasFeature("ftr_storefront_home") },
    { label: "Chat Support", included: hasFeature("ftr_shop_chat_support") },
    { label: "SEO Marketing", included: hasFeature("ftr_shop_seo_marketing") },
    { label: "Delivery Support", included: hasFeature("ftr_shop_delivery_support") },
    { label: "SMS Support", included: hasFeature("ftr_shop_sms_support") },
    { label: "AI Features", included: hasFeature("ftr_ai") },
    { label: "Referral System", included: hasFeature("ftr_referral_system") },
    { label: "Inventory Copilot", included: hasFeature("ftr_inventory_copilot") },
    { label: "Commission Based", included: Boolean(chosenPlan.is_commission_based || chosenPlan.commission_based) },
  ];

  return (
    <>
      <section className="min-h-screen bg-[#FBF9FF] px-6 py-8 text-[#101828] lg:px-12 lg:py-12">
      <div className="mx-auto grid max-w-[1820px] gap-8 lg:grid-cols-[1.03fr_1fr]">
        <section className="border border-[#E8E0F0] bg-white px-8 py-10 shadow-[0_18px_50px_rgba(85,52,135,0.05)] lg:px-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#D01B82]">Your plan</p>
              <h1 className="mt-2 text-3xl font-normal tracking-[-0.05em] text-[#101828]">{chosenPlan.name}</h1>
              <p className="mt-2 text-base text-[#101828]">Billed {chosenPlan.billing_period || "monthly"}. Cancel anytime.</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tracking-[-0.04em] text-[#101828]">
                {chosenPlan.is_free === "free" ? "Free" : formatCurrency(planAmount)}
              </p>
              <Link to="/subscription/plans" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#7138D4]">Change plan <PiArrowRight size={16} /></Link>
            </div>
          </div>

          <div className="my-8 border-t border-[#EEE8F5]" />

          <div className="flex flex-col gap-5 border-b border-[#EEE8F5] pb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7138D4]">Optional add-on</p>
              <h2 className="mt-2 text-xl font-bold text-[#101828]">Premium templates</h2>
              <p className="mt-2 max-w-[560px] text-sm leading-6 text-[#667085]">Free templates are already included with your plan. Add a premium template when needed.</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-4">
              <span className="text-sm font-bold text-[#7138D4]">{selectedTemplateDetails.length > 0 ? `+${formatCurrency(selectedTemplateTotal)}` : "Optional"}</span>
              <button type="button" onClick={openTemplateModal} className="inline-flex items-center gap-2 rounded-full border border-[#D7BFFF] px-5 py-2.5 text-sm font-bold text-[#7138D4]">
                {selectedTemplateDetails.length > 0 ? "Change templates" : "Add premium template"} <PiArrowRight size={16} />
              </button>
            </div>
          </div>

          {selectedTemplateDetails.length > 0 ? (
            <div className="mt-5 space-y-2 border-b border-[#EEE8F5] pb-6">
              {selectedTemplateDetails.map((template) => (
                <div key={template.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#EADCFB] bg-[#FCF9FF] px-4 py-3 text-sm">
                  <span>{template.template_name || `Template #${template.id}`}</span>
                  <div className="flex items-center gap-4">
                    <strong>{formatCurrency(template.discounted_price ?? template.price)}</strong>
                    <button type="button" onClick={() => removeTemplate(template.id)} className="text-xs font-semibold text-[#D01B82]">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E8E0F0] bg-[#FBF9FF] p-5">
            <input
              type="checkbox"
              checked={seedDemoData}
              onChange={(event) => setSeedDemoData(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#7138D4]"
            />
            <span>
              <span className="block text-base font-bold text-[#101828]">Seed demo data</span>
              <span className="mt-1 block text-sm leading-6 text-[#667085]">
                Add sample categories, brands, products, and inventory during store setup. Leave unchecked to start with an empty catalog.
              </span>
            </span>
          </label>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {featureItems.map((feature) => (
              <div key={feature.label} className={`flex items-center gap-3 rounded-full border px-4 py-2.5 text-right text-sm ${feature.included ? "border-[#EADCFB] bg-[#FCF9FF] text-[#344054]" : "border-[#E8EDF2] bg-[#F8FAFC] text-[#98A2B3]"}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${feature.included ? "bg-[#F0E5FF] text-[#7B3FE4]" : "bg-[#EEF2F5] text-[#AAB3BD]"}`}>
                  {feature.included ? <PiCheck size={16} /> : <PiX size={14} />}
                </span>
                <span className="flex-1">{feature.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="h-fit border border-[#E8E0F0] bg-white px-8 py-10 shadow-[0_18px_50px_rgba(85,52,135,0.05)] lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#D01B82]">Payment</p>
          <h2 className="mt-2 text-3xl font-normal tracking-[-0.05em] text-[#101828]">Choose payment method</h2>
          <p className="mt-3 text-base text-[#667085]">Select how you want to pay today.</p>

          {!requiresPayment ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
              This plan can be activated instantly. No payment gateway is required.
            </div>
          ) : gateways.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#E8E0F0] bg-[#FBF9FF] p-6 text-sm text-[#667085]">No active payment gateways found right now.</div>
          ) : (
            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {gateways.map((gateway) => {
                const isActive = String(selectedGatewayId) === String(gateway.id);
                return (
                  <button key={gateway.id} type="button" onClick={() => setSelectedGatewayId(gateway.id)} className={`rounded-[22px] border px-6 py-7 text-left transition ${isActive ? "border-[#AD7BFF] shadow-[0_0_0_1px_#AD7BFF]" : "border-[#E8E0F0] hover:border-[#C9A8FF]"}`}>
                    <p className="text-base text-[#344054]">{gateway.name}</p>
                    <p className="mt-5 text-sm text-[#667085]">Charge: {gateway.charge_type === "percent" ? `${formatRate(gateway.charge)}%` : formatCurrency(gateway.charge)}</p>
                    <p className="mt-4 text-sm text-[#667085]">Currency: {gateway.currency?.code || "N/A"}</p>
                  </button>
                );
              })}
            </div>
          )}

          {selectedGateway?.gateway_type === "manual" ? (
            <div className="mt-6 rounded-2xl border border-[#E8E0F0] bg-[#FBF9FF] p-5">
              <p className="text-base font-bold text-[#101828]">Payment details</p>
              <div className="mt-4 space-y-4">
                {manualParams.length === 0 ? <p className="text-sm text-[#667085]">No additional fields are required.</p> : manualParams.map((param, index) => {
                  const fieldName = param?.name || `field_${index}`;
                  const fieldLabel = param?.label || fieldName;
                  const fieldType = param?.type || "text";
                  if (fieldType === "file") return <label key={fieldName} className="block text-sm font-medium text-[#101828]">{fieldLabel}<input type="file" className="mt-2 block w-full rounded-xl border border-[#E8E0F0] bg-white px-4 py-3 text-sm" onChange={(event) => handlePaymentFileChange(fieldName, event.target.files?.[0])} /></label>;
                  return <label key={fieldName} className="block text-sm font-medium text-[#101828]">{fieldLabel}<input type="text" value={paymentFields[fieldName] || ""} className="mt-2 block h-12 w-full rounded-xl border border-[#E8E0F0] bg-white px-4 text-sm outline-none focus:border-[#7138D4]" onChange={(event) => handlePaymentFieldChange(fieldName, event.target.value)} /></label>;
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-8 rounded-[22px] border border-[#E6D9FF] bg-[#FBF7FF] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7138D4]">Total today</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#101828]">{chosenPlan.is_free === "free" ? "Free" : formatCurrency(totalAmount)}</p>
            {gatewayFee > 0 ? <p className="mt-2 text-sm text-[#667085]">{selectedGateway?.name} fee included: {formatCurrency(gatewayFee)}.</p> : null}
            {isSubscribed ? <p className="mt-3 text-sm text-emerald-700">This plan is already active on your account.</p> : null}
            <button type="button" onClick={handleSubmitPlanPurchase} disabled={processing || (requiresPayment && !selectedGatewayId) || isSubscribed} className="mt-7 w-full rounded-xl bg-[#CE1A85] px-6 py-3.5 text-base font-bold text-white transition hover:bg-[#B91475] disabled:cursor-not-allowed disabled:opacity-50">
              {processing ? "Processing..." : requiresPayment ? "Continue to payment" : "Activate plan"}
            </button>
          </div>
        </section>
      </div>
      </section>

      {templateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/45 p-4" onClick={() => setTemplateModalOpen(false)}>
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="premium-template-modal-title">
            <div className="flex items-start justify-between gap-4 border-b border-[#EEE8F5] p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7138D4]">Optional add-on</p>
                <h2 id="premium-template-modal-title" className="mt-2 text-2xl font-semibold text-[#101828]">Choose premium templates</h2>
                <p className="mt-1 text-sm text-[#667085]">Search and select the templates you want to add.</p>
              </div>
              <button type="button" onClick={() => setTemplateModalOpen(false)} className="text-sm font-semibold text-[#667085]" aria-label="Close">Close</button>
            </div>

            <div className="border-b border-[#EEE8F5] p-5">
              <input type="search" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Search templates..." className="h-11 w-full rounded-full border border-[#E8E0F0] px-5 text-sm outline-none focus:border-[#7138D4]" />
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              {templateLoading ? (
                <p className="py-10 text-center text-sm text-[#667085]">Loading templates...</p>
              ) : visibleTemplates.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleTemplates.map((template) => {
                    const checked = selectedTemplateIds.includes(Number(template.id));
                    return (
                      <label key={template.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${checked ? "border-[#AD7BFF] bg-[#FBF7FF]" : "border-[#E8E0F0] hover:border-[#C9A8FF]"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTemplate(template)} className="mt-1 accent-[#7138D4]" />
                        <div className="min-w-0 flex-1">
                          {template.image_url ? <img src={template.image_url} alt={template.template_name || "Template preview"} className="mb-3 h-28 w-full rounded-lg object-cover" /> : null}
                          <p className="font-semibold text-[#101828]">{template.template_name || `Template #${template.id}`}</p>
                          <p className="mt-1 text-xs text-[#667085]">{template.short_description || "Premium storefront template"}</p>
                          <p className="mt-2 text-sm font-bold text-[#7138D4]">{formatCurrency(template.discounted_price ?? template.price)}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-[#667085]">No premium templates found.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#EEE8F5] p-5">
              <span className="text-sm text-[#667085]">{selectedTemplateDetails.length} selected</span>
              <button type="button" onClick={() => setTemplateModalOpen(false)} className="rounded-full bg-[#7138D4] px-6 py-2.5 text-sm font-semibold text-white">Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

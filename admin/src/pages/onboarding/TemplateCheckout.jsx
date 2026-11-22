import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { getTemplateCheckoutOptions, purchaseTemplate } from "../../api/companyOnboarding";
import { setPlanAccess } from "../../slice/authSlice";

const formatAmount = (value) => Number(value || 0).toFixed(2);

const resolveRedirect = (navigate, redirectUrl) => {
  const targetUrl = String(redirectUrl || "").trim();
  if (!targetUrl) return false;

  if (targetUrl.startsWith("/") && !targetUrl.startsWith("//")) {
    navigate(targetUrl, { replace: true });
    return true;
  }

  try {
    const target = new URL(targetUrl, window.location.origin);
    if (target.origin === window.location.origin) {
      navigate(`${target.pathname}${target.search}${target.hash}`, { replace: true });
      return true;
    }
  } catch {
    // Fall through to a full navigation for a malformed or external URL.
  }

  window.location.assign(targetUrl);
  return true;
};

export default function TemplateCheckout() {
  const { templateId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const accessToken = useSelector((store) => store.auth.accessToken);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [selectedGatewayId, setSelectedGatewayId] = useState("");
  const [paymentFields, setPaymentFields] = useState({});
  const [paymentFiles, setPaymentFiles] = useState({});

  const template = checkout?.template;
  const gateways = useMemo(
    () => (Array.isArray(checkout?.gateways) ? checkout.gateways : []),
    [checkout?.gateways],
  );
  const selectedGateway = useMemo(
    () => gateways.find((gateway) => String(gateway.id) === String(selectedGatewayId)) || null,
    [gateways, selectedGatewayId],
  );
  const manualParams = useMemo(
    () => selectedGateway?.gateway_type === "manual" && Array.isArray(selectedGateway.parameters)
      ? selectedGateway.parameters
      : [],
    [selectedGateway],
  );
  const templateAmount = Number(checkout?.amounts?.template_amount ?? template?.payable_price ?? 0);
  const planAmount = Number(checkout?.amounts?.plan_amount ?? 0);
  const payableAmount = Number(checkout?.amounts?.subtotal ?? templateAmount + planAmount);

  const loadCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTemplateCheckoutOptions(accessToken, templateId);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load template checkout");
      }

      const nextCheckout = result.data || null;
      const nextGateways = Array.isArray(nextCheckout?.gateways) ? nextCheckout.gateways : [];
      setCheckout(nextCheckout);
      setSelectedGatewayId(nextGateways[0]?.id || "");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load template checkout");
      navigate("/onboarding/ecommerce-template", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [accessToken, navigate, templateId]);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  const handlePaymentFieldChange = (name, value) => {
    setPaymentFields((current) => ({ ...current, [name]: value }));
  };

  const handlePaymentFileChange = (name, file) => {
    setPaymentFiles((current) => ({ ...current, [name]: file || null }));
  };

  const handlePurchase = async () => {
    if (!template) return;
    if (payableAmount > 0 && !selectedGatewayId) {
      toast.error("Please select a payment gateway.");
      return;
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("template_id", template.id);
      if (selectedGatewayId) formData.append("gateway_id", selectedGatewayId);
      const categoryId = state?.categoryId || checkout?.category_id;
      if (categoryId) formData.append("category_id", categoryId);
      formData.append("payment_fields", JSON.stringify(paymentFields || {}));

      Object.entries(paymentFiles).forEach(([key, file]) => {
        if (file instanceof File) {
          formData.append(`payment_files[${key}]`, file, file.name);
        }
      });

      const result = await purchaseTemplate(accessToken, formData);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to purchase template");
      }

      const payment = result?.data?.payment || {};
      const accessGranted = Boolean(result?.data?.access_granted);

      if (accessGranted) {
        dispatch(setPlanAccess({
          needs_ecommerce_setup: false,
          selected_e_template_id: result?.data?.template?.id || template.id,
          ecommerce_setup_completed_at: new Date().toISOString(),
        }));
        toast.success(result?.message || "Template purchased successfully.");
        navigate("/onboarding/ecommerce-template", { replace: true });
        return;
      }

      if (payment.type === "redirect" && payment.redirect_url) {
        toast.info("Redirecting to payment gateway...");
        resolveRedirect(navigate, payment.redirect_url);
        return;
      }

      if (payment.type === "pending") {
        toast.success(result?.message || "Payment request submitted. Waiting for admin approval.");
        navigate("/plan-payments", { replace: true });
        return;
      }

      toast.error(payment.message || "Payment gateway did not return a checkout URL.");
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      toast.error(Array.isArray(apiErrors) && apiErrors.length
        ? apiErrors.join(" | ")
        : error?.response?.data?.message || error?.message || "Failed to purchase template");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-[#FCFBF7] px-6 pb-24 pt-32 lg:px-8">
        <div className="mx-auto max-w-xl rounded-[28px] border border-[#EADFD5] bg-white p-8 text-center shadow-[0_20px_70px_rgba(17,24,39,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6E26F2]">
            Preparing Payment
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-black">
            Checking payment options
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#5A5A59]">If one gateway is active, you will go directly to that payment page.</p>
        </div>
      </section>
    );
  }

  if (!template) return null;

  return (
    <section className="bg-[#FCFBF7] px-6 pb-24 pt-32 lg:px-8 lg:pb-32">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-[28px] border border-[#EADFD5] bg-white p-6 shadow-[0_20px_70px_rgba(17,24,39,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6E26F2]">
            Template Checkout
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-black">
            Review your template purchase
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5A5A59]">
            Your active plan already includes free templates. This checkout is only for the selected premium template.
            If only one gateway is enabled, we will send you straight to payment.
          </p>

          {checkout ? (
            <form onSubmit={(event) => { event.preventDefault(); void handlePurchase(); }} className="mt-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#EADFD5] p-5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Template</span>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-black">{template.template_name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5A5A59]">{template.short_description || "Selected storefront design."}</p>
                </div>
                <div className="rounded-2xl border border-[#EADFD5] p-5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Active Plan</span>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-black">{checkout.plan?.name || "Active plan"}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5A5A59]">Already active. No additional plan charge is included.</p>
                </div>
              </div>

              {checkout?.gateway_flow?.auto_redirect !== true && payableAmount > 0 && gateways.length > 0 ? (
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-black">Payment gateway</h2>
                  <p className="mt-1 text-sm text-[#5A5A59]">Choose how you want to pay for this template.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {gateways.map((gateway) => {
                      const isActive = String(selectedGatewayId) === String(gateway.id);
                      return (
                        <button key={gateway.id} type="button" onClick={() => setSelectedGatewayId(String(gateway.id))} className={`rounded-2xl border p-4 text-left transition ${isActive ? "border-[#6E26F2] bg-[#F7F2FF]" : "border-[#EADFD5] bg-white hover:border-[#B68FFF]"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <strong className="text-sm text-black">{gateway.name}</strong>
                            <span className="rounded-full border border-[#EADFD5] bg-white px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                              {gateway.gateway_type === "manual" ? "Manual" : "Automatic"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-[#6B7280]">No extra gateway charge on template purchase.</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : payableAmount > 0 ? (
                <div className="rounded-2xl border border-dashed border-[#EADFD5] bg-[#FCFBF7] p-5 text-sm text-[#6B7280]">No active payment gateways found right now.</div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">This template is free after discount. You can unlock it instantly.</div>
              )}

              {selectedGateway?.gateway_type === "manual" ? (
                <div className="rounded-2xl border border-[#EADFD5] bg-[#FCFBF7] p-5">
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-black">Manual payment details</h2>
                  <p className="mt-1 text-sm text-[#5A5A59]">Add the required payment information for admin review.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {manualParams.length === 0 ? <p className="text-sm text-[#6B7280]">No additional fields are required.</p> : manualParams.map((param, index) => {
                      const fieldName = param?.name || `field_${index}`;
                      const fieldLabel = param?.label || fieldName;
                      if (param?.type === "file") {
                        return <label key={fieldName} className="text-sm font-medium text-black">{fieldLabel}<input type="file" className="mt-2 block w-full rounded-xl border border-[#EADFD5] bg-white px-4 py-3 text-sm" onChange={(event) => handlePaymentFileChange(fieldName, event.target.files?.[0])} /></label>;
                      }
                      return <label key={fieldName} className="text-sm font-medium text-black">{fieldLabel}<input type="text" value={paymentFields[fieldName] || ""} className="mt-2 block w-full rounded-xl border border-[#EADFD5] bg-white px-4 py-3 text-sm outline-none focus:border-[#6E26F2]" onChange={(event) => handlePaymentFieldChange(fieldName, event.target.value)} /></label>;
                    })}
                  </div>
                </div>
              ) : null}

              <button type="submit" disabled={processing || (payableAmount > 0 && !selectedGatewayId)} className="rounded-full bg-[#6E26F2] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(84,35,231,0.22)] transition hover:bg-[#5D1FE0] disabled:cursor-not-allowed disabled:opacity-50">
                {processing ? "Processing..." : payableAmount > 0 ? "Continue to payment" : "Unlock template"}
              </button>
            </form>
          ) : null}
        </div>

        <aside className="h-fit rounded-[28px] border border-[#EADFD5] bg-white p-6 shadow-[0_20px_70px_rgba(17,24,39,0.06)]">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-black">Payment summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#F0E7DE] pb-3"><span className="text-[#5A5A59]">Template price</span><strong>{formatAmount(templateAmount)} {selectedGateway?.currency?.code || ""}</strong></div>
            <div className="flex justify-between gap-4 border-b border-[#F0E7DE] pb-3"><span className="text-[#5A5A59]">Plan price</span><strong>{formatAmount(planAmount)} {selectedGateway?.currency?.code || ""}</strong></div>
            <div className="flex items-center justify-between gap-4 pt-2"><span className="text-base font-semibold text-black">Total</span><strong className="text-2xl tracking-[-0.04em] text-[#6E26F2]">{formatAmount(payableAmount)} {selectedGateway?.currency?.code || ""}</strong></div>
          </div>
          {checkout?.gateway_flow?.auto_redirect ? <div className="mt-5 rounded-2xl border border-[#EADFD5] bg-[#FCFBF7] p-4 text-xs leading-5 text-[#5A5A59]">One payment gateway is enabled. Redirecting you to payment...</div> : null}
        </aside>
      </div>
    </section>
  );
}

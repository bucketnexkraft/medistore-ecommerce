import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { PiArrowLeft, PiCheckCircle, PiEnvelopeSimple, PiTag, PiWrench } from "react-icons/pi";
import { getPreference } from "../../api/preference";
import { sendCompanyTestSms, updateCompanyPreference } from "../../api/companyPreferances";
import { isFeatureIncludedInPlan } from "../../utils/planFeatures";

const smsProvider = {
  id: "bulk_sms_bd",
  label: "Bulk SMS BD",
  website: "https://bulksmsbd.com",
};

const defaultSmsTemplates = {
  order_confirmation: {
    title: "Order Confirmation",
    template: "Hello {{customer_name}}, your order #{{order_id}} has been confirmed. Total: {{order_total}}. - {{shop_name}}",
  },
  order_shipped: {
    title: "Order Shipped",
    template: "Hello {{customer_name}}, your order #{{order_id}} is on the way. Tracking: {{tracking_number}}. - {{shop_name}}",
  },
  order_delivered: {
    title: "Order Delivered",
    template: "Hello {{customer_name}}, your order #{{order_id}} has been delivered successfully. Thank you for shopping with {{shop_name}}.",
  },
  otp_verification: {
    title: "OTP Verification",
    template: "Your {{shop_name}} verification code is {{otp_code}}. This code will expire in {{otp_expiry_minutes}} minutes.",
  },
};

export default function ShopSmsSupport() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const smsSupportAllowed = isFeatureIncludedInPlan(selectedPlanFeatures, "ftr_shop_sms_support");

  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [smsTemplates, setSmsTemplates] = useState(defaultSmsTemplates);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    const loadSmsSettings = async () => {
      if (!accessToken || !companyId) return;

      try {
        const response = await getPreference(companyId, accessToken);
        const preferences = Array.isArray(response?.data) ? response.data : [];

        const readValue = (key) => {
          const item = preferences.find((entry) => entry?.key === key);
          return item?.value ?? null;
        };

        setApiKey(String(readValue("sms_api_key") ?? ""));
        setSenderId(String(readValue("sms_sender_id") ?? ""));
        const storedTemplates = readValue("sms_template_settings");
        if (storedTemplates && typeof storedTemplates === "object") {
          setSmsTemplates((prev) => {
            const next = { ...prev };
            Object.entries(prev).forEach(([key, value]) => {
              next[key] = {
                ...value,
                template: String(storedTemplates?.[key]?.template ?? value.template),
              };
            });
            return next;
          });
        }
      } catch (error) {
        console.error("Failed to load SMS support settings", error);
      }
    };

    loadSmsSettings();
  }, [accessToken, companyId]);

  const validateForm = () => {
    const nextErrors = {};

    if (!apiKey.trim()) {
      nextErrors.apiKey = "API key is required";
    }

    if (!senderId.trim()) {
      nextErrors.senderId = "Sender ID is required";
    }

    Object.entries(smsTemplates).forEach(([key, value]) => {
      if (!String(value?.template || "").trim()) {
        nextErrors[`template_${key}`] = `${value.title} template is required`;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveSmsSupport = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append("sms_service_provider", smsProvider.id);
      formData.append("sms_api_key", apiKey.trim());
      formData.append("sms_sender_id", senderId.trim());
      formData.append(
        "sms_template_settings",
        JSON.stringify(
          Object.fromEntries(
            Object.entries(smsTemplates).map(([key, value]) => [
              key,
              { title: value.title, template: String(value.template || "").trim() },
            ])
          )
        )
      );

      await updateCompanyPreference(accessToken, formData);
      setErrors({});

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "SMS support updated successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update SMS support");
    } finally {
      setIsSaving(false);
    }
  };

  const updateTemplate = (key, value) => {
    setSmsTemplates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        template: value,
      },
    }));
    setErrors((prev) => ({ ...prev, [`template_${key}`]: "" }));
  };

  const sendTestSms = async () => {
    if (!apiKey.trim() || !senderId.trim()) {
      toast.error("Save your API key and sender ID first.");
      return;
    }

    if (!testPhone.trim()) {
      toast.error("Enter a test phone number first.");
      return;
    }

    try {
      setIsSendingTest(true);
      await sendCompanyTestSms(accessToken, {
        phone: testPhone.trim(),
        message: testMessage.trim(),
      });

      Swal.fire({
        icon: "success",
        title: "Test SMS Sent",
        text: "Please check the recipient phone now.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send test SMS");
    } finally {
      setIsSendingTest(false);
    }
  };

  const templateEntries = Object.entries(smsTemplates);
  const isLocked = !smsSupportAllowed;

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto max-w-[1480px] space-y-6">
        <div className="rounded-2xl border border-black/20 bg-transparent p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => navigate("/company-preference/shop-setup")}
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-black/20 bg-white text-black transition hover:bg-slate-50"
              >
                <PiArrowLeft size={26} />
              </button>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-black">
                  Shop Setup
                </div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-black sm:text-4xl">
                  SMS Support
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-black sm:text-base">
                  Configure your SMS provider, message templates, and test delivery from one classic admin-style screen.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 xl:min-w-[560px]">
              <div className="rounded-2xl border border-black/20 bg-transparent px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Provider</p>
                <p className="mt-2 text-base font-semibold text-black">{smsProvider.label}</p>
              </div>
              <div className="rounded-2xl border border-black/20 bg-transparent px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Templates</p>
                <p className="mt-2 text-2xl font-bold text-black">{templateEntries.length}</p>
              </div>
              <div className="rounded-2xl border border-black/20 bg-transparent px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Plan</p>
                <p className="mt-2 inline-flex rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-bold text-black">
                  {smsSupportAllowed ? "Included" : "Disabled"}
                </p>
              </div>
              <div className="rounded-2xl border border-black/20 bg-transparent px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Status</p>
                <p className="mt-2 text-base font-semibold text-black">{apiKey && senderId ? "Connected" : "Setup needed"}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-2xl border border-black/20 bg-transparent p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-black/20 bg-white text-black">
                    <PiEnvelopeSimple size={22} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Provider</p>
                    <h2 className="mt-1 text-xl font-bold text-black">{smsProvider.label}</h2>
                    <p className="mt-1 text-sm text-black">Your SMS traffic is routed through this gateway.</p>
                  </div>
                </div>
                <span className="rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-bold text-black">
                  {smsSupportAllowed ? "Editable" : "Read only"}
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-black/20 bg-transparent p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Need credentials?</p>
                <a
                  href={smsProvider.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-black underline-offset-4 hover:underline"
                >
                  Open BULK SMS BD
                </a>
                <p className="mt-2 text-sm leading-6 text-black">
                  Create your account there, copy the API key and sender ID, then return here to save them.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-black/20 bg-transparent px-4 py-3">
                <PiCheckCircle size={18} className="text-black" />
                <div>
                  <p className="text-sm font-semibold text-black">Subscription access</p>
                  <p className="text-sm text-black">{smsSupportAllowed ? "This feature is available in the subscribed plan." : "This feature is not included in the subscribed plan."}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/20 bg-transparent p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-black/20 bg-white text-black">
                  <PiTag size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-black">Supported Placeholders</h3>
                  <p className="text-sm text-black">Use these tokens inside your templates.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "{{customer_name}}",
                  "{{order_id}}",
                  "{{order_total}}",
                  "{{tracking_number}}",
                  "{{shop_name}}",
                  "{{otp_code}}",
                  "{{otp_expiry_minutes}}",
                ].map((token) => (
                  <span
                    key={token}
                    className="rounded-full border border-black/20 bg-white px-3 py-2 text-[11px] font-bold text-black"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="rounded-2xl border border-black/20 bg-transparent p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black">Gateway Setup</p>
                  <h3 className="mt-1 text-2xl font-bold text-black">Provider Credentials</h3>
                  <p className="mt-2 text-sm text-black">These fields are required before sending any message.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black">
                  <PiWrench size={14} />
                  Required Setup
                </div>
              </div>

              <div className="relative mt-6 rounded-2xl border border-black/20 bg-transparent p-5">
                {isLocked ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/72 backdrop-blur-[2px]">
                    <button
                      type="button"
                      onClick={() => navigate("/subscription/plans")}
                      className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-6 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800"
                    >
                      Upgrade now
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="text-base font-bold text-black">Send Test SMS</h4>
                    <p className="mt-1 text-sm text-black">Use this to verify your API key, sender ID, and recipient format.</p>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-black/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-black">
                    Live Check
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-12">
                  <label className="block xl:col-span-4">
                    <span className="mb-2 block text-sm font-medium text-black">Test phone *</span>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="8801XXXXXXXXX"
                      disabled={isLocked}
                      className="h-12 w-full rounded-xl border border-black/20 bg-white px-4 text-sm text-black outline-none focus:border-black/40"
                    />
                  </label>

                  <label className="block xl:col-span-5">
                    <span className="mb-2 block text-sm font-medium text-black">Custom message</span>
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Leave blank to use default test message"
                      disabled={isLocked}
                      className="h-12 w-full rounded-xl border border-black/20 bg-white px-4 text-sm text-black outline-none focus:border-black/40"
                    />
                  </label>

                  <div className="flex items-end xl:col-span-3">
                    <button
                      type="button"
                      onClick={sendTestSms}
                      disabled={isLocked || isSendingTest}
                    className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-black/20 bg-white px-5 text-sm font-bold text-black transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSendingTest ? "Sending..." : "Send Test SMS"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-12">
                  <label className="block xl:col-span-4">
                  <span className="mb-2 block text-sm font-medium text-black">API key *</span>
                    <input
                      type="text"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setErrors((prev) => ({ ...prev, apiKey: "" }));
                    }}
                    placeholder="Paste API key"
                    disabled={isLocked}
                    className={`h-12 w-full rounded-xl bg-white px-4 text-sm text-black outline-none ${
                      errors.apiKey ? "border border-red-400" : "border border-black/20"
                    } focus:border-black/40`}
                  />
                  {errors.apiKey ? <p className="mt-2 text-sm font-medium text-red-500">{errors.apiKey}</p> : null}
                </label>

                <label className="block xl:col-span-4">
                  <span className="mb-2 block text-sm font-medium text-black">Sender ID *</span>
                  <input
                    type="text"
                    value={senderId}
                    onChange={(e) => {
                      setSenderId(e.target.value);
                      setErrors((prev) => ({ ...prev, senderId: "" }));
                    }}
                    placeholder="Enter sender ID"
                    disabled={isLocked}
                    className={`h-12 w-full rounded-xl bg-white px-4 text-sm text-black outline-none ${
                      errors.senderId ? "border border-red-400" : "border border-black/20"
                    } focus:border-black/40`}
                  />
                  {errors.senderId ? <p className="mt-2 text-sm font-medium text-red-500">{errors.senderId}</p> : null}
                </label>

                <div className="flex items-end xl:col-span-4">
                  <button
                    type="button"
                    onClick={saveSmsSupport}
                    disabled={isLocked || isSaving}
                    className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500"
                  >
                    {isSaving ? "Saving..." : "Save SMS Setup"}
                  </button>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl border border-black/20 bg-transparent p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-black">Message Library</p>
                  <h3 className="mt-1 text-2xl font-bold text-black">SMS Templates</h3>
                  <p className="mt-2 text-sm text-black">Customize the exact message your customer will receive for each moment.</p>
                </div>
                <div className="inline-flex items-center rounded-full border border-black/20 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black">
                  Fully Editable
                </div>
              </div>

              {isLocked ? (
                <div className="absolute inset-0 z-20 rounded-2xl bg-white/72 backdrop-blur-[2px]">
                  <div className="flex h-full items-center justify-center p-6">
                    <button
                      type="button"
                      onClick={() => navigate("/subscription/plans")}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-6 text-sm font-bold text-white shadow-sm transition hover:bg-neutral-800"
                    >
                      Upgrade now
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {templateEntries.map(([key, value]) => (
                  <label key={key} className="block rounded-2xl border border-black/20 bg-transparent p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="block text-base font-bold text-black">{value.title}</span>
                      <span className="rounded-full border border-black/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-black">
                        Template
                      </span>
                    </div>
                    <textarea
                      rows="6"
                      value={value.template}
                      onChange={(e) => updateTemplate(key, e.target.value)}
                      placeholder={`Write ${value.title.toLowerCase()} SMS template`}
                      disabled={isLocked}
                      className={`mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm leading-7 text-black outline-none ${
                        errors[`template_${key}`] ? "border border-red-400" : "border border-black/20"
                      } focus:border-black/40`}
                    />
                    {errors[`template_${key}`] ? (
                      <p className="mt-2 text-sm font-medium text-red-500">{errors[`template_${key}`]}</p>
                    ) : (
                      <p className="mt-2 text-xs text-black">Use placeholders above to inject order or customer data automatically.</p>
                    )}
                  </label>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-black/20 bg-transparent px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-black">
                  Template text is saved from this panel. Keep your placeholders intact for dynamic values.
                </p>
                <button
                  type="button"
                  onClick={saveSmsSupport}
                  disabled={isLocked || isSaving}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-6 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500"
                >
                  {isSaving ? "Saving..." : "Save Templates"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}

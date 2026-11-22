import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { PiArrowLeft, PiBank, PiCaretDown, PiCashRegister, PiEye, PiEyeSlash } from "react-icons/pi";
import { getPreference } from "../../api/preference";
import { updateCompanyPreference } from "../../api/companyPreferances";
import { getPlanGateways } from "../../api/companyOnboarding";
import { isFeatureIncludedInPlan } from "../../utils/planFeatures";

function formatParameterLabel(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isSecretField(key) {
  const normalized = String(key || "").trim().toLowerCase();
  return ["secret", "password", "token", "webhook", "encryption", "integrity"].some((part) =>
    normalized.includes(part)
  );
}

function getGatewayFields(gateway) {
  const parameters = gateway?.parameters;

  if (!parameters || Array.isArray(parameters) || typeof parameters !== "object") {
    return [];
  }

  return Object.keys(parameters).map((key) => ({
    key,
    label: formatParameterLabel(key),
    required: true,
    secret: isSecretField(key),
  }));
}

function normalizeGatewaySettings(systemGateways, storedSettings) {
  const storedMap = new Map(
    (Array.isArray(storedSettings) ? storedSettings : []).map((item) => [
      String(item?.id || ""),
      item,
    ])
  );

  return (Array.isArray(systemGateways) ? systemGateways : []).map((gateway) => {
    if (String(gateway?.gateway_type || "").toLowerCase() === "manual") {
      return null;
    }

    const saved = storedMap.get(String(gateway?.id || ""));
    const gatewayFields = getGatewayFields(gateway);
    const credentials = gatewayFields.reduce((accumulator, field) => {
      accumulator[field.key] = String(
        saved?.parameters?.[field.key] ??
        saved?.credentials?.[field.key] ??
        gateway?.parameters?.[field.key] ??
        ""
      );
      return accumulator;
    }, {});

    return {
      id: gateway?.id || "",
      name: gateway?.name || "Gateway",
      description:
        gateway?.description ||
        `Configure ${gateway?.name || "gateway"} settings`,
      image_url: gateway?.image_url || "",
      enabled: Boolean(saved?.enabled ?? false),
      gateway_type: gateway?.gateway_type || "",
      charge: gateway?.charge ?? 0,
      charge_type: gateway?.charge_type || "fixed",
      currency: gateway?.currency || null,
      parameters: gateway?.parameters && !Array.isArray(gateway.parameters) ? gateway.parameters : {},
      credentials,
    };
  }).filter(Boolean);
}

export default function ShopPaymentGateway() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const paymentGatewayAllowed = isFeatureIncludedInPlan(selectedPlanFeatures, "ftr_payment_gateway");

  const [gateways, setGateways] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedGatewayId, setExpandedGatewayId] = useState(null);
  const [visibleSecrets, setVisibleSecrets] = useState({});
  const hasEditableGateway = useMemo(
    () => paymentGatewayAllowed && gateways.length > 0,
    [gateways, paymentGatewayAllowed]
  );

  useEffect(() => {
    const loadGatewaySettings = async () => {
      if (!accessToken || !companyId) return;

      try {
        setIsLoading(true);

        const [gatewayResponse, preferenceResponse] = await Promise.all([
          getPlanGateways(accessToken),
          getPreference(companyId, accessToken),
        ]);

        const systemGateways = Array.isArray(gatewayResponse?.data) ? gatewayResponse.data : [];
        const preferences = Array.isArray(preferenceResponse?.data) ? preferenceResponse.data : [];
        const storedSettings =
          preferences.find((item) => item?.key === "payment_gateway_settings")?.value ?? [];

        setGateways(normalizeGatewaySettings(systemGateways, storedSettings));
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load payment gateways");
      } finally {
        setIsLoading(false);
      }
    };

    loadGatewaySettings();
  }, [accessToken, companyId]);

  const enabledCount = useMemo(
    () => gateways.filter((gateway) => gateway.enabled).length,
    [gateways]
  );

  const canEditGateway = () => paymentGatewayAllowed;

  const toggleGateway = (id) => {
    setGateways((prev) =>
      prev.map((gateway) =>
        String(gateway.id) === String(id) && canEditGateway(gateway)
          ? { ...gateway, enabled: !gateway.enabled }
          : gateway
      )
    );
  };

  const updateCredential = (gatewayId, key, value) => {
    setGateways((prev) =>
      prev.map((gateway) =>
        String(gateway.id) === String(gatewayId) && canEditGateway(gateway)
          ? {
              ...gateway,
              credentials: {
                ...(gateway.credentials || {}),
                [key]: value,
              },
            }
          : gateway
      )
    );
  };

  const toggleSecretVisibility = (gatewayId, key) => {
    const stateKey = `${gatewayId}:${key}`;
    setVisibleSecrets((prev) => ({
      ...prev,
      [stateKey]: !prev[stateKey],
    }));
  };

  const validateGateways = () => {
    for (const gateway of gateways) {
      if (!canEditGateway(gateway)) continue;
      if (!gateway.enabled) continue;

      const fields = getGatewayFields(gateway);
      for (const field of fields) {
        if (!field.required) continue;

        const value = String(gateway.credentials?.[field.key] || "").trim();
        if (!value) {
          setExpandedGatewayId(gateway.id);
          toast.error(`${gateway.name}: ${field.label} is required before enabling this gateway.`);
          return false;
        }
      }
    }

    return true;
  };

  const saveGateways = async () => {
    try {
      setIsSaving(true);

      if (!hasEditableGateway) {
        toast.info("Your current plan does not include payment gateway management.");
        setIsSaving(false);
        return;
      }

      if (!validateGateways()) {
        setIsSaving(false);
        return;
      }

      const formData = new FormData();
      formData.append(
        "payment_gateway_settings",
        JSON.stringify(
            gateways.map((gateway) => ({
              id: gateway.id,
              name: gateway.name,
              enabled: gateway.enabled,
              parameters: gateway.credentials || {},
          }))
        )
      );

      await updateCompanyPreference(accessToken, formData);

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Payment gateway settings updated successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update payment gateway settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/company-preference/shop-setup")}
                className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                <PiArrowLeft size={28} />
              </button>

              <div>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Shop Setup
                </div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  Payment Gateway
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Control which payment methods this company can use at checkout.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Total gateways</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{gateways.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Enabled</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{enabledCount}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Payment Gateways</h2>
              <p className="mt-2 text-sm text-slate-500">
                  Choose which payment methods will be available for this company.
              </p>
              {!paymentGatewayAllowed ? (
                <p className="mt-4 text-sm text-amber-700">
                  Your plan does not include payment gateway management, so this page is read-only.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={saveGateways}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSaving || isLoading || (!paymentGatewayAllowed && !hasEditableGateway)}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {gateways.map((gateway) => (
              <div
                key={gateway.id}
                className={`rounded-2xl border bg-white p-5 ${
                  canEditGateway(gateway)
                    ? "border-slate-200"
                    : "border-slate-200/80 bg-slate-50/80"
                }`}
              >
                {(() => {
                  const fields = getGatewayFields(gateway);
                  const isExpanded = String(expandedGatewayId) === String(gateway.id);
                  const editable = canEditGateway(gateway);

                  return (
                    <>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="grid h-[72px] w-[72px] min-h-[72px] min-w-[72px] place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {gateway.image_url ? (
                        <img src={gateway.image_url} alt={gateway.name} className="h-full w-full object-contain p-3" />
                      ) : gateway.name.toLowerCase().includes("cash") ? (
                        <PiCashRegister size={28} className="text-slate-700" />
                      ) : (
                        <PiBank size={28} className="text-slate-700" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold text-slate-900">{gateway.name}</h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            gateway.enabled
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {gateway.enabled ? "Enabled" : "Disabled"}
                        </span>
                        {!editable ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                            Plan locked
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{gateway.description}</p>
                      <p className="mt-2 text-sm text-slate-400">
                        Charge: {Number(gateway.charge || 0).toFixed(2)}
                        {gateway.charge_type === "percent" ? "%" : ""}{" "}
                        {gateway.currency?.code ? `| Currency: ${gateway.currency.code}` : ""}
                      </p>
                    </div>
                  </div>

                    <div className="flex items-center gap-3">
                    {fields.length > 0 && editable ? (
                      <button
                        type="button"
                        onClick={() => setExpandedGatewayId(isExpanded ? null : gateway.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Configure
                        <PiCaretDown className={`transition ${isExpanded ? "rotate-180" : ""}`} size={16} />
                      </button>
                    ) : null}

                    <label className="inline-flex items-center gap-4 rounded-full border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="text-sm font-medium text-slate-500">{gateway.enabled ? "On" : "Off"}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-lg toggle-primary"
                        checked={gateway.enabled}
                        onChange={() => toggleGateway(gateway.id)}
                        disabled={!editable}
                      />
                    </label>
                  </div>
                </div>

                {isExpanded && editable ? (
                  <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
                      {fields.map((field) => {
                        const stateKey = `${gateway.id}:${field.key}`;
                        const isSecretVisible = Boolean(visibleSecrets[stateKey]);
                        const currentValue = String(gateway.credentials?.[field.key] || "");

                        return (
                          <label key={field.key} className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              {field.label}
                              {field.required ? <span className="ml-1 text-rose-500">*</span> : null}
                            </span>
                            <div className="relative">
                              <input
                                type={field.secret && !isSecretVisible ? "password" : "text"}
                                value={currentValue}
                                onChange={(event) => updateCredential(gateway.id, field.key, event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                              />
                              {field.secret ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSecretVisibility(gateway.id, field.key)}
                                  className="absolute inset-y-0 right-3 inline-flex items-center text-slate-400 hover:text-slate-700"
                                >
                                  {isSecretVisible ? <PiEyeSlash size={18} /> : <PiEye size={18} />}
                                </button>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-sm text-slate-500">
                      These credentials are stored in this company&apos;s preference and used only for checkout payments.
                    </p>
                  </div>
                ) : null}
                    </>
                  );
                })()}
              </div>
            ))}

            {!isLoading && gateways.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
                No active system gateways found right now.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

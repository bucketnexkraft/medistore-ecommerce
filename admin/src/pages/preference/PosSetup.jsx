import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  PiCheckCircle,
  PiCoins,
  PiCreditCard,
  PiGear,
  PiMoney,
  PiQrCode,
  PiReceipt,
  PiWallet,
} from "react-icons/pi";
import extractLaravelErrors from "../../hooks/handleError";
import { getPosSettings, updatePosSettings } from "../../api/companyPreferances";
import { getproductSettings } from "../../api/productSettings";
import { hasPermission } from "../../utils/permissions";

const defaultReturnPolicy = {
  enabled: true,
  return_window_days: 7,
  allow_partial_return: true,
  require_invoice: true,
  allow_damaged_return: true,
  manager_approval_threshold: 0,
  allowed_return_modes: ["refund", "exchange"],
};

const defaultMethodConfig = {
  last_digit_length: [],
  require_last_digits: false,
  providers: [],
};

const methodMeta = {
  Cash: {
    icon: PiMoney,
    accent: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    label: "Counter cash",
  },
  Card: {
    icon: PiCreditCard,
    accent: "bg-sky-50 text-sky-700 ring-sky-100",
    label: "Card verification",
  },
  "QR Payment": {
    icon: PiQrCode,
    accent: "bg-violet-50 text-violet-700 ring-violet-100",
    label: "Mobile wallet",
  },
  "Reward Points": {
    icon: PiCoins,
    accent: "bg-amber-50 text-amber-700 ring-amber-100",
    label: "Loyalty balance",
  },
  "Cash Refund": {
    icon: PiMoney,
    accent: "bg-rose-50 text-rose-700 ring-rose-100",
    label: "Return cash",
  },
  "Refund to Card": {
    icon: PiCreditCard,
    accent: "bg-sky-50 text-sky-700 ring-sky-100",
    label: "Card refund",
  },
  "Refund to MF": {
    icon: PiWallet,
    accent: "bg-violet-50 text-violet-700 ring-violet-100",
    label: "Wallet refund",
  },
};

const getMethodMeta = (name) =>
  methodMeta[name] || {
    icon: PiGear,
    accent: "bg-slate-50 text-slate-700 ring-slate-100",
    label: "Payment option",
  };

const Spinner = ({ className = "h-5 w-5 text-white" }) => (
  <svg
    className={`animate-spin ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2V6M12 18V22M6 12H2M22 12H18M18.364 5.636L15.536 8.464M8.464 15.536L5.636 18.364M18.364 18.364L15.536 15.536M8.464 8.464L5.636 5.636"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const ToggleRow = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-primary/30 hover:bg-slate-50">
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-slate-800">
        {label}
      </span>
      {description && (
        <span className="mt-0.5 block text-xs text-slate-500">
          {description}
        </span>
      )}
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="toggle toggle-primary toggle-sm shrink-0"
    />
  </label>
);

const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  ...props
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
      {...props}
    />
  </label>
);

const MethodCard = ({ method, index, onToggle, children }) => {
  const meta = getMethodMeta(method.name);
  const Icon = meta.icon;

  return (
    <div
      className={`rounded-lg border bg-white transition ${
        method.enabled
          ? "border-primary/25 shadow-sm shadow-primary/5"
          : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ring-1 ${meta.accent}`}
          >
            <Icon size={22} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">
              {method.name}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {meta.label}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              method.enabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {method.enabled ? "Active" : "Inactive"}
          </span>
          <input
            type="checkbox"
            checked={!!method.enabled}
            onChange={() => onToggle(index)}
            className="toggle toggle-primary toggle-sm"
          />
        </div>
      </div>
      {method.enabled && children && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-4">
          {children}
        </div>
      )}
    </div>
  );
};

const PosSetup = () => {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [returnPolicy, setReturnPolicy] = useState(defaultReturnPolicy);
  const [isLoading, setIsLoading] = useState(false);
  const [isSellReturnEnabled, setIsSellReturnEnabled] = useState(false);

  const normalizePaymentMethods = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (Array.isArray(value?.data)) return value.data;
    return [];
  };

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const [response, featureResponse] = await Promise.all([
        getPosSettings(accessToken),
        getproductSettings(accessToken),
      ]);

      const assignedPreferences = featureResponse?.data?.preferences || [];
      const sellReturnPreference = assignedPreferences.find(
        (preference) => preference.code === "ftr_sell_return"
      );
      setIsSellReturnEnabled(!!sellReturnPreference?.is_active);

      setPaymentMethods(normalizePaymentMethods(response.data));
      setReturnPolicy(response.return_policy || defaultReturnPolicy);
    } catch (error) {
      const res = error?.response;
      const data = res?.data;
      if (res?.status === 422 && data?.errors) {
        const messages = extractLaravelErrors(data.errors);
        messages.forEach((m) => toast.error(m));
      } else {
        toast.error(data?.message || "Failed to fetch POS settings");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      const payload = {
        payment_methods: paymentMethods,
        ...(isSellReturnEnabled ? { return_policy: returnPolicy } : {}),
      };
      await updatePosSettings(accessToken, payload);
      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Settings saved successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      const res = error?.response;
      const data = res?.data;
      if (res?.status === 422 && data?.errors) {
        const messages = extractLaravelErrors(data.errors);
        messages.forEach((m) => toast.error(m));
      } else {
        toast.error(data?.message || "Failed to save settings");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePaymentMethod = (index) => {
    const updatedMethods = [...paymentMethods];
    updatedMethods[index].enabled = !updatedMethods[index].enabled;
    setPaymentMethods(updatedMethods);
  };

  const findPaymentMethodIndexByName = (name) =>
    paymentMethods.findIndex((method) => method.name === name);

  const ensureMethodConfig = (methods, index) => {
    methods[index].config = {
      ...defaultMethodConfig,
      ...(methods[index].config || {}),
    };
  };

  const updateCardDigitLength = (index, value) => {
    const updatedMethods = [...paymentMethods];
    const lengths = value
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !isNaN(v) && v > 0);
    ensureMethodConfig(updatedMethods, index);
    updatedMethods[index].config.last_digit_length = lengths;
    setPaymentMethods(updatedMethods);
  };

  const toggleRequireLastDigits = (index) => {
    const updatedMethods = [...paymentMethods];
    ensureMethodConfig(updatedMethods, index);
    updatedMethods[index].config.require_last_digits =
      !updatedMethods[index].config.require_last_digits;
    setPaymentMethods(updatedMethods);
  };

  const updateQrProviders = (index, value) => {
    const updatedMethods = [...paymentMethods];
    const providers = value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v);
    ensureMethodConfig(updatedMethods, index);
    updatedMethods[index].config.providers = providers;
    setPaymentMethods(updatedMethods);
  };

  const toggleReturnMode = (mode) => {
    setReturnPolicy((prev) => {
      const currentModes = Array.isArray(prev.allowed_return_modes)
        ? prev.allowed_return_modes
        : ["refund", "exchange"];
      const hasMode = currentModes.includes(mode);
      const nextModes = hasMode
        ? currentModes.filter((m) => m !== mode)
        : [...currentModes, mode];

      if (nextModes.length === 0) {
        toast.error("At least one return mode must be enabled");
        return prev;
      }

      return {
        ...prev,
        allowed_return_modes: nextModes,
      };
    });
  };

  useEffect(() => {
    fetchSettings();
  }, [accessToken]);

  const visiblePaymentMethods = paymentMethods.filter(
    (method) =>
      !["Cash Refund", "Refund to Card", "Refund to MF"].includes(method.name)
  );
  const activePaymentCount = visiblePaymentMethods.filter(
    (method) => method.enabled
  ).length;
  const totalPaymentCount = visiblePaymentMethods.length;

  const renderCardFields = (method, index, providerLabel = "QR providers") => {
    const config = { ...defaultMethodConfig, ...(method.config || {}) };

    if (method.name === "Card" || method.name === "Refund to Card") {
      return (
        <div className="space-y-3">
          <TextField
            label="Card last digit length"
            value={config.last_digit_length?.join(",") || ""}
            onChange={(e) => updateCardDigitLength(index, e.target.value)}
            placeholder="e.g., 5,6"
          />
          <ToggleRow
            checked={config.require_last_digits || false}
            onChange={() => toggleRequireLastDigits(index)}
            label="Require card last digits"
            description="Cashier must enter the configured card digits."
          />
        </div>
      );
    }

    if (method.name === "QR Payment" || method.name === "Refund to MF") {
      return (
        <TextField
          label={providerLabel}
          value={config.providers?.join(",") || ""}
          onChange={(e) => updateQrProviders(index, e.target.value)}
          placeholder="e.g., bKash,Nagad,Rocket,Upay"
        />
      );
    }

    return null;
  };
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <PiGear size={18} />
            POS Setup
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            POS Settings
          </h1>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          {activePaymentCount}/{totalPaymentCount} active methods
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Payment Methods</h2>
        </div>

        {isLoading ? (
          <div className="grid min-h-56 place-items-center">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-slate-500">
                Loading settings
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {visiblePaymentMethods.map((method) => {
                const index = findPaymentMethodIndexByName(method.name);

                return (
                  <MethodCard
                    key={method.name}
                    method={method}
                    index={index}
                    onToggle={togglePaymentMethod}
                  >
                    {renderCardFields(method, index)}
                  </MethodCard>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">
                  Active methods
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {activePaymentCount}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">
                  Return policy
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {isSellReturnEnabled && returnPolicy.enabled ? "On" : "Off"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">
                  Return window
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {returnPolicy.return_window_days ?? 0} days
                </p>
              </div>
            </div>

            <div>
              {isSellReturnEnabled && (
                <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-rose-700 ring-1 ring-rose-100">
                      <PiReceipt size={22} />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        Return Policy
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Configure refund methods and return rules.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    {["Cash Refund", "Refund to Card", "Refund to MF"].map(
                      (methodName) => {
                        const index = findPaymentMethodIndexByName(methodName);
                        const method = index >= 0 ? paymentMethods[index] : null;

                        return method ? (
                          <MethodCard
                            key={method.name}
                            method={method}
                            index={index}
                            onToggle={togglePaymentMethod}
                          >
                            {renderCardFields(
                              method,
                              index,
                              method.name === "Refund to MF"
                                ? "MF providers"
                                : "QR providers"
                            )}
                          </MethodCard>
                        ) : null;
                      }
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <ToggleRow
                      checked={!!returnPolicy.enabled}
                      onChange={(e) =>
                        setReturnPolicy((prev) => ({
                          ...prev,
                          enabled: e.target.checked,
                        }))
                      }
                      label="Enable returns"
                    />
                    <ToggleRow
                      checked={!!returnPolicy.allow_partial_return}
                      onChange={(e) =>
                        setReturnPolicy((prev) => ({
                          ...prev,
                          allow_partial_return: e.target.checked,
                        }))
                      }
                      label="Allow partial return"
                    />
                    <ToggleRow
                      checked={!!returnPolicy.require_invoice}
                      onChange={(e) =>
                        setReturnPolicy((prev) => ({
                          ...prev,
                          require_invoice: e.target.checked,
                        }))
                      }
                      label="Require invoice"
                    />
                    <ToggleRow
                      checked={!!returnPolicy.allow_damaged_return}
                      onChange={(e) =>
                        setReturnPolicy((prev) => ({
                          ...prev,
                          allow_damaged_return: e.target.checked,
                        }))
                      }
                      label="Allow damaged return"
                    />
                    <TextField
                      label="Return window (days)"
                      type="number"
                      min="0"
                      max="365"
                      value={returnPolicy.return_window_days ?? 7}
                      onChange={(e) =>
                        setReturnPolicy((prev) => ({
                          ...prev,
                          return_window_days: Number(e.target.value || 0),
                        }))
                      }
                    />
                    <TextField
                      label="Manager approval threshold"
                      type="number"
                      min="0"
                      step="0.01"
                      value={returnPolicy.manager_approval_threshold ?? 0}
                      onChange={(e) =>
                        setReturnPolicy((prev) => ({
                          ...prev,
                          manager_approval_threshold: Number(e.target.value || 0),
                        }))
                      }
                    />
                    <div className="md:col-span-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Allowed return modes
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ToggleRow
                          checked={(returnPolicy.allowed_return_modes || []).includes(
                            "refund"
                          )}
                          onChange={() => toggleReturnMode("refund")}
                          label="Cashback / Refund"
                        />
                        <ToggleRow
                          checked={(returnPolicy.allowed_return_modes || []).includes(
                            "exchange"
                          )}
                          onChange={() => toggleReturnMode("exchange")}
                          label="Exchange"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-5">
              {hasPermission("pos-setup.edit") && (
                <button
                  onClick={saveSettings}
                  className="btn btn-primary min-h-11 rounded-lg px-6 text-white shadow-sm"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Spinner />
                  ) : (
                    <>
                      <PiCheckCircle size={20} />
                      Save Settings
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PosSetup;

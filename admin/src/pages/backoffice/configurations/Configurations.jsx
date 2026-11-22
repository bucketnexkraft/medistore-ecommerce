import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getSettingSection,
  getSettingsSections,
  sendSettingsTestMail,
  updateSettingSection,
} from "../../../api/backoffice/configurations";
import { getCurrencies } from "../../../api/backoffice/currencies";

const EMAIL_METHODS = ["php", "smtp", "sendgrid"];
const CURRENCY_FORMAT_OPTIONS = ["left", "right", "both"];
const DEFAULT_BASE_COLOR = "#5423E7";
const IMAGE_FIELDS = new Set(["white_logo", "dark_logo", "icon", "og_image"]);
const REFERRAL_LEVEL_LIMIT = 20;
const BASE_VISIBLE_SECTIONS = [
  { key: "basic", title: "Basic Settings" },
  { key: "email_configuration", title: "Email Configuration" },
  { key: "ecommerce_store", title: "Ecommerce Store" },
  { key: "referral_rules", title: "Referral Rules" },
  { key: "payout_settings", title: "Payout Settings" },
  { key: "extension", title: "Extension Settings" },
];
const STORE_PROTOCOL_OPTIONS = ["https", "http"];

const normalizeBaseColor = (value) => {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BASE_COLOR;
};

const clampReferralLevel = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, REFERRAL_LEVEL_LIMIT);
};

const buildReferralLevelRows = (maxLevels, sourceLevels = [], fallback = {}) => {
  const limit = clampReferralLevel(maxLevels);
  const rows = new Map();

  if (Array.isArray(sourceLevels)) {
    sourceLevels.forEach((row, index) => {
      const level = Number.parseInt(row?.level ?? index + 1, 10);
      if (!Number.isFinite(level) || level < 1 || level > limit) {
        return;
      }

      rows.set(level, {
        level,
        percentage: row?.percentage ?? fallback[`level${level}_percentage`] ?? "",
      });
    });
  }

  for (let level = 1; level <= limit; level += 1) {
    if (!rows.has(level)) {
      rows.set(level, {
        level,
        percentage: fallback[`level${level}_percentage`] ?? "",
      });
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.level - b.level);
};

const normalizeReferralRulesForm = (data = {}) => {
  const derivedLevels = Array.isArray(data.levels) ? data.levels : [];
  const fallbackMax = derivedLevels.length > 0 ? derivedLevels.length : 1;
  const maxLevels = clampReferralLevel(data.max_levels ?? fallbackMax);

  return {
    ...data,
    max_levels: maxLevels,
    levels: buildReferralLevelRows(maxLevels, derivedLevels, data),
  };
};

export default function Configurations() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [active, setActive] = useState("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [testMailForm, setTestMailForm] = useState({
    receiver_email: "",
    subject: "",
    message: "",
  });
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const visibleSections = useMemo(() => BASE_VISIBLE_SECTIONS, []);

  const loadSections = useCallback(async () => {
    try {
      const result = await getSettingsSections(accessToken);
      if (result?.status) {
        const availableSections = Array.isArray(result?.data) ? result.data : [];
        setSections(
          availableSections.filter((section) =>
            visibleSections.some((visibleSection) => visibleSection.key === section.key)
          )
        );
      }
    } catch (error) {
      toast.error(error?.message || "Failed to load settings sections");
    }
  }, [accessToken, visibleSections]);

  const loadActiveSection = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSettingSection(accessToken, active);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load settings");
      }
      let nextForm = result?.data || {};
      if (active === "basic") {
        nextForm = {
          ...nextForm,
          base_color: normalizeBaseColor(nextForm.base_color),
        };
      }
      if (active === "referral_rules") {
        nextForm = normalizeReferralRulesForm(nextForm);
      }
      if (active === "payout_settings") {
        nextForm = {
          ...nextForm,
          methods_text: Array.isArray(nextForm.methods) ? nextForm.methods.join(", ") : (nextForm.methods || ""),
        };
      }

      setForm(nextForm);
      setFiles({});
      setImagePreviews({});
      setFieldErrors({});
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [accessToken, active]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const result = await getCurrencies(accessToken, { perPage: "all" });
        if (result?.status) {
          setCurrencyOptions(Array.isArray(result?.data) ? result.data : []);
        }
      } catch (error) {
        // Keep form usable even if currency list fails.
        console.error("Failed to load currencies", error);
      }
    };

    if (accessToken) {
      loadCurrencies();
    }
  }, [accessToken]);

  useEffect(() => {
    loadActiveSection();
  }, [loadActiveSection]);

  const save = async () => {
    setSaving(true);
    try {
      let payload = form;
      let isFormData = false;

      if (active === "payout_settings") {
        payload = {
          ...form,
          methods: String(form.methods_text || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        };
        delete payload.methods_text;
      }

      if (active === "basic" || active === "seo") {
        const fd = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          if (key.endsWith("_url")) return;
          if (IMAGE_FIELDS.has(key)) return;
          if (Array.isArray(value)) {
            fd.append(key, value.join(","));
          } else {
            fd.append(key, value ?? "");
          }
        });
        Object.entries(files).forEach(([key, file]) => {
          if (file instanceof File) {
            fd.append(key, file);
          }
        });
        payload = fd;
        isFormData = true;
      }

      const result = await updateSettingSection(accessToken, active, payload, isFormData);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to update settings");
      }
      toast.success(result?.message || "Settings updated");
      loadActiveSection();
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      if (apiErrors && typeof apiErrors === "object" && !Array.isArray(apiErrors)) {
        setFieldErrors(apiErrors);
      } else {
        toast.error(Array.isArray(apiErrors) ? apiErrors[0] : error?.response?.data?.message || error?.message || "Update failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const sendTestMail = async () => {
    setSendingMail(true);
    try {
      const result = await sendSettingsTestMail(accessToken, testMailForm);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to send test mail");
      }
      toast.success(result?.message || "Test mail sent");
      setTestMailForm({ receiver_email: "", subject: "", message: "" });
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || "Test mail failed");
    } finally {
      setSendingMail(false);
    }
  };

  const sectionTitle = useMemo(() => {
    const matched = sections.find((s) => s.key === active);
    return matched?.title || active;
  }, [sections, active]);

    const timezoneOptions = useMemo(() => {
      try {
        if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
          return Intl.supportedValuesOf("timeZone");
        }
    } catch {
      // ignore and use fallback
    }

    return [
      "UTC",
      "Asia/Dhaka",
      "Asia/Kolkata",
      "Asia/Dubai",
      "Europe/London",
      "Europe/Paris",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
    ];
  }, []);

  const getFieldError = (name) => {
    const err = fieldErrors?.[name];
    if (Array.isArray(err)) return err[0];
    if (typeof err === "string") return err;
    return "";
  };

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev || !Object.prototype.hasOwnProperty.call(prev, name)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const resolveImagePreview = (key) => {
    if (imagePreviews[key]) return imagePreviews[key];
    if (form[`${key}_url`]) return form[`${key}_url`];
    return "";
  };

  useEffect(() => {
    return () => {
      Object.values(imagePreviews).forEach((previewUrl) => {
        if (previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      });
    };
  }, [imagePreviews]);

  const handleCurrencyChange = (code) => {
    const matchedCurrency = currencyOptions.find((currency) => String(currency?.code || "") === String(code));
    setForm((prev) => ({
      ...prev,
      currency: code,
      currency_symbol: matchedCurrency?.symbol || prev?.currency_symbol || "",
    }));
  };

  const renderLoadingSkeleton = () => {
    const skeletonCountBySection = {
      basic: 12,
      email_configuration: 6,
      ecommerce_store: 10,
      extension: 10,
    };

    const skeletonCount = skeletonCountBySection[active] || 8;

    return (
      <div className="space-y-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-full bg-slate-200" />
          <div className="h-4 w-72 max-w-full rounded-full bg-slate-100" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <div key={index} className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
              <div className="h-4 w-28 rounded-full bg-slate-200" />
              <div className="mt-3 h-12 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="h-11 w-40 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  };

  const renderBasic = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        ["sitename", "Site Name"],
        ["base_color", "Base Color"],
        ["copyright", "Copyright"],
      ].map(([key, label]) => (
        <div key={key}>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">{label}</span></label>
          {key === "base_color" ? (
            <div className="flex gap-3">
              <input
                type="color"
                aria-label="Choose base color"
                className="h-12 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                value={normalizeBaseColor(form[key])}
                onChange={(e) => setField(key, e.target.value)}
              />
              <input
                className={`input input-bordered min-w-0 flex-1 ${getFieldError(key) ? "input-error border-red-500" : ""}`}
                value={form[key] ?? DEFAULT_BASE_COLOR}
                onChange={(e) => setField(key, e.target.value)}
                placeholder="#5423E7"
                maxLength={7}
              />
            </div>
          ) : (
            <input
              className={`input input-bordered w-full ${getFieldError(key) ? "input-error border-red-500" : ""}`}
              value={form[key] ?? ""}
              onChange={(e) => setField(key, e.target.value)}
            />
          )}
          {getFieldError(key) && <p className="text-red-500 text-xs mt-1">{getFieldError(key)}</p>}
        </div>
      ))}

      <div>
        <label className="label py-1"><span className="label-text font-medium text-slate-700">Timezone</span></label>
        <select
          className={`select select-bordered w-full ${getFieldError("timezone") ? "select-error border-red-500" : ""}`}
          value={form.timezone ?? ""}
          onChange={(e) => setField("timezone", e.target.value)}
        >
          <option value="">Select timezone</option>
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        {getFieldError("timezone") && <p className="text-red-500 text-xs mt-1">{getFieldError("timezone")}</p>}
      </div>

      <div>
        <label className="label py-1"><span className="label-text font-medium text-slate-700">Pagination</span></label>
        <input
          type="number"
          min="1"
          step="1"
          className={`input input-bordered w-full ${getFieldError("pagination") ? "input-error border-red-500" : ""}`}
          value={form.pagination ?? ""}
          onChange={(e) => setField("pagination", e.target.value)}
        />
        {getFieldError("pagination") && <p className="text-red-500 text-xs mt-1">{getFieldError("pagination")}</p>}
      </div>

      <div>
        <label className="label py-1"><span className="label-text font-medium text-slate-700">Currency Format</span></label>
        <select
          className={`select select-bordered w-full ${getFieldError("currency_format") ? "select-error border-red-500" : ""}`}
          value={form.currency_format ?? ""}
          onChange={(e) => setField("currency_format", e.target.value)}
        >
          <option value="">Select format</option>
          {CURRENCY_FORMAT_OPTIONS.map((formatOption) => (
            <option key={formatOption} value={formatOption}>
              {formatOption}
            </option>
          ))}
        </select>
        {getFieldError("currency_format") && <p className="text-red-500 text-xs mt-1">{getFieldError("currency_format")}</p>}
      </div>

      <div>
        <label className="label py-1"><span className="label-text font-medium text-slate-700">Decimal Precision</span></label>
        <input
          type="number"
          min="0"
          step="1"
          className={`input input-bordered w-full ${getFieldError("precision") ? "input-error border-red-500" : ""}`}
          value={form.precision ?? ""}
          onChange={(e) => setField("precision", e.target.value)}
        />
        {getFieldError("precision") && <p className="text-red-500 text-xs mt-1">{getFieldError("precision")}</p>}
      </div>

      <div>
        <label className="label py-1"><span className="label-text font-medium text-slate-700">Currency Code</span></label>
        <select
          className={`select select-bordered w-full ${getFieldError("currency") ? "select-error border-red-500" : ""}`}
          value={form.currency ?? ""}
          onChange={(e) => handleCurrencyChange(e.target.value)}
        >
          <option value="">Select currency</option>
          {currencyOptions.map((currency) => (
            <option key={currency.id || currency.code} value={currency.code}>
              {currency.code}
            </option>
          ))}
        </select>
        {getFieldError("currency") && <p className="text-red-500 text-xs mt-1">{getFieldError("currency")}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="label py-1"><span className="label-text font-medium text-slate-700">Currency Symbol</span></label>
        <input
          className={`input input-bordered w-full ${getFieldError("currency_symbol") ? "input-error border-red-500" : ""}`}
          value={form.currency_symbol ?? ""}
          onChange={(e) => setField("currency_symbol", e.target.value)}
          placeholder="Auto from currency setup"
        />
        {getFieldError("currency_symbol") && <p className="text-red-500 text-xs mt-1">{getFieldError("currency_symbol")}</p>}
      </div>

      {["white_logo", "dark_logo", "icon"].map((key) => (
        <div key={key}>
          <label className="label py-1"><span className="label-text font-medium text-slate-700 capitalize">{key.replace("_", " ")}</span></label>
          <input
            type="file"
            className={`file-input file-input-bordered w-full ${getFieldError(key) ? "file-input-error border-red-500" : ""}`}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;

              setFiles((prev) => ({ ...prev, [key]: file }));
              setImagePreviews((prev) => {
                if (prev[key]?.startsWith("blob:")) {
                  URL.revokeObjectURL(prev[key]);
                }

                return {
                  ...prev,
                  [key]: file ? URL.createObjectURL(file) : "",
                };
              });
            }}
          />
          {getFieldError(key) && <p className="text-red-500 text-xs mt-1">{getFieldError(key)}</p>}
          {resolveImagePreview(key) && (
            <img
              src={resolveImagePreview(key)}
              alt={key}
              className="mt-2 h-16 rounded border object-contain"
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderEmail = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Email Method</span></label>
          <select
            className="select select-bordered w-full"
            value={form.email_method || "php"}
            onChange={(e) => setField("email_method", e.target.value)}
          >
            {EMAIL_METHODS.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Email Send From</span></label>
          <input className="input input-bordered w-full" value={form.email_send_from ?? ""} onChange={(e) => setField("email_send_from", e.target.value)} />
        </div>
        {(form.email_method || "php") === "smtp" && (
          <>
            {["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_encryption"].map((key) => (
              <div key={key}>
                <label className="label py-1"><span className="label-text font-medium text-slate-700 capitalize">{key.replaceAll("_", " ")}</span></label>
                <input className="input input-bordered w-full" value={form[key] ?? ""} onChange={(e) => setField(key, e.target.value)} />
              </div>
            ))}
          </>
        )}
        {(form.email_method || "php") === "sendgrid" && (
          <div>
            <label className="label py-1"><span className="label-text font-medium text-slate-700">Sendgrid API Key</span></label>
            <input className="input input-bordered w-full" value={form.sendgrid_api_key ?? ""} onChange={(e) => setField("sendgrid_api_key", e.target.value)} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold">Send Test Mail</h4>
            <p className="text-sm text-gray-500 mt-1">Use current saved email configuration to verify delivery.</p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => navigate("/backoffice/email-templates")}
          >
            Manage Email Templates
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label py-1"><span className="label-text">Receiver Email</span></label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={testMailForm.receiver_email}
              onChange={(e) => setTestMailForm((prev) => ({ ...prev, receiver_email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label py-1"><span className="label-text">Subject</span></label>
            <input
              className="input input-bordered w-full"
              value={testMailForm.subject}
              onChange={(e) => setTestMailForm((prev) => ({ ...prev, subject: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label py-1"><span className="label-text">Message</span></label>
            <textarea
              rows={4}
              className="textarea textarea-bordered w-full"
              value={testMailForm.message}
              onChange={(e) => setTestMailForm((prev) => ({ ...prev, message: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" className="btn btn-outline mt-3" onClick={sendTestMail} disabled={sendingMail}>
          {sendingMail ? "Sending..." : "Send Test Mail"}
        </button>
      </div>
    </div>
  );

  const renderEcommerceStore = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h4 className="text-sm font-semibold text-slate-800">Managed Store Links</h4>
        <p className="mt-1 text-sm text-slate-500">
          Control the platform domain customers get instantly during ecommerce setup, without requiring DNS work for every store.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Platform Store Domain</span></label>
          <input
            className={`input input-bordered w-full ${getFieldError("platform_store_domain") ? "input-error border-red-500" : ""}`}
            value={form.platform_store_domain ?? ""}
            onChange={(e) => setField("platform_store_domain", e.target.value)}
            placeholder="stores.example.com"
          />
          <p className="mt-1 text-xs text-slate-500">Used to generate live customer store links like `cartbd.stores.example.com`.</p>
          {getFieldError("platform_store_domain") && <p className="text-red-500 text-xs mt-1">{getFieldError("platform_store_domain")}</p>}
        </div>

        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Local Store Domain</span></label>
          <input
            className={`input input-bordered w-full ${getFieldError("storefront_local_domain") ? "input-error border-red-500" : ""}`}
            value={form.storefront_local_domain ?? ""}
            onChange={(e) => setField("storefront_local_domain", e.target.value)}
            placeholder="arcade.local"
          />
          <p className="mt-1 text-xs text-slate-500">Used for local previews, for example `cartbd.arcade.local`.</p>
          {getFieldError("storefront_local_domain") && <p className="text-red-500 text-xs mt-1">{getFieldError("storefront_local_domain")}</p>}
        </div>

        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Store Link Example</span></label>
          <input
            className={`input input-bordered w-full ${getFieldError("store_link_example") ? "input-error border-red-500" : ""}`}
            value={form.store_link_example ?? ""}
            onChange={(e) => setField("store_link_example", e.target.value)}
            placeholder="cartbd-demo.stores.example.com"
          />
          {getFieldError("store_link_example") && <p className="text-red-500 text-xs mt-1">{getFieldError("store_link_example")}</p>}
        </div>

        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Default Protocol</span></label>
          <select
            className={`select select-bordered w-full ${getFieldError("default_store_protocol") ? "select-error border-red-500" : ""}`}
            value={form.default_store_protocol ?? "https"}
            onChange={(e) => setField("default_store_protocol", e.target.value)}
          >
            {STORE_PROTOCOL_OPTIONS.map((protocol) => (
              <option key={protocol} value={protocol}>{protocol}</option>
            ))}
          </select>
          {getFieldError("default_store_protocol") && <p className="text-red-500 text-xs mt-1">{getFieldError("default_store_protocol")}</p>}
        </div>

        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Subdomain Separator</span></label>
          <input
            className={`input input-bordered w-full ${getFieldError("subdomain_separator") ? "input-error border-red-500" : ""}`}
            value={form.subdomain_separator ?? "-"}
            onChange={(e) => setField("subdomain_separator", e.target.value)}
            placeholder="-"
          />
          <p className="mt-1 text-xs text-slate-500">Optional helper for auto-generated variations when a store handle is already taken.</p>
          {getFieldError("subdomain_separator") && <p className="text-red-500 text-xs mt-1">{getFieldError("subdomain_separator")}</p>}
        </div>

        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Reserved Subdomains</span></label>
          <input
            className={`input input-bordered w-full ${getFieldError("reserved_subdomains") ? "input-error border-red-500" : ""}`}
            value={form.reserved_subdomains ?? ""}
            onChange={(e) => setField("reserved_subdomains", e.target.value)}
            placeholder="www, admin, api, app"
          />
          <p className="mt-1 text-xs text-slate-500">Comma-separated blocked handles that customers should not claim.</p>
          {getFieldError("reserved_subdomains") && <p className="text-red-500 text-xs mt-1">{getFieldError("reserved_subdomains")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          ["managed_subdomains_enabled", "Managed subdomains", "Allow platform-generated store links for each company."],
          ["custom_domains_enabled", "Custom domains", "Keep custom domains optional instead of required during onboarding."],
          ["auto_generate_store_links", "Auto-generate links", "Suggest the first available store handle automatically from the company name."],
          ["company_name_as_subdomain", "Company name as subdomain", "Use the company/store name as the base handle when generating links."],
          ["show_store_link_during_onboarding", "Show link in onboarding", "Display the final storefront URL instantly before setup finishes."],
        ].map(([key, title, description]) => (
          <label key={key} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary mt-1"
              checked={Boolean(Number(form[key] || 0))}
              onChange={(e) => setField(key, e.target.checked ? 1 : 0)}
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Store Link Help Text</span></label>
          <textarea
            rows={4}
            className={`textarea textarea-bordered w-full ${getFieldError("store_link_help_text") ? "textarea-error border-red-500" : ""}`}
            value={form.store_link_help_text ?? ""}
            onChange={(e) => setField("store_link_help_text", e.target.value)}
            placeholder="Customers will get an instant platform link without DNS setup."
          />
          {getFieldError("store_link_help_text") && <p className="text-red-500 text-xs mt-1">{getFieldError("store_link_help_text")}</p>}
        </div>

        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Custom Domain Help Text</span></label>
          <textarea
            rows={4}
            className={`textarea textarea-bordered w-full ${getFieldError("custom_domain_help_text") ? "textarea-error border-red-500" : ""}`}
            value={form.custom_domain_help_text ?? ""}
            onChange={(e) => setField("custom_domain_help_text", e.target.value)}
            placeholder="Custom domains can be connected later if the merchant wants."
          />
          {getFieldError("custom_domain_help_text") && <p className="text-red-500 text-xs mt-1">{getFieldError("custom_domain_help_text")}</p>}
        </div>
      </div>
    </div>
  );

  const renderReferralRules = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h4 className="text-sm font-semibold text-slate-800">Referral Reward Rules</h4>
        <p className="mt-1 text-sm text-slate-500">
          Control the MLM-style payout chain for company activations and referral earnings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Max Levels</span></label>
          <input
            type="number"
            min="1"
            max={REFERRAL_LEVEL_LIMIT}
            step="1"
            className="input input-bordered w-full"
            value={form.max_levels ?? 1}
            onChange={(e) => {
              const nextMax = clampReferralLevel(e.target.value);
              setForm((prev) => {
                const currentLevels = Array.isArray(prev.levels) ? prev.levels : [];
                const nextLevels = [];

                for (let level = 1; level <= nextMax; level += 1) {
                  const existing = currentLevels[level - 1] || {};
                  nextLevels.push({
                    level,
                    percentage: existing.percentage ?? prev?.[`level${level}_percentage`] ?? "",
                  });
                }

                return {
                  ...prev,
                  max_levels: nextMax,
                  levels: nextLevels,
                };
              });
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            Controls how many ancestor levels receive rewards. Current limit: {REFERRAL_LEVEL_LIMIT}.
          </p>
        </div>

        <div>
          <label className="label py-1"><span className="label-text font-medium text-slate-700">Signup Bonus</span></label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input input-bordered w-full"
            value={form.signup_bonus ?? ""}
            onChange={(e) => setField("signup_bonus", e.target.value)}
            placeholder="25.00"
          />
          <p className="mt-1 text-xs text-slate-500">Used when a company activates with no payment amount.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-slate-800">Level Percentages</h5>
            <p className="mt-1 text-xs text-slate-500">Add the payout percentage for each ancestor level.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {Array.isArray(form.levels) ? form.levels.length : 0} levels
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(Array.isArray(form.levels) ? form.levels : []).map((row, index) => {
            const levelNumber = row?.level ?? index + 1;

            return (
              <div key={levelNumber} className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="label py-1">
                  <span className="label-text font-medium text-slate-700">Level {levelNumber} Percentage</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="input input-bordered w-full"
                  value={row?.percentage ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => {
                      const nextLevels = Array.isArray(prev.levels) ? [...prev.levels] : [];
                      nextLevels[index] = {
                        ...(nextLevels[index] || {}),
                        level: levelNumber,
                        percentage: value,
                      };

                      return {
                        ...prev,
                        levels: nextLevels,
                      };
                    });
                  }}
                  placeholder="10"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderPayoutSettings = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h4 className="text-sm font-semibold text-amber-950">Referral Bonus Payouts</h4>
        <p className="mt-1 text-sm text-amber-800">
          Control when companies can withdraw referral wallet earnings and which payout channels they can use.
        </p>
      </div>

      <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
        <div>
          <p className="font-semibold text-slate-900">Enable referral payouts</p>
          <p className="mt-1 text-sm text-slate-500">Companies can submit payout requests from their Referral System page.</p>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={Boolean(Number(form.enabled || 0))}
          onChange={(e) => setField("enabled", e.target.checked ? 1 : 0)}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label py-1"><span className="label-text font-medium">Minimum payout amount</span></label>
          <input type="number" min="0.01" step="0.01" className="input input-bordered w-full" value={form.minimum_amount ?? 10} onChange={(e) => setField("minimum_amount", e.target.value)} />
        </div>
        <div>
          <label className="label py-1"><span className="label-text font-medium">Maximum payout amount</span></label>
          <input type="number" min="0.01" step="0.01" className="input input-bordered w-full" value={form.maximum_amount ?? ""} onChange={(e) => setField("maximum_amount", e.target.value)} placeholder="No maximum" />
        </div>
        <div>
          <label className="label py-1"><span className="label-text font-medium">Maximum pending requests</span></label>
          <input type="number" min="1" max="20" step="1" className="input input-bordered w-full" value={form.max_pending_requests ?? 1} onChange={(e) => setField("max_pending_requests", e.target.value)} />
        </div>
        <div>
          <label className="label py-1"><span className="label-text font-medium">Payout methods</span></label>
          <input
            className="input input-bordered w-full"
            value={form.methods_text ?? ""}
            onChange={(e) => setField("methods_text", e.target.value)}
            placeholder="Bank Transfer, bKash, Nagad"
          />
          <p className="mt-1 text-xs text-slate-500">Separate methods with commas.</p>
        </div>
      </div>

      <div>
        <label className="label py-1"><span className="label-text font-medium">Company instructions</span></label>
        <textarea rows={4} className="textarea textarea-bordered w-full" value={form.instructions ?? ""} onChange={(e) => setField("instructions", e.target.value)} placeholder="Explain processing time and required account information." />
      </div>
    </div>
  );

  const renderExtension = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h4 className="text-sm font-semibold text-slate-800">AI Access Control</h4>
        <p className="mt-1 text-sm text-slate-500">
          Configure the global AI key, enable or disable AI features, and set the generation quota used by product descriptions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="label py-1"><span className="label-text">AI Key</span></label>
          <input
            className="input input-bordered w-full"
            value={form.ai_key ?? ""}
            onChange={(e) => setField("ai_key", e.target.value)}
            placeholder="OpenAI API key or compatible provider key"
          />
        </div>

        <div>
          <label className="label py-1"><span className="label-text">AI Generation Limit</span></label>
          <input
            type="number"
            min="0"
            step="1"
            className="input input-bordered w-full"
            value={form.ai_generation_limit ?? ""}
            onChange={(e) => setField("ai_generation_limit", e.target.value)}
            placeholder="Monthly generation count"
          />
          <p className="mt-1 text-xs text-slate-500">Counts how many product descriptions can be generated per company each month.</p>
        </div>

        <div>
          <label className="label py-1"><span className="label-text">AI Max Text Length</span></label>
          <input
            type="number"
            min="0"
            step="1"
            className="input input-bordered w-full"
            value={form.ai_max_text_length ?? ""}
            onChange={(e) => setField("ai_max_text_length", e.target.value)}
            placeholder="Maximum generated characters"
          />
          <p className="mt-1 text-xs text-slate-500">Limits the final product description length returned by AI.</p>
        </div>

        <label className="flex items-center justify-between border rounded-lg px-4 py-3 md:col-span-2">
          <span>AI Enabled</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={Boolean(Number(form.ai_status || 0))}
            onChange={(e) => setField("ai_status", e.target.checked ? 1 : 0)}
          />
        </label>
      </div>
    </div>
  );

  const renderSeo = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {["seo_title", "seo_description", "og_title", "og_description"].map((key) => (
        <div key={key}>
          <label className="label py-1"><span className="label-text">{key.replaceAll("_", " ")}</span></label>
          <input className="input input-bordered w-full" value={form[key] ?? ""} onChange={(e) => setField(key, e.target.value)} />
        </div>
      ))}
      <div className="md:col-span-2">
        <label className="label py-1"><span className="label-text">SEO Keywords (comma separated)</span></label>
        <input
          className="input input-bordered w-full"
          value={Array.isArray(form.seo_keywords) ? form.seo_keywords.join(", ") : (form.seo_keywords ?? "")}
          onChange={(e) => setField("seo_keywords", e.target.value)}
        />
      </div>
      <div>
        <label className="label py-1"><span className="label-text">OG Image</span></label>
        <input type="file" className="file-input file-input-bordered w-full" onChange={(e) => setFiles((prev) => ({ ...prev, og_image: e.target.files?.[0] }))} />
        {(form.og_image_url || form.og_image) && <img src={form.og_image_url || form.og_image} alt="og" className="mt-2 h-16 rounded border object-contain" />}
      </div>
    </div>
  );

  const renderSocial = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[
        "google_client_id",
        "google_client_secret",
        "google_callback_url",
        "facebook_client_id",
        "facebook_client_secret",
        "facebook_callback_url",
      ].map((key) => (
        <div key={key}>
          <label className="label py-1"><span className="label-text">{key.replaceAll("_", " ")}</span></label>
          <input className="input input-bordered w-full" value={form[key] ?? ""} onChange={(e) => setField(key, e.target.value)} />
        </div>
      ))}
      {["google_status", "facebook_status"].map((key) => (
        <label key={key} className="flex items-center justify-between border rounded-lg px-4 py-3">
          <span>{key.replaceAll("_", " ")}</span>
          <input type="checkbox" className="toggle toggle-primary" checked={Boolean(Number(form[key] || 0))} onChange={(e) => setField(key, e.target.checked ? 1 : 0)} />
        </label>
      ))}
    </div>
  );

  const renderKyc = () => {
    const fields = Array.isArray(form) ? form : [];
    return (
      <div className="space-y-3">
        {fields.map((row, idx) => (
          <div key={`${row?.name || "kyc"}-${idx}`} className="grid grid-cols-1 md:grid-cols-5 gap-2 border rounded-lg p-3">
            <input className="input input-bordered" placeholder="name" value={row?.name || ""} onChange={(e) => {
              const next = [...fields];
              next[idx] = { ...next[idx], name: e.target.value };
              setForm(next);
            }} />
            <input className="input input-bordered" placeholder="label" value={row?.label || ""} onChange={(e) => {
              const next = [...fields];
              next[idx] = { ...next[idx], label: e.target.value };
              setForm(next);
            }} />
            <select className="select select-bordered" value={row?.type || "text"} onChange={(e) => {
              const next = [...fields];
              next[idx] = { ...next[idx], type: e.target.value };
              setForm(next);
            }}>
              <option value="text">text</option>
              <option value="file">file</option>
              <option value="textarea">textarea</option>
            </select>
            <select className="select select-bordered" value={row?.is_required ? "1" : "0"} onChange={(e) => {
              const next = [...fields];
              next[idx] = { ...next[idx], is_required: e.target.value === "1" };
              setForm(next);
            }}>
              <option value="1">required</option>
              <option value="0">optional</option>
            </select>
            <button type="button" className="btn btn-error btn-outline" onClick={() => {
              const next = fields.filter((_, i) => i !== idx);
              setForm(next);
            }}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => {
          const next = [...fields, { name: "", label: "", type: "text", is_required: true }];
          setForm(next);
        }}>Add KYC Field</button>
      </div>
    );
  };

  const renderCron = () => (
    <div className="space-y-3">
      <div className="form-control">
        <label className="label py-1"><span className="label-text">Event Expired Cron</span></label>
        <input readOnly className="input input-bordered" value={form?.cron_event || ""} />
      </div>
      <div className="form-control">
        <label className="label py-1"><span className="label-text">Dispatch Email Queue</span></label>
        <input readOnly className="input input-bordered" value={form?.cron_queue || ""} />
      </div>
    </div>
  );

  const renderBody = () => {
    if (loading) return renderLoadingSkeleton();
    if (active === "basic") return renderBasic();
    if (active === "email_configuration") return renderEmail();
    if (active === "ecommerce_store") return renderEcommerceStore();
    if (active === "referral_rules") return renderReferralRules();
    if (active === "payout_settings") return renderPayoutSettings();
    if (active === "extension") return renderExtension();
    if (active === "seo") return renderSeo();
    if (active === "social") return renderSocial();
    if (active === "kyc") return renderKyc();
    if (active === "cron") return renderCron();
    return null;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold">Configuration</h2>
        <p className="text-sm text-gray-600 mt-1">
          Full admin settings migrated from legacy backoffice blades.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="border-b border-slate-200 mb-5">
          <div className="inline-flex flex-wrap gap-1">
          {(sections.length ? sections : visibleSections).map((section) => (
            <button
              key={section.key}
              type="button"
              className={`px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 ${
                active === section.key
                  ? "text-primary border-primary bg-primary/5"
                  : "text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300"
              }`}
              onClick={() => setActive(section.key)}
            >
              {section.title}
            </button>
          ))}
          </div>
        </div>

        {!loading && (
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-slate-800">{sectionTitle}</h3>
            <p className="text-sm text-slate-500 mt-1">Update section settings and save changes when finished.</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {renderBody()}
        </div>

        {!loading && active !== "cron" && (
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn btn-primary min-w-44" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

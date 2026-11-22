import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import {
  PiArrowLeft,
  PiArrowRight,
  PiArrowSquareOut,
  PiCopy,
  PiGlobeHemisphereWest,
  PiLink,
  PiLockKey,
  PiMagnifyingGlass,
  PiShieldCheck,
} from "react-icons/pi";
import { getPreference } from "../../api/preference";
import { getSettingSection } from "../../api/backoffice/configurations";
import {
  checkCompanyDomainAvailability,
  connectCustomDomain,
  getCompany,
  updateCompanyInfo,
  validateCustomDomainStore,
} from "../../api/backoffice/company";
import { isFeatureIncludedInPlan } from "../../utils/planFeatures";
import CustomDomainFlow from "../onboarding/CustomDomainFlow";

const FALLBACK_PLATFORM_DOMAIN = "your-platform-domain.com";
const LEGACY_PLATFORM_DOMAINS = new Set(["zatiq.app", "www.zatiq.app"]);

const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");

const slugifyHandle = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const getBrowserHost = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const host = normalizeDomain(window.location.hostname);
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return "";
  }

  return host;
};

const rootDomainFromHost = (value) => {
  const normalized = normalizeDomain(value);
  if (!normalized) {
    return "";
  }

  const segments = normalized.split(".").filter(Boolean);
  if (segments.length <= 2) {
    return normalized;
  }

  return segments.slice(-2).join(".");
};

const resolvePlatformDomain = (configuredDomain, activeDomain) => {
  const normalizedConfigured = normalizeDomain(configuredDomain);
  const normalizedActive = normalizeDomain(activeDomain);
  const browserHost = getBrowserHost();

  if (normalizedConfigured && !LEGACY_PLATFORM_DOMAINS.has(normalizedConfigured)) {
    return normalizedConfigured;
  }

  const activeRootDomain = rootDomainFromHost(normalizedActive);
  if (activeRootDomain && !LEGACY_PLATFORM_DOMAINS.has(activeRootDomain)) {
    return activeRootDomain;
  }

  if (browserHost && !LEGACY_PLATFORM_DOMAINS.has(browserHost)) {
    return browserHost;
  }

  return FALLBACK_PLATFORM_DOMAIN;
};

const isManagedDomain = (domain, platformDomain) => {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedPlatform = normalizeDomain(platformDomain);
  return Boolean(
    normalizedDomain &&
      normalizedPlatform &&
      normalizedDomain.endsWith(`.${normalizedPlatform}`)
  );
};

const extractHandle = (domain, platformDomain) => {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedPlatform = normalizeDomain(platformDomain);

  if (!isManagedDomain(normalizedDomain, normalizedPlatform)) {
    return "";
  }

  return normalizedDomain.replace(`.${normalizedPlatform}`, "");
};

export default function ShopDomainSetup() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);

  const [loading, setLoading] = useState(true);
  const [savingManaged, setSavingManaged] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [checkingManaged, setCheckingManaged] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [activeDomain, setActiveDomain] = useState("");
  const [platformDomain, setPlatformDomain] = useState(FALLBACK_PLATFORM_DOMAIN);
  const [customDomainsEnabled, setCustomDomainsEnabled] = useState(true);
  const [managedSubdomainsEnabled, setManagedSubdomainsEnabled] = useState(true);
  const [managedHandle, setManagedHandle] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [customSaveError, setCustomSaveError] = useState("");
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    const loadDomainSetup = async () => {
      if (!accessToken || !companyId) {
        setLoading(false);
        return;
      }

      try {
        const [preferenceResponse, companyResponse, settingsResponse] = await Promise.allSettled([
          getPreference(companyId, accessToken),
          getCompany(accessToken, companyId),
          getSettingSection(accessToken, "ecommerce_store"),
        ]);

        const preferences =
          preferenceResponse.status === "fulfilled" && Array.isArray(preferenceResponse.value?.data)
            ? preferenceResponse.value.data
            : [];

        const readValue = (key) =>
          preferences.find((item) => item?.key === key)?.value ?? null;

        const companyDomain =
          normalizeDomain(
            companyResponse.status === "fulfilled"
              ? companyResponse.value?.data?.domain || readValue("domain")
              : readValue("domain")
          ) || "";
        const companyCustomDomain = normalizeDomain(
          companyResponse.status === "fulfilled"
            ? companyResponse.value?.data?.custom_domain || readValue("custom_domain")
            : readValue("custom_domain")
        );

        const nextCompanyName = String(readValue("application_name") || "").trim();
        setCompanyName(nextCompanyName);
        setActiveDomain(companyDomain);
        setCustomDomain(companyCustomDomain);

        if (settingsResponse.status === "fulfilled") {
          const settings = settingsResponse.value?.data || {};
          setPlatformDomain(
            resolvePlatformDomain(settings.platform_store_domain, companyDomain)
          );
          setCustomDomainsEnabled(Boolean(settings.custom_domains_enabled ?? true));
          setManagedSubdomainsEnabled(Boolean(settings.managed_subdomains_enabled ?? true));
        } else {
          setPlatformDomain(resolvePlatformDomain("", companyDomain));
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load domain settings");
      } finally {
        setLoading(false);
      }
    };

    loadDomainSetup();
  }, [accessToken, companyId]);

  useEffect(() => {
    if (!activeDomain) {
      setManagedHandle("");
      return;
    }

    if (isManagedDomain(activeDomain, platformDomain)) {
      setManagedHandle(extractHandle(activeDomain, platformDomain));
    } else {
      setManagedHandle("");
    }
  }, [activeDomain, platformDomain]);

  const managedPreview = useMemo(() => {
    const handle = slugifyHandle(managedHandle);
    return handle ? `${handle}.${platformDomain}` : "";
  }, [managedHandle, platformDomain]);

  const currentMode = useMemo(() => {
    if (customDomain) return "custom";
    if (!activeDomain) return "none";
    return isManagedDomain(activeDomain, platformDomain) ? "managed" : "custom";
  }, [activeDomain, customDomain, platformDomain]);
  const customDomainFeatureEnabled = isFeatureIncludedInPlan(
    selectedPlanFeatures,
    "ftr_shop_domain_setup",
  );
  const managedDomainLocked = currentMode === "managed" && Boolean(activeDomain);
  const primaryDomain = customDomain || activeDomain;

  const validateCustomStore = async (storeDomain) => {
    const response = await validateCustomDomainStore(accessToken, companyId, storeDomain);
    return {
      valid: Boolean(response?.data?.valid),
      message: String(response?.data?.message || ""),
      suggestions: Array.isArray(response?.data?.suggestions) ? response.data.suggestions : [],
    };
  };

  const handleCustomDomainConnect = async ({ customDomain: connectedDomain, storeDomain, verificationToken }) => {
    setSavingCustom(true);
    setCustomSaveError("");

    try {
      const response = await connectCustomDomain(accessToken, companyId, {
        custom_domain: connectedDomain,
        store_domain: storeDomain,
        verification_token: verificationToken,
      });
      setActiveDomain(response?.data?.domain || storeDomain);
      setCustomDomain(response?.data?.custom_domain || connectedDomain);
      toast.success("Custom domain connected successfully.");
    } catch (error) {
      setCustomSaveError(error?.response?.data?.msg || error?.message || "Failed to connect custom domain.");
    } finally {
      setSavingCustom(false);
    }
  };

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const openDomain = (domain) => {
    const target = normalizeDomain(domain);
    if (!target) return;
    window.open(`https://${target}`, "_blank", "noopener,noreferrer");
  };

  const runAvailabilityCheck = async () => {
    const nextDomain = managedPreview;
    if (!nextDomain) {
      toast.error("Enter a subdomain first");
      return;
    }

    try {
      setCheckingManaged(true);
      const response = await checkCompanyDomainAvailability(accessToken, companyId, nextDomain);
      setAvailability(response?.data || null);
      if (response?.data?.available) {
        toast.success("Subdomain is available");
      } else {
        toast.error(response?.data?.message || "Subdomain is not available");
      }
    } catch (error) {
      toast.error(error?.response?.data?.msg || "Failed to check domain availability");
    } finally {
      setCheckingManaged(false);
    }
  };

  const saveDomain = async (domain, mode) => {
    try {
      if (!domain) {
        toast.error("Domain is required");
        return;
      }

      if (mode === "managed") {
        setSavingManaged(true);
      } else {
        setSavingCustom(true);
      }

      await updateCompanyInfo(accessToken, companyId, {
        domain: normalizeDomain(domain),
      });

      setActiveDomain(normalizeDomain(domain));
      setAvailability(null);

      Swal.fire({
        icon: "success",
        title: "Saved",
        text:
          mode === "managed"
            ? "Store subdomain updated successfully"
            : "Custom domain saved successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(
        error?.response?.data?.msg ||
          error?.response?.data?.message ||
          "Failed to save domain"
      );
    } finally {
      setSavingManaged(false);
      setSavingCustom(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px] space-y-6">
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
                  Shop Domain
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Manage the live store address customers use to open your shop.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">
                Active mode:{" "}
                <span className="text-slate-600">
                  {currentMode === "managed"
                    ? "Free subdomain"
                    : currentMode === "custom"
                      ? "Custom domain"
                      : "Not configured"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <PiGlobeHemisphereWest size={24} />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">
                  Primary Domain
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {primaryDomain || "No live domain yet"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {companyName || "Your store"} will open from this address.
                </p>
              </div>
            </div>

            {primaryDomain ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openDomain(primaryDomain)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  <PiArrowSquareOut size={18} />
                  Visit Store
                </button>
                <button
                  type="button"
                  onClick={() => copyText(`https://${primaryDomain}`)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  <PiCopy size={18} />
                  Copy Link
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <PiLink size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Free Subdomain</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Use a managed store link on your platform domain.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {managedSubdomainsEnabled ? "Available" : "Disabled"}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Store handle</span>
                <div className="flex rounded-xl border border-slate-200 bg-white">
                  <input
                    type="text"
                    value={managedHandle}
                    onChange={(e) => {
                      setManagedHandle(slugifyHandle(e.target.value));
                      setAvailability(null);
                    }}
                    placeholder="your-store"
                    className="h-12 flex-1 rounded-l-xl px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    disabled={!managedSubdomainsEnabled || loading || managedDomainLocked}
                  />
                  <div className="flex items-center border-l border-slate-200 px-4 text-sm text-slate-500">
                    .{platformDomain}
                  </div>
                </div>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-medium text-slate-900">Preview</p>
                <p className="mt-1 text-slate-600">
                  {managedPreview ? `https://${managedPreview}` : `your-store.${platformDomain}`}
                </p>
              </div>

              {managedDomainLocked ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                  This free subdomain was already reserved during landing setup and is locked here.
                </div>
              ) : null}

              {availability ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    availability.available
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <p>{availability.message}</p>
                  {!availability.available && availability.suggestions?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availability.suggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setManagedHandle(extractHandle(item, platformDomain) || item.split(".")[0]);
                            setAvailability(null);
                          }}
                          className="rounded-full border border-current px-3 py-1 text-xs font-medium"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={runAvailabilityCheck}
                  disabled={!managedSubdomainsEnabled || checkingManaged || !managedPreview || managedDomainLocked}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <PiMagnifyingGlass size={18} />
                  {checkingManaged ? "Checking..." : "Check Availability"}
                </button>
                <button
                  type="button"
                  onClick={() => saveDomain(managedPreview, "managed")}
                  disabled={!managedSubdomainsEnabled || savingManaged || !managedPreview || managedDomainLocked}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingManaged ? "Saving..." : "Save Subdomain"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <PiShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Custom Domain</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Use your own branded domain for the storefront.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {customDomainsEnabled && customDomainFeatureEnabled ? "Supported" : "Unavailable"}
              </span>
            </div>

            {!customDomainFeatureEnabled ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                      <PiLockKey size={14} />
                      Upgrade Required
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">
                      Custom domain is not included in your current plan
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Free subdomain setup is still available on this page. Upgrade your subscription when you want to connect a branded custom domain.
                    </p>
                  </div>

                  <Link
                    to="/subscription/plans"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Upgrade Plan
                    <PiArrowRight size={18} />
                  </Link>
                </div>
              </div>
            ) : (
              <CustomDomainFlow
                key={`${customDomain}:${managedHandle}`}
                initialDomain={customDomain}
                initialStoreName={managedHandle || slugifyHandle(companyName)}
                platformTarget={platformDomain}
                saving={savingCustom}
                saveError={customSaveError}
                validateStore={validateCustomStore}
                onConnect={handleCustomDomainConnect}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

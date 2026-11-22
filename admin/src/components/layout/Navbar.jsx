import React, { useCallback, useEffect, useState } from "react";
import { RiMenu3Fill } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import companyLogo from "../../../public/logo/default-logo.png";
import { PiBell, PiLightbulb, PiStackPlus, PiUserSwitch, PiUser, PiLockKey, PiSignOut, PiX, PiClockCountdown } from "react-icons/pi";
import { MdOutlinePointOfSale, MdOutlineFilePresent } from "react-icons/md";
import { BsCashStack } from "react-icons/bs";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { hasPermission } from "../../utils/permissions";
import { stopImpersonation } from "../../slice/authSlice";
import { setRights } from "../../slice/rightSlice";
import { toast } from "react-toastify";
import defaultProfileAvater from "../../assets/img/user_default_image.webp";
import { getproductSettings } from "../../api/productSettings";
import { fetchInventoryCopilotInsights } from "../../api/inventoryCopilot";
import axiosInstance from "../../config/axiosInstance";
import { API_URL } from "../../config/constants";

const buildSettingsAssetUrl = (value) => {
  const fileName = String(value || "").trim();
  if (!fileName) return null;
  if (/^https?:\/\//i.test(fileName)) return fileName;

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || API_URL.replace(/\/api\/v\d+\/?$/, "")).replace(/\/+$/, "");
  return `${apiBaseUrl}/uploads/settings/${fileName.replace(/^\/+/, "")}`;
};

export default function Navbar({ toggleSidebar, isSidebarOpen }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth);
  const { data } = useSelector((state) => state.preferences);
  const isSuperAdmin = Number(user?.is_super_admin || 0) === 1;
  const needsPlanSelection = user?.needs_plan_selection === true && !isSuperAdmin;
  const location = useLocation();
  const isInBackoffice = location.pathname.startsWith("/backoffice");
  const isImpersonating = user.is_impersonating === true;
  const displayName = (user?.name || "User").trim();
  const shortName =
    displayName.length > 18 ? `${displayName.slice(0, 18).trim()}...` : displayName;
  const profileImageSrc = user?.profile_image_path || defaultProfileAvater;
  const isProfileRoute = location.pathname.startsWith("/profile");
  const isPasswordRoute = location.pathname.startsWith("/password-update");
  const isBackofficeShell =
    isInBackoffice || (isSuperAdmin && (isProfileRoute || isPasswordRoute));
  const isBackofficeProfileShell = isSuperAdmin && (isProfileRoute || isPasswordRoute);
  const stockTrackingEnabled = ![false, 0, "0", "false"].includes(data?.stock_tracking_enabled);
  const [copilotEnabled, setCopilotEnabled] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotData, setCopilotData] = useState({ summary: {}, insights: [] });
  const [copilotFilter, setCopilotFilter] = useState(null);

  const priorityClass = {
    high: "border-rose-200 bg-rose-50 text-rose-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-slate-200 bg-slate-50 text-slate-700",
  };

  const typeLabels = {
    low_stock: "Low Stock",
    fast_selling: "Fast Selling",
    aging_stock: "Aging Stock",
    dead_stock: "Dead Stock",
    overstock: "Overstock",
  };
  const visibleCopilotInsights = copilotData.insights;
  const copilotFilterLabel = !copilotFilter
    ? "All insights"
    : copilotFilter.kind === "priority"
      ? `${copilotFilter.value.charAt(0).toUpperCase()}${copilotFilter.value.slice(1)} priority`
      : typeLabels[copilotFilter.value] || copilotFilter.value;

  const loadCopilotFeature = useCallback(async () => {
    if (!user?.accessToken || isSuperAdmin || isInBackoffice) {
      setCopilotEnabled(false);
      return;
    }

    try {
      const result = await getproductSettings(user.accessToken);
      const planFeatures = Array.isArray(user?.selected_plan_features) ? user.selected_plan_features : [];
      const planAllowsCopilot = planFeatures.length === 0 || planFeatures.includes("ftr_inventory_copilot");
      const enabled = result?.data?.preferences?.some(
        (preference) => preference.code === "ftr_inventory_copilot" && preference.is_active
      );
      setCopilotEnabled(Boolean(enabled && planAllowsCopilot));
    } catch (error) {
      setCopilotEnabled(false);
    }
  }, [isInBackoffice, isSuperAdmin, user?.accessToken, user?.selected_plan_features]);

  const loadCopilotInsights = useCallback(async (filter = null) => {
    if (!user?.accessToken) return;

    setCopilotLoading(true);
    try {
      const params = filter
        ? filter.kind === "priority"
          ? { priority: filter.value }
          : { type: filter.value }
        : {};
      const result = await fetchInventoryCopilotInsights(user.accessToken, params);
      setCopilotData({
        summary: result?.summary || {},
        insights: Array.isArray(result?.insights) ? result.insights : [],
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load Inventory Copilot");
      setCopilotData({ summary: {}, insights: [] });
    } finally {
      setCopilotLoading(false);
    }
  }, [user?.accessToken]);

  useEffect(() => {
    loadCopilotFeature();
  }, [loadCopilotFeature]);

  useEffect(() => {
    const handleFeaturePreferenceUpdate = (event) => {
      const { code, is_active } = event?.detail || {};
      if (code === "ftr_inventory_copilot") {
        const planFeatures = Array.isArray(user?.selected_plan_features) ? user.selected_plan_features : [];
        const planAllowsCopilot = planFeatures.length === 0 || planFeatures.includes("ftr_inventory_copilot");
        setCopilotEnabled(Boolean(is_active && planAllowsCopilot));
        if (!is_active) {
          setCopilotOpen(false);
        }
      }
    };

    window.addEventListener(
      "stoqio:feature-preferences-updated",
      handleFeaturePreferenceUpdate
    );

    return () => {
      window.removeEventListener(
        "stoqio:feature-preferences-updated",
        handleFeaturePreferenceUpdate
      );
    };
  }, [user?.selected_plan_features]);

  useEffect(() => {
    if (copilotOpen) {
      setCopilotFilter(null);
      loadCopilotInsights(null);
    }
  }, [copilotOpen, loadCopilotInsights]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isShiftFeatureEnabled, setIsShiftFeatureEnabled] = useState(false);
  const [isWaitlistFeatureEnabled, setIsWaitlistFeatureEnabled] = useState(false);
  const globalBrandLogo =
    buildSettingsAssetUrl(data?.basic?.dark_logo) ||
    buildSettingsAssetUrl(data?.basic?.white_logo) ||
    data?.white_logo_url ||
    data?.dark_logo_url ||
    buildSettingsAssetUrl(data?.white_logo) ||
    buildSettingsAssetUrl(data?.dark_logo) ||
    data?.white_logo ||
    data?.dark_logo ||
    companyLogo;
  const companyBrandLogo = data?.site_logo || null;
  const activeBrandLogo = isBackofficeShell ? globalBrandLogo : companyBrandLogo;
  const brandName =
    isBackofficeShell
      ? data?.basic?.sitename || data?.sitename || data?.application_name || "stoqio"
      : data?.application_name || data?.basic?.sitename || data?.sitename || "stoqio";

  const loadNotifications = async () => {
    if (!user?.accessToken) return;
    setIsLoadingNotifications(true);
    try {
      const api = axiosInstance(user.accessToken);
      const response = await api.get("/notifications", { params: { limit: 8 } });
      const result = response?.data || {};
      if (result.status) {
        setNotifications(Array.isArray(result.data) ? result.data : []);
        setUnreadCount(Number(result.unread_count || 0));
      }
    } catch (error) {
      // Silent fail for header utility
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user?.accessToken || unreadCount <= 0) return;
    try {
      const api = axiosInstance(user.accessToken);
      await api.post("/notifications/mark-all-read");
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          read_at: item.read_at || new Date().toISOString(),
        }))
      );
    } catch (error) {
      // Silent fail for header utility
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.accessToken]);

  useEffect(() => {
    let isMounted = true;

    const loadHeaderFeatures = async () => {
      if (!user?.accessToken || isSuperAdmin) {
        if (isMounted) {
          setIsShiftFeatureEnabled(false);
          setIsWaitlistFeatureEnabled(false);
        }
        return;
      }

      try {
        const result = await getproductSettings(user.accessToken);
        const assignedPreferences = result?.data?.preferences || [];
        const shiftPreference = assignedPreferences.find(
          (preference) => preference.code === "ftr_shift_and_cash_handover"
        );
        const waitlistPreference = assignedPreferences.find(
          (preference) => preference.code === "ftr_customer_waitlist"
        );
        if (isMounted) {
          setIsShiftFeatureEnabled(!!shiftPreference?.is_active);
          setIsWaitlistFeatureEnabled(!!waitlistPreference?.is_active);
        }
      } catch (error) {
        if (isMounted) {
          setIsShiftFeatureEnabled(false);
          setIsWaitlistFeatureEnabled(false);
        }
      }
    };

    loadHeaderFeatures();

    return () => {
      isMounted = false;
    };
  }, [user?.accessToken, isSuperAdmin]);

  useEffect(() => {
    const handleFeaturePreferenceUpdate = (event) => {
      const { code, is_active } = event?.detail || {};
      if (code === "ftr_shift_and_cash_handover") {
        setIsShiftFeatureEnabled(!!is_active);
      }
      if (code === "ftr_customer_waitlist") {
        setIsWaitlistFeatureEnabled(!!is_active);
      }
    };

    window.addEventListener(
      "stoqio:feature-preferences-updated",
      handleFeaturePreferenceUpdate
    );

    return () => {
      window.removeEventListener(
        "stoqio:feature-preferences-updated",
        handleFeaturePreferenceUpdate
      );
    };
  }, []);

  const handleBackToAdmin = () => {
    const session = user.impersonator_session;
    if (!session) return;

    dispatch(
      stopImpersonation({
        authSnapshot: session.authSnapshot,
      })
    );
    dispatch(setRights(session.rights || []));
    toast.success("Returned to admin session");
    navigate("/backoffice/companies");
  };

  const handleCopilotAction = (url) => {
    if (!url) return;
    setCopilotOpen(false);
    navigate(url);
  };


  const applyCopilotFilter = (filter) => {
    setCopilotFilter(filter);
    loadCopilotInsights(filter);
  };

  return (
    <>
    <div className="navbar min-h-16 flex items-center justify-between px-3 sm:px-4 lg:px-6 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_0_rgba(15,23,42,0.03)] fixed top-0 left-0 right-0 z-30">
      {/* Logo and Toggle */}
      <div className="flex min-w-0 items-center gap-3">
        {/* {!isInBackoffice && ( */}
          <div className="flex-none">
            <button
              onClick={toggleSidebar}
              className="btn btn-ghost btn-square h-10 min-h-10 w-10 rounded-lg border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <RiMenu3Fill className="h-5 w-5" />
            </button>
          </div>
        {/* )} */}
        <Link
          to={isBackofficeShell ? "/backoffice/dashboard" : needsPlanSelection ? "/subscription/plans" : "/dashboard"}
          className="max-lg:hidden flex h-10 items-center"
        >
          {isBackofficeShell ? (
            <span className="truncate text-2xl font-semibold tracking-wide text-slate-950">
              {brandName}
            </span>
          ) : null}
        </Link>
      </div>
      {/* User Profile and Notifications */}
      <div className="flex-none flex items-center gap-2">
        <LanguageSwitcher />
        {isImpersonating && !needsPlanSelection && (
          <button type="button" className="btn btn-warning btn-sm h-10 min-h-10 rounded-lg" onClick={handleBackToAdmin}>
            Back to Backoffice
          </button>
        )}
        {!needsPlanSelection && copilotEnabled && (
          <button
            type="button"
            className="btn btn-outline btn-primary h-10 min-h-10 rounded-lg px-3"
            onClick={() => setCopilotOpen(true)}
          >
            <PiLightbulb className="size-[1.2em]" />
            <span className="hidden xl:inline">Inventory Copilot</span>
          </button>
        )}
        {!needsPlanSelection && isSuperAdmin && !isInBackoffice && !isProfileRoute && (
          <Link
            to="/backoffice"
            className="btn btn-square btn-outline h-10 min-h-10 rounded-lg border-slate-300 hover:border-primary hover:bg-primary/5"
            title="Login to Backoffice"
          >
            <PiUserSwitch className="flex-shrink-0 size-[1.2em]" />
          </Link>
        )}
        <div className="flex gap-2 max-sm:hidden">
        {!needsPlanSelection && !isBackofficeShell && !isSuperAdmin && isShiftFeatureEnabled && hasPermission("stock-out.shifting") && location.pathname.startsWith("/pos") && (
            <>
              <button
                type="button"
                className="btn btn-square btn-outline btn-primary h-10 min-h-10 rounded-lg"
                title="Start / Handover Shift"
                onClick={() => window.dispatchEvent(new CustomEvent("pos-shift:open"))}
              >
                <PiUserSwitch className="flex-shrink-0 size-[1.2em]" />
              </button>
              <button
                type="button"
                className="btn btn-square btn-outline btn-info h-10 min-h-10 rounded-lg"
                title="Cash Handover"
                onClick={() => window.dispatchEvent(new CustomEvent("pos-cash-handover:open"))}
              >
                <BsCashStack className="flex-shrink-0 size-[1.2em]" />
              </button>
            </>
          )}
          {!needsPlanSelection && stockTrackingEnabled && !isBackofficeShell && !isSuperAdmin  && hasPermission("stock-in.create") && (
            <Link
              className="btn btn-square btn-outline btn-primary h-10 min-h-10 rounded-lg"
              title="Stock In"
              to="/purchases/create"
            >
              <PiStackPlus className="flex-shrink-0 size-[1.2em]" />
            </Link>
          )}
          {!needsPlanSelection && !isBackofficeShell && !isSuperAdmin && hasPermission("stock-out.create") && (
            <Link
              className="btn btn-square btn-outline btn-primary h-10 min-h-10 rounded-lg"
              title="Stock Out"
              to="/pos"
            >
              <MdOutlinePointOfSale className="flex-shrink-0 size-[1.2em]" />
            </Link>
          )}
          {!needsPlanSelection &&
            !isSuperAdmin &&
            !isBackofficeShell &&
            isWaitlistFeatureEnabled &&
            hasPermission("stock-out.view") && (
              <Link
                className="btn btn-square btn-outline btn-primary h-10 min-h-10 rounded-lg"
                title="Waitlists"
                to="/stock/waitlists"
              >
                <PiClockCountdown className="flex-shrink-0 size-[1.2em]" />
              </Link>
            )}
          {!needsPlanSelection && isSuperAdmin && (
            <Link
              className="btn btn-square btn-outline btn-secondary h-10 min-h-10 rounded-lg"
              title="View Logs"
              to="/backoffice/logs"
            >
              <MdOutlineFilePresent className="flex-shrink-0 size-[1.2em]" />
            </Link>
          )}
        </div>
        {!needsPlanSelection && !isBackofficeProfileShell && (
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            role="button"
            className="btn btn-square btn-outline h-10 min-h-10 rounded-lg border-slate-300 hover:border-primary hover:bg-primary/5"
            onClick={loadNotifications}
          >
            <div className="indicator">
              <PiBell className="flex-shrink-0 size-[1.2em] h-5 w-5" />
              {unreadCount > 0 && <span className="badge badge-xs badge-primary indicator-item"></span>}
            </div>
          </button>
          <div
            tabIndex={0}
            className="dropdown-content z-[200] mt-3 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <p className="font-semibold text-slate-800">Notifications</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{unreadCount} new</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={markAllNotificationsRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            {isLoadingNotifications ? (
              <div className="py-6 text-center text-sm text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No notifications yet</div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.map((item) => (
                  <div key={item.id} className="py-2.5">
                    <p className="text-sm font-medium text-slate-800">
                      {item?.data?.title || "Notification"}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {item?.data?.message || "You have a new update."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
        {!needsPlanSelection && <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />}
        <div className="dropdown dropdown-end">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-sm shadow-slate-200/40 transition hover:border-slate-300">
            <div className="hidden md:block text-right leading-tight pr-1">
              <h5 className="text-sm font-semibold text-slate-900">{shortName}</h5>
            </div>
            <div
              tabIndex={0}
              role="button"
              className="avatar cursor-pointer"
            >
              <div className="h-8 w-8 rounded-lg ring-1 ring-slate-200 overflow-hidden">
                <img
                  alt="Profile"
                  src={profileImageSrc}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = defaultProfileAvater;
                  }}
                />
              </div>
            </div>
          </div>
          <div
            tabIndex={0}
            className="dropdown-content z-[300] mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <p className="font-semibold text-slate-900 truncate">{displayName}</p>
            </div>

            <div className="space-y-1">
              <Link to="/profile" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                <PiUser size={18} />
                <span>Profile</span>
              </Link>
              {!needsPlanSelection && (
                <Link to="/profile?tab=password" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <PiLockKey size={18} />
                  <span>Password Update</span>
                </Link>
              )}
              {isImpersonating && !needsPlanSelection && (
                <button
                  type="button"
                  onClick={handleBackToAdmin}
                  className="w-full text-left flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                >
                  <PiUserSwitch size={18} />
                  <span>Back to Backoffice</span>
                </button>
              )}
            </div>

            <div className="my-2 border-t border-slate-100" />

            <Link to="/logout" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
              <PiSignOut size={18} />
              <span>Logout</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
    {copilotOpen && (
      <div className="fixed inset-0 z-[400]">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/30"
          onClick={() => setCopilotOpen(false)}
          aria-label="Close Inventory Copilot"
        />
        <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
              <h2 className="text-lg font-semibold text-slate-900">Inventory Copilot</h2>
                <p className="text-sm text-slate-500">
                  {copilotData.summary?.total || 0} active insight{copilotData.summary?.total === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setCopilotOpen(false)}
              >
                <PiX />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {copilotLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading insights...</div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => applyCopilotFilter(null)}
                      className={`rounded-lg border p-3 text-left transition ${!copilotFilter ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-700 hover:border-primary/50"}`}
                    >
                      <p className="text-xs">All</p>
                      <p className="text-xl font-semibold">{copilotData.summary?.total || 0}</p>
                    </button>
                    {["high", "medium", "low"].map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => applyCopilotFilter({ kind: "priority", value: key })}
                        className={`rounded-lg border p-3 text-left transition ${copilotFilter?.kind === "priority" && copilotFilter?.value === key ? "ring-2 ring-primary" : ""} ${priorityClass[key]}`}
                      >
                        <p className="text-xs capitalize">{key}</p>
                        <p className="text-xl font-semibold">{copilotData.summary?.[key] || 0}</p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => applyCopilotFilter({ kind: "type", value: key })}
                        className={`rounded-lg border p-3 text-left transition hover:border-primary/50 ${copilotFilter?.kind === "type" && copilotFilter?.value === key ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}
                      >
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="text-lg font-semibold text-slate-900">{copilotData.summary?.[key] || 0}</p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700">
                      Showing: <span className="text-slate-950">{copilotFilterLabel}</span>
                    </p>
                    {copilotFilter && (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => applyCopilotFilter(null)}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {visibleCopilotInsights?.length ? (
                      visibleCopilotInsights.map((insight) => (
                        <div key={insight.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${priorityClass[insight.priority] || priorityClass.low}`}>
                                {insight.priority}
                              </span>
                              <h3 className="mt-2 font-semibold text-slate-900">{insight.title}</h3>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {typeLabels[insight.type] || insight.type}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{insight.message}</p>
                          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">{insight.why}</p>
                          {insight.action_label && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline btn-primary mt-3"
                              onClick={() => handleCopilotAction(insight.action_url)}
                            >
                              {insight.action_label}
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                        No inventory insights need attention right now.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    )}
    </>
  );
}

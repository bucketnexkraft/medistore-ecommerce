import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Pagination from "../../../components/common/Pagination";
import {
  createCompanyFeaturePreference,
  deleteCompanyFeaturePreference,
  getCompany,
  getCompanyFeaturePreferences,
  getCompanyUsers,
  updateCompanyFeaturePreference,
} from "../../../api/backoffice/company";
import { closeModal, showModal } from "../../../hooks/modalConfig";

export default function CompanyDetails() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("company_id");

  const [activeTab, setActiveTab] = useState("users");

  const [company, setCompany] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  const [usersData, setUsersData] = useState({ data: [], meta: {} });
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");

  const [preferencesData, setPreferencesData] = useState({ data: [], meta: {} });
  const [allPreferenceOptions, setAllPreferenceOptions] = useState([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSearch, setPreferencesSearch] = useState("");
  const [preferenceSubmitting, setPreferenceSubmitting] = useState(false);
  const [preferenceForm, setPreferenceForm] = useState({
    id: null,
    code: "",
    is_active: false,
  });

  const formatDateTime = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString();
  };

  const formatDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrencyAmount = (amount, code = "") => {
    const numericAmount = Number(amount || 0);
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) {
      return numericAmount.toFixed(2);
    }

    return `${numericAmount.toFixed(2)} ${normalizedCode}`;
  };

  const getPlanTimeLeftLabel = (planStatus) => {
    if (!planStatus) return "N/A";
    if (planStatus.label === "Commission based") return "Not applicable";
    if (planStatus.is_expired) return "Expired";
    if (planStatus.days_left === null || planStatus.days_left === undefined) {
      return "N/A";
    }

    const daysLeft = Math.max(0, Math.round(Number(planStatus.days_left || 0)));
    const suffix = daysLeft === 1 ? "" : "s";
    return `${daysLeft} day${suffix} left`;
  };

  const getApiError = (error, fallback) => {
    const errors = error?.response?.data?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors[0];
    }
    return error?.response?.data?.message || error.message || fallback;
  };

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setCompanyLoading(true);
    try {
      const result = await getCompany(accessToken, companyId);
      setCompany(result?.data || null);
    } catch (error) {
      toast.error(error.message || "Failed to fetch company details");
    } finally {
      setCompanyLoading(false);
    }
  }, [accessToken, companyId]);

  const loadUsers = useCallback(async () => {
    if (!companyId) return;
    setUsersLoading(true);
    try {
      const result = await getCompanyUsers(accessToken, companyId, {
        perPage: 10,
        page: usersPage,
        search: usersSearch,
        sortField: "created_at",
        sortOrder: "desc",
      });
      setUsersData({
        data: result?.data || [],
        meta: result?.meta || {},
      });
    } catch (error) {
      toast.error(error.message || "Failed to fetch company users");
    } finally {
      setUsersLoading(false);
    }
  }, [accessToken, companyId, usersPage, usersSearch]);

  const loadFeaturePreferences = useCallback(async () => {
    if (!companyId) return;
    setPreferencesLoading(true);
    try {
      const result = await getCompanyFeaturePreferences(accessToken, companyId);

      const allOptions = result?.data || [];
      const assignedPreferences = allOptions.filter((item) => item.is_assigned);
      const filteredPreferences = assignedPreferences.filter((item) => {
        const query = preferencesSearch.trim().toLowerCase();
        if (!query) return true;
        return (
          item.name?.toLowerCase().includes(query) ||
          item.code?.toLowerCase().includes(query)
        );
      });

      setAllPreferenceOptions(allOptions);
      setPreferencesData({
        data: filteredPreferences,
        meta: {
          current_page: 1,
          last_page: 1,
        },
      });
    } catch (error) {
      toast.error(getApiError(error, "Failed to fetch feature preferences"));
    } finally {
      setPreferencesLoading(false);
    }
  }, [accessToken, companyId, preferencesSearch]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    }
    if (activeTab === "feature-preference") {
      loadFeaturePreferences();
    }
  }, [activeTab, loadUsers, loadFeaturePreferences]);

  const openAddPreferenceModal = () => {
    const firstAvailableOption = allPreferenceOptions.find((item) => !item.is_assigned);
    setPreferenceForm({
      id: null,
      code: firstAvailableOption?.code || "",
      is_active: false,
    });
    showModal("company-feature-preference-modal");
  };

  const openEditPreferenceModal = (preference) => {
    setPreferenceForm({
      id: preference.id,
      code: preference.code || "",
      is_active: Boolean(preference.is_active),
    });
    showModal("company-feature-preference-modal");
  };

  const handlePreferenceSubmit = async (e) => {
    e.preventDefault();
    if (!companyId) return;

    setPreferenceSubmitting(true);
    try {
      const payload = {
        code: preferenceForm.code,
        is_active: preferenceForm.is_active,
      };

      if (preferenceForm.id) {
        await updateCompanyFeaturePreference(accessToken, companyId, preferenceForm.id, payload);
        toast.success("Feature preference updated successfully");
      } else {
        await createCompanyFeaturePreference(accessToken, companyId, payload);
        toast.success("Feature preference created successfully");
      }

      closeModal("company-feature-preference-modal");
      loadFeaturePreferences();
    } catch (error) {
      toast.error(getApiError(error, "Failed to save feature preference"));
    } finally {
      setPreferenceSubmitting(false);
    }
  };

  const handleDeletePreference = async (preference) => {
    if (!companyId || !preference?.id) return;

    const result = await Swal.fire({
      title: "Delete feature preference?",
      text: `This will remove "${preference.name}" from the company.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await deleteCompanyFeaturePreference(accessToken, companyId, preference.id);
      toast.success("Feature preference deleted successfully");
      loadFeaturePreferences();
    } catch (error) {
      toast.error(getApiError(error, "Failed to delete feature preference"));
    }
  };

  const summaryCards = useMemo(() => ([
    {
      label: "Total Products",
      value: company?.analysis?.total_products ?? 0,
      subtext: `Active: ${company?.analysis?.active_products ?? 0}`,
    },
    {
      label: "Team Members",
      value: company?.analysis?.total_users ?? 0,
      subtext: `Active: ${company?.analysis?.active_users ?? 0}`,
    },
    {
      label: "Template",
      value: company?.selected_template_name || "Not selected",
      subtext: company?.selected_template_id ? `Template ID: ${company.selected_template_id}` : "No template linked",
    },
    {
      label: "Feature Preferences",
      value: company?.analysis?.active_feature_preferences ?? 0,
      subtext: "Active assigned features",
    },
  ]), [company]);

  const planDetails = useMemo(() => {
    const latestPayment = company?.latest_plan_payment;
    const isCommissionPlan = company?.plan_type === "commission";

    return [
      { label: "Plan", value: company?.plan_name || "No active plan" },
      { label: "Plan Type", value: company?.plan_type_label || "N/A" },
      { label: "Billing", value: company?.plan_billing_label || "N/A" },
      { label: "Subscribed At", value: formatDateTime(company?.plan_subscribed_at) },
      { label: "Expires At", value: isCommissionPlan ? "Not applicable" : formatDateTime(company?.plan_expires_at) },
      { label: "Time Left", value: getPlanTimeLeftLabel(company?.plan_status) },
      { label: "Latest Purchase", value: latestPayment?.paid_at ? formatDateTime(latestPayment.paid_at) : "No approved payment found" },
      { label: "Latest Paid Amount", value: latestPayment ? formatCurrencyAmount(latestPayment.amount, latestPayment.currency_code) : "N/A" },
    ];
  }, [company]);

  if (!companyId) {
    return (
      <div className="p-4">
        <div className="alert alert-warning">
          Company ID is missing in URL. Use `company-details?company_id=...`.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Company Details</h2>
        <Link to="/backoffice/companies" className="btn btn-outline btn-sm">
          Back to Companies
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        {companyLoading ? (
          <div className="animate-pulse h-20 bg-gray-100 rounded" />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 rounded-2xl border border-slate-200 p-5 bg-slate-50/60">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Company Overview</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">{company?.name || "N/A"}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {company?.contact_name || "N/A"} · {company?.email || "N/A"} · {company?.phone_number || "N/A"}
                    </p>
                  </div>
                  <span className={`badge ${company?.status === 1 ? "badge-success" : "badge-error"} badge-lg`}>
                    {company?.status === 1 ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">Company ID</p>
                    <p className="mt-1 break-all font-medium text-slate-900">{company?.company_id || "N/A"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">Store Domain</p>
                    <p className="mt-1 font-medium text-slate-900">{company?.domain || "Not reserved yet"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="mt-1 font-medium text-slate-900">{company?.address || "N/A"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">Joined</p>
                    <p className="mt-1 font-medium text-slate-900">{formatDate(company?.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Company Analysis</p>
                <div className="mt-4 space-y-3">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.subtext}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Plan Analysis</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">Subscription and billing snapshot</h3>
                </div>
                <span className="badge badge-outline">
                  {company?.plan_status?.label || "N/A"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {planDetails.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="mt-1 font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              {company?.plan_type === "commission" ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs text-amber-700">Pending Commission</p>
                    <p className="mt-1 text-lg font-semibold text-amber-900">
                      {formatCurrencyAmount(company?.analysis?.pending_commission_amount || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-700">Paid Commission</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-900">
                      {formatCurrencyAmount(company?.analysis?.paid_commission_amount || 0)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b p-4 flex items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "users" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "feature-preference" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("feature-preference")}
          >
            Feature Preference
          </button>
        </div>

        {activeTab === "users" && (
          <div className="p-4">
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search users..."
                className="input input-bordered w-full max-w-sm"
                value={usersSearch}
                onChange={(e) => {
                  setUsersPage(1);
                  setUsersSearch(e.target.value);
                }}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-6">
                        Loading users...
                      </td>
                    </tr>
                  ) : usersData.data.length > 0 ? (
                    usersData.data.map((user) => (
                      <tr key={user.id}>
                        <td>{`${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A"}</td>
                        <td>{user.email || "N/A"}</td>
                        <td>{user.phone || "N/A"}</td>
                        <td>
                          <span className={`badge ${user.status === 1 ? "badge-success" : "badge-error"}`}>
                            {user.status === 1 ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-6">
                        No users found for this company.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={usersData.meta?.current_page || 1}
              lastPage={usersData.meta?.last_page || 1}
              handlePrevious={() =>
                setUsersPage((prev) => Math.max(1, prev - 1))
              }
              handlePageChange={(page) => setUsersPage(page)}
              handleNextPage={() =>
                setUsersPage((prev) =>
                  Math.min(usersData.meta?.last_page || 1, prev + 1)
                )
              }
            />
          </div>
        )}

        {activeTab === "feature-preference" && (
          <div className="p-4">
            <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <input
                type="text"
                placeholder="Search features..."
                className="input input-bordered w-full max-w-sm"
                value={preferencesSearch}
                onChange={(e) => {
                  setPreferencesSearch(e.target.value);
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openAddPreferenceModal}
                disabled={allPreferenceOptions.every((item) => item.is_assigned)}
              >
                Add Feature Preference
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Active</th>
                    <th>Updated</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preferencesLoading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-6">
                        Loading feature preferences...
                      </td>
                    </tr>
                  ) : preferencesData.data.length > 0 ? (
                    preferencesData.data.map((preference) => (
                      <tr key={preference.code}>
                        <td>{preference.name}</td>
                        <td>
                          <span className={`badge ${preference.is_active ? "badge-success" : "badge-error"}`}>
                            {preference.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          {preference.updated_at
                            ? new Date(preference.updated_at).toLocaleString()
                            : "N/A"}
                        </td>
                        <td className="text-right">
                          {preference.is_core ? (
                            <span className="text-xs font-semibold text-blue-700">Always on</span>
                          ) : (
                            <div className="inline-flex gap-2">
                              <button type="button" className="btn btn-xs btn-outline" onClick={() => openEditPreferenceModal(preference)}>
                                Edit
                              </button>
                              <button type="button" className="btn btn-xs btn-outline btn-error" onClick={() => handleDeletePreference(preference)}>
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-6">
                        No feature preferences found for this company.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>

      <dialog id="company-feature-preference-modal" className="modal">
        <div className="modal-box w-full max-w-lg">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">x</button>
          </form>

          <h3 className="font-bold text-lg mb-4">
            {preferenceForm.id ? "Update Feature Preference" : "Add Feature Preference"}
          </h3>

          <form onSubmit={handlePreferenceSubmit} className="space-y-4">
            <div>
              <label className="label">
                <span className="label-text">Feature</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={preferenceForm.code}
                onChange={(e) =>
                  setPreferenceForm((prev) => ({
                    ...prev,
                    code: e.target.value,
                  }))
                }
                required
              >
                {allPreferenceOptions
                  .filter(
                    (feature) =>
                      !feature.is_assigned || feature.code === preferenceForm.code
                  )
                  .map((feature) => (
                  <option key={feature.code} value={feature.code}>
                    {feature.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={preferenceForm.is_active}
                  onChange={(e) =>
                    setPreferenceForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                <span className="label-text">Active</span>
              </label>
            </div>

            <div className="modal-action">
              <button type="submit" className="btn btn-primary" disabled={preferenceSubmitting}>
                {preferenceSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}

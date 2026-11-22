import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Pagination from "../../components/common/Pagination";
import TableLoading from "../../components/loadings/TableLoading";
import {
  createPlan,
  deletePlan,
  getPlanOptions,
  getPlans,
  updatePlan,
  updatePlanDefault,
  updatePlanStatus,
} from "../../api/saasPlan";
import { getBackofficeFeaturePreferenceOptions } from "../../api/backoffice/company";
import { PiMagnifyingGlass, PiNotePencil, PiSliders, PiTrash, PiX } from "react-icons/pi";
import { FaPlus } from "react-icons/fa";
import { formatFeatureLabel } from "../../config/constants";

const initialForm = {
  name: "",
  description: "",
  is_free: "paid",
  plan_type: "paid",
  included_plan_id: "",
  price: "0",
  discount_amount: "0",
  discount_type: "fixed",
  billing_period: "monthly",
  trial_period: "",
  commission_rate: "0",
  commission_type: "percent",
  commission_base: "total_amount",
  inventory_item_limit: "0",
  monthly_pos_transaction_limit: "0",
  warehouse_limit: "1",
  user_limit: "1",
  allow_inventory: true,
  allow_pos: true,
  is_default: false,
  status: true,
  features: [],
  default_features: [],
};

export default function SaasPlans() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filterRef = useRef(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formStep, setFormStep] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const [featureOptions, setFeatureOptions] = useState([]);
  const [featureOptionsLoading, setFeatureOptionsLoading] = useState(false);
  const [featureSearch, setFeatureSearch] = useState("");
  const [planOptions, setPlanOptions] = useState([]);
  const isFreePlan = form.plan_type === "free";
  const isCommissionPlan = form.plan_type === "commission";
  const getFeatureLabel = useCallback(
    (code) => featureOptions.find((feature) => feature.code === code)?.name || formatFeatureLabel(code),
    [featureOptions]
  );
  const defaultFeatureCodes = useMemo(
    () => featureOptions.filter((feature) => feature.default_active).map((feature) => feature.code).filter(Boolean),
    [featureOptions]
  );
  const coreFeatureCodes = useMemo(
    () => featureOptions.filter((feature) => feature.is_core).map((feature) => feature.code).filter(Boolean),
    [featureOptions]
  );

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPlans(accessToken, {
        page,
        perPage: 20,
        search,
        status,
      });
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load plans");
      }
      setPlans(result?.data || []);
      setPagination(
        result?.pagination || {
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: 0,
        }
      );
    } catch (error) {
      toast.error(error?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, status]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    const loadFeatureOptions = async () => {
      setFeatureOptionsLoading(true);
      try {
        const result = await getBackofficeFeaturePreferenceOptions(accessToken);
        setFeatureOptions(result?.data || []);
      } catch (error) {
        toast.error(error?.message || "Failed to load feature options");
      } finally {
        setFeatureOptionsLoading(false);
      }
    };

    loadFeatureOptions();
  }, [accessToken]);

  useEffect(() => {
    if (!isModalOpen || editingPlan || defaultFeatureCodes.length === 0) return;

    setForm((prev) => {
      if (
        (Array.isArray(prev.features) && prev.features.length > 0)
        || (Array.isArray(prev.default_features) && prev.default_features.length > 0)
      ) return prev;
      return { ...prev, features: defaultFeatureCodes, default_features: defaultFeatureCodes };
    });
  }, [defaultFeatureCodes, editingPlan, isModalOpen]);

  useEffect(() => {
    getPlanOptions(accessToken).then((result) => {
      setPlanOptions(
        Array.isArray(result?.data?.plans)
          ? result.data.plans.map((item) => ({
              value: item.id,
              label: item.name,
              plan_type: item.plan_type,
              effective_features: Array.isArray(item.effective_features) ? item.effective_features : [],
              effective_default_features: Array.isArray(item.effective_default_features) ? item.effective_default_features : [],
            }))
          : []
      );
    }).catch(() => null);
  }, [accessToken]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = () => {
    setPage(1);
    setIsAdvancedOpen(false);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPage(1);
    setIsAdvancedOpen(false);
  };

  const blockNegativeNumberInput = (e) => {
    if (["-", "+", "e", "E"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...initialForm, features: defaultFeatureCodes, default_features: defaultFeatureCodes });
    setFormStep(1);
    setFormErrors({});
    setFeatureSearch("");
    setIsModalOpen(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setFormStep(1);
    setFormErrors({});
    setForm({
      name: plan.name || "",
      description: plan.description || "",
      is_free: plan.is_free || "paid",
      plan_type: plan.plan_type || (plan.is_free === "free" ? "free" : "paid"),
      included_plan_id: plan.included_plan_id ? String(plan.included_plan_id) : "",
      price: String(plan.price ?? 0),
      discount_amount: String(plan.discount_amount ?? 0),
      discount_type: plan.discount_type || "fixed",
      billing_period: plan.billing_period || "monthly",
      trial_period: plan.trial_period == null ? "" : String(plan.trial_period),
      commission_rate: String(plan.commission_rate ?? 0),
      commission_type: plan.commission_type || "percent",
      commission_base: plan.commission_base || "total_amount",
      inventory_item_limit: String(plan.inventory_item_limit ?? 0),
      monthly_pos_transaction_limit: String(plan.monthly_pos_transaction_limit ?? 0),
      warehouse_limit: String(plan.warehouse_limit ?? 1),
      user_limit: String(plan.user_limit ?? 1),
      allow_inventory: Boolean(plan.allow_inventory),
      allow_pos: Boolean(plan.allow_pos),
      is_default: Boolean(plan.is_default),
      status: Boolean(plan.status),
      features: Array.from(new Set([
        ...(Array.isArray(plan.features) ? plan.features : []),
        ...coreFeatureCodes,
      ])),
      default_features: Array.from(new Set([
        ...coreFeatureCodes,
        ...(Array.isArray(plan.default_features) ? plan.default_features : []),
        ...(Array.isArray(plan.effective_default_features) ? plan.effective_default_features : []),
        ...(Array.isArray(plan.features) && !Array.isArray(plan.default_features) ? plan.features : []),
      ])),
    });
    setFeatureSearch("");
    setIsModalOpen(true);
  };

  const formPayload = useMemo(() => {
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_free: form.plan_type === "free" ? "free" : "paid",
      plan_type: form.plan_type,
      included_plan_id: form.included_plan_id ? Number(form.included_plan_id) : null,
      price: isFreePlan || isCommissionPlan ? 0 : Number(form.price || 0),
      discount_amount: isFreePlan || isCommissionPlan ? 0 : Number(form.discount_amount || 0),
      discount_type: isFreePlan || isCommissionPlan ? "fixed" : form.discount_type,
      billing_period: isFreePlan || isCommissionPlan ? "monthly" : form.billing_period,
      trial_period: isFreePlan
        ? (form.trial_period === "" ? null : Number(form.trial_period))
        : null,
      commission_rate: isCommissionPlan ? Number(form.commission_rate || 0) : 0,
      commission_type: form.commission_type,
      commission_base: form.commission_base,
      inventory_item_limit: Number(form.inventory_item_limit || 0),
      monthly_pos_transaction_limit: Number(form.monthly_pos_transaction_limit || 0),
      warehouse_limit: Number(form.warehouse_limit || 1),
      user_limit: Number(form.user_limit || 1),
      allow_inventory: Boolean(form.allow_inventory),
      allow_pos: Boolean(form.allow_pos),
      is_default: Boolean(form.is_default),
      status: Boolean(form.status),
      features: Array.from(new Set([
        ...coreFeatureCodes,
        ...(Array.isArray(form.features) ? form.features.map((item) => item.trim()).filter(Boolean) : []),
      ])),
      default_features: Array.from(new Set([
        ...coreFeatureCodes,
        ...(Array.isArray(form.default_features)
          ? form.default_features.map((item) => item.trim()).filter(Boolean)
          : []),
      ])),
    };
  }, [form, isFreePlan, isCommissionPlan, coreFeatureCodes]);

  const toggleFeature = (code) => {
    if (coreFeatureCodes.includes(String(code))) return;
    const nextCode = String(code || "").trim();
    if (!nextCode) return;

    setForm((prev) => {
      const current = Array.isArray(prev.features) ? prev.features : [];
      const hasFeature = current.includes(nextCode);

      return {
        ...prev,
        features: hasFeature
          ? current.filter((item) => item !== nextCode)
          : [...current, nextCode],
        default_features: hasFeature
          ? (Array.isArray(prev.default_features) ? prev.default_features.filter((item) => item !== nextCode) : [])
          : (Array.isArray(prev.default_features) ? prev.default_features : []),
      };
    });
  };

  const toggleDefaultFeature = (code) => {
    if (coreFeatureCodes.includes(String(code))) return;
    const nextCode = String(code || "").trim();
    if (!nextCode) return;

    setForm((prev) => {
      const selectedFeatures = new Set([
        ...(Array.isArray(prev.features) ? prev.features : []),
        ...inheritedFeatureCodes,
      ]);
      if (!selectedFeatures.has(nextCode)) return prev;

      const current = Array.isArray(prev.default_features) ? prev.default_features : [];
      return {
        ...prev,
        default_features: current.includes(nextCode)
          ? current.filter((item) => item !== nextCode)
          : [...current, nextCode],
      };
    });
  };

  const filteredFeatureOptions = useMemo(() => {
    const keyword = featureSearch.trim().toLowerCase();
    if (!keyword) return featureOptions;

    return featureOptions.filter((item) => {
      const haystack = `${item?.name || ""} ${item?.code || ""} ${item?.description || ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [featureOptions, featureSearch]);

  const selectedFeatureCount = Array.isArray(form.features)
    ? form.features.filter((code) => !coreFeatureCodes.includes(code)).length
    : 0;
  const includedPlan = planOptions.find((item) => String(item.value) === String(form.included_plan_id));
  const inheritedFeatureCodes = Array.isArray(includedPlan?.effective_features)
    ? includedPlan.effective_features
    : [];
  const inheritedDefaultFeatureCodes = Array.isArray(includedPlan?.effective_default_features)
    ? includedPlan.effective_default_features
    : [];
  const effectiveFeatureCount = new Set([
    ...coreFeatureCodes,
    ...inheritedFeatureCodes,
    ...(Array.isArray(form.features) ? form.features : []),
  ]).size;
  const selectablePlanOptions = planOptions.filter(
    (item) => !editingPlan || String(item.value) !== String(editingPlan.id)
  );
  const allFeatureCodes = useMemo(
    () => featureOptions.map((item) => item?.code).filter(Boolean),
    [featureOptions]
  );
  const allFeaturesSelected =
    allFeatureCodes.length > 0 && new Set([
      ...coreFeatureCodes,
      ...(Array.isArray(form.features) ? form.features : []),
    ]).size === allFeatureCodes.length;
  const selectedFeatureCodes = new Set([
    ...coreFeatureCodes,
    ...inheritedFeatureCodes,
    ...(Array.isArray(form.features) ? form.features : []),
  ]);
  const defaultFeatureOptions = featureOptions.filter((feature) => selectedFeatureCodes.has(feature.code));
  const defaultFeatureCount = new Set([
    ...coreFeatureCodes,
    ...inheritedDefaultFeatureCodes,
    ...(Array.isArray(form.default_features) ? form.default_features : []),
  ]).size;

  const selectAllDefaultFeatures = () => {
    setForm((prev) => ({
      ...prev,
      default_features: defaultFeatureOptions.map((feature) => feature.code).filter(Boolean),
    }));
  };

  const deselectAllDefaultFeatures = () => {
    setForm((prev) => ({ ...prev, default_features: coreFeatureCodes }));
  };

  const toggleAllFeatures = () => {
    setForm((prev) => ({
      ...prev,
      features: allFeaturesSelected ? coreFeatureCodes : allFeatureCodes,
      default_features: allFeaturesSelected
        ? (Array.isArray(prev.default_features)
          ? prev.default_features.filter((code) => coreFeatureCodes.includes(code))
          : coreFeatureCodes)
        : prev.default_features,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormStep(1);
      setFormErrors({ name: "Plan name is required" });
      return;
    }

    setFormErrors({});

    setIsSaving(true);
    try {
      const result = editingPlan
        ? await updatePlan(accessToken, editingPlan.id, formPayload)
        : await createPlan(accessToken, formPayload);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to save plan");
      }

      toast.success(editingPlan ? "Plan updated successfully" : "Plan created successfully");
      setIsModalOpen(false);
      loadPlans();
    } catch (error) {
      const serverErrors = error?.response?.data?.errors;
      if (serverErrors && !Array.isArray(serverErrors) && typeof serverErrors === "object") {
        const normalizedErrors = Object.fromEntries(
          Object.entries(serverErrors).map(([field, messages]) => [
            field,
            Array.isArray(messages) ? messages[0] : String(messages),
          ])
        );
        setFormErrors(normalizedErrors);
        if (normalizedErrors.name) setFormStep(1);
      } else if (Array.isArray(serverErrors) && serverErrors.length > 0) {
        setFormErrors({ general: serverErrors[0] });
      } else {
        setFormErrors({
          general: error?.response?.data?.message || error?.message || "Failed to save plan",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (plan) => {
    const result = await Swal.fire({
      title: "Delete plan?",
      text: `Plan "${plan.name}" will be deleted permanently.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d33",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deletePlan(accessToken, plan.id);
      if (!response?.status) {
        throw new Error(response?.message || "Failed to delete plan");
      }
      toast.success("Plan deleted successfully");
      loadPlans();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete plan");
    }
  };

  const handleStatus = async (plan, newStatus) => {
    try {
      const response = await updatePlanStatus(accessToken, plan.id, newStatus);
      if (!response?.status) {
        throw new Error(response?.message || "Failed to update status");
      }
      setPlans((prev) =>
        prev.map((item) => (item.id === plan.id ? { ...item, status: newStatus } : item))
      );
      toast.success("Plan status updated");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to update status");
    }
  };

  const formSteps = [
    { number: 1, label: "Basics" },
    { number: 2, label: "Pricing" },
    { number: 3, label: "Limits & access" },
    { number: 4, label: "Features" },
    { number: 5, label: "Default active" },
  ];

  const handleNextStep = () => {
    if (formStep === 1 && !form.name.trim()) {
      setFormErrors({ name: "Plan name is required" });
      return;
    }

    setFormErrors({});
    setFormStep((current) => Math.min(current + 1, formSteps.length));
  };

  const handleDefault = async (plan) => {
    if (plan.is_default) {
      return;
    }

    try {
      const response = await updatePlanDefault(accessToken, plan.id);
      if (!response?.status) {
        throw new Error(response?.message || "Failed to update default plan");
      }
      setPlans((prev) =>
        prev.map((item) => ({ ...item, is_default: item.id === plan.id }))
      );
      toast.success("Default plan updated");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to update default plan");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold">SaaS Plan Setup</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage pricing plans for Inventory and POS companies.
        </p>

        <div className="w-full max-w-4xl mt-4 relative" ref={filterRef}>
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search plans..."
                className="input w-full h-14 min-h-14 pr-20 border-none rounded-xl focus:outline-none focus:border-none"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />

              <div className="absolute right-3 flex items-center gap-1">
                <button
                  onClick={handleSearch}
                  className="text-gray-500 hover:text-primary p-2"
                  title="Search"
                >
                  <PiMagnifyingGlass className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsAdvancedOpen((prev) => !prev)}
                  className="text-gray-500 hover:text-primary p-2"
                  title="Filter"
                >
                  <PiSliders className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
              <div className="w-full">
                <label className="label py-1">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 w-full"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="btn btn-ghost h-10 min-h-10" onClick={resetFilters}>
                  Reset
                </button>
                <button className="btn btn-primary h-10 min-h-10" onClick={handleSearch}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div>
            <h5 className="font-semibold text-custom-gray-400">Plans List</h5>
            <p className="text-xs text-gray-500 mt-1">Select one plan as the default using the Default column.</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <FaPlus className="mr-1" /> Add Plan
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Name</th>
                  <th>Billing</th>
                  <th>Price</th>
                  <th>Features</th>
                  <th>Inventory</th>
                  <th>POS</th>
                  <th>Default</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8">
                      No plans found.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{plan.name}</div>
                          {Boolean(plan.is_default) && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {plan.plan_type === "commission"
                            ? "Commission Plan"
                            : plan.is_free === "free"
                              ? "Free Plan"
                              : "Paid Plan"}
                        </div>
                      </td>
                      <td>
                        {plan.plan_type === "commission"
                          ? `On ${String(plan.commission_base || "total_amount").replace(/_/g, " ")}`
                          : plan.is_free === "free"
                          ? `Trial: ${Number(plan.trial_period || 0)} day${Number(plan.trial_period || 0) === 1 ? "" : "s"}`
                          : <span className="capitalize">{plan.billing_period}</span>}
                      </td>
                      <td>
                        {plan.plan_type === "commission"
                          ? `${Number(plan.commission_rate || 0).toFixed(2)}${plan.commission_type === "fixed" ? "" : "%"}`
                          : plan.is_free === "free"
                            ? "-"
                            : Number(plan.price).toFixed(2)}
                        {plan.plan_type !== "commission" && plan.is_free !== "free" && Number(plan.discount_amount) > 0 ? (
                          <div className="text-xs text-gray-500">
                            Discount: {Number(plan.discount_amount).toFixed(2)}{plan.discount_type === "percent" ? "%" : ""}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {Array.isArray(plan.features) && plan.features.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {plan.features.slice(0, 4).map((feature) => (
                              <span
                                key={feature}
                                title={feature}
                                className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                              >
                                {getFeatureLabel(feature)}
                              </span>
                            ))}
                            {plan.features.length > 4 && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                +{plan.features.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No features</span>
                        )}
                      </td>
                      <td>
                        <div>{plan.allow_inventory ? "Enabled" : "Disabled"}</div>
                        <div className="text-xs text-gray-500">
                          Limit: {plan.inventory_item_limit}
                        </div>
                      </td>
                      <td>
                        <div>{plan.allow_pos ? "Enabled" : "Disabled"}</div>
                        <div className="text-xs text-gray-500">
                          Monthly Txn: {plan.monthly_pos_transaction_limit}
                        </div>
                      </td>
                      <td>
                        <label className="inline-flex cursor-pointer items-center justify-center">
                          <input
                            type="radio"
                            name="default-plan"
                            className="radio radio-primary radio-sm"
                            checked={Boolean(plan.is_default)}
                            onChange={() => handleDefault(plan)}
                            title="Set as default plan"
                          />
                        </label>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="toggle toggle-sm toggle-primary"
                          checked={Boolean(plan.status)}
                          onChange={(e) => handleStatus(plan, e.target.checked)}
                        />
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={() => openEdit(plan)}
                            title="Edit Plan"
                          >
                            <PiNotePencil size={16} />
                          </button>
                          <button
                            className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                            onClick={() => handleDelete(plan)}
                            title="Delete Plan"
                          >
                            <PiTrash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={pagination.current_page || 1}
          lastPage={pagination.last_page || 1}
          handlePrevious={() => setPage((prev) => Math.max(prev - 1, 1))}
          handlePageChange={(nextPage) => setPage(nextPage)}
          handleNextPage={() =>
            setPage((prev) => Math.min(prev + 1, pagination.last_page || 1))
          }
          showPrevious={(pagination.current_page || 1) > 1}
          showNext={(pagination.current_page || 1) < (pagination.last_page || 1)}
        />
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setIsModalOpen(false)}
            aria-label="Close plan editor backdrop"
          />
          <div
            className="absolute inset-y-0 right-0 z-10 flex w-full max-w-4xl flex-col bg-slate-50 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {editingPlan ? "Update SaaS Plan" : "Create SaaS Plan"}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {editingPlan ? "Edit mode" : "New plan"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Set plan details, pricing, limits and access permissions.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close plan editor"
              >
                <PiX size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-7">
              <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-4 gap-2">
                  {formSteps.map((step) => (
                    <button
                      key={step.number}
                      type="button"
                      onClick={() => step.number < formStep && setFormStep(step.number)}
                      className={`border-b-2 px-1 pb-2 text-left text-xs font-semibold transition-colors sm:text-sm ${
                        step.number === formStep
                          ? "border-primary text-primary"
                          : step.number < formStep
                            ? "border-emerald-500 text-emerald-600"
                            : "border-slate-200 text-slate-400"
                      }`}
                    >
                      <span className="mr-1">{step.number}.</span>{step.label}
                    </button>
                  ))}
                </div>
              </div>

              {formErrors.general && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formErrors.general}
                </div>
              )}

              <div className="space-y-4">
              {formStep === 1 && (
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h4 className="font-semibold text-slate-900">Plan basics</h4>
                  <p className="mt-1 text-xs text-slate-500">Name the plan and choose how it will be billed.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&_.label-text]:inline-block [&_.label-text]:pb-2 [&_.label-text]:font-medium [&_.label-text]:text-slate-700">
                  <label className="form-control md:col-span-2">
                    <span className="label-text">Plan Name</span>
                    <input
                      className={`input input-bordered rounded-xl ${formErrors.name ? "border-red-500 focus:border-red-500" : ""}`}
                      value={form.name}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, name: e.target.value }));
                        if (formErrors.name) {
                          setFormErrors((prev) => ({ ...prev, name: "" }));
                        }
                      }}
                    />
                    {formErrors.name && (
                      <span className="mt-1 text-xs font-medium text-red-600">{formErrors.name}</span>
                    )}
                  </label>

                  <label className="form-control md:col-span-2">
                    <span className="label-text">Description</span>
                    <textarea
                      className="textarea textarea-bordered rounded-xl"
                      rows={2}
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text">Plan Type</span>
                    <select
                      className="select select-bordered rounded-xl"
                      value={form.plan_type}
                      onChange={(e) => setForm((prev) => ({ ...prev, plan_type: e.target.value }))}
                    >
                      <option value="paid">Paid</option>
                      <option value="free">Free</option>
                      <option value="commission">Commission Based</option>
                    </select>
                  </label>

                  <label className="form-control">
                    <span className="label-text">
                      {isFreePlan ? "Trial Period (days)" : isCommissionPlan ? "Commission Base" : "Billing Period"}
                    </span>
                    {isFreePlan ? (
                      <input
                        type="number"
                        min={0}
                        className="input input-bordered rounded-xl"
                        value={form.trial_period}
                        onKeyDown={blockNegativeNumberInput}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, trial_period: e.target.value }))
                        }
                      />
                    ) : isCommissionPlan ? (
                      <select
                        className="select select-bordered rounded-xl"
                        value={form.commission_base}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, commission_base: e.target.value }))
                        }
                      >
                        <option value="total_amount">Total Amount</option>
                        <option value="subtotal">Subtotal</option>
                        <option value="payable_amount">Payable Amount</option>
                      </select>
                    ) : (
                      <select
                        className="select select-bordered rounded-xl"
                        value={form.billing_period}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, billing_period: e.target.value }))
                        }
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    )}
                  </label>
                </div>
              </div>
              )}

              {formStep === 2 && (
              <>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h4 className="font-semibold text-slate-800">Template access</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Templates are independent. Customers receive all free templates and add premium templates during checkout.
                </p>
              </div>

              {!isFreePlan && !isCommissionPlan && (
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="mb-4 border-b border-slate-100 pb-3">
                    <h4 className="font-semibold text-slate-900">Pricing</h4>
                    <p className="mt-1 text-xs text-slate-500">Define the base price and optional customer discount.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&_.label-text]:inline-block [&_.label-text]:pb-2 [&_.label-text]:font-medium [&_.label-text]:text-slate-700">
                    <label className="form-control">
                      <span className="label-text">Price</span>
                      <input
                        type="number"
                        min={0}
                        className="input input-bordered rounded-xl"
                        value={form.price}
                        onKeyDown={blockNegativeNumberInput}
                        onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                      />
                    </label>

                    <label className="form-control">
                      <span className="label-text">Discount</span>
                      <input
                        type="number"
                        min={0}
                        max={form.discount_type === "percent" ? 100 : undefined}
                        className="input input-bordered rounded-xl"
                        value={form.discount_amount}
                        onKeyDown={blockNegativeNumberInput}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, discount_amount: e.target.value }))
                        }
                      />
                    </label>

                    <label className="form-control">
                      <span className="label-text">Discount Type</span>
                      <select
                        className="select select-bordered rounded-xl"
                        value={form.discount_type}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, discount_type: e.target.value }))
                        }
                      >
                        <option value="fixed">Fixed Amount</option>
                        <option value="percent">Percentage</option>
                      </select>
                    </label>

                  </div>
                </div>
              )}

              {isCommissionPlan && (
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="mb-4 border-b border-slate-100 pb-3">
                    <h4 className="font-semibold text-slate-900">Commission setup</h4>
                    <p className="mt-1 text-xs text-slate-500">Configure how commission is applied to orders.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&_.label-text]:inline-block [&_.label-text]:pb-2 [&_.label-text]:font-medium [&_.label-text]:text-slate-700">
                    <label className="form-control">
                      <span className="label-text">Commission Rate</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input input-bordered rounded-xl"
                        value={form.commission_rate}
                        onKeyDown={blockNegativeNumberInput}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, commission_rate: e.target.value }))
                        }
                      />
                    </label>

                    <label className="form-control">
                      <span className="label-text">Commission Type</span>
                      <select
                        className="select select-bordered rounded-xl"
                        value={form.commission_type}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, commission_type: e.target.value }))
                        }
                      >
                        <option value="percent">Percent</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
              </>
              )}

              {formStep === 3 && (
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <h4 className="font-semibold text-slate-900">Limits & access</h4>
                  <p className="mt-1 text-xs text-slate-500">Control usage limits and enabled product modules.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&_.label-text]:inline-block [&_.label-text]:pb-2 [&_.label-text]:font-medium [&_.label-text]:text-slate-700">
                  <label className="form-control">
                    <span className="label-text">Warehouse Limit</span>
                    <input
                      type="number"
                      min={1}
                      className="input input-bordered rounded-xl"
                      value={form.warehouse_limit}
                      onKeyDown={blockNegativeNumberInput}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, warehouse_limit: e.target.value }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text">Inventory Item Limit</span>
                    <input
                      type="number"
                      min={0}
                      className="input input-bordered rounded-xl"
                      value={form.inventory_item_limit}
                      onKeyDown={blockNegativeNumberInput}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, inventory_item_limit: e.target.value }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text">Monthly POS Transaction Limit</span>
                    <input
                      type="number"
                      min={0}
                      className="input input-bordered rounded-xl"
                      value={form.monthly_pos_transaction_limit}
                      onKeyDown={blockNegativeNumberInput}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          monthly_pos_transaction_limit: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text">User Limit</span>
                    <input
                      type="number"
                      min={1}
                      className="input input-bordered rounded-xl"
                      value={form.user_limit}
                      onKeyDown={blockNegativeNumberInput}
                      onChange={(e) => setForm((prev) => ({ ...prev, user_limit: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={form.allow_inventory}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, allow_inventory: e.target.checked }))
                      }
                    />
                    <span className="text-sm font-medium text-slate-700">Allow Inventory</span>
                  </label>

                  <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={form.allow_pos}
                      onChange={(e) => setForm((prev) => ({ ...prev, allow_pos: e.target.checked }))}
                    />
                    <span className="text-sm font-medium text-slate-700">Allow POS</span>
                  </label>

                  <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.checked }))}
                    />
                    <span className="text-sm font-medium text-slate-700">Active Plan</span>
                  </label>

                  <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={form.is_default}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                    />
                    <span className="text-sm font-medium text-slate-700">Default Plan</span>
                  </label>
                </div>
              </div>
              )}

              {formStep === 4 && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-5">
                  <label className="form-control">
                    <span className="label-text font-semibold text-slate-800">Include features from</span>
                    <select
                      className="select select-bordered mt-2 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={form.included_plan_id}
                      onChange={(e) => {
                        const includedPlanId = e.target.value;
                        const selectedParent = planOptions.find(
                          (item) => String(item.value) === String(includedPlanId)
                        );
                        const parentDefaults = Array.isArray(selectedParent?.effective_default_features)
                          ? selectedParent.effective_default_features
                          : [];

                        setForm((prev) => ({
                          ...prev,
                          included_plan_id: includedPlanId,
                          default_features: Array.from(new Set([
                            ...(Array.isArray(prev.default_features) ? prev.default_features : []),
                            ...parentDefaults,
                          ])),
                        }));
                      }}
                    >
                      <option value="">No parent plan</option>
                      {selectablePlanOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                    <span className="mt-2 text-xs leading-5 text-slate-500">
                      Features from the selected parent plan are included automatically. Select only the additional features for this plan below.
                    </span>
                  </label>
                </div>
                <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">Plan features</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {effectiveFeatureCount} selected
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Choose optional modules for this plan. Core features stay included and active for every plan.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost border border-slate-200"
                    onClick={toggleAllFeatures}
                    disabled={featureOptionsLoading || allFeatureCodes.length === 0}
                  >
                    {allFeaturesSelected ? "Clear All" : "Select All"}
                  </button>
                </div>

                <div className="px-5 pt-4">
                  <input
                    className="input input-bordered w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Search features..."
                    value={featureSearch}
                    onChange={(e) => setFeatureSearch(e.target.value)}
                  />
                </div>

                {featureOptionsLoading ? (
                  <div className="py-6 text-sm text-slate-500">Loading feature list...</div>
                ) : filteredFeatureOptions.length > 0 ? (
                  <div className="mt-4 grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto bg-slate-50/60 p-4 md:grid-cols-2">
                    {filteredFeatureOptions.map((feature) => (
                      <label
                        key={feature.code}
                        className={`cursor-pointer rounded-lg border px-3 py-3 transition-colors ${
                          inheritedFeatureCodes.includes(feature.code)
                            ? "border-blue-200 bg-blue-50/60"
                            : form.features.includes(feature.code)
                              ? "border-primary/40 bg-primary/5"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary mt-1"
                            checked={
                              feature.is_core ||
                              (Array.isArray(form.features) && form.features.includes(feature.code)) ||
                              inheritedFeatureCodes.includes(feature.code)
                            }
                            disabled={feature.is_core || inheritedFeatureCodes.includes(feature.code)}
                            onChange={() => toggleFeature(feature.code)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-slate-800">{feature.name}</div>
                              {feature.is_core && (
                                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Always on</span>
                              )}
                              {inheritedFeatureCodes.includes(feature.code) ? (
                                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  Included
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{feature.description}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mx-5 mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-slate-600">No matching features found</p>
                    <p className="mt-1 text-xs text-slate-500">Try a different search term.</p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-3 text-primary"
                      onClick={() => setFeatureSearch("")}
                    >
                      Clear search
                    </button>
                  </div>
                )}

                {selectedFeatureCount > 0 && (
                  <div className="mx-5 mb-5 mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Additional features ({selectedFeatureCount})
                    </div>
                    <div className="flex flex-wrap gap-2">
                    {form.features.filter((feature) => !coreFeatureCodes.includes(feature)).map((feature) => (
                      <span
                        key={feature}
                        title={feature}
                        className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
                      >
                        {getFeatureLabel(feature)}
                        <button
                          type="button"
                          className="text-primary/80 hover:text-primary"
                          onClick={() => toggleFeature(feature)}
                          aria-label={`Remove ${feature}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    </div>
                  </div>
                )}
              </div>
              )}

              {formStep === 5 && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">Default active features</h4>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {defaultFeatureCount} selected
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost border border-slate-200"
                        onClick={selectAllDefaultFeatures}
                        disabled={featureOptionsLoading || defaultFeatureOptions.length === 0}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost border border-slate-200"
                        onClick={deselectAllDefaultFeatures}
                        disabled={featureOptionsLoading || defaultFeatureOptions.length === 0}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Choose which optional features start active. Core features are always active and cannot be deselected.
                  </p>
                </div>

                {featureOptionsLoading ? (
                  <div className="p-6 text-sm text-slate-500">Loading feature list...</div>
                ) : defaultFeatureOptions.length > 0 ? (
                  <div className="grid max-h-[460px] grid-cols-1 gap-2 overflow-y-auto bg-slate-50/60 p-4 md:grid-cols-2">
                    {defaultFeatureOptions.map((feature) => {
                      const isDefaultSelected = feature.is_core || form.default_features.includes(feature.code);

                      return (
                        <label
                          key={feature.code}
                          className={`cursor-pointer rounded-lg border px-3 py-3 transition-colors ${
                            isDefaultSelected
                              ? "border-emerald-300 bg-emerald-50/70"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-success mt-1"
                              checked={isDefaultSelected}
                              disabled={feature.is_core}
                              onChange={() => toggleDefaultFeature(feature.code)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-medium text-slate-800">{feature.name}</div>
                                {feature.is_core && (
                                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Always on</span>
                                )}
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{feature.description}</div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="m-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-600">No features selected in Step 4</p>
                    <p className="mt-1 text-xs text-slate-500">Go back and select at least one feature before choosing defaults.</p>
                  </div>
                )}
              </div>
              )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div className="mr-auto text-xs text-slate-500">
                Step {formStep} of {formSteps.length}
              </div>
              {formStep > 1 && (
                <button className="btn btn-ghost" onClick={() => setFormStep((current) => current - 1)}>
                  Back
                </button>
              )}
              {formStep < formSteps.length ? (
                <button className="btn btn-primary min-w-[120px]" onClick={handleNextStep}>
                  Continue
                </button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary min-w-[140px]" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

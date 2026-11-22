import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { createCompany, updateCompany } from "../../../../api/backoffice/company";
import { getPlanOptions } from "../../../../api/saasPlan";
import { getETemplates } from "../../../../api/backoffice/ecommerceTemplates";
import { closeModal } from "../../../../hooks/modalConfig";

const BUSINESS_MODE_OPTIONS = [
  { value: "online", label: "Online", description: "Online store with ecommerce setup" },
  { value: "pos", label: "POS", description: "Point of sale operations only" },
  { value: "both", label: "Both", description: "Online store and POS operations" },
];

export default function CompanyAddUpdateModal({ company, setLoadData }) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact_name: "",
    phone_number: "",
    role_name: "",
    password: "",
    status: "1",
    business_mode: "pos",
    saas_plan_id: "",
    selected_e_template_id: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadStoreOptions = async () => {
      if (!accessToken) return;

      setOptionsLoading(true);
      try {
        const [planResult, templateResult] = await Promise.all([
          getPlanOptions(accessToken),
          getETemplates(accessToken, { perPage: 200 }),
        ]);

        if (!active) return;

        setPlans(Array.isArray(planResult?.data?.plans)
          ? planResult.data.plans.filter((plan) => plan.status !== false && plan.status !== 0)
          : []);
        setTemplates(Array.isArray(templateResult?.data) ? templateResult.data : []);
      } catch {
        if (active) {
          setPlans([]);
          setTemplates([]);
        }
      } finally {
        if (active) setOptionsLoading(false);
      }
    };

    void loadStoreOptions();

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (company) {
      // Edit mode - populate form with existing data
      setFormData({
        name: company.name || "",
        email: company.email || "",
        contact_name: company.contact_name || "",
        phone_number: company.phone_number || "",
        role_name: company.role_name || "",
        password: "",
        status: company.status?.toString() || "1",
        business_mode: ["online", "both"].includes(company.business_mode)
          ? company.business_mode
          : (company.saas_plan_id || company.selected_e_template_id ? "online" : "pos"),
        saas_plan_id: company.saas_plan_id?.toString() || "",
        selected_e_template_id: (company.selected_e_template_id || company.selected_template_id)?.toString() || "",
      });
    } else {
      // Add mode - reset form to defaults
      setFormData({
        name: "",
        email: "",
        contact_name: "",
        phone_number: "",
        role_name: "",
        password: "",
        status: "1",
        business_mode: "pos",
        saas_plan_id: "",
        selected_e_template_id: "",
      });
    }
    setErrors({});
  }, [company]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? (checked ? "1" : "0") : value;

    setFormData(prev => ({
      ...prev,
      [name]: nextValue,
      ...(name === "business_mode" && nextValue === "pos"
        ? { saas_plan_id: "", selected_e_template_id: "" }
        : {}),
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Company name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    
    if (!formData.contact_name.trim()) {
      newErrors.contact_name = "Contact name is required";
    }
    
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = "Phone number is required";
    }

    if (!formData.role_name.trim()) {
      newErrors.role_name = "Role is required";
    }

    if (!company && !formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    const hasOnlineStore = ["online", "both"].includes(formData.business_mode);
    if (hasOnlineStore && !formData.saas_plan_id) {
      newErrors.saas_plan_id = "Please select a plan";
    }

    if (hasOnlineStore && !formData.selected_e_template_id) {
      newErrors.selected_e_template_id = "Please select a template";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      let response;
      const hasOnlineStore = ["online", "both"].includes(formData.business_mode);
      const payload = {
        ...formData,
        saas_plan_id: hasOnlineStore ? formData.saas_plan_id : "",
        selected_e_template_id: hasOnlineStore ? formData.selected_e_template_id : "",
      };
      
      if (company) {
        // Update existing company (backend will handle user update)
        response = await updateCompany(accessToken, company.company_id, payload);
        toast.success("Company updated successfully", {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        });
      } else {
        // Create new company (backend will handle user creation)
        response = await createCompany(accessToken, payload);
        toast.success("Company created successfully", {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        });
      }
      
      if (response.status) {
        // Close modal and refresh data
        closeModal(company ? "edit_company_modal" : "add_company_modal");
        setLoadData(true);
      } else {
        // Even if response.status is false, if we got a response, close modal
        closeModal(company ? "edit_company_modal" : "add_company_modal");
        setLoadData(true);
      }
    } catch (error) {
      console.error("Save company error:", error);
      console.error("Error response:", error.response);
      
      // Show detailed error message
      const errorMessage = error.response?.data?.msg ||
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Failed to save company";
      
      toast.error(errorMessage, {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
      
    } finally {
      setLoading(false);
    }
  };

  const modalId = company ? "edit_company_modal" : "add_company_modal";
  const title = company ? "Edit Company" : "Add New Company";
  const submitText = loading ? (company ? "Updating..." : "Creating...") : (company ? "Update Company" : "Create Company");
  const hasOnlineStore = ["online", "both"].includes(formData.business_mode);

  return (
    <dialog id={modalId} className="modal">
      <div className="modal-box w-full max-w-3xl">
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Company Name <span className="text-red-500">*</span></span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`input input-bordered w-full ${errors.name ? "input-error" : ""}`}
              placeholder="Enter company name"
              disabled={loading}
            />
            {errors.name && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.name}</span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email <span className="text-red-500">*</span></span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`input input-bordered w-full ${errors.email ? "input-error" : ""}`}
                placeholder="Enter company email"
                disabled={loading}
              />
              {errors.email && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.email}</span>
                </label>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Contact Name <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className={`input input-bordered w-full ${errors.contact_name ? "input-error" : ""}`}
                placeholder="Enter contact person name"
                disabled={loading}
              />
              {errors.contact_name && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.contact_name}</span>
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Phone Number <span className="text-red-500">*</span></span>
              </label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                className={`input input-bordered w-full ${errors.phone_number ? "input-error" : ""}`}
                placeholder="Enter phone number"
                disabled={loading}
              />
              {errors.phone_number && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.phone_number}</span>
                </label>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Role <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                name="role_name"
                value={formData.role_name}
                onChange={handleChange}
                className={`input input-bordered w-full ${errors.role_name ? "input-error" : ""}`}
                placeholder="Enter admin role name"
                disabled={loading}
              />
              {errors.role_name && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.role_name}</span>
                </label>
              )}
            </div>
          </div>

          <div className="form-control mt-4 md:max-w-[48%]">
            <label className="label">
              <span className="label-text">
                Password {!company && <span className="text-red-500">*</span>}
              </span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`input input-bordered w-full ${errors.password ? "input-error" : ""}`}
              placeholder={company ? "Leave blank to keep current password" : "Enter login password"}
              disabled={loading}
              autoComplete="new-password"
            />
            {errors.password && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.password}</span>
              </label>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-base-300 bg-base-100 p-4">
            <label className="label px-0 pt-0">
              <span className="label-text font-medium">Company Type <span className="text-red-500">*</span></span>
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {BUSINESS_MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border p-3 transition ${formData.business_mode === option.value ? "border-primary bg-primary/5" : "border-base-300"}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="business_mode"
                      value={option.value}
                      checked={formData.business_mode === option.value}
                      onChange={handleChange}
                      className="radio radio-primary radio-sm"
                      disabled={loading}
                    />
                    <span className="font-semibold">{option.label}</span>
                  </span>
                  <span className="mt-1 block text-xs text-base-content/60">{option.description}</span>
                </label>
              ))}
            </div>
            {errors.business_mode && <p className="mt-2 text-xs text-error">{errors.business_mode}</p>}

            {hasOnlineStore && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="form-control">
                  <label className="label px-0">
                    <span className="label-text">Plan <span className="text-red-500">*</span></span>
                  </label>
                  <select
                    name="saas_plan_id"
                    value={formData.saas_plan_id}
                    onChange={handleChange}
                    className={`select select-bordered w-full ${errors.saas_plan_id ? "select-error" : ""}`}
                    disabled={loading || optionsLoading}
                  >
                    <option value="">{optionsLoading ? "Loading plans..." : "Select a plan"}</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                  {errors.saas_plan_id && <p className="mt-1 text-xs text-error">{errors.saas_plan_id}</p>}
                </div>

                <div className="form-control">
                  <label className="label px-0">
                    <span className="label-text">Template <span className="text-red-500">*</span></span>
                  </label>
                  <select
                    name="selected_e_template_id"
                    value={formData.selected_e_template_id}
                    onChange={handleChange}
                    className={`select select-bordered w-full ${errors.selected_e_template_id ? "select-error" : ""}`}
                    disabled={loading || optionsLoading}
                  >
                    <option value="">{optionsLoading ? "Loading templates..." : "Select a template"}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.template_name}</option>
                    ))}
                  </select>
                  {errors.selected_e_template_id && <p className="mt-1 text-xs text-error">{errors.selected_e_template_id}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="form-control mt-4 md:max-w-[48%]">
            <label className="label cursor-pointer justify-between border border-base-300 rounded-lg px-4 py-3">
              <span className="label-text font-medium">Active Status</span>
              <input
                type="checkbox"
                name="status"
                checked={formData.status === "1"}
                onChange={handleChange}
                className="checkbox checkbox-primary"
                disabled={loading}
              />
            </label>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => closeModal(modalId)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
      
      {/* Click outside to close */}
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

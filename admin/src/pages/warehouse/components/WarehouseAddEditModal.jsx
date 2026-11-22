import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { createWarehouse, updateWarehouse } from "../../../api/warehouse";
import { getCompanies } from "../../../api/backoffice/company";
import { closeModal } from "../../../hooks/modalConfig";
import { PiX } from "react-icons/pi";
import { toast } from "react-toastify";

const WarehouseAddEditModal = ({
  isEdit,
  fetchwarehouse,
  editableData = null,
  setEditableData,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const userCompanyId = useSelector((state) => state.auth.company_id);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Check if user can select companies (superadmin has no company_id)
  const canSelectCompany = !userCompanyId;

  const fetchCompaniesList = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const response = await getCompanies(accessToken);
      if (response.status) {
        setCompanies(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoadingCompanies(false);
    }
  }, [accessToken]);

  // Fetch companies when component mounts (for admin users)
  useEffect(() => {
    if (canSelectCompany) {
      fetchCompaniesList();
    }
  }, [canSelectCompany, fetchCompaniesList]);

  useEffect(() => {
    if (isEdit && editableData) {
      reset({
        name: editableData.name || "",
        location: editableData.location || "",
        is_default: editableData.is_default === 1,
        company_id: editableData.company_id || (canSelectCompany ? "" : userCompanyId),
      });
    } else {
      reset({
        name: "",
        location: "",
        is_default: false,
        company_id: canSelectCompany ? "" : userCompanyId,
      });
    }
    setErrorMessage("");
  }, [isEdit, editableData, reset, canSelectCompany, userCompanyId]);

  const onFormSubmit = async (data) => {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const payload = {
        name: data.name.trim(),
        location: data.location.trim(),
        is_default: data.is_default ? 1 : 0,
      };

      // Add company_id for admin users
      if (canSelectCompany && data.company_id) {
        payload.company_id = data.company_id;
      }

      const response = isEdit
        ? await updateWarehouse(accessToken, editableData.id, payload)
        : await createWarehouse(accessToken, payload);

      if (response.status) {
        toast.success(
          isEdit ? "Warehouse updated successfully" : "Warehouse created successfully",
          {
            className: "alert alert-success",
            bodyClassName: "text-sm",
            progressClassName: "bg-success",
          }
        );
        closeModal("create_warehouse");
        fetchwarehouse();
        setEditableData(null);
        reset();
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || "Failed to save warehouse";
      setErrorMessage(errorMsg);
      // toast.error(errorMsg, {
      //   className: "alert alert-error",
      //   bodyClassName: "text-sm",
      //   progressClassName: "bg-error",
      // });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    closeModal("create_warehouse");
    setEditableData(null);
    reset();
    setErrorMessage("");
  };

  return (
    <dialog id="create_warehouse" className="modal">
      <div className="modal-box w-11/12 max-w-lg flex flex-col p-0">
        {/* Fixed Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">
              {isEdit ? "Edit Warehouse" : "Add New Warehouse"}
            </h3>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              onClick={handleClose}
            >
              <PiX size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 px-6">
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company Selection - Only for admin users */}
              {canSelectCompany && (
                <div className="form-control col-span-2">
                  <label className="label">
                    <span className="label-text">Company *</span>
                  </label>
                  <select
                    {...register("company_id", {
                      required: "Company is required",
                    })}
                    className={`select select-bordered w-full ${
                      errors.company_id ? "select-error" : ""
                    }`}
                    disabled={loadingCompanies}
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {errors.company_id && (
                    <span className="text-error text-xs mt-1">
                      {errors.company_id.message}
                    </span>
                  )}
                  {loadingCompanies && (
                    <span className="text-info text-xs mt-1">Loading companies...</span>
                  )}
                </div>
              )}

              <div className="form-control col-span-2">
                <label className="label">
                  <span className="label-text">Warehouse Name *</span>
                </label>
                <input
                  {...register("name", {
                    required: "Name is required",
                    maxLength: {
                      value: 255,
                      message: "Maximum 255 characters allowed",
                    },
                    validate: (value) => {
                      const trimmed = value.trim();
                      if (trimmed.length === 0) return "Name cannot be empty";
                      return true;
                    },
                  })}
                  className={`input input-bordered w-full ${
                    errors.name ? "input-error" : ""
                  }`}
                />
                {errors.name && (
                  <span className="text-error text-xs mt-1">
                    {errors.name.message}
                  </span>
                )}
              </div>

              <div className="form-control col-span-2">
                <label className="label">
                  <span className="label-text">Warehouse Location *</span>
                </label>
                <input
                  {...register("location", {
                    required: "Location is required",
                    maxLength: {
                      value: 255,
                      message: "Maximum 255 characters allowed",
                    },
                    validate: (value) => {
                      const trimmed = value.trim();
                      if (trimmed.length === 0) return "Location cannot be empty";
                      return true;
                    },
                  })}
                  className={`input input-bordered w-full ${
                    errors.location ? "input-error" : ""
                  }`}
                />
                {errors.location && (
                  <span className="text-error text-xs mt-1">
                    {errors.location.message}
                  </span>
                )}
              </div>

              <div className="form-control col-span-2">
                  <label className="label cursor-pointer justify-start gap-4">
                    <input
                        type="checkbox"
                        {...register("is_default")}
                        className="toggle toggle-primary"
                      />
                  <span className="label-text">Is Default Warehouse?</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-error text-sm">{errorMessage}</span>
            <div className="flex items-center gap-2 modal-action m-0">
              <button
                type="button"
                className="btn btn-ghost h-10 min-h-10"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary h-10 min-h-10"
                onClick={handleSubmit(onFormSubmit)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="loading loading-spinner"></span>
                ) : isEdit ? (
                  "Update"
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default WarehouseAddEditModal;
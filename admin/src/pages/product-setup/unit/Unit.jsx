import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaFileExcel, FaPlus } from "react-icons/fa";
import {
  PiCopy,
  PiMagnifyingGlass,
  PiNotePencil,
  PiSliders,
  PiTrash,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import { closeModal, showModal } from "../../../hooks/modalConfig";
import useSelectableList from "../../../hooks/useSelectableList";
import { hasPermission } from "../../../utils/permissions";
import {
  deleteUnits,
  getUnits,
  storeUnit,
  updateUnit,
  updateUnitStatus,
} from "../../../api/unit";
import UnitAddEditModal from "./components/UnitAddEditModal";

const normalizeErrorMessage = (messages, fallbackMessage) => {
  const lines = (Array.isArray(messages) ? messages : [messages])
    .flatMap((message) => String(message || "").split("\n"))
    .map((message) => message.trim())
    .filter(Boolean);

  const uniqueLines = [...new Set(lines)];
  return uniqueLines.length > 0
    ? uniqueLines.join("\n")
    : fallbackMessage;
};

export default function Unit() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState({
    status: "",
    baseUnit: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, others_data: {} });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isEdit, setIsEdit] = useState(false);
  const [editableData, setEditableData] = useState(null);
  const [loadData, setLoadData] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const filterRef = useRef(null);

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(data.data);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        perPage,
        status: filters.status,
        baseUnit: filters.baseUnit,
        search: searchQuery.trim(),
        sortField,
        sortOrder,
        page: currentPage,
      };
      const result = await getUnits(accessToken, params);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch units");
      }

      setData({
        data: result.data,
        meta: result.meta,
        others_data: result.others_data || {},
      });
    } catch (error) {
      console.error("Fetch units error:", error);
      toast.error(error.message || "Failed to load units", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [
    accessToken,
    currentPage,
    filters.baseUnit,
    filters.status,
    perPage,
    searchQuery,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    if (loadData && accessToken) {
      fetchData();
    }
  }, [accessToken, fetchData, loadData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleSort = (field) => {
    setSortField(field);
    setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
    setLoadData(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await deleteUnits(accessToken, id);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete unit");
      }

      toast.success("Unit deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
    } catch (error) {
      console.error("Delete unit error:", error);
      toast.error(
        error?.response?.data?.error || error.message || "Failed to delete unit",
        {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        }
      );
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one unit to delete", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} units. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete them!",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await deleteUnits(accessToken, selectedOptions);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete units");
      }

      toast.success("Units deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      clearSelection();
      setLoadData(true);
    } catch (error) {
      console.error("Bulk delete units error:", error);
      toast.error(
        error?.response?.data?.error || error.message || "Failed to delete units",
        {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        }
      );
    }
  };

  const handleStatusToggle = async (unit) => {
    const newStatus = unit.is_active === 1 ? 0 : 1;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${newStatus === 1 ? "Active" : "Inactive"} for unit "${unit.unit_name}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, change it!",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await updateUnitStatus(accessToken, unit.id, {
        is_active: newStatus,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update status");
      }

      toast.success(
        `Unit status updated to ${newStatus === 1 ? "Active" : "Inactive"}`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      setLoadData(true);
    } catch (error) {
      console.error("Unit status error:", error);
      toast.error(error.message || "Failed to update status", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkStatusUpdate = async (is_active) => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one unit to update", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${is_active === 1 ? "Active" : "Inactive"} for ${selectedOptions.length} selected units?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, change them!",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await updateUnitStatus(accessToken, selectedOptions, {
        is_active,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update statuses");
      }

      toast.success(
        `Selected units updated to ${is_active === 1 ? "Active" : "Inactive"}`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      clearSelection();
      setLoadData(true);
    } catch (error) {
      console.error("Bulk status update error:", error);
      toast.error(error.message || "Failed to update statuses", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleAddOrEdit = async (formData) => {
    try {
      const payload = {
        unit_name: formData.unit_name.trim(),
        unit_code: formData.unit_code.trim(),
        base_unit: Number(formData.base_unit || 0),
        operator: formData.base_unit > 0 ? formData.operator : "*",
        operation_value:
          Number(formData.base_unit || 0) > 0
            ? Number(formData.operation_value)
            : 1,
        is_active: formData.is_active ? 1 : 0,
      };

      const response = isEdit
        ? await updateUnit(accessToken, editableData.id, payload)
        : await storeUnit(accessToken, payload);

      if (!response.status) {
        throw new Error(response.message || `Failed to ${isEdit ? "update" : "create"} unit`);
      }

      toast.success(`Unit ${isEdit ? "updated" : "created"} successfully!`, {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      setEditableData(null);
      setErrorMessage("");
      setIsSuccess(true);
      closeModal("add_edit_unit_modal");
    } catch (error) {
      let errorMsg = "An unexpected error occurred";
      if (error.response && error.response.status === 422) {
        const messages = error.response.data.errors;
        errorMsg = normalizeErrorMessage(
          Array.isArray(messages) ? messages : Object.values(messages || {}).flat(),
          errorMsg
        );
      } else {
        errorMsg = normalizeErrorMessage(
          error?.response?.data?.error || error.message,
          errorMsg
        );
      }
      setErrorMessage(errorMsg);
    }
  };

  const exportToExcel = () => {
    const headers = ["Unit Name", "Unit Code", "Base Unit", "Operator", "Operation Value", "Status"];
    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;
    const rows = exportData.map((item) => [
      item.unit_name,
      item.unit_code,
      item.base_unit_name || "",
      item.base_unit > 0 ? item.operator : "",
      item.base_unit > 0 ? item.operation_value : "",
      item.is_active === 1 ? "Active" : "Inactive",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Units.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    try {
      const exportData =
        selectedOptions.length > 0
          ? data.data.filter((item) => selectedOptions.includes(item.id))
          : data.data;
      const text = exportData
        .map(
          (item) =>
            `${item.unit_name || ""},${item.unit_code || ""},${item.base_unit_name || ""},${
              item.base_unit > 0 ? item.operator : ""
            },${item.base_unit > 0 ? item.operation_value : ""},${
              item.is_active === 1 ? "Active" : "Inactive"
            }`
        )
        .join("\n");
      const clipboardText =
        `Unit Name,Unit Code,Base Unit,Operator,Operation Value,Status\n${text}`;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = clipboardText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      toast.success("Data copied to clipboard", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
    } catch (error) {
      console.error("Copy units error:", error);
      toast.error("Failed to copy to clipboard", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const resetFilters = () => {
    setFilters({
      status: "",
      baseUnit: "",
    });
    setSearchQuery("");
    setSortField("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Unit Management</h2>
        <p className="text-sm text-gray-600">
          Manage product units and their conversion rules from this page.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search units..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setLoadData(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={handleSearch}
                >
                  <PiMagnifyingGlass fontSize={20} />
                </button>
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                >
                  <PiSliders fontSize={20} />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 w-full"
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Base Unit</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 w-full"
                  value={filters.baseUnit}
                  onChange={(e) => handleFilterChange("baseUnit", e.target.value)}
                >
                  <option value="">All Base Units</option>
                  <option value="0">Primary Units</option>
                  {(data?.others_data?.base_units || []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name} ({unit.unit_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>
                  Reset
                </button>
                <button
                  className="btn h-10 min-h-10"
                  onClick={() => {
                    setIsAdvancedOpen(false);
                    setCurrentPage(1);
                    setLoadData(true);
                  }}
                >
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Unit List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <>
                {hasPermission("product-setup.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(1)}
                    className="btn btn-outline btn-success"
                  >
                    Set Active
                  </button>
                )}
                {hasPermission("product-setup.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(0)}
                    className="btn btn-outline btn-warning"
                  >
                    Set Inactive
                  </button>
                )}
                {hasPermission("product-setup.edit") && (
                  <button
                    onClick={handleBulkDelete}
                    className="btn btn-outline btn-error"
                    title="Delete Selected"
                  >
                    <PiTrash />
                    Delete ({selectedOptions.length})
                  </button>
                )}
              </>
            )}
            <button onClick={exportToExcel} className="btn btn-outline btn-success">
              <FaFileExcel />
            </button>
            <button onClick={copyToClipboard} className="btn btn-outline btn-info">
              <PiCopy size={18} />
            </button>
            {hasPermission("product-setup.create") && (
              <button
                className="btn btn-outline btn-primary"
                onClick={() => {
                  setIsEdit(false);
                  setEditableData(null);
                  setErrorMessage("");
                  setIsSuccess(false);
                  showModal("add_edit_unit_modal");
                }}
              >
                <FaPlus />
                Add
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <>
              <table className="table figtree-regular">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th className="w-0.5/12">
                      <label>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          checked={isAllSelectedOnCurrentPage()}
                        />
                      </label>
                    </th>
                    <th className="w-3/12 cursor-pointer" onClick={() => handleSort("unit_name")}>
                      Unit Name {sortField === "unit_name" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12 cursor-pointer" onClick={() => handleSort("unit_code")}>
                      Code {sortField === "unit_code" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2.5/12 cursor-pointer" onClick={() => handleSort("base_unit")}>
                      Base Unit {sortField === "base_unit" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12 cursor-pointer" onClick={() => handleSort("operation_value")}>
                      Conversion {sortField === "operation_value" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-1.5/12 cursor-pointer" onClick={() => handleSort("is_active")}>
                      Status {sortField === "is_active" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-1.5/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.length > 0 ? (
                    data.data.map((unit) => (
                      <tr
                        key={unit.id}
                        className={`hover ${selectedOptions.includes(unit.id) ? "bg-blue-100" : ""}`}
                      >
                        <th>
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(unit.id)}
                              checked={selectedOptions.includes(unit.id)}
                            />
                          </label>
                        </th>
                        <td>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{unit.unit_name}</p>
                          </div>
                        </td>
                        <td>{unit.unit_code}</td>
                        <td>{unit.base_unit_name || "Primary unit"}</td>
                        <td>
                          {unit.base_unit > 0 ? `${unit.operator} ${unit.operation_value}` : "Base unit"}
                        </td>
                        <td>
                          {hasPermission("product-setup.edit") && (
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={unit.is_active === 1}
                              onChange={() => handleStatusToggle(unit)}
                            />
                          )}
                        </td>
                        <th>
                          <div className="flex items-center justify-center gap-2">
                            {hasPermission("product-setup.edit") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => {
                                  setIsEdit(true);
                                  setEditableData(unit);
                                  setErrorMessage("");
                                  setIsSuccess(false);
                                  showModal("add_edit_unit_modal");
                                }}
                              >
                                <PiNotePencil fontSize={16} />
                              </button>
                            )}
                            {hasPermission("product-setup.edit") && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                onClick={() => handleDelete(unit.id)}
                              >
                                <PiTrash fontSize={16} />
                              </button>
                            )}
                          </div>
                        </th>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center pt-4 pb-4">
                        No Units Found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data?.data?.length > 0 && (
                <Pagination
                  currentPage={data?.meta?.current_page}
                  lastPage={data?.meta?.last_page}
                  handlePrevious={() => {
                    setCurrentPage((prev) => prev - 1);
                    setLoadData(true);
                  }}
                  handlePageChange={(page) => {
                    setCurrentPage(page);
                    setLoadData(true);
                  }}
                  handleNextPage={() => {
                    setCurrentPage((prev) => prev + 1);
                    setLoadData(true);
                  }}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < data?.meta?.last_page}
                />
              )}
            </>
          )}
        </div>
      </div>

      <UnitAddEditModal
        isEdit={isEdit}
        editableData={editableData}
        onSubmit={handleAddOrEdit}
        errorMessage={errorMessage}
        isSuccess={isSuccess}
        onClearError={setErrorMessage}
        onSuccessReset={setIsSuccess}
        baseUnits={(data?.others_data?.base_units || []).filter(
          (unit) => unit.id !== editableData?.id
        )}
      />
    </div>
  );
}

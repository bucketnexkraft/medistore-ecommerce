import React, { useCallback, useEffect, useState, useRef } from "react";
import { FaPlus, FaFileExcel } from "react-icons/fa";
import {
  PiCopy,
  PiMagnifyingGlass,
  PiNotePencil,
  PiSliders,
  PiTrash,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  deleteSuppliers,
  getSuppliers,
  storeSuppliers,
  updateSuppliers,
  updateSupplierStatus, // Assume this API exists; implement if not (similar to updateCategoryStatus)
} from "../../api/supplier";
import { closeModal, showModal } from "../../hooks/modalConfig";
import useSelectableList from "../../hooks/useSelectableList";
import Swal from "sweetalert2";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import SupplierAddEditModal from "./components/SupplierAddEditModal";
import noImage from "../../../public/images/no-images/no-img.jpg"; // Adjust if needed (though not used in original, added for consistency)
import { hasPermission } from "./../../utils/permissions";

export default function Suppliers() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState({
    status: "",
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
  const filterRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

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
        search: searchQuery,
        sortField,
        sortOrder,
        page: currentPage,
      };
      const result = await getSuppliers(accessToken, params);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch suppliers");
      }

      setData({
        data: result.data,
        meta: result.meta,
        others_data: result.others_data,
      });
    } catch (error) {
      console.error("Fetch suppliers error:", error);
      toast.error(error.message || "Failed to load suppliers", {
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
    perPage,
    sortField,
    sortOrder,
    currentPage,
    filters,
    searchQuery,
  ]);

  useEffect(() => {
    if (loadData) {
      fetchData();
    }
  }, [fetchData, loadData]);

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
    if (searchQuery.trim() !== "") {
      setCurrentPage(1);
      setLoadData(true);
    }
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
      const response = await deleteSuppliers(accessToken, id);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete supplier");
      }
      toast.success("Supplier deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
    } catch (error) {
      console.error("Delete supplier error:", error);
      toast.error(error.message || "Failed to delete supplier", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one supplier to delete", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} suppliers. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete them!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await deleteSuppliers(accessToken, selectedOptions);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete suppliers");
      }
      toast.success("Suppliers deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      clearSelection();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(error.message || "Failed to delete suppliers", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleStatusToggle = async (supplier) => {
    const newStatus = supplier.status === 1 ? 0 : 1;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${
        newStatus === 1 ? "Active" : "Inactive"
      } for supplier "${supplier.name}"?`,
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
      const response = await updateSupplierStatus(accessToken, supplier.id, {
        status: newStatus,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update status");
      }
      toast.success(
        `Supplier status updated to ${newStatus === 1 ? "Active" : "Inactive"}`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      setLoadData(true);
    } catch (error) {
      console.error("Status update error:", error);
      toast.error(error.message || "Failed to update status", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one supplier to update", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${status === 1 ? "Active" : "Inactive"} for ${
        selectedOptions.length
      } selected suppliers?`,
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
      const response = await updateSupplierStatus(
        accessToken,
        selectedOptions,
        { status }
      );
      if (!response.status) {
        throw new Error(response?.message || "Failed to update statuses");
      }
      toast.success(
        `Selected suppliers updated to ${status === 1 ? "Active" : "Inactive"}`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      setLoadData(true);
      clearSelection();
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
      const response = isEdit
        ? await updateSuppliers(accessToken, editableData.id, formData)
        : await storeSuppliers(accessToken, formData);

      if (!response.status) {
        throw new Error(
          response.message ||
            `Failed to ${isEdit ? "update" : "create"} supplier`
        );
      }
      toast.success(
        `Supplier ${isEdit ? "updated" : "created"} successfully!`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      setLoadData(true);
      setEditableData(null);
      setErrorMessage(""); // Clear any previous errors
      setIsSuccess(!isSuccess);
      closeModal("add_edit_supplier_modal");
    } catch (error) {
      console.error(`${isEdit ? "Update" : "Create"} supplier error:`, error);
      let errorMsg = "An unexpected error occurred";
      if (error.response && error.response.status === 422) {
        const messages = error.response.data.errors;
        errorMsg = messages.join("\n");
      } else {
        errorMsg =
          error.message || `Failed to ${isEdit ? "update" : "create"} supplier`;
      }
      setErrorMessage(errorMsg);
    }
  };

  const handleSort = (field) => {
    setSortField(field);
    setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
    setLoadData(true);
  };

  const exportToExcel = () => {
    const headers = ["Name", "Email", "Phone", "Address", "Status"];
    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;
    const rows = exportData.map((item) => [
      item.name,
      item.email || "",
      item.phone || "",
      item.address || "",
      item.status === 1 ? "Active" : "Inactive",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Suppliers.csv";
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
            `${item.name || ""},${item.email || ""},${item.phone || ""},${
              item.address || ""
            },${item.status === 1 ? "Active" : "Inactive"}`
        )
        .join("\n");
      const clipboardText = `Name,Email,Phone,Address,Status\n${text}`;

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
      console.error("Copy to clipboard error:", error);
      toast.error("Failed to copy to clipboard", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => prev + 1);
    setLoadData(true);
  };
  const handlePrevious = () => {
    setCurrentPage((prev) => prev - 1);
    setLoadData(true);
  };
  const handlePageChange = (page) => {
    setCurrentPage(page);
    setLoadData(true);
  };

  const onFilterSubmit = () => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters({
      status: "",
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
        <h2 className="text-xl font-semibold">Supplier Management</h2>
        <p className="text-sm text-gray-600">
          Manage your suppliers from this page. Use filters to narrow down
          results or add new suppliers.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search suppliers..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setLoadData(true);
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && searchQuery.trim() !== "") {
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
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button
                  className="btn btn-error btn-outline h-10 min-h-10"
                  onClick={resetFilters}
                >
                  Reset
                </button>
                <button className="btn h-10 min-h-10" onClick={onFilterSubmit}>
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Supplier List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <>
                {hasPermission("supplier.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(1)}
                    className="btn btn-outline btn-success"
                  >
                    Set Active
                  </button>
                )}
                {hasPermission("supplier.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(0)}
                    className="btn btn-outline btn-warning"
                  >
                    Set Inactive
                  </button>
                )}
                {hasPermission("supplier.delete") &&
                  selectedOptions.length > 1 && (
                    <button
                      onClick={handleBulkDelete}
                      className="btn btn-outline btn-error"
                      title="Delete Selected"
                    >
                      <PiTrash className="" />
                      Delete ({selectedOptions.length})
                    </button>
                  )}
              </>
            )}
            <button
              onClick={exportToExcel}
              className="btn btn-outline btn-success"
            >
              <FaFileExcel />
            </button>
            <button
              onClick={copyToClipboard}
              className="btn btn-outline btn-info"
            >
              <PiCopy size={18} />
            </button>
            {hasPermission("supplier.create") && (
              <button
                className="btn btn-outline btn-primary"
                onClick={() => {
                  setIsEdit(false);
                  setEditableData(null);
                  setErrorMessage("");
                  showModal("add_edit_supplier_modal");
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
                    <th
                      className="w-2/12 cursor-pointer"
                      onClick={() => handleSort("name")}
                    >
                      Name{" "}
                      {sortField === "name" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-2/12 cursor-pointer"
                      onClick={() => handleSort("email")}
                    >
                      Email{" "}
                      {sortField === "email" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12">Phone</th>
                    <th className="w-3/12">Address</th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("status")}
                    >
                      Status{" "}
                      {sortField === "status" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.length > 0 ? (
                    data.data.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className={`hover ${
                          selectedOptions.includes(supplier.id)
                            ? "bg-blue-100"
                            : ""
                        }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(supplier)}
                              checked={selectedOptions.includes(supplier.id)}
                            />
                          </label>
                        </th>
                        <td className="w-2/12">{supplier?.name}</td>
                        <td className="w-2/12">{supplier?.email}</td>
                        <td className="w-2/12">{supplier?.phone}</td>
                        <td className="w-3/12">{supplier?.address}</td>
                        <td className="w-1/12">
                          {hasPermission("supplier.edit") && (
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={supplier.status === 1}
                              onChange={() => handleStatusToggle(supplier)}
                            />
                          )}
                        </td>
                        <th className="w-2/12">
                          <div className="flex items-center justify-center gap-2">
                            {hasPermission("supplier.edit") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => {
                                  setIsEdit(true);
                                  setEditableData(supplier);
                                  setErrorMessage("");
                                  showModal("add_edit_supplier_modal");
                                }}
                              >
                                <PiNotePencil fontSize={16} />
                              </button>
                            )}
                            {hasPermission("supplier.delete") && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                onClick={() => handleDelete(supplier.id)}
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
                        No Suppliers Found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data?.data?.length > 0 && (
                <Pagination
                  currentPage={data?.meta?.current_page}
                  lastPage={data?.meta?.last_page}
                  handlePrevious={handlePrevious}
                  handlePageChange={handlePageChange}
                  handleNextPage={handleNextPage}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < data?.meta?.last_page}
                />
              )}
            </>
          )}
        </div>
      </div>

      <SupplierAddEditModal
        isEdit={isEdit}
        editableData={editableData}
        onSubmit={handleAddOrEdit}
        errorMessage={errorMessage}
        isSuccess={isSuccess}
      />
    </div>
  );
}

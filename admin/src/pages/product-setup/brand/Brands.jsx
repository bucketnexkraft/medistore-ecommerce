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
import TableLoading from "../../../components/loadings/TableLoading";
import {
  getBrands,
  deleteBrands,
  storeBrands,
  updateBrands,
  updateBrandStatus,
} from "../../../api/brand";
import Pagination from "../../../components/common/Pagination";
import BrandAddEditModal from "./components/BrandAddEditModal";
import { closeModal, showModal } from "../../../hooks/modalConfig";
import Swal from "sweetalert2";
import noImage from "../../../../public/images/no-images/no-img.jpg";
import useSelectableList from "../../../hooks/useSelectableList";
import { hasPermission } from "../../../utils/permissions";

export default function Brands() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState({
    status: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isEdit, setIsEdit] = useState(false);
  const [editableData, setEditableData] = useState(null);
  const [loadData, setLoadData] = useState(true);
  const dropdownRef = useRef(null);
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
        per_page: perPage,
        status: filters.status,
        search: searchQuery.trim(),
        sortField,
        sortOrder,
        page: currentPage,
      };
      const result = await getBrands(accessToken, params);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch brands");
      }

      setData({
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      console.error("Fetch brands error:", error);
      toast.error(error.message || "Failed to load brands", {
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
    filters,
    searchQuery,
    sortField,
    sortOrder,
    currentPage,
  ]);

  useEffect(() => {
    if (loadData && accessToken) {
      fetchData();
    }
  }, [fetchData, loadData, accessToken]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
      setIsAdvancedOpen(false);
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
      const response = await deleteBrands(accessToken, id);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete brand");
      }
      toast.success("Brand deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
    } catch (error) {
      console.error("Delete brand error:", error);
      toast.error(error.message || "Failed to delete brand", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one brand to delete", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} brands. This action cannot be undone.`,
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
      const response = await deleteBrands(accessToken, selectedOptions);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete brands");
      }
      toast.success("Brands deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      clearSelection();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(error.message || "Failed to delete brands", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleStatusToggle = async (brand) => {
    const newStatus = brand.status === 1 ? 0 : 1;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${
        newStatus === 1 ? "Active" : "Inactive"
      } for brand "${brand.title}"?`,
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
      const response = await updateBrandStatus(accessToken, brand.id, {
        status: newStatus,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update status");
      }
      toast.success(
        `Brand status updated to ${newStatus === 1 ? "Active" : "Inactive"}`,
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
      toast.warning("Please select at least one brand to update", {
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
      } selected brands?`,
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
      const response = await updateBrandStatus(accessToken, selectedOptions, {
        status,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update statuses");
      }
      toast.success(
        `Selected brands updated to ${status === 1 ? "Active" : "Inactive"}`,
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
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("status", formData.status ? "1" : "0");
      formDataToSend.append("return_enabled", formData.return_enabled ? "1" : "0");
      formDataToSend.append("return_day", formData.return_day ?? "");
      formDataToSend.append(
        "return_condition",
        JSON.stringify(
          Array.isArray(formData.return_condition)
            ? formData.return_condition
                .map((item) => String(item?.value || "").trim())
                .filter(Boolean)
            : []
        )
      );

      if (formData.image instanceof File) {
        formDataToSend.append("image", formData.image);
      }

      const response = isEdit
        ? await updateBrands(accessToken, editableData.id, formDataToSend)
        : await storeBrands(accessToken, formDataToSend);

      if (!response.status) {
        throw new Error(
          response.message || `Failed to ${isEdit ? "update" : "create"} brand`
        );
      }

      toast.success(`Brand ${isEdit ? "updated" : "created"} successfully!`, {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      setEditableData(null);
      setErrorMessage("");
      setIsSuccess(true);
      closeModal("add_edit_brand_modal");
    } catch (error) {
      let errorMsg = "An unexpected error occurred";
      if (error.response && error.response.status === 422) {
        const messages = error.response.data.errors;
        errorMsg = Object.values(messages).flat().join("\n");
      } else {
        console.error("Unexpected error:", error);
        errorMsg =
          error.message || `Failed to ${isEdit ? "update" : "create"} brand`;
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
    const headers = ["Title", "Status"];
    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;
    const rows = exportData.map((item) => [
      item.title,
      item.status === 1 ? "Active" : "Inactive",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Brands.csv";
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
            `${item.title || ""},${item.status === 1 ? "Active" : "Inactive"}`
        )
        .join("\n");
      const clipboardText = `Title,Status\n${text}`;

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
    setFilters({ status: "" });
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
        <h2 className="text-xl font-semibold">Brand Management</h2>
        <p className="text-sm text-gray-600">
          Manage your product brands from this page. Use filters to narrow down
          results or add new brands.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={dropdownRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search brands..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setLoadData(true);
                }}
                onKeyDown={(e) => {
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
          <h5 className="font-semibold text-custom-gray-400">Brand List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <>
                {hasPermission("brand.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(1)}
                    className="btn btn-outline btn-success"
                  >
                    Set Active
                  </button>
                )}
                {hasPermission("brand.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(0)}
                    className="btn btn-outline btn-warning"
                  >
                    Set Inactive
                  </button>
                )}
                {hasPermission("brand.delete") &&
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
            {hasPermission("brand.create") && (
              <button
                onClick={() => {
                  setIsEdit(false);
                  setEditableData(null);
                  setErrorMessage("");
                  setIsSuccess(false);
                  showModal("add_edit_brand_modal");
                }}
                className="btn btn-outline btn-primary"
              >
                <FaPlus />
                Add
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden">
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
                    <th className="w-2/12">Image</th>
                    <th
                      className="w-5/12 cursor-pointer"
                      onClick={() => handleSort("title")}
                    >
                      Title{" "}
                      {sortField === "title" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-2/12 cursor-pointer"
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
                    data.data.map((brand) => (
                      <tr
                        key={brand.id}
                        className={`hover ${
                          selectedOptions.includes(brand.id)
                            ? "bg-blue-100"
                            : ""
                        }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(brand.id)}
                              checked={selectedOptions.includes(brand.id)}
                            />
                          </label>
                        </th>
                        <td className="w-2/12">
                          <div className="flex items-center gap-3">
                            <div className="">
                              <div className="h-10 w-10">
                                <img
                                  className="object-contain h-10 w-10 rounded-md"
                                  src={brand.image || noImage}
                                  alt={brand?.title || "Brand"}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="w-5/12">{brand?.title}</td>
                        <td className="w-2/12">
                          {hasPermission("brand.edit") && (
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={brand.status === 1}
                              onChange={() => handleStatusToggle(brand)}
                            />
                          )}
                        </td>
                        <th className="w-2/12">
                          <div className="flex items-center justify-center gap-2">
                            {hasPermission("brand.edit") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => {
                                  setIsEdit(true);
                                  setEditableData(brand);
                                  showModal("add_edit_brand_modal");
                                }}
                              >
                                <PiNotePencil fontSize={16} />
                              </button>
                            )}
                            {hasPermission("brand.delete") && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                onClick={() => handleDelete(brand.id)}
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
                      <td colSpan="5" className="text-center pt-4 pb-4">
                        No Brands Found
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

      <BrandAddEditModal
        isEdit={isEdit}
        editableData={editableData}
        onSubmit={handleAddOrEdit}
        errorMessage={errorMessage}
        isSuccess={isSuccess}
        onClearError={setErrorMessage}
        onSuccessReset={setIsSuccess}
      />
    </div>
  );
}

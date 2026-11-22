import React, { useCallback, useEffect, useState, useRef } from "react";
import { FaPlus, FaFileExcel } from "react-icons/fa";
import {
  PiCopy,
  PiMagnifyingGlass,
  PiNotePencil,
  PiSliders,
  PiTrash,
} from "react-icons/pi";
import { showModal } from "../../hooks/modalConfig";
import WarehouseAddEditModal from "./components/WarehouseAddEditModal";
import { getWarehouse } from "../../api/warehouse";
// Assuming deleteWarehouse API exists or needs to be implemented similarly to deleteCategories
import { deleteWarehouse } from "../../api/warehouse"; // Import or create this
import { useSelector } from "react-redux";
import TableLoading from "../../components/loadings/TableLoading";
import { toast } from "react-toastify";
import Pagination from "../../components/common/Pagination";
import Swal from "sweetalert2";
import useSelectableList from "../../hooks/useSelectableList";
import { hasPermission } from "../../utils/permissions";

const Warehouse = () => {
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState({
    is_default: "",
  });
  const [data, setData] = useState({ data: [], meta: {} });
  const [editableData, setEditableData] = useState(null);
  const dropdownRef = useRef(null);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loadData, setLoadData] = useState(true);

  const accessToken = useSelector((state) => state.auth.accessToken);

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(data.data);

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

  const fetchWarehouse = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        per_page: perPage,
        search: searchQuery.trim(),
        page: currentPage,
        is_default: filters.is_default,
        sortField,
        sortOrder,
      };
      const result = await getWarehouse(accessToken, params);
      setData({
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      toast.error(error.message || "Failed to load warehouse");
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [
    accessToken,
    searchQuery,
    perPage,
    currentPage,
    filters,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    if (loadData) {
      fetchWarehouse();
    }
  }, [loadData, fetchWarehouse]);

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

  const toggleAdvanced = () => {
    setIsAdvancedOpen(!isAdvancedOpen);
  };

  const onFilterSubmit = () => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters({
      is_default: "",
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
      const response = await deleteWarehouse(accessToken, id);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete warehouse");
      }
      toast.success("Warehouse deleted successfully");
      setLoadData(true);
    } catch (error) {
      toast.error(error.message || "Failed to delete warehouse");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one warehouse to delete");
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} warehouses. This action cannot be undone.`,
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
      const response = await deleteWarehouse(accessToken, selectedOptions);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete warehouses");
      }
      toast.success("Warehouses deleted successfully");
      setLoadData(true);
      clearSelection();
    } catch (error) {
      toast.error(error.message || "Failed to delete warehouses");
    }
  };

  const exportToExcel = () => {
    const headers = ["Warehouse Name", "Location", "Default Branch"];
    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;
    const rows = exportData.map((item) => [
      item.name,
      item.location,
      item.is_default === 1 ? "Default" : "No",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Warehouses.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    try {
      const exportData =
        selectedOptions.length > 0
          ? data.data.filter((item) => selectedOptions.includes(item.id))
          : data.data;

      if (!exportData.length) {
        toast.warning("No warehouse data to copy");
        return;
      }

      const text = exportData
        .map(
          (item) =>
            `${item.name},${item.location},${
              item.is_default === 1 ? "Default" : "No"
            }`
        )
        .join("\n");
      const clipboardText = `Warehouse Name,Location,Default Branch\n${text}`;

      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(clipboardText);
        } catch (clipboardError) {
          console.warn("navigator.clipboard.writeText failed, using fallback copy", clipboardError);
          const textArea = document.createElement("textarea");
          textArea.value = clipboardText;
          textArea.setAttribute("readonly", "");
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = clipboardText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success("Data copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Warehouse</h2>
        <p className="text-sm text-gray-600">
          Manage your warehouses from this page. You can add, edit, or view
          warehouse details as needed.
        </p>

        <div className="w-full max-w-3xl mt-4 relative" ref={dropdownRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search warehouse..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  setLoadData(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim() !== "") {
                    handleSearch();
                  }
                }}
              />
              <div className="absolute right-1 w-full max-w-16 flex items-center justify-end gap-0.5">
                <button
                  onClick={handleSearch}
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  title="Search"
                >
                  <PiMagnifyingGlass className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleAdvanced}
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  title="Advanced Search"
                >
                  <PiSliders className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Default Warehouse</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                  value={filters.is_default}
                  onChange={(e) =>
                    handleFilterChange("is_default", e.target.value)
                  }
                >
                  <option value="">All</option>
                  <option value="1">Default</option>
                  <option value="0">Not Default</option>
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
          <h5 className="font-semibold text-custom-gray-400">Warehouse List</h5>
          <div className="flex items-center gap-2">
            {hasPermission("warehouse.delete") &&
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
            {hasPermission("warehouse.create") && (
              <button
                onClick={() => {
                  showModal("create_warehouse");
                  setIsEdit(false);
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
          {loading && <TableLoading />}
          {!loading && (
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
                    className="w-3/12 cursor-pointer"
                    onClick={() => handleSort("name")}
                  >
                    Warehouse Name{" "}
                    {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="w-3/12 cursor-pointer"
                    onClick={() => handleSort("location")}
                  >
                    Location{" "}
                    {sortField === "location" &&
                      (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="w-2/12 cursor-pointer"
                    onClick={() => handleSort("is_default")}
                  >
                    Default Warehouse{" "}
                    {sortField === "is_default" &&
                      (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="w-2/12 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length > 0 ? (
                  data.data.map((warehouse) => (
                    <tr
                      key={warehouse.id}
                      className={`hover ${
                        selectedOptions.includes(warehouse.id)
                          ? "bg-blue-100"
                          : ""
                      }`}
                    >
                      <th className="w-0.5/12">
                        <label>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            onChange={() => handleSelect(warehouse.id)}
                            checked={selectedOptions.includes(warehouse.id)}
                          />
                        </label>
                      </th>
                      <td className="w-3/12">{warehouse.name}</td>
                      <td className="w-3/12">{warehouse.location}</td>
                      <td className="w-2/12">
                        <div
                          className={`badge badge-sm text-white font-semibold ${
                            warehouse.is_default === 1
                              ? "badge-success"
                              : "badge-error"
                          }`}
                        >
                          {warehouse.is_default === 1 ? "Default" : "No"}
                        </div>
                      </td>
                      <th className="w-2/12">
                        <div className="flex items-center justify-center gap-2">
                          {hasPermission("warehouse.edit") && (
                            <button
                              className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={() => {
                                setIsEdit(true);
                                setEditableData(warehouse);
                                showModal("create_warehouse");
                              }}
                            >
                              <PiNotePencil fontSize={16} />
                            </button>
                          )}
                          {hasPermission("warehouse.delete") && (
                            <button
                              className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                              onClick={() => handleDelete(warehouse.id)}
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
                      No Warehouse Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {data?.data?.length > 0 && data.meta.last_page > 1 && (
            <Pagination
              currentPage={data?.meta?.current_page}
              lastPage={data?.meta?.last_page}
              handlePrevious={handlePrevious}
              handlePageChange={handlePageChange}
              handleNextPage={handleNextPage}
            />
          )}
        </div>
      </div>
      <WarehouseAddEditModal
        isEdit={isEdit}
        fetchwarehouse={fetchWarehouse}
        editableData={editableData}
        setEditableData={setEditableData}
      />
    </div>
  );
};

export default Warehouse;

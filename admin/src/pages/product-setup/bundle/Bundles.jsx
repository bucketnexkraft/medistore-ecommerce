import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaFileExcel, FaPlus } from "react-icons/fa";
import {
  PiCopy,
  PiMagnifyingGlass,
  PiNotePencil,
  PiPrinter,
  PiSliders,
  PiTrash,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import PrintableBarcodeSheet from "../../../components/printable-invoices/PrintableBarcodeSheet";
import useSelectableList from "../../../hooks/useSelectableList";
import { hasPermission } from "../../../utils/permissions";
import { fetchingProducts, getAllProduct } from "../../../api/products";
import {
  deleteBundle,
  getBundle,
  getBundles,
  storeBundle,
  updateBundle,
} from "../../../api/bundle";
import BundleAddEditModal from "./components/BundleAddEditModal";

export default function Bundles() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState({ status: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [isEdit, setIsEdit] = useState(false);
  const [editableData, setEditableData] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadData, setLoadData] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBarcodeSheetOpen, setIsBarcodeSheetOpen] = useState(false);
  const filterRef = useRef(null);
  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(data?.data || []);

  const fetchProducts = useCallback(async () => {
    try {
      const result = await getAllProduct(accessToken);
      const rawProducts = Array.isArray(result?.data) ? result.data : [];

      if (rawProducts.length > 0) {
        setProducts(
          rawProducts.map((product) => ({
            id: product.id,
            name: product.name || product.title || "Unnamed product",
            code: product.code || product.sku || "",
            price: Number(
              product.live_price ??
                product.selling_price ??
                product.price ??
                0
            ),
            available_quantity: Number(product.available_quantity ?? product.total_quantity ?? 0),
          }))
        );
        return;
      }

      const fallback = await fetchingProducts(accessToken, {
        perPage: 1000,
        page: 1,
        sortField: "name",
        sortOrder: "asc",
        status: 1,
      });

      setProducts(
        (Array.isArray(fallback?.data) ? fallback.data : []).map((product) => ({
          id: product.id,
          name: product.name || product.title || "Unnamed product",
          code: product.code || product.sku || "",
          price: Number(
            product.live_price ??
              product.selling_price ??
              product.price ??
              0
          ),
          available_quantity: Number(product.available_quantity ?? product.total_quantity ?? 0),
        }))
      );
    } catch (error) {
      console.error("Fetch products error:", error);
      toast.error(error.message || "Failed to load products", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBundles(accessToken, {
        perPage,
        page: currentPage,
        search: searchQuery.trim(),
        status: filters.status,
      });

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch bundles");
      }

      setData({
        data: result.data || [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch bundles error:", error);
      toast.error(error.message || "Failed to load bundles", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, filters.status, perPage, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
    setIsAdvancedOpen(false);
  };

  const handleEdit = async (bundleId) => {
    try {
      const response = await getBundle(accessToken, bundleId);
      if (!response.status) {
        throw new Error(response?.message || "Failed to fetch bundle details");
      }
      setIsEdit(true);
      setEditableData(response.data);
      setErrorMessage("");
      setIsSuccess(false);
      setIsDrawerOpen(true);
    } catch (error) {
      console.error("Fetch bundle details error:", error);
      toast.error(error.message || "Failed to load bundle details", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleDelete = async (bundle) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Delete bundle "${bundle.name}"?`,
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
      const response = await deleteBundle(accessToken, bundle.id);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete bundle");
      }
      toast.success("Bundle deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
    } catch (error) {
      console.error("Delete bundle error:", error);
      toast.error(
        error?.response?.data?.message || error.message || "Failed to delete bundle",
        {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        }
      );
    }
  };

  const handleAddOrEdit = async (formData) => {
    try {
      const payload = {
        name: formData.name,
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value || 0),
        bundle_qty: Number(formData.bundle_qty || 1),
        is_active: formData.is_active ? 1 : 0,
        products: formData.products,
      };

      const response = isEdit
        ? await updateBundle(accessToken, editableData.id, payload)
        : await storeBundle(accessToken, payload);

      if (!response.status) {
        throw new Error(
          response.message || `Failed to ${isEdit ? "update" : "create"} bundle`
        );
      }

      toast.success(`Bundle ${isEdit ? "updated" : "created"} successfully!`, {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      setEditableData(null);
      setErrorMessage("");
      setIsSuccess(true);
      setIsDrawerOpen(false);
    } catch (error) {
      let errorMsg = "An unexpected error occurred";
      if (error.response && error.response.status === 422) {
        const messages = error.response.data.errors;
        errorMsg = Array.isArray(messages)
          ? messages.join("\n")
          : Object.values(messages || {}).flat().join("\n");
      } else {
        errorMsg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error.message ||
          errorMsg;
      }
      setErrorMessage(errorMsg);
    }
  };

  const resetFilters = () => {
    setFilters({ status: "" });
    setSearchQuery("");
    setCurrentPage(1);
    setLoadData(true);
  };

  const exportToExcel = () => {
    const headers = ["Name", "Barcode", "Products", "Discount Type", "Discount Value", "Bundle Price", "Status"];
    const rows = (data.data || []).map((item) => [
      item.name,
      item.code,
      item.products?.map((product) => `${product.product_name} x${product.quantity}`).join(" | "),
      item.discount_type,
      item.discount_value,
      item.bundle_price,
      item.is_active ? "Active" : "Inactive",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Bundles.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    try {
      const text = (data.data || [])
        .map(
          (item) =>
            `${item.name || ""},${item.code || ""},${item.products
              ?.map((product) => `${product.product_name} x${product.quantity}`)
              .join(" | ") || ""},${item.discount_type || ""},${item.discount_value || 0},${
              item.bundle_price || 0
            },${item.is_active ? "Active" : "Inactive"}`
        )
        .join("\n");
      const clipboardText =
        `Name,Barcode,Products,Discount Type,Discount Value,Bundle Price,Status\n${text}`;

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

  const selectedBundles = (data.data || [])
    .filter((item) => selectedOptions.includes(item.id))
    .map((bundle) => ({
      id: String(bundle.id),
      name: bundle.name,
      code: bundle.code || "",
    }));

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Bundle Management</h2>
        <p className="text-sm text-gray-600">
          Create bundle products with multiple items and automatic discounts.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search bundles..."
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
                  onChange={(e) => setFilters({ status: e.target.value })}
                >
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>
                  Reset
                </button>
                <button className="btn h-10 min-h-10" onClick={handleSearch}>
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Bundle List</h5>
          <div className="flex items-center gap-2">
            <button onClick={exportToExcel} className="btn btn-outline btn-success">
              <FaFileExcel />
            </button>
            <button onClick={copyToClipboard} className="btn btn-outline btn-info">
              <PiCopy size={18} />
            </button>
            <button
              onClick={() => setIsBarcodeSheetOpen(true)}
              className="btn btn-outline btn-secondary"
              disabled={selectedBundles.length === 0}
            >
              <PiPrinter size={18} />
              Barcode Print
            </button>
            {hasPermission("product-setup.create") && (
              <button
                className="btn btn-outline btn-primary"
                onClick={() => {
                  setIsEdit(false);
                  setEditableData(null);
                  setErrorMessage("");
                  setIsSuccess(false);
                  setIsDrawerOpen(true);
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
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        checked={isAllSelectedOnCurrentPage()}
                      />
                    </th>
                    <th className="w-3/12">Name</th>
                    <th className="w-2/12">Barcode</th>
                    <th className="w-4/12">Products</th>
                    <th className="w-1.5/12">Discount</th>
                    <th className="w-1.5/12">Bundle Price</th>
                    <th className="w-1/12">Status</th>
                    <th className="w-1/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.length > 0 ? (
                    data.data.map((bundle) => (
                      <tr
                        key={bundle.id}
                        className={`hover ${selectedOptions.includes(bundle.id) ? "bg-blue-100" : ""}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            onChange={() => handleSelect(bundle.id)}
                            checked={selectedOptions.includes(bundle.id)}
                          />
                        </td>
                        <td className="font-semibold">{bundle.name}</td>
                        <td className="text-xs text-blue-600 font-medium">{bundle.code}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            {(bundle.products || []).map((product, index) => (
                              <span key={`${bundle.id}-${product.product_id}-${index}`} className="text-sm">
                                {product.product_name} x{product.quantity}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          {bundle.discount_type === "percentage"
                            ? `${Number(bundle.discount_value || 0).toFixed(2)}%`
                            : Number(bundle.discount_value || 0).toFixed(2)}
                        </td>
                        <td>{Number(bundle.bundle_price || 0).toFixed(2)}</td>
                        <td>
                          <span
                            className={`badge ${
                              bundle.is_active ? "badge-success" : "badge-warning"
                            }`}
                          >
                            {bundle.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            {hasPermission("product-setup.edit") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => handleEdit(bundle.id)}
                              >
                                <PiNotePencil fontSize={16} />
                              </button>
                            )}
                            {hasPermission("product-setup.edit") && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                onClick={() => handleDelete(bundle)}
                              >
                                <PiTrash fontSize={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center pt-4 pb-4">
                        No Bundles Found
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

      <BundleAddEditModal
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setErrorMessage("");
        }}
        isEdit={isEdit}
        editableData={editableData}
        onSubmit={handleAddOrEdit}
        errorMessage={errorMessage}
        isSuccess={isSuccess}
        onClearError={setErrorMessage}
        onSuccessReset={setIsSuccess}
        products={products}
      />
      <PrintableBarcodeSheet
        open={isBarcodeSheetOpen}
        onClose={() => {
          setIsBarcodeSheetOpen(false);
          clearSelection();
        }}
        products={selectedBundles}
      />
    </div>
  );
}

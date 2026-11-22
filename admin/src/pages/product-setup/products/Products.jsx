import React, { useCallback, useEffect, useState, useRef } from "react";
import { CiSearch } from "react-icons/ci";
import {
  PiCopy,
  PiMicrosoftExcelLogoFill,
  PiPlus,
  PiPrinter,
  PiSliders,
  PiTrash,
  PiNotePencil,
  PiEyeFill,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import TableLoading from "../../../components/loadings/TableLoading";
import {
  deleteProduct,
  fetchProductOptions,
  fetchingProducts,
  updateProductStatus,
} from "../../../api/products";
import { getBrands } from "../../../api/brand";
import { getCategories } from "../../../api/category";
import { getproductSettings } from "../../../api/productSettings";
import Pagination from "../../../components/common/Pagination";
import ProductModal from "./components/ProductModal";
import EditProductModal from "./components/EditProductModal";
import { showModal } from "../../../hooks/modalConfig";
import useSelectableList from "../../../hooks/useSelectableList";
import { useForm, Controller } from "react-hook-form";
import { hasPermission } from "../../../utils/permissions";
import noImage from "../../../../public/images/no-images/no-img.jpg";
import PrintableBarcodeSheet from "../../../components/printable-invoices/PrintableBarcodeSheet";
import { getDemandTag, normalizeDemandTags } from "../../../utils/demandTags";

const Products = () => {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [data, setData] = useState({ data: [], meta: {} });
  const [categories, setCategories] = useState({ data: [], meta: {} });
  const [brands, setBrands] = useState({ data: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isEdit, setIsEdit] = useState(false);
  const [editableData, setEditableData] = useState(null);
  const [mode, setMode] = useState(false);
  const [viewInStep, setViewInStep] = useState(false);
  const [isBarcodeFeatureEnabled, setIsBarcodeFeatureEnabled] = useState(true);
  const [isBarcodeSheetOpen, setIsBarcodeSheetOpen] = useState(false);
  const [demandTagOptions, setDemandTagOptions] = useState([]);
  const [isDrawer] = useState(true);
  const dropdownRef = useRef(null);
  const debounceTimeout = useRef(null);

  const { control, watch, setValue, handleSubmit } = useForm({
    defaultValues: {
      search: "",
      status: "",
      category: "",
      brand: "",
      demand_tag: "",
    },
  });

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(data?.data || []);

  // Debounced search handler
  const handleSearchInput = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      setCurrentPage(1);
      setLoadData(true);
      setIsAdvancedOpen(false);
    }, 500);
  }, []);

  // Fetch Products
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        perPage,
        status: watch().status,
        search: watch().search.trim(),
        sortField,
        sortOrder,
        page: currentPage,
        category: watch().category,
        brand: watch().brand,
        demand_tag: watch().demand_tag,
      };
      const result = await fetchingProducts(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch products");
      }
      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch products error:", error);
      toast.error(error.message || "Failed to load products", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, perPage, currentPage, sortField, sortOrder, watch]);

  // Fetch Product Settings
  const fetchSettings = useCallback(async () => {
    try {
      const result = await getproductSettings(accessToken);
      const options = await fetchProductOptions(accessToken);
      setViewInStep(Boolean(result?.data?.is_product_modal_in_step));
      const assignedPreferences = result?.data?.preferences || [];
      const barcodePreference = assignedPreferences.find(
        (preference) => preference.code === "ftr_product_barcode"
      );
      const barcodeEnabledFromPreference = !!barcodePreference?.is_active;
      const barcodeEnabledFromLegacy = Boolean(result?.data?.has_barcode);
      setIsBarcodeFeatureEnabled(
        barcodePreference ? barcodeEnabledFromPreference : barcodeEnabledFromLegacy
      );
      setDemandTagOptions(Array.isArray(options?.data?.demand_tags) ? options.data.demand_tags : []);
    } catch (error) {
      console.error("Fetch settings error:", error);
      setIsBarcodeFeatureEnabled(false);
      toast.error(error.message || "Failed to load settings", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken]);

  // Fetch Categories
  const fetchCategoriesData = useCallback(async () => {
    try {
      const params = { perPage: 100, status: "1" };
      const result = await getCategories(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch categories");
      }
      setCategories({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch categories error:", error);
      toast.error(error.message || "Failed to load categories", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken]);

  // Fetch Brands
  const fetchBrandsData = useCallback(async () => {
    try {
      const params = { perPage: 100, status: "1" };
      const result = await getBrands(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch brands");
      }
      setBrands({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch brands error:", error);
      toast.error(error.message || "Failed to load brands", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken]);

  // Export to Excel
  const exportToExcel = useCallback(() => {
    try {
      const exportData =
        selectedOptions.length > 0
          ? data.data.filter((item) =>
            selectedOptions.some((option) => option.id === item.id)
          )
          : data.data;

      // Define headers exactly as in your table/export
      const headers = [
        "Name",
        "Code",
        "Type",
        "Price",
        "Category",
        "Brand",
        "Demand Tags",
        "Stock",
        "Status",
      ];

      // Map data to rows
      const rows = exportData.map((item) => [
        item.name || "N/A",
        item.code || "N/A",
        item.has_variant === 1 ? "Variant" : "Simple",
        Number(item.price || 0).toFixed(2),
        item.category || "N/A",
        item.brand || "N/A",
        normalizeDemandTags(item.demand_tags).map((tag) => getDemandTag(tag).label).join(" | ") || "N/A",
        item.total_quantity || 0,
        item.status === 1 ? "Active" : "Inactive",
      ]);

      // Create CSV content
      const csvContent = [headers, ...rows]
        .map((row) =>
          row
            .map((cell) =>
              typeof cell === "string" && cell.includes(",")
                ? `"${cell.replace(/"/g, '""')}"`
                : cell
            )
            .join(",")
        )
        .join("\n");

      // Create and trigger download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "products_export.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // toast.success("Products exported successfully!", {
      //   className: "alert alert-success",
      //   bodyClassName: "text-sm",
      //   progressClassName: "bg-success",
      // });
    } catch (error) {
      console.error("Export to CSV error:", error);
      toast.error("Failed to export products", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [data.data, selectedOptions]);

  // Copy to Clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      const exportData =
        selectedOptions.length > 0
          ? data.data.filter((item) =>
            selectedOptions.some((option) => option.id === item.id)
          )
          : data.data;
      const text = exportData
        .map(
          (item) =>
            `${item.name || ""},${item.code || ""},${item.has_variant === 1 ? "Variant" : "Simple"
            },${Number(item.price || 0).toFixed(2)},${item.category || ""},${item.brand || ""
            },${normalizeDemandTags(item.demand_tags).map((tag) => getDemandTag(tag).label).join(" | ")},${item.total_quantity || 0},${item.status === 1 ? "Active" : "Inactive"
            }`
        )
        .join("\n");
      const clipboardText = `Name,Code,Type,Price,Category,Brand,Demand Tags,Stock,Status\n${text}`;
      await navigator.clipboard.writeText(clipboardText);
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
  }, [data.data, selectedOptions]);

  // Handle single product deletion
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        const response = await deleteProduct(accessToken, id);
        if (!response.status) {
          throw new Error(response?.message || "Failed to delete product");
        }
        Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Product has been deleted.",
          showConfirmButton: false,
          timer: 1500,
        });
        setLoadData(true);
      } catch (error) {
        console.error("Delete product error:", error);
        Swal.fire({
          icon: "error",
          title: "Error!",
          text: error.message || "Failed to delete product",
        });
      }
    }
  };

  const handleStatusToggle = async (product) => {
    const newStatus = product.status === 1 ? 0 : 1;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${newStatus === 1 ? "Active" : "Inactive"
        } for product "${product.name}"?`,
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
      const response = await updateProductStatus(accessToken, product.id, {
        status: newStatus,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update status");
      }
      toast.success(
        `Product status updated to ${newStatus === 1 ? "Active" : "Inactive"}`,
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
      toast.warning("Please select at least one product to update", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${status === 1 ? "Active" : "Inactive"} for ${selectedOptions.length
        } selected products?`,
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
      const response = await updateProductStatus(accessToken, selectedOptions, {
        status,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update statuses");
      }
      toast.success(
        `Selected products updated to ${status === 1 ? "Active" : "Inactive"}`,
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
  // Handle bulk product deletion
  const handleBulkDelete = async () => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one product to delete", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} product(s)!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete them!",
    });

    if (result.isConfirmed) {
      try {
        const response = await deleteProduct(accessToken, selectedOptions);
        if (!response.status) {
          throw new Error(response?.message || "Failed to delete products");
        }
        Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Selected products have been deleted.",
          showConfirmButton: false,
          timer: 1500,
        });
        setLoadData(true);
        clearSelection();
      } catch (error) {
        console.error("Bulk delete error:", error);
        Swal.fire({
          icon: "error",
          title: "Error!",
          text: error.message || "Failed to delete products",
        });
      }
    }
  };

  // Handle column sorting
  const handleSort = useCallback(
    (field) => {
      setSortField(field);
      setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
      setCurrentPage(1);
      setLoadData(true);
    },
    [sortField, sortOrder]
  );

  // Reset filters
  const resetFilters = useCallback(() => {
    setValue("search", "");
    setValue("status", "");
    setValue("category", "");
    setValue("brand", "");
    setValue("demand_tag", "");
    setCurrentPage(1);
    setSortField("created_at");
    setSortOrder("desc");
    setLoadData(true);
  }, [setValue]);

  // Pagination handlers
  const handleNextPage = useCallback(() => {
    if (currentPage < (data.meta.last_page || 1)) {
      setCurrentPage((prev) => prev + 1);
      setLoadData(true);
    }
  }, [currentPage, data.meta.last_page]);

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      setLoadData(true);
    }
  }, [currentPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    setLoadData(true);
  }, []);

  // Handle filter submit
  const onFilterSubmit = useCallback(() => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  }, []);

  const selectedProducts = data.data.filter((item) =>
    selectedOptions.includes(item.id)
  );

  // Fetch data on load or when loadData changes
  useEffect(() => {
    if (loadData) {
      fetchData();
    }
  }, [fetchData, loadData]);

  // Fetch settings, categories, and brands on mount
  useEffect(() => {
    fetchSettings();
    fetchCategoriesData();
    fetchBrandsData();
  }, [fetchSettings, fetchCategoriesData, fetchBrandsData]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (watch().search.trim()) {
        handleSearchInput();
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [watch().search, handleSearchInput]);

  // Click outside to close advanced filters
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

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Product List</h2>
        <p className="text-sm text-gray-600">
          Manage your products from this page. Use filters to narrow down
          results or add a new product.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={dropdownRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <Controller
                control={control}
                name="search"
                render={({ field }) => (
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="input w-full pr-16 focus:outline-none focus:border-none"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={handleSearchInput}
                >
                  <CiSearch fontSize={20} />
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
                  <span className="label-text">Category</span>
                </label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <select
                      className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="">All Categories</option>
                      {categories.data.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.title}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Brand</span>
                </label>
                <Controller
                  control={control}
                  name="brand"
                  render={({ field }) => (
                    <select
                      className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="">All Brands</option>
                      {brands.data.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.title}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <select
                      className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="">All Statuses</option>
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  )}
                />
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Demand Tag</span>
                </label>
                <Controller
                  control={control}
                  name="demand_tag"
                  render={({ field }) => (
                    <select
                      className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="">All Demand Tags</option>
                      {demandTagOptions.map((tag) => (
                        <option key={tag.value} value={tag.value}>
                          {tag.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div className="w-full flex justify-end gap-2">
                <button
                  className="btn btn-error btn-outline h-10 min-h-10"
                  onClick={resetFilters}
                >
                  Reset
                </button>
                <button
                  className="btn h-10 min-h-10"
                  onClick={handleSubmit(onFilterSubmit)}
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
          <h5 className="font-semibold text-custom-gray-400">Product List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <>
                {hasPermission("product.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(1)}
                    className="btn btn-outline btn-success"
                  >
                    Set Active
                  </button>
                )}
                {hasPermission("product.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(0)}
                    className="btn btn-outline btn-warning"
                  >
                    Set Inactive
                  </button>
                )}
                {hasPermission("product.delete") &&
                  selectedOptions.length > 0 && (
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
              title="Export to Excel"
            >
              <PiMicrosoftExcelLogoFill size={20} />
            </button>
            <button
              onClick={copyToClipboard}
              className="btn btn-outline btn-info"
              title="Copy to Clipboard"
            >
              <PiCopy size={20} />
            </button>
            {isBarcodeFeatureEnabled && (
              <button
                onClick={() => setIsBarcodeSheetOpen(true)}
                className="btn btn-outline btn-secondary"
                title="Print Barcode Sheet"
                disabled={selectedProducts.length === 0}
              >
                <PiPrinter size={20} />
                Barcode Print
              </button>
            )}
            {hasPermission("product.create") && (
              <button
                onClick={() => {
                  setIsEdit(false);
                  setEditableData(null);
                  if (isDrawer) {
                    document.getElementById("product-drawer").checked = true;
                  } else {
                    showModal("product_modal");
                  }
                }}
                className="btn btn-outline btn-primary"
              >
                <PiPlus className="" />
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
                      className="w-2.5/12 cursor-pointer"
                      onClick={() => handleSort("name")}
                    >
                      Product{" "}
                      {sortField === "name" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("has_variant")}
                    >
                      Type{" "}
                      {sortField === "has_variant" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-1.5/12">Variants</th>
                    {/* <th
                      className="w-1/12"
                    >
                      Price
                    </th> */}
                    <th className="w-1.5/12">Category</th>
                    <th className="w-1.5/12">Brand</th>
                    <th className="w-1/12 ">Stock</th>
                    <th
                      className="w-2/12 cursor-pointer"
                      onClick={() => handleSort("status")}
                    >
                      Status{" "}
                      {sortField === "status" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.length ? (
                    data.data.map((product) => (
                      <tr
                        key={product.id}
                        className={`hover ${selectedOptions.includes(product.id)
                            ? "bg-blue-100"
                            : ""
                          }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(product)}
                              checked={selectedOptions.includes(product.id)}
                            />
                          </label>
                        </th>
                        <td className="w-2.5/12">
                          <div className="flex items-center space-x-4">
                            <div className="avatar">
                              <div className="w-8 h-10 rounded">
                                <img
                                  src={product.thumbnail || noImage }
                                  alt={product.name || "Product"}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {product.name || "N/A"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {product.code || "N/A"}
                              </p>
                              {normalizeDemandTags(product.demand_tags).length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {normalizeDemandTags(product.demand_tags).map((tag) => {
                                    const demandTag = getDemandTag(tag);
                                    return (
                                      <span
                                        key={tag}
                                        className={`rounded border px-1.5 py-0.5 text-[11px] leading-tight ${demandTag.className}`}
                                      >
                                        {demandTag.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="w-1/12">
                          <div
                            className={`badge badge-outline ${product.has_variant === 1
                                ? "badge-primary"
                                : "badge-info"
                              }`}
                          >
                            {product.has_variant === 1 ? "Variant" : "Simple"}
                          </div>
                        </td>
                        <td className="w-1/12">{product.variants_display}</td>
                        {/* <td className="w-1/12">
                          ${Number(product.price || 0).toFixed(2)}
                        </td> */}
                        <td className="w-1.5/12">
                          {product.category || "N/A"}
                        </td>
                        <td className="w-1.5/12">{product.brand || "N/A"}</td>
                        <td className="w-1/12">
                          {product.total_quantity || 0}
                        </td>
                        <td className="w-1/12">
                          {hasPermission("product.edit") && (
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={product.status === 1}
                              onChange={() => handleStatusToggle(product)}
                            />
                          )}
                        </td>
                        <td className="w-1/12">
                          <div className="flex items-center justify-center gap-2">
                            {/* {hasPermission("product.view") && (
                              <button
                                className="btn btn-sm border-none bg-info/10 text-info hover:bg-info/20"
                                title="View"
                                onClick={() => {
                                  setMode(true);
                                  setEditableData(product);
                                  if (isDrawer) {
                                    document.getElementById(
                                      "edit_product_drawer"
                                    ).checked = true;
                                  } else {
                                    showModal("edit_product_modal");
                                  }
                                }}
                              >
                                <PiEyeFill fontSize={16} />
                              </button>
                            )} */}
                            {hasPermission("product.edit") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                title="Edit"
                                onClick={() => {
                                  setMode(false);
                                  setEditableData(product);
                                  if (isDrawer) {
                                    document.getElementById(
                                      "edit_product_drawer"
                                    ).checked = true;
                                  } else {
                                    showModal("edit_product_modal");
                                  }
                                }}
                              >
                                <PiNotePencil fontSize={16} />
                              </button>
                            )}
                            {hasPermission("product.delete") && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                title="Delete"
                                onClick={() => handleDelete(product.id)}
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
                      <td colSpan="8" className="text-center pt-4 pb-4">
                        No products found
                      </td>
                    </tr>
                  )}
                  {data?.data?.length > 0 && (
                    <tr className="bg-gray-100 font-semibold">
                      <td colSpan="6" className="text-right">
                        Totals:
                      </td>
                      <td>
                        {data.data.reduce(
                          (acc, item) =>
                            acc + (Number(item.total_quantity) || 0),
                          0
                        )}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data?.data?.length > 0 && (
                <Pagination
                  currentPage={data?.meta?.current_page || 1}
                  lastPage={data?.meta?.last_page || 1}
                  handlePrevious={handlePrevious}
                  handlePageChange={handlePageChange}
                  handleNextPage={handleNextPage}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < (data?.meta?.last_page || 1)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <ProductModal
        fetchData={fetchData}
        viewInStep={viewInStep}
        isDrawer={isDrawer}
      />
      <EditProductModal
        editableData={editableData}
        setEditableData={setEditableData}
        fetchData={fetchData}
        viewInStep={viewInStep}
        mode={mode}
      />
      <PrintableBarcodeSheet
        open={isBarcodeSheetOpen}
        onClose={() => setIsBarcodeSheetOpen(false)}
        products={selectedProducts}
      />
    </div>
  );
};

export default Products;

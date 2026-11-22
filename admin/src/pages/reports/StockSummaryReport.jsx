import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FaFileExcel } from "react-icons/fa";
import {
  PiCopy,
  PiMagnifyingGlass,
  PiSliders,
  PiCube,
  PiWarehouse,
  PiTag,
  PiTrendUp,
  PiCheckCircle,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { getStockOverview } from "../../api/purchase";
import { getSuppliers } from "../../api/supplier";
import { fetchProductOptions } from "../../api/products";
import useSelectableList from "../../hooks/useSelectableList";
import { getWarehouse } from "../../api/warehouse";
import { formatPrice } from "../../hooks/currency";

const emptyFilters = {
  category: "",
  brand: "",
  warehouse: "",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const toNumber = (value) => Number(value) || 0;

export default function StockSummaryReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState(emptyFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, others: {} });
  const [categoryList, setCategoryList] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [warehouseList, setWarehouseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const filterRef = useRef(null);

  const { selectedOptions } = useSelectableList(data.data);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        perPage,
        page: currentPage,
        search: searchQuery,
        sortField,
        sortOrder,
        category: filters.category,
        brand: filters.brand,
        warehouse: filters.warehouse,
      };

      const result = await getStockOverview(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch stock data");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
        others: result.others_data || {},
      });
    } catch (error) {
      toast.error(error.message || "Error loading stock data", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, filters, perPage, searchQuery, sortField, sortOrder]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [, filterOptions, warehouseRes] = await Promise.all([
        getSuppliers(accessToken, { perPage: 100 }),
        fetchProductOptions(accessToken),
        getWarehouse(accessToken, { perPage: 100, status: "1" }),
      ]);

      if (filterOptions?.data) {
        setCategoryList(filterOptions.data.categories || []);
        setBrandList(filterOptions.data.brands || []);
      } else {
        toast.error("Failed to load filter dependencies", {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        });
      }

      if (warehouseRes?.status) {
        setWarehouseList(warehouseRes.data || []);
      } else {
        toast.error("Failed to load warehouses", {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching filter options", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleSort = (field) => {
    const nextOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(nextOrder);
    setLoadData(true);
  };

  const exportToExcel = () => {
    if (data.data.length === 0) {
      toast.warning("No data to export", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;

    if (exportData.length === 0) {
      toast.warning("No items selected to export", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const headers = [
      "Lot Number",
      "Product",
      "Category",
      "Brand",
      "Warehouse",
      "Stock Group",
      "In Stock",
      "Purchase Price",
      "Selling Price",
    ];

    const rows = exportData.map((item) => [
      item.batch_no,
      item.product_info?.name || "",
      item.category || "",
      item.brand || "",
      item.warehouse || "",
      item.stock_group || "",
      item.total_qty || 0,
      item.purchase_price || 0,
      item.selling_price || 0,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Stock.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    if (data.data.length === 0) {
      toast.warning("No data to copy", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;

    if (exportData.length === 0) {
      toast.warning("No items selected to copy", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    try {
      const text = exportData
        .map(
          (item) =>
            `${item.batch_no || ""},${item.product_info?.name || ""},${item.category || ""},${item.brand || ""},${item.warehouse || ""},${item.stock_group || ""},${item.total_qty || 0},${item.purchase_price || 0},${item.selling_price || 0}`
        )
        .join("\n");
      const clipboardText = `Lot Number,Product,Category,Brand,Warehouse,Stock Group,In Stock,Purchase Price,Selling Price\n${text}`;

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
    setCurrentPage((prev) => Math.max(1, prev - 1));
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
    setFilters(emptyFilters);
    setSearchQuery("");
    setSortField("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const totalQuantity = data.data.reduce(
    (sum, item) => sum + toNumber(item.total_qty),
    0
  );
  const totalPurchasePrice = data.data.reduce(
    (sum, item) => sum + toNumber(item.purchase_price) * toNumber(item.total_qty),
    0
  );
  const totalSellingPrice = data.data.reduce(
    (sum, item) => sum + toNumber(item.selling_price) * toNumber(item.total_qty),
    0
  );
  const totalRecords = data?.meta?.total || data.data.length;
  const totalSelected = selectedOptions.length;
  const hasActiveFilters =
    searchQuery.trim() ||
    filters.category ||
    filters.brand ||
    filters.warehouse;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiCube size={14} />
              Stock Report
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Stock summary
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review inventory by product, category, brand, and warehouse with
              export and copy actions built in.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  hasActiveFilters ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              {hasActiveFilters ? "Filters active" : "No filters applied"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[760px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Products
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalRecords.toLocaleString()}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Selected
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalSelected.toLocaleString()}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Quantity
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalQuantity.toLocaleString()}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Purchase value
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPrice(totalPurchasePrice)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-blue-50 p-2 text-blue-600">
              <PiTrendUp size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Selling value
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(totalSellingPrice)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Total selling value across visible rows
            </p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-emerald-50 p-2 text-emerald-600">
              <PiWarehouse size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Warehouse
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {filters.warehouse
                ? warehouseList.find((w) => String(w.id) === String(filters.warehouse))
                    ?.name || "Selected warehouse"
                : "All warehouses"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current warehouse filter</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-sky-50 p-2 text-sky-600">
              <PiTag size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Category
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {filters.category
                ? categoryList.find((c) => String(c.id) === String(filters.category))
                    ?.title || "Selected category"
                : "All categories"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current category filter</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-amber-50 p-2 text-amber-600">
              <PiCheckCircle size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Sort
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {sortField === "product_id" ? "Product" : "Purchase price"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {sortOrder === "asc" ? "Ascending order" : "Descending order"}
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div
            ref={filterRef}
            className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search products
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                    aria-label="Search"
                  >
                    <PiMagnifyingGlass size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen((prev) => !prev)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                      isAdvancedOpen
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                    }`}
                    aria-label="Toggle advanced filters"
                  >
                    <PiSliders size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:pt-7">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSearch}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(37,99,235,0.18)] transition hover:translate-y-[-1px] hover:from-blue-700 hover:to-indigo-700"
              >
                Search
              </button>
            </div>

            {isAdvancedOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.category}
                      onChange={(e) => handleFilterChange("category", e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categoryList.map((c) => (
                        <option key={c?.id} value={c?.id}>
                          {c?.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Brand
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.brand}
                      onChange={(e) => handleFilterChange("brand", e.target.value)}
                    >
                      <option value="">All Brands</option>
                      {brandList.map((b) => (
                        <option key={b?.id} value={b?.id}>
                          {b?.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Warehouse
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.warehouse}
                      onChange={(e) => handleFilterChange("warehouse", e.target.value)}
                    >
                      <option value="">All Warehouses</option>
                      {warehouseList.map((w) => (
                        <option key={w?.id} value={w?.id}>
                          {w?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen(false)}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onFilterSubmit}
                    className="inline-flex h-10 items-center rounded-xl border-0 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Apply filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h5 className="text-lg font-bold tracking-tight text-slate-950">
                Stock list
              </h5>
              <p className="mt-1 text-sm text-slate-500">
                Use sorting, pagination, export, or copy actions for the current
                dataset.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportToExcel}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              >
                <FaFileExcel />
                Export
              </button>
              <button
                type="button"
                onClick={copyToClipboard}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
              >
                <PiCopy size={18} />
                Copy
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableLoading />
            ) : (
              <>
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 first:rounded-l-xl">
                        Product
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Variant
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Lot number
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Category
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Brand
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Warehouse
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                        In stock
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("purchase_price")}
                      >
                        Purchase price
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right last:rounded-r-xl">
                        Selling price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data?.length > 0 ? (
                      <>
                        {data.data.map((item) => (
                          <tr
                            key={item.id}
                            className={`transition ${
                              selectedOptions.includes(item.id)
                                ? "bg-blue-50/70"
                                : "bg-white hover:bg-slate-50/70"
                            }`}
                          >
                            <td className="border-b border-slate-100 px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                  <img
                                    src={item.product_info?.thumbnail}
                                    alt={item.product_info?.name}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {item.product_info?.name}
                                  </p>
                                  <p className="text-xs text-sky-600">
                                    {item.product_info?.barcode}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              {item.variant || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              <span className="font-medium text-blue-600">
                                {item.lots && item.lots.length > 0
                                  ? `#${item.lots.join(", ")}`
                                  : "N/A"}
                              </span>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              {item.category || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              {item.brand || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              {item.warehouse || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {toNumber(item.total_qty).toLocaleString()}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {formatPrice(item.purchase_price)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {formatPrice(item.selling_price)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50">
                          <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                            Total stock
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            Page summary
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totalPurchasePrice)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {totalQuantity.toLocaleString()}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totalPurchasePrice)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totalSellingPrice)}
                          </td>
                        </tr>
                        <tr className="bg-slate-900 text-white">
                          <td className="px-4 py-4 text-sm font-semibold">
                            Grand total
                          </td>
                          <td className="px-4 py-4 text-sm" colSpan={5}>
                            {toNumber(data?.others?.grand_total_qty).toLocaleString()} units
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            {toNumber(data?.others?.grand_total_qty).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            {formatPrice(data?.others?.grand_total_purchase_price || 0)}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            {formatPrice(data?.others?.grand_total_selling_price || 0)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center">
                          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8">
                            <p className="text-sm font-semibold text-slate-700">
                              No products found
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Try a different search or adjust the filters.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {data?.data?.length > 0 && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <Pagination
                      currentPage={data?.meta?.current_page}
                      lastPage={data?.meta?.last_page}
                      handlePrevious={handlePrevious}
                      handlePageChange={handlePageChange}
                      handleNextPage={handleNextPage}
                      showPrevious={currentPage > 1}
                      showNext={currentPage < data?.meta?.last_page}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

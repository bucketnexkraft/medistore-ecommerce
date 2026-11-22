import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useSelector } from "react-redux";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "react-toastify";
import { FaFileExcel } from "react-icons/fa";
import {
  PiChartBar,
  PiCheckCircle,
  PiCube,
  PiFunnel,
  PiMagnifyingGlass,
  PiWarehouse,
  PiX,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { getWarehouse } from "../../api/warehouse";
import { formatPrice } from "../../hooks/currency";
import { getStockByCategory } from "../../api/report";
import { fetchProductOptions } from "../../api/products";

const emptyFilters = {
  warehouse: "",
  dateRange: [null, null],
  category: "",
  include_child_categories: false,
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const toNumber = (value) => Number(value) || 0;

export default function CategorywiseStock() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState(emptyFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, others: {} });
  const [warehouseList, setWarehouseList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);
  const filterRef = useRef(null);

  const { control, handleSubmit, reset, setValue } = useForm({
    defaultValues: emptyFilters,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dateFrom, dateTo] = filters.dateRange || [null, null];
      const params = {
        perPage,
        page: currentPage,
        search: searchQuery,
        warehouse: filters.warehouse,
        date_from: dateFrom ? dateFrom.toISOString().split("T")[0] : "",
        date_to: dateTo ? dateTo.toISOString().split("T")[0] : "",
        category: filters.category,
        include_child_categories: filters.include_child_categories ? 1 : 0,
        groupBy: "category",
      };

      const result = await getStockByCategory(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch stock data");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
        others: result.others || {},
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
  }, [accessToken, currentPage, filters, perPage, searchQuery]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [warehouseRes, filterOptions] = await Promise.all([
        getWarehouse(accessToken, { perPage: 100, status: "1" }),
        fetchProductOptions(accessToken),
      ]);

      if (warehouseRes?.status) {
        setWarehouseList(warehouseRes.data || []);
      } else {
        toast.error("Failed to load warehouses", {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        });
      }

      if (filterOptions?.status) {
        setCategoryList(filterOptions.data.categories || []);
      } else {
        toast.error("Failed to load categories", {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        });
      }
    } catch {
      toast.error("Error fetching initial data", {
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

  const exportToExcel = () => {
    if (!data.data || data.data.length === 0) {
      toast.warning("No data to export", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const headers = [
      "Category",
      "Number of Products",
      "Stock Quantity",
      "Purchase Price",
      "Selling Price",
    ];

    const rows = data.data.map((item) => [
      item.category || "",
      item.product_count || 0,
      item.total_qty || 0,
      item.purchase_price || 0,
      item.selling_price || 0,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "CategorywiseStock.csv";
    link.click();
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

  const onFilterSubmit = handleSubmit(() => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  });

  const resetFilters = () => {
    setFilters(emptyFilters);
    reset(emptyFilters);
    setSearchQuery("");
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setValue(key, value);
  };

  const totalProducts = (data.data || []).reduce(
    (sum, item) => sum + toNumber(item.product_count),
    0
  );
  const totalQuantity = (data.data || []).reduce(
    (sum, item) => sum + toNumber(item.total_qty),
    0
  );
  const totalPurchasePrice = (data.data || []).reduce(
    (sum, item) => sum + toNumber(item.purchase_price),
    0
  );
  const activeRows = (data.data || []).filter(
    (item) => toNumber(item.product_count) > 0 || toNumber(item.total_qty) > 0
  );
  const averagePurchaseValue =
    activeRows.length > 0 ? totalPurchasePrice / activeRows.length : 0;
  const totalCategories = data?.meta?.total || data?.others?.total_category || 0;
  const activeCategoryName = categoryList.find(
    (cat) => String(cat.id) === String(filters.category)
  )?.title;
  const activeWarehouseName = warehouseList.find(
    (warehouse) => String(warehouse.id) === String(filters.warehouse)
  )?.name;

  const hasActiveFilters =
    searchQuery.trim() ||
    filters.warehouse ||
    filters.category ||
    filters.include_child_categories ||
    (filters.dateRange && (filters.dateRange[0] || filters.dateRange[1]));

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiCube size={14} />
              Stock Reports
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Stock by category
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review category-level inventory with filters for warehouse, date
              range, and child categories.
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

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[440px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Categories
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalCategories.toLocaleString()}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Products
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalProducts.toLocaleString()}
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
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-blue-50 p-2 text-blue-600">
              <PiChartBar size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Page purchase total
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(totalPurchasePrice)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Aggregated from the current page rows
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
              {activeWarehouseName || "All warehouses"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current warehouse filter</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-sky-50 p-2 text-sky-600">
              <PiFunnel size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Category
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {activeCategoryName || "All categories"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current category filter</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-amber-50 p-2 text-amber-600">
              <PiCheckCircle size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Average price
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {formatPrice(averagePurchaseValue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Average purchase value per active category
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div ref={filterRef} className="relative">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search categories
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search categories..."
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
                      <PiFunnel size={18} />
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
                  <PiX size={16} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onFilterSubmit}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(37,99,235,0.18)] transition hover:translate-y-[-1px] hover:from-blue-700 hover:to-indigo-700"
                >
                  Search
                </button>
              </div>
            </div>

            {isAdvancedOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date range
                    </label>
                    <Controller
                      control={control}
                      name="dateRange"
                      render={({ field }) => (
                        <DatePicker
                          selectsRange
                          startDate={field.value?.[0]}
                          endDate={field.value?.[1]}
                          onChange={(dates) => {
                            field.onChange(dates);
                            handleFilterChange("dateRange", dates);
                          }}
                          placeholderText="Select date range"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                          isClearable
                        />
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Warehouse
                    </label>
                    <Controller
                      control={control}
                      name="warehouse"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                          value={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            handleFilterChange("warehouse", e.target.value);
                          }}
                        >
                          <option value="">All Warehouses</option>
                          {warehouseList.map((warehouse) => (
                            <option key={warehouse?.id} value={warehouse?.id}>
                              {warehouse?.name}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </label>
                    <Controller
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                          value={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            handleFilterChange("category", e.target.value);
                          }}
                        >
                          <option value="">All Categories</option>
                          {categoryList.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.title}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">
                          Include child categories
                        </span>
                        <span className="block text-xs text-slate-500">
                          Include nested categories in the result set
                        </span>
                      </span>
                      <Controller
                        control={control}
                        name="include_child_categories"
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={field.value}
                            onChange={(e) => {
                              field.onChange(e);
                              handleFilterChange(
                                "include_child_categories",
                                e.target.checked
                              );
                            }}
                          />
                        )}
                      />
                    </label>
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
                Category stock list
              </h5>
              <p className="mt-1 text-sm text-slate-500">
                {loading ? "Loading results..." : "Export or page through the category summary."}
              </p>
            </div>
            <button
              type="button"
              onClick={exportToExcel}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <FaFileExcel />
              Export CSV
            </button>
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
                        Category
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                        Number of products
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                        Stock quantity
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right last:rounded-r-xl">
                        Purchase price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data?.length > 0 ? (
                      <>
                        {data.data.map((item, index) => (
                          <tr
                            key={`${item.category}-${index}`}
                            className="bg-white transition hover:bg-slate-50/80"
                          >
                            <td className="border-b border-slate-100 px-4 py-4">
                              <div className="flex items-center gap-3">
                                <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
                                  <PiCube size={18} />
                                </span>
                                <span className="text-sm font-semibold text-slate-900">
                                  {item.category}
                                </span>
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-medium text-slate-700">
                              {toNumber(item.product_count).toLocaleString()}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-medium text-slate-700">
                              {toNumber(item.total_qty).toLocaleString()}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-950">
                              {formatPrice(item.purchase_price)}
                            </td>
                          </tr>
                        ))}

                        <tr className="bg-slate-50">
                          <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                            Page total
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {totalProducts.toLocaleString()}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {totalQuantity.toLocaleString()}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totalPurchasePrice)}
                          </td>
                        </tr>

                        <tr className="bg-slate-900 text-white">
                          <td className="px-4 py-4 text-sm font-semibold">
                            Grand total
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            {toNumber(data?.others?.total_product_count).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            {toNumber(data?.others?.total_total_qty).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            {formatPrice(data?.others?.total_purchase_price || 0)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center">
                          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8">
                            <p className="text-sm font-semibold text-slate-700">
                              No categories found
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Try adjusting the filters or search term.
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

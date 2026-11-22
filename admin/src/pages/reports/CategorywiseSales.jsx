import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "react-toastify";
import { FaFileExcel } from "react-icons/fa";
import {
  PiCheckCircle,
  PiCoin,
  PiMagnifyingGlass,
  PiMoney,
  PiSliders,
  PiTag,
  PiTrendUp,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { getWarehouse, getPaymentMethods } from "../../api/warehouse";
import { fetchProductOptions } from "../../api/products";
import { formatPrice } from "../../hooks/currency";
import { getSalesByCategory } from "../../api/report";

const initialFilters = {
  warehouse: "",
  dateRange: [null, null],
  category: "",
  include_child_categories: false,
  payment_method: "",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const toNumber = (value) => Number(value) || 0;

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function CategorywiseSales() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState(initialFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, others: {} });
  const [warehouseList, setWarehouseList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [paymentMethodList, setPaymentMethodList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);
  const filterRef = useRef(null);

  const { control, handleSubmit, reset, setValue } = useForm({
    defaultValues: initialFilters,
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
        date_from: formatDate(dateFrom),
        date_to: formatDate(dateTo),
        category: filters.category,
        include_child_categories: filters.include_child_categories ? 1 : 0,
        payment_method: filters.payment_method,
        groupBy: "category",
      };

      const result = await getSalesByCategory(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch sales data");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
        others: result.others || {},
      });
    } catch (error) {
      toast.error(error.message || "Error loading sales data", {
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
      const [warehouseRes, filterOptions, paymentMethodRes] = await Promise.all([
        getWarehouse(accessToken, { perPage: 100, status: "1" }),
        fetchProductOptions(accessToken),
        getPaymentMethods(accessToken),
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

      if (Array.isArray(paymentMethodRes)) {
        setPaymentMethodList(paymentMethodRes.filter((method) => method.enabled).map((method) => method.name));
      } else if (Array.isArray(paymentMethodRes?.data)) {
        setPaymentMethodList(
          paymentMethodRes.data.filter((method) => method.enabled).map((method) => method.name)
        );
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

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setValue(key, value);
  };

  const onFilterSubmit = handleSubmit(() => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  });

  const resetFilters = () => {
    setFilters(initialFilters);
    reset(initialFilters);
    setSearchQuery("");
    setCurrentPage(1);
    setLoadData(true);
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

  const exportToExcel = () => {
    if (data.data.length === 0) {
      toast.warning("No data to export", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const headers = ["Category", "Total Quantity Sold", "Total Sales Amount"];
    const rows = data.data.map((item) => [
      item.category || "",
      item.total_qty_sold || 0,
      item.total_sales || 0,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "CategorywiseSales.csv";
    link.click();
  };

  const totalProducts = data.data.reduce(
    (sum, item) => sum + toNumber(item.product_count),
    0
  );
  const totalQuantitySold = data.data.reduce(
    (sum, item) => sum + toNumber(item.total_qty_sold),
    0
  );
  const totalSalesAmount = data.data.reduce(
    (sum, item) => sum + toNumber(item.total_sales),
    0
  );
  const paymentMethodTotals = data.others?.payment_method_totals || {};
  const paymentMethodEntries = Object.entries(paymentMethodTotals).filter(
    ([, amount]) => Number(amount || 0) > 0
  );
  const totalCategories = data?.meta?.total || data.data.length;
  const totalDiscount = toNumber(data.others?.total_discount);
  const totalVat = toNumber(data.others?.invoice_total_vat);
  const averageCategorySales =
    data.data.length > 0 ? totalSalesAmount / data.data.length : 0;
  const activeWarehouseName = warehouseList.find(
    (warehouse) => String(warehouse.id) === String(filters.warehouse)
  )?.name;
  const activeCategoryName = categoryList.find(
    (category) => String(category.id) === String(filters.category)
  )?.title;
  const activePaymentMethod = filters.payment_method || "All payment methods";
  const hasActiveFilters =
    searchQuery.trim() ||
    filters.warehouse ||
    filters.category ||
    filters.payment_method ||
    filters.include_child_categories ||
    filters.dateRange?.[0] ||
    filters.dateRange?.[1];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiTag size={14} />
              Sales Report
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Sales by category
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review category-level sales with filters for warehouse, date
              range, category hierarchy, and payment method.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  hasActiveFilters ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              {hasActiveFilters ? "Filters active" : "No filters applied"}
            </div>
            {(activeWarehouseName || activeCategoryName) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {activeWarehouseName && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Warehouse: {activeWarehouseName}
                  </span>
                )}
                {activeCategoryName && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Category: {activeCategoryName}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[760px]">
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
                Units sold
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalQuantitySold.toLocaleString()}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Sales value
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPrice(totalSalesAmount)}
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
              Avg category sales
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(averageCategorySales)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Average revenue per visible category
            </p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-emerald-50 p-2 text-emerald-600">
              <PiMoney size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Discount
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(totalDiscount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Invoice discount total</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-sky-50 p-2 text-sky-600">
              <PiCheckCircle size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              VAT
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(totalVat)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Invoice VAT total</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-amber-50 p-2 text-amber-600">
              <PiCoin size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Payment method
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {activePaymentMethod}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current payment filter state</p>
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
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setLoadData(true);
                    }}
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
                  onClick={onFilterSubmit}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(37,99,235,0.18)] transition hover:translate-y-[-1px] hover:from-blue-700 hover:to-indigo-700"
                >
                  Search
                </button>
              </div>
            </div>

            {isAdvancedOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                          startDate={field.value[0]}
                          endDate={field.value[1]}
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

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment method
                    </label>
                    <Controller
                      control={control}
                      name="payment_method"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                          value={field.value}
                          onChange={(e) => {
                            field.onChange(e);
                            handleFilterChange("payment_method", e.target.value);
                          }}
                        >
                          <option value="">All Payment Methods</option>
                          {paymentMethodList.map((pm) => (
                            <option key={pm} value={pm}>
                              {pm}
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
                Category performance
              </h5>
              <p className="mt-1 text-sm text-slate-500">
                Qty: {totalQuantitySold.toLocaleString()} | Discount: {formatPrice(totalDiscount)}
              </p>
            </div>
            <button
              type="button"
              onClick={exportToExcel}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <FaFileExcel />
              Export
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
                        Units sold
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right last:rounded-r-xl">
                        Gross sales
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data?.length > 0 ? (
                      <>
                        {data.data.map((item, index) => (
                          <tr
                            key={`${item.category}-${index}`}
                            className="bg-white transition hover:bg-slate-50/70"
                          >
                            <td className="border-b border-slate-100 px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                                  <PiTag size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {item.category}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {item.product_count || 0} products
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {toNumber(item.total_qty_sold).toLocaleString()}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-950">
                              {formatPrice(item.total_sales)}
                            </td>
                          </tr>
                        ))}

                        <tr className="bg-slate-50">
                          <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                            Page total
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {totalQuantitySold.toLocaleString()}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totalSalesAmount)}
                          </td>
                        </tr>

                        <tr className="bg-slate-900 text-white">
                          <td className="px-4 py-4 text-sm font-semibold">
                            Grand total
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            {toNumber(data.others.total_qty_sold).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold">
                            <div className="space-y-1">
                              <div className="text-sm font-bold">
                                {formatPrice(data.others.total_sales || 0)}
                              </div>
                              <div className="text-[11px] font-normal text-white/70">
                                Invoice discount: {formatPrice(totalDiscount)}
                              </div>
                              <div className="text-[11px] font-normal text-white/70">
                                Invoice VAT: {formatPrice(totalVat)}
                              </div>
                              {paymentMethodEntries.length > 0 && (
                                <div className="pt-1 text-[11px] font-normal text-white/70">
                                  {paymentMethodEntries
                                    .map(
                                      ([method, amount]) =>
                                        `${method}: ${formatPrice(amount)}`
                                    )
                                    .join(" | ")}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center">
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

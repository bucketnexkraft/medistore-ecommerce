import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FaFileExcel } from "react-icons/fa";
import {
  PiChartBar,
  PiCheckCircle,
  PiFunnel,
  PiMagnifyingGlass,
  PiTag,
  PiX,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { getWarehouse, getPaymentMethods } from "../../api/warehouse";
import { fetchProductOptions } from "../../api/products";
import { formatPrice } from "../../hooks/currency";
import { getProfitMarginReport } from "../../api/report";

const emptyFilters = {
  warehouse: "",
  dateRange: [null, null],
  category: "",
  include_child_categories: false,
  payment_method: "",
  groupBy: "category",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toNumber = (value) => Number(value) || 0;

export default function ProfitMarginReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState(emptyFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, others: {} });
  const [warehouseList, setWarehouseList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [paymentMethodList, setPaymentMethodList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
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
        date_from: dateFrom ? formatDate(dateFrom) : "",
        date_to: dateTo ? formatDate(dateTo) : "",
        category: filters.category,
        include_child_categories: filters.include_child_categories ? 1 : 0,
        payment_method: filters.payment_method,
        groupBy: filters.groupBy,
      };

      const result = await getProfitMarginReport(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch profit margin data");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
        others: result.others || {},
      });
    } catch (error) {
      toast.error(error.message || "Error loading profit margin data", {
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
        setPaymentMethodList(paymentMethodRes.filter((method) => method.enabled).map((method) => method.name) || []);
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
    if (data.data.length === 0) {
      toast.warning("No data to export", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const headers = [
      "Category/Product",
      "Total Sales",
      "Total Cost",
      "Profit",
      "Profit On Cost %",
      "Quantity Sold",
    ];

    const rows = data.data.map((item) => [
      item.category || item.product_name || "",
      item.total_sales || 0,
      item.total_cost || 0,
      item.profit || 0,
      item.profit_on_cost_margin || 0,
      item.total_qty_sold || 0,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ProfitMarginReport.csv";
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

  const totalSales = data.data.reduce((sum, item) => sum + toNumber(item.total_sales), 0);
  const totalCost = data.data.reduce((sum, item) => sum + toNumber(item.total_cost), 0);
  const totalProfit = data.data.reduce((sum, item) => sum + toNumber(item.profit), 0);
  const totalQuantitySold = data.data.reduce((sum, item) => sum + toNumber(item.total_qty_sold), 0);

  const hasActiveFilters =
    searchQuery.trim() ||
    filters.warehouse ||
    filters.category ||
    filters.payment_method ||
    filters.groupBy !== "category" ||
    filters.include_child_categories ||
    (filters.dateRange && (filters.dateRange[0] || filters.dateRange[1]));

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <PiChartBar size={14} />
              Profit reports
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Profit margin report
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review sales, cost, profit, and margin performance by category or product with the same search and filter flow as the stock reports.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Sales
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {formatPrice(totalSales)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Current page sales total</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Cost
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {formatPrice(totalCost)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Current page cost total</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Profit
              </p>
              <p className={`mt-2 text-2xl font-bold tracking-tight ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatPrice(totalProfit)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Current page profit total</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Units sold
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {totalQuantitySold.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Sold units in the current page</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div ref={filterRef} className="relative">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search products or categories
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search categories or products..."
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setLoadData(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSearch();
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-emerald-600"
                      aria-label="Search"
                    >
                      <PiMagnifyingGlass size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdvancedOpen((prev) => !prev)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        isAdvancedOpen
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-500 hover:bg-slate-100 hover:text-emerald-600"
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
                  onClick={handleSearch}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Search
                </button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Filters active
              </div>
            )}

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
                          startDate={field.value?.[0]}
                          endDate={field.value?.[1]}
                          onChange={(dates) => {
                            field.onChange(dates);
                            handleFilterChange("dateRange", dates);
                          }}
                          placeholderText="Select date range"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
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
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event);
                            handleFilterChange("warehouse", event.target.value);
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
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event);
                            handleFilterChange("category", event.target.value);
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
                      Group by
                    </label>
                    <Controller
                      control={control}
                      name="groupBy"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event);
                            handleFilterChange("groupBy", event.target.value);
                          }}
                        >
                          <option value="category">Category</option>
                          <option value="product">Product</option>
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
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event);
                            handleFilterChange("payment_method", event.target.value);
                          }}
                        >
                          <option value="">All Payment Methods</option>
                          {paymentMethodList.map((method) => (
                            <option key={method} value={method}>
                              {method}
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
                            onChange={(event) => {
                              field.onChange(event);
                              handleFilterChange(
                                "include_child_categories",
                                event.target.checked
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

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Profit margin analysis</h3>
              <p className="text-sm text-slate-500">
                {data.data.length.toLocaleString()} rows on this page from the selected filters.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportToExcel}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <FaFileExcel />
                Export
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableLoading />
            ) : data.data.length > 0 ? (
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-4 py-4 w-3/12">
                      {filters.groupBy === "category" ? "Category" : "Product"}
                    </th>
                    <th className="px-4 py-4 w-2/12 text-right">Sales</th>
                    <th className="px-4 py-4 w-2/12 text-right">Cost</th>
                    <th className="px-4 py-4 w-2/12 text-right">Profit</th>
                    <th className="px-4 py-4 w-1/12 text-right">Profit %</th>
                    <th className="px-4 py-4 w-1/12 text-right">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item) => (
                    <tr key={item.category || item.product_name} className="border-b border-slate-100">
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-2xl bg-slate-100 p-2 text-slate-500">
                            <PiTag size={18} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-950">
                              {filters.groupBy === "category" ? item.category : item.product_name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {filters.groupBy === "category" ? "Category grouping" : "Product grouping"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-right font-medium text-slate-900">
                        {formatPrice(item.total_sales)}
                      </td>
                      <td className="px-4 py-4 align-top text-right font-medium text-slate-900">
                        {formatPrice(item.total_cost)}
                      </td>
                      <td className="px-4 py-4 align-top text-right font-semibold">
                        <span className={item.profit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {formatPrice(item.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-right font-semibold">
                        <span className={item.profit_on_cost_margin >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {Number(item.profit_on_cost_margin || 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-right text-slate-700">
                        {item.total_qty_sold}
                      </td>
                    </tr>
                  ))}

                  <tr className="border-t border-slate-200 bg-slate-50/90 font-semibold text-slate-900">
                    <td className="px-4 py-4">Page total</td>
                    <td className="px-4 py-4 text-right">{formatPrice(totalSales)}</td>
                    <td className="px-4 py-4 text-right">{formatPrice(totalCost)}</td>
                    <td className="px-4 py-4 text-right">
                      <span className={totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                        {formatPrice(totalProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(2) : "0.00"}%
                    </td>
                    <td className="px-4 py-4 text-right">{totalQuantitySold}</td>
                  </tr>

                  <tr className="bg-emerald-50/70 font-bold text-slate-950">
                    <td className="px-4 py-4">Grand total</td>
                    <td className="px-4 py-4 text-right">
                      {formatPrice(data.others.total_sales || 0)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {formatPrice(data.others.total_cost || 0)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={(data.others.total_profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}>
                        {formatPrice(data.others.total_profit || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {data.others.total_cost > 0
                        ? ((data.others.total_profit / data.others.total_cost) * 100).toFixed(2)
                        : "0.00"}
                      %
                    </td>
                    <td className="px-4 py-4 text-right">
                      {data.others.total_qty_sold || 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center px-6 py-12 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <PiCheckCircle size={24} />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-950">No records found</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Try a different search term or adjust the filters.
                  </p>
                </div>
              </div>
            )}
          </div>

          {!loading && data.data.length > 0 && (
            <div className="border-t border-slate-200/80 px-4 py-4">
              <Pagination
                currentPage={data?.meta?.current_page || 1}
                lastPage={data?.meta?.last_page || 1}
                handlePrevious={handlePrevious}
                handlePageChange={handlePageChange}
                handleNextPage={handleNextPage}
                showPrevious={currentPage > 1}
                showNext={currentPage < (data?.meta?.last_page || 1)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

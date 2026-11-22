import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FaFileExcel } from "react-icons/fa";
import {
  PiCopy,
  PiMagnifyingGlass,
  PiSliders,
  PiTruck,
  PiWarehouse,
  PiClock,
  PiReceipt,
  PiTrendUp,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { formatPrice } from "../../hooks/currency";
import { getSupplierPurchaseReport } from "../../api/report";
import { getSuppliers } from "../../api/supplier";
import { getWarehouse } from "../../api/warehouse";

const initialFilters = {
  supplier: "",
  warehouse: "",
  payment_status: "",
  start_date: "",
  end_date: "",
};

const statusLabelMap = {
  paid: "Paid",
  unpaid: "Unpaid",
  partial: "Partial",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const toNumber = (value) => Number(value) || 0;

export default function SupplierReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState(initialFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, others: {} });
  const [supplierList, setSupplierList] = useState([]);
  const [warehouseList, setWarehouseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState("grand_total");
  const [sortOrder, setSortOrder] = useState("desc");
  const filterRef = useRef(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        perPage: 10,
        page: currentPage,
        search: searchQuery,
        sortField,
        sortOrder,
        ...filters,
      };

      const result = await getSupplierPurchaseReport(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load supplier report");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
        others: result.others_data || {},
      });
    } catch (error) {
      toast.error(error.message || "Error loading supplier report", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, filters, searchQuery, sortField, sortOrder]);

  const fetchDependencies = useCallback(async () => {
    try {
      const [supplierRes, warehouseRes] = await Promise.all([
        getSuppliers(accessToken, { perPage: 200 }),
        getWarehouse(accessToken, { perPage: 200, status: "1" }),
      ]);

      setSupplierList(Array.isArray(supplierRes?.data) ? supplierRes.data : []);
      setWarehouseList(Array.isArray(warehouseRes?.data) ? warehouseRes.data : []);
    } catch {
      toast.error("Failed to load supplier report filters", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  useEffect(() => {
    if (loadData) {
      fetchReport();
    }
  }, [fetchReport, loadData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSort = (field) => {
    setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
    setSortField(field);
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const onFilterSubmit = () => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setSearchQuery("");
    setSortField("grand_total");
    setSortOrder("desc");
    setCurrentPage(1);
    setLoadData(true);
  };

  const exportToExcel = () => {
    if (data.data.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const headers = [
      "Supplier",
      "Phone",
      "Email",
      "Warehouses",
      "Invoices",
      "Quantity",
      "Average Invoice",
      "Grand Total",
      "Paid",
      "Due",
      "Last Purchase",
      "Paid Count",
      "Unpaid Count",
      "Partial Count",
    ];

    const rows = data.data.map((item) => [
      item.supplier_name || "",
      item.phone || "",
      item.email || "",
      (item.warehouses || []).join(" | "),
      item.invoice_count || 0,
      item.total_qty || 0,
      item.average_invoice_value || 0,
      item.grand_total || 0,
      item.paid_total || 0,
      item.due_total || 0,
      item.last_purchase_date || "",
      item.status_breakdown?.paid || 0,
      item.status_breakdown?.unpaid || 0,
      item.status_breakdown?.partial || 0,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "supplier-report.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    if (data.data.length === 0) {
      toast.warning("No data to copy");
      return;
    }

    const text = data.data
      .map(
        (item) =>
          [
            item.supplier_name || "",
            item.phone || "",
            item.email || "",
            (item.warehouses || []).join(" | "),
            item.invoice_count || 0,
            item.total_qty || 0,
            item.average_invoice_value || 0,
            item.grand_total || 0,
            item.paid_total || 0,
            item.due_total || 0,
            item.last_purchase_date || "",
          ].join(",")
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(
        `Supplier,Phone,Email,Warehouses,Invoices,Quantity,Average Invoice,Grand Total,Paid,Due,Last Purchase\n${text}`
      );
      toast.success("Data copied to clipboard", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
    } catch {
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

  const renderStatusSummary = (statusBreakdown = {}) =>
    ["paid", "unpaid", "partial"]
      .map((key) => `${statusLabelMap[key]}: ${statusBreakdown[key] || 0}`)
      .join(" | ");

  const totalSuppliers = toNumber(data.others.total_suppliers);
  const totalInvoices = toNumber(data.others.total_invoices);
  const grandTotal = toNumber(data.others.grand_total);
  const paidTotal = toNumber(data.others.paid_total);
  const dueTotal = toNumber(data.others.due_total);
  const totalQty = toNumber(data.others.total_qty);
  const avgInvoice = toNumber(data.others.average_invoice_value);
  const discountTotal = toNumber(data.others.discount_total);
  const activeWarehouseName = warehouseList.find(
    (warehouse) => String(warehouse.id) === String(filters.warehouse)
  )?.name;
  const activeSupplierName = supplierList.find(
    (supplier) => String(supplier.id) === String(filters.supplier)
  )?.name;
  const activeStatusLabel =
    filters.payment_status === "1"
      ? "Paid"
      : filters.payment_status === "0"
      ? "Unpaid"
      : filters.payment_status === "2"
      ? "Partial"
      : "All statuses";
  const hasActiveFilters =
    searchQuery.trim() ||
    filters.supplier ||
    filters.warehouse ||
    filters.payment_status ||
    filters.start_date ||
    filters.end_date;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiTruck size={14} />
              Supplier Report
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Supplier purchase insights
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review supplier-wise purchases, due exposure, payment mix, and invoice totals with a cleaner reporting layout.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  hasActiveFilters ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              {hasActiveFilters ? "Filters active" : "No filters applied"}
            </div>
            {(activeSupplierName || activeWarehouseName) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {activeSupplierName && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Supplier: {activeSupplierName}
                  </span>
                )}
                {activeWarehouseName && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Warehouse: {activeWarehouseName}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[760px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Suppliers
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalSuppliers.toLocaleString()}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Invoices
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {totalInvoices.toLocaleString()}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Grand total
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPrice(grandTotal)}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Due
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPrice(dueTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-blue-50 p-2 text-blue-600">
              <PiReceipt size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Quantity
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {totalQty.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">Units across the current filter set</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-emerald-50 p-2 text-emerald-600">
              <PiTrendUp size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Avg invoice
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(avgInvoice)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Average purchase value per invoice</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-sky-50 p-2 text-sky-600">
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
            <div className="absolute right-3 top-3 rounded-full bg-amber-50 p-2 text-amber-600">
              <PiClock size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Payment status
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {activeStatusLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current payment filter state</p>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div
            ref={filterRef}
            className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search suppliers
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by invoice, reference, supplier, email, phone..."
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
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Supplier
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.supplier}
                      onChange={(e) => handleFilterChange("supplier", e.target.value)}
                    >
                      <option value="">All Suppliers</option>
                      {supplierList.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
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
                      {warehouseList.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment status
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.payment_status}
                      onChange={(e) => handleFilterChange("payment_status", e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="1">Paid</option>
                      <option value="0">Unpaid</option>
                      <option value="2">Partial</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Start date
                    </label>
                    <input
                      type="date"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.start_date}
                      onChange={(e) => handleFilterChange("start_date", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      End date
                    </label>
                    <input
                      type="date"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.end_date}
                      onChange={(e) => handleFilterChange("end_date", e.target.value)}
                    />
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
                Supplier purchase list
              </h5>
              <p className="mt-1 text-sm text-slate-500">
                Qty: {totalQty.toLocaleString()} | Discount: {formatPrice(discountTotal)}
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
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 first:rounded-l-xl cursor-pointer"
                        onClick={() => handleSort("supplier_name")}
                      >
                        Supplier
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Contact
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Warehouses
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("invoice_count")}
                      >
                        Invoices
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("total_qty")}
                      >
                        Qty
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("average_invoice_value")}
                      >
                        Avg invoice
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("grand_total")}
                      >
                        Grand total
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("paid_total")}
                      >
                        Paid
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("due_total")}
                      >
                        Due
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer"
                        onClick={() => handleSort("last_purchase_date")}
                      >
                        Last purchase
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 last:rounded-r-xl">
                        Status mix
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data?.length > 0 ? (
                      <>
                        {data.data.map((item) => (
                          <tr
                            key={item.key}
                            className="bg-white transition hover:bg-slate-50/70"
                          >
                            <td className="border-b border-slate-100 px-4 py-4">
                              <div className="flex items-start gap-3">
                                <div className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                                  <PiTruck size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {item.supplier_name}
                                  </p>
                                  <p className="text-xs text-blue-600">
                                    First purchase: {item.first_purchase_date || "N/A"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              <div>
                                <p>{item.phone || "N/A"}</p>
                                <p className="text-xs text-slate-500">
                                  {item.email || "N/A"}
                                </p>
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              <div className="max-w-48 whitespace-normal">
                                {(item.warehouses || []).length > 0
                                  ? item.warehouses.join(", ")
                                  : "N/A"}
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {toNumber(item.invoice_count).toLocaleString()}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {toNumber(item.total_qty).toLocaleString()}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {formatPrice(item.average_invoice_value || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-950">
                              {formatPrice(item.grand_total || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {formatPrice(item.paid_total || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-rose-600">
                              {formatPrice(item.due_total || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              {item.last_purchase_date || "N/A"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-xs text-slate-600">
                              {renderStatusSummary(item.status_breakdown)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50">
                          <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                            Page total
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {totalInvoices.toLocaleString()}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {totalQty.toLocaleString()}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(avgInvoice)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(grandTotal)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(paidTotal)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(dueTotal)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-xs text-slate-600">
                            {renderStatusSummary(data.others.payment_status_breakdown)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center">
                          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8">
                            <p className="text-sm font-semibold text-slate-700">
                              No supplier report data found
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Try a different search term or filter combination.
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

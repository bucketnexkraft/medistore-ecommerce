import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { BiSearch } from "react-icons/bi";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiPackage,
  FiRefreshCw,
} from "react-icons/fi";
import { getExpireProductReport } from "../../api/report";
import { getWarehouse } from "../../api/warehouse";
import Pagination from "../../components/common/Pagination";
import TableLoading from "../../components/loadings/TableLoading";

const defaultFilters = {
  search: "",
  warehouse_id: "",
  status: "all",
  days_to_expire: 30,
  date_from: "",
  date_to: "",
};

const getStatusMeta = (status, daysLeft) => {
  const normalized = String(status || "").toLowerCase();
  const numericDays = Number(daysLeft);

  if (normalized === "expired" || numericDays < 0) {
    return {
      label: "Expired",
      icon: FiAlertTriangle,
      chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
      row: "hover:bg-rose-50/70",
      bar: "bg-rose-500",
    };
  }

  if (normalized === "expiring" || numericDays <= 30) {
    return {
      label: "Expiring",
      icon: FiClock,
      chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      row: "hover:bg-amber-50/70",
      bar: "bg-amber-500",
    };
  }

  return {
    label: "Valid",
    icon: FiCheckCircle,
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    row: "hover:bg-emerald-50/70",
    bar: "bg-emerald-500",
  };
};

const formatDateLabel = (date) => {
  if (!date) return "N/A";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const getDaysLabel = (daysLeft) => {
  const days = Number(daysLeft);
  if (Number.isNaN(days)) return "N/A";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
};

export default function ExpireProductReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [summary, setSummary] = useState({ expired_count: 0, expiring_count: 0, days_to_expire: 30 });
  const [filters, setFilters] = useState(defaultFilters);

  const fetchReport = async (page = 1, nextFilters = filters) => {
    try {
      setLoading(true);
      const response = await getExpireProductReport(accessToken, {
        ...nextFilters,
        perPage: meta.per_page || 20,
        page,
      });
      setRows(response?.data || []);
      setMeta(response?.meta || { current_page: 1, last_page: 1, per_page: 20, total: 0 });
      setSummary(response?.others_data || { expired_count: 0, expiring_count: 0, days_to_expire: 30 });
    } catch (error) {
      toast.error(error?.message || "Failed to load expire product report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const whRes = await getWarehouse(accessToken, { perPage: 200, status: "1" });
        if (whRes?.status) setWarehouses(whRes.data || []);
      } catch (error) {
        // ignore warehouse load failure
      }
      fetchReport(1);
    })();
  }, []);

  const handleReset = () => {
    setFilters(defaultFilters);
    fetchReport(1, defaultFilters);
  };

  const handlePrevious = () => {
    if (meta.current_page > 1) fetchReport(meta.current_page - 1);
  };
  const handleNextPage = () => {
    if (meta.current_page < meta.last_page) fetchReport(meta.current_page + 1);
  };
  const handlePageChange = (page) => fetchReport(page);

  const totalAtRisk = (Number(summary?.expired_count) || 0) + (Number(summary?.expiring_count) || 0);
  const activeWarehouse = warehouses.find((warehouse) => warehouse.id === filters.warehouse_id)?.name || "All warehouses";
  const activeStatus = filters.status === "all" ? "All status" : filters.status;

  return (
    <div className="min-h-screen figtree-regular space-y-6 bg-slate-50/50">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-900 px-5 py-5 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
              <FiPackage size={14} />
              Inventory expiry control
            </div>
            <h2 className="text-2xl font-semibold">Expire Product Report</h2>
            <p className="mt-1 text-sm text-slate-300">
              Monitor expired stock, upcoming expiry windows, lots, barcodes, and warehouse exposure.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg bg-white/10 p-3 text-center backdrop-blur">
            <div>
              <p className="text-xs text-slate-300">At Risk</p>
              <p className="text-xl font-semibold">{totalAtRisk}</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Scope</p>
              <p className="max-w-36 truncate text-sm font-semibold capitalize">{activeWarehouse}</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Status</p>
              <p className="text-sm font-semibold capitalize">{activeStatus}</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <label className="space-y-1.5 xl:col-span-4">
            <span className="text-xs font-semibold uppercase text-slate-500">Product search</span>
            <div className="relative">
            <input
              type="text"
              className="input input-bordered h-11 min-h-11 w-full rounded-lg border-slate-200 bg-white pr-10 text-sm"
              placeholder="Search product/sku/barcode/lot"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            />
              <BiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
          </label>

          <label className="space-y-1.5 xl:col-span-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Warehouse</span>
            <select
              className="select select-bordered h-11 min-h-11 w-full rounded-lg border-slate-200 bg-white text-sm"
              value={filters.warehouse_id}
              onChange={(e) => setFilters((p) => ({ ...p, warehouse_id: e.target.value }))}
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 xl:col-span-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
            <select
              className="select select-bordered h-11 min-h-11 w-full rounded-lg border-slate-200 bg-white text-sm capitalize"
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="all">All Status</option>
              <option value="expired">Expired</option>
              <option value="expiring">Expiring</option>
            </select>
          </label>

          <label className="space-y-1.5 xl:col-span-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Threshold days</span>
            <input
              type="number"
              min="0"
              className="input input-bordered h-11 min-h-11 w-full rounded-lg border-slate-200 bg-white text-sm"
              placeholder="Days to expire"
              value={filters.days_to_expire}
              onChange={(e) => setFilters((p) => ({ ...p, days_to_expire: e.target.value }))}
            />
          </label>

          <label className="space-y-1.5 xl:col-span-1">
            <span className="text-xs font-semibold uppercase text-slate-500">From</span>
            <input
              type="date"
              className="input input-bordered h-11 min-h-11 w-full rounded-lg border-slate-200 bg-white text-sm"
              value={filters.date_from}
              onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))}
            />
          </label>

          <label className="space-y-1.5 xl:col-span-1">
            <span className="text-xs font-semibold uppercase text-slate-500">To</span>
            <input
              type="date"
              className="input input-bordered h-11 min-h-11 w-full rounded-lg border-slate-200 bg-white text-sm"
              value={filters.date_to}
              onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))}
            />
          </label>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Date filters are optional. Leave blank to review all expiry-dated inventory.
            </p>
            <div className="flex gap-2">
          <button className="btn btn-outline h-10 min-h-10 rounded-lg border-slate-200 px-4 text-slate-700" onClick={handleReset} disabled={loading}>
            <FiRefreshCw size={16} />
            Reset
          </button>
          <button className="btn h-10 min-h-10 rounded-lg bg-slate-900 px-5 text-white hover:bg-slate-800" onClick={() => fetchReport(1)} disabled={loading}>
            <BiSearch size={18} />
            {loading ? "Loading..." : "Search"}
          </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-rose-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Expired Items</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{summary?.expired_count || 0}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3 text-rose-600">
              <FiAlertTriangle size={22} />
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-rose-100">
            <div className="h-full w-2/3 rounded-full bg-rose-500" />
          </div>
        </div>
        <div className="rounded-lg border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Expiring Soon</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{summary?.expiring_count || 0}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-amber-600">
              <FiClock size={22} />
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full w-2/3 rounded-full bg-amber-500" />
          </div>
        </div>
        <div className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Threshold</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{summary?.days_to_expire ?? filters.days_to_expire}</p>
              <p className="text-xs text-slate-500">days before expiry</p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3 text-sky-600">
              <FiCalendar size={22} />
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sky-100">
            <div className="h-full w-2/3 rounded-full bg-sky-500" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-950">Expiry Inventory</h3>
            <p className="text-sm text-slate-500">{meta?.total || 0} records found</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Page {meta.current_page || 1} of {meta.last_page || 1}
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <TableLoading />
          ) : (
            <table className="table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="px-5 py-4">Product</th>
                  <th className="py-4">Code / SKU</th>
                  <th className="py-4">Warehouse</th>
                  <th className="py-4">Lot / Barcode</th>
                  <th className="py-4 text-right">Qty</th>
                  <th className="py-4">Expiry Date</th>
                  <th className="py-4">Days Left</th>
                  <th className="py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                          <FiPackage size={24} />
                        </div>
                        <p className="font-medium text-slate-700">{loading ? "Loading..." : "No expiry data found"}</p>
                        <p className="text-sm">Try a wider date range, all warehouses, or all status.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const statusMeta = getStatusMeta(row.expiry_status, row.days_left);
                    const StatusIcon = statusMeta.icon;

                    return (
                    <tr key={row.id} className={`border-b border-slate-100 transition-colors ${statusMeta.row}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`h-9 w-1 rounded-full ${statusMeta.bar}`} />
                          <div>
                            <p className="font-semibold text-slate-900">{row.product_name || "N/A"}</p>
                            <p className="text-xs text-slate-500">Inventory item</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-800">{row.product_code || "N/A"}</div>
                        <div className="text-xs text-slate-500">{row.sku || "N/A"}</div>
                      </td>
                      <td>
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {row.warehouse_name || "N/A"}
                        </span>
                      </td>
                      <td>
                        <div className="font-medium text-slate-800">{row.lot_number || "N/A"}</div>
                        <div className="text-xs text-slate-500">{row.barcode || "N/A"}</div>
                      </td>
                      <td className="text-right font-semibold text-slate-900">{row.quantity || 0}</td>
                      <td className="font-medium text-slate-800">{formatDateLabel(row.expiry_date)}</td>
                      <td>
                        <span className="font-medium text-slate-800">{getDaysLabel(row.days_left)}</span>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.chip}`}>
                          <StatusIcon size={14} />
                          {statusMeta.label}
                        </span>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          <div className="px-4 py-2">
          <Pagination
            currentPage={meta.current_page || 1}
            lastPage={meta.last_page || 1}
            handlePrevious={handlePrevious}
            handlePageChange={handlePageChange}
            handleNextPage={handleNextPage}
          />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiCalendar, PiPackage, PiTrendUp, PiWarehouse, PiX } from "react-icons/pi";
import { getWarehouse } from "../../api/warehouse";
import { getStockTransferReport } from "../../api/stockTransfer";
import { formatPrice } from "../../hooks/currency";
import TableLoading from "../../components/loadings/TableLoading";

const emptyFilters = {
  startDate: "",
  endDate: "",
  from_warehouse_id: "",
  to_warehouse_id: "",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

export default function StockTransferReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [warehouses, setWarehouses] = useState([]);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_transfers: 0,
    total_qty: 0,
    total_amount: 0,
  });
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);

    try {
      const res = await getStockTransferReport(accessToken, filters);
      if (!res?.status) {
        throw new Error(res?.error?.message || res?.message || "Failed to fetch report");
      }

      setRows(Array.isArray(res.data) ? res.data : []);
      setSummary(
        res.summary || {
          total_transfers: 0,
          total_qty: 0,
          total_amount: 0,
        }
      );
    } catch (error) {
      toast.error(error.message || "Failed to fetch report");
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, filters]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const wRes = await getWarehouse(accessToken, { perPage: 200, status: "1" });
        if (wRes?.status) {
          setWarehouses(wRes.data || []);
        }
      } catch (error) {
        toast.error(error.message || "Failed to load warehouses");
      }
    };

    fetchInitialData();
  }, [accessToken]);

  useEffect(() => {
    if (loadData) {
      fetchReport();
    }
  }, [fetchReport, loadData]);

  const handleSearch = () => {
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setLoadData(true);
  };

  const hasActiveFilters =
    filters.startDate || filters.endDate || filters.from_warehouse_id || filters.to_warehouse_id;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiCalendar size={14} />
              Transfer reports
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Stock transfer report
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review warehouse-to-warehouse transfer volume and value with the same clean reporting style.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[620px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Transfers
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {Number(summary.total_transfers || 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Total transfer documents</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Quantity
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {Number(summary.total_qty || 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Items moved between warehouses</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Value
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {formatPrice(summary.total_amount || 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Transfer value for the selected range</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search transfers
              </label>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  type="date"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                  value={filters.startDate}
                  onChange={(event) =>
                    setFilters((previous) => ({ ...previous, startDate: event.target.value }))
                  }
                />
                <input
                  type="date"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                  value={filters.endDate}
                  onChange={(event) =>
                    setFilters((previous) => ({ ...previous, endDate: event.target.value }))
                  }
                />
                <select
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                  value={filters.from_warehouse_id}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      from_warehouse_id: event.target.value,
                    }))
                  }
                >
                  <option value="">All from warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                <select
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                  value={filters.to_warehouse_id}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      to_warehouse_id: event.target.value,
                    }))
                  }
                >
                  <option value="">All to warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:pb-[2px]">
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
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Transfer rows</h3>
              <p className="text-sm text-slate-500">
                {rows.length.toLocaleString()} rows in the current result set.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                <PiWarehouse size={14} />
                Warehouses
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                <PiTrendUp size={14} />
                Movement
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableLoading />
            ) : rows.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center px-6 py-12 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <PiPackage size={24} />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-950">No transfer data</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Try changing the date range or warehouse filters to find matching transfers.
                  </p>
                </div>
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-4 py-4">No</th>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">From</th>
                    <th className="px-4 py-4">To</th>
                    <th className="px-4 py-4 text-right">Items</th>
                    <th className="px-4 py-4 text-right">Qty</th>
                    <th className="px-4 py-4 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.transfer_no} className="border-b border-slate-100">
                      <td className="px-4 py-4 align-top font-mono text-xs text-slate-500">
                        #{row.transfer_no}
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">
                        {row.transfer_date || "-"}
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-slate-950">
                        {row.from_warehouse || "-"}
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-slate-950">
                        {row.to_warehouse || "-"}
                      </td>
                      <td className="px-4 py-4 align-top text-right text-slate-700">
                        {Number(row.items_count || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 align-top text-right text-slate-700">
                        {Number(row.total_qty || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 align-top text-right font-semibold text-slate-900">
                        {formatPrice(row.total_amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

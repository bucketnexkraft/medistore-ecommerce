import { useCallback, useEffect, useRef, useState } from "react";
import { BiSearch } from "react-icons/bi";
import {
  PiArrowsClockwise,
  PiCheckCircle,
  PiFunnel,
  PiReceipt,
  PiX,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Pagination from "../../components/common/Pagination";
import TableLoading from "../../components/loadings/TableLoading";
import { getSellReturnLogs } from "../../api/report";
import { formatPrice } from "../../hooks/currency";

const emptyFilters = {
  filterText: "",
  from: "",
  to: "",
  return_type: "",
  refund_method: "",
  status: "",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const statusClassMap = {
  completed: "bg-emerald-50 text-emerald-700",
  approved: "bg-blue-50 text-blue-700",
  pending_approval: "bg-amber-50 text-amber-700",
  rejected: "bg-rose-50 text-rose-700",
};

const returnTypeLabel = (value) =>
  value ? String(value).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "N/A";

export default function SellReturnLog() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [filters, setFilters] = useState(emptyFilters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [loadData, setLoadData] = useState(true);
  const filterRef = useRef(null);

  const fetchLogs = useCallback(
    async (page = 1, nextFilters = filters) => {
      try {
        setLoading(true);
        const response = await getSellReturnLogs(accessToken, {
          ...nextFilters,
          page,
          perPage: meta.per_page || 20,
        });
        setRows(Array.isArray(response.data) ? response.data : []);
        setMeta(
          response.meta || {
            current_page: 1,
            last_page: 1,
            per_page: 20,
            total: 0,
          }
        );
      } catch (error) {
        toast.error(error?.message || "Failed to load sell return logs");
      } finally {
        setLoading(false);
        setLoadData(false);
      }
    },
    [accessToken, filters, meta.per_page]
  );

  useEffect(() => {
    if (loadData) {
      fetchLogs(1);
    }
  }, [fetchLogs, loadData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowAdvancedFilters(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    setShowAdvancedFilters(false);
    setLoadData(true);
  };

  const handlePrevious = () => {
    if (meta.current_page > 1) {
      fetchLogs(meta.current_page - 1);
    }
  };

  const handleNextPage = () => {
    if (meta.current_page < meta.last_page) {
      fetchLogs(meta.current_page + 1);
    }
  };

  const handlePageChange = (page) => fetchLogs(page);

  const handleReset = () => {
    setFilters(emptyFilters);
    setShowAdvancedFilters(false);
    setLoadData(true);
  };

  const totalReturns = meta.total || rows.length;
  const totalRefundAmount = rows.reduce((sum, row) => sum + Number(row.refund_amount || 0), 0);
  const totalReverseAmount = rows.reduce((sum, row) => sum + Number(row.total_reverse || 0), 0);
  const approvedCount = rows.filter((row) => row.status === "approved" || row.status === "completed").length;
  const hasActiveFilters =
    filters.filterText.trim() ||
    filters.from ||
    filters.to ||
    filters.return_type ||
    filters.refund_method ||
    filters.status;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <PiReceipt size={14} />
              Returns report
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Sell return log
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Track return transactions, filter by date and status, and open each return for a clean detail view.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Returns
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {totalReturns.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Matched return records</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Refund total
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {formatPrice(totalRefundAmount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Total refund amount in view</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Reverse total
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {formatPrice(totalReverseAmount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Total returned sale value</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Approved
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {approvedCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Approved or completed returns</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div ref={filterRef} className="relative">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search returns
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                    placeholder="Search return no, invoice, customer, or cashier"
                    value={filters.filterText}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, filterText: event.target.value }))
                    }
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
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                      aria-label="Search"
                    >
                      <BiSearch size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters((previous) => !previous)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        showAdvancedFilters
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
                  onClick={handleReset}
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

            {showAdvancedFilters && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      From date
                    </label>
                    <input
                      type="date"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.from}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, from: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      To date
                    </label>
                    <input
                      type="date"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.to}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, to: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Return type
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.return_type}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, return_type: event.target.value }))
                      }
                    >
                      <option value="">All types</option>
                      <option value="refund">Refund</option>
                      <option value="exchange">Exchange</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Refund method
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.refund_method}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, refund_method: event.target.value }))
                      }
                    >
                      <option value="">All methods</option>
                      <option value="Cash Refund">Cash Refund</option>
                      <option value="Refund to Card">Refund to Card</option>
                      <option value="Refund to MF">Refund to MF</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.status}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, status: event.target.value }))
                      }
                    >
                      <option value="">All statuses</option>
                      <option value="completed">Completed</option>
                      <option value="approved">Approved</option>
                      <option value="pending_approval">Pending Approval</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters(false)}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSearch}
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
              <h3 className="text-lg font-bold text-slate-950">Return logs</h3>
              <p className="text-sm text-slate-500">
                {rows.length.toLocaleString()} rows in the current page of results.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              <PiArrowsClockwise size={14} />
              Live query
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading && rows.length === 0 ? (
              <TableLoading />
            ) : rows.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center px-6 py-12 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <PiCheckCircle size={24} />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-950">No sell return logs found</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Try changing the filters or search term to surface matching returns.
                  </p>
                </div>
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">Return no</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">Type</th>
                    <th className="px-4 py-4 text-right">Items</th>
                    <th className="px-4 py-4 text-right">Amount</th>
                    <th className="px-4 py-4 text-right">Refund</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const statusKey = String(row.status || "").toLowerCase();

                    return (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-4 py-4 align-top text-slate-700">{row.date || "N/A"}</td>
                        <td className="px-4 py-4 align-top font-mono text-xs text-slate-500">
                          {row.return_no || "N/A"}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-slate-950">
                            {row.customer_name || "N/A"}
                          </div>
                          <div className="text-xs text-slate-500">{row.customer_phone || ""}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {returnTypeLabel(row.return_type)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-right text-slate-700">
                          {Number(row.returned_items_count || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 align-top text-right font-medium text-slate-900">
                          {formatPrice(row.total_reverse || 0)}
                        </td>
                        <td className="px-4 py-4 align-top text-right font-medium text-slate-900">
                          {formatPrice(row.refund_amount || 0)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              statusClassMap[statusKey] || "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.status || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            onClick={() => setSelectedReturn(row)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!loading && rows.length > 0 && (
            <div className="border-t border-slate-200/80 px-4 py-4">
              <Pagination
                currentPage={meta.current_page || 1}
                lastPage={meta.last_page || 1}
                handlePrevious={handlePrevious}
                handlePageChange={handlePageChange}
                handleNextPage={handleNextPage}
                showPrevious={meta.current_page > 1}
                showNext={meta.current_page < meta.last_page}
              />
            </div>
          )}
        </div>
      </div>

      {selectedReturn && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedReturn(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl translate-x-0 transform flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Sell return details</h3>
                <p className="text-sm text-slate-500">{selectedReturn.return_no || "N/A"}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setSelectedReturn(null)}
              >
                Close
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Date
                  </span>
                  <span className="mt-1 block text-slate-900">{selectedReturn.date || "N/A"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Type
                  </span>
                  <span className="mt-1 block text-slate-900">{returnTypeLabel(selectedReturn.return_type)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </span>
                  <span className="mt-1 block text-slate-900">{selectedReturn.status || "N/A"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Cashier
                  </span>
                  <span className="mt-1 block text-slate-900">{selectedReturn.cashier_name || "N/A"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Customer
                  </span>
                  <span className="mt-1 block text-slate-900">{selectedReturn.customer_name || "N/A"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Phone
                  </span>
                  <span className="mt-1 block text-slate-900">{selectedReturn.customer_phone || "N/A"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Original invoice
                  </span>
                  <span className="mt-1 block text-slate-900">
                    {selectedReturn.original_invoice_no || "N/A"}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Return invoice
                  </span>
                  <span className="mt-1 block text-slate-900">
                    {selectedReturn.return_invoice_no || "N/A"}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Refund method
                  </span>
                  <span className="mt-1 block text-slate-900">
                    {selectedReturn.refund_method || "N/A"}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Refund amount
                  </span>
                  <span className="mt-1 block text-slate-900">
                    {formatPrice(selectedReturn.refund_amount || 0)}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Exchange total
                  </span>
                  <span className="mt-1 block text-slate-900">
                    {formatPrice(selectedReturn.exchange_total || 0)}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Total reverse
                  </span>
                  <span className="mt-1 block text-slate-900">
                    {formatPrice(selectedReturn.total_reverse || 0)}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200">
                <div className="border-b px-4 py-3">
                  <h4 className="font-semibold text-slate-950">Returned products</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Unit price</th>
                        <th className="px-4 py-3 text-right">Line total</th>
                        <th className="px-4 py-3">Restock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReturn.returned_items || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            No returned item details
                          </td>
                        </tr>
                      ) : (
                        (selectedReturn.returned_items || []).map((item, index) => (
                          <tr key={`${item.product_id || "item"}-${index}`} className="border-b border-slate-100">
                            <td className="px-4 py-4 align-top font-medium text-slate-950">
                              {item.product_name || "N/A"}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-slate-700">
                              {item.return_qty || 0}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-slate-700">
                              {formatPrice(item.unit_price || 0)}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-slate-700">
                              {formatPrice(item.line_total_reverse || 0)}
                            </td>
                            <td className="px-4 py-4 align-top text-slate-700">
                              {item.restock_type || "N/A"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedReturn.note ? (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-1 font-semibold text-slate-950">Note</h4>
                  <p className="text-sm leading-6 text-slate-600">{selectedReturn.note}</p>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

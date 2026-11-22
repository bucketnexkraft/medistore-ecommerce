import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiCalendar, PiCheckCircle, PiFunnel, PiMagnifyingGlass, PiShieldCheck, PiX } from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { getAuditLogById, getAuditLogs } from "../../api/auditLogs";

const emptyFilters = {
  keyword: "",
  method: "",
  status_code: "",
  date_from: "",
  date_to: "",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const formatDateTime = (value, fallback = "N/A") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
};

const statusTone = (status) => {
  const code = Number(status);
  if (!Number.isFinite(code)) return "bg-slate-100 text-slate-600";
  if (code >= 200 && code < 300) return "bg-emerald-50 text-emerald-700";
  if (code >= 400) return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
};

export default function AuditLogs() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [filters, setFilters] = useState(emptyFilters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [loadData, setLoadData] = useState(true);
  const filterRef = useRef(null);

  const fetchLogs = useCallback(
    async (page = 1, nextFilters = filters) => {
      try {
        setLoading(true);
        const response = await getAuditLogs(accessToken, {
          ...nextFilters,
          page,
          perPage: meta.per_page || 20,
        });
        setRows(Array.isArray(response?.data) ? response.data : []);
        setMeta(
          response?.meta || {
            current_page: 1,
            last_page: 1,
            per_page: 20,
            total: 0,
          }
        );
      } catch (error) {
        toast.error(error?.message || "Failed to load audit logs");
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

  const handleReset = () => {
    setFilters(emptyFilters);
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

  const openDetails = async (id) => {
    try {
      setDrawerLoading(true);
      setSelectedLog(null);
      const response = await getAuditLogById(accessToken, id);
      setSelectedLog(response?.data || null);
    } catch (error) {
      toast.error(error?.message || "Failed to fetch audit log details");
    } finally {
      setDrawerLoading(false);
    }
  };

  const totalLogs = meta.total || rows.length;
  const successCount = rows.filter((row) => {
    const code = Number(row.status_code);
    return Number.isFinite(code) && code >= 200 && code < 300;
  }).length;
  const errorCount = rows.filter((row) => {
    const code = Number(row.status_code);
    return Number.isFinite(code) && code >= 400;
  }).length;
  const uniqueModules = new Set(rows.map((row) => row.module || "System")).size;

  const hasActiveFilters =
    filters.keyword.trim() ||
    filters.method ||
    filters.status_code ||
    filters.date_from ||
    filters.date_to;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <PiShieldCheck size={14} />
              System logs
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Audit logs
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Track API actions by user, endpoint, payload, status code, and method in a cleaner report view.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Total logs
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {totalLogs.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Current result set</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Successful
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                {successCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">2xx responses in view</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Errors
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">
                {errorCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">4xx and 5xx responses</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Modules
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {uniqueModules.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Unique modules in view</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div ref={filterRef} className="relative">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search logs
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                    placeholder="Search endpoint / user / ip / status"
                    value={filters.keyword}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, keyword: event.target.value }))
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
                      <PiMagnifyingGlass size={18} />
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
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Method
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.method}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, method: event.target.value }))
                      }
                    >
                      <option value="">All Methods</option>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status code
                    </label>
                    <input
                      type="text"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      placeholder="e.g. 200"
                      value={filters.status_code}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, status_code: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      From date
                    </label>
                    <input
                      type="date"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.date_from}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, date_from: event.target.value }))
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
                      value={filters.date_to}
                      onChange={(event) =>
                        setFilters((previous) => ({ ...previous, date_to: event.target.value }))
                      }
                    />
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
              <h3 className="text-lg font-bold text-slate-950">Audit log rows</h3>
              <p className="text-sm text-slate-500">
                {rows.length.toLocaleString()} rows in the current page of results.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              <PiCalendar size={14} />
              System activity
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
                  <h4 className="text-lg font-semibold text-slate-950">No audit logs found</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Try adjusting the filters or search term to reveal matching activity.
                  </p>
                </div>
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-4 py-4">Time</th>
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Module</th>
                    <th className="px-4 py-4">Action</th>
                    <th className="px-4 py-4">Method</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">IP</th>
                    <th className="px-4 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-4 py-4 align-top text-slate-700">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-slate-950">
                          {row.actor_name || "System/Guest"}
                        </div>
                        <div className="text-xs text-slate-500">{row.actor_email || ""}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">{row.module || "System"}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="max-w-[320px] space-y-1">
                          <div className="truncate font-medium text-slate-950">
                            {row.action_label || "N/A"}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {row.action_summary || ""}
                          </div>
                          <div className="truncate text-xs text-slate-400">
                            {row.action_details || ""}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {row.method || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(
                            row.status_code
                          )}`}
                        >
                          {row.status_code || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">{row.ip_address || "N/A"}</td>
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          onClick={() => openDetails(row.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
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

      {(drawerLoading || selectedLog) && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedLog(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl translate-x-0 transform flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Audit log details</h3>
                <p className="text-sm text-slate-500">{selectedLog?.endpoint || "Loading..."}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              {drawerLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    {[
                      ["Time", formatDateTime(selectedLog?.created_at)],
                      ["User", selectedLog?.actor_name || "System/Guest"],
                      ["Email", selectedLog?.actor_email || "N/A"],
                      ["Phone", selectedLog?.actor_phone || "N/A"],
                      ["Module", selectedLog?.module || "System"],
                      ["Action", selectedLog?.action_label || "N/A"],
                      ["Method", selectedLog?.method || "N/A"],
                      ["Status", selectedLog?.status_code || "N/A"],
                      ["IP", selectedLog?.ip_address || "N/A"],
                      ["Endpoint", selectedLog?.endpoint || "N/A"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 p-3">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {label}
                        </span>
                        <span className="mt-1 block text-slate-900">{value}</span>
                      </div>
                    ))}
                    <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-3">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Action details
                      </span>
                      <span className="mt-1 block text-slate-900">
                        {selectedLog?.action_details || "No additional details"}
                      </span>
                    </div>
                    <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-3">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                        User agent
                      </span>
                      <span className="mt-1 block text-slate-900">
                        {selectedLog?.user_agent || "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200">
                    <div className="border-b px-4 py-3">
                      <h4 className="font-semibold text-slate-950">Payload</h4>
                    </div>
                    <pre className="overflow-auto bg-slate-50 p-4 text-xs leading-6 text-slate-700">
                      {JSON.stringify(selectedLog?.payload || {}, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

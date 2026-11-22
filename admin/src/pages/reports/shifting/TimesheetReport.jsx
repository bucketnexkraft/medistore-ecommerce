import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { FaFileExcel } from "react-icons/fa";
import {
  PiCalendar,
  PiCheckCircle,
  PiClock,
  PiCopy,
  PiFunnel,
  PiMagnifyingGlass,
  PiTrendUp,
  PiUsers,
  PiX,
  PiWallet,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { getCashiersForReport, getTimesheetReport } from "../../../api/report";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import { formatPrice } from "../../../hooks/currency";

const cardBase =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const formatDateTime = (value, fallback = "-") => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return format(date, "dd MMM yyyy, hh:mm a");
};

const formatDateOnly = (value, fallback = "-") => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return format(date, "dd MMM yyyy");
};

const getFullName = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
  user?.name ||
  "Unknown";

const getShiftStatus = (shift) => (shift?.end_time ? "Closed" : "Active");

export default function TimesheetReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState({
    cashier_id: "",
    date_from: "",
    date_to: "",
    shift_status: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({
    data: [],
    meta: {},
    summary: {},
    cash_handover_logs: [],
  });
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const filterRef = useRef(null);

  const fetchInitialData = useCallback(async () => {
    try {
      const cashierRes = await getCashiersForReport(accessToken);
      if (cashierRes?.status) {
        setCashiers(cashierRes.data || []);
      }
    } catch (err) {
      console.error("Failed to load cashiers", err);
    }
  }, [accessToken]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        page: currentPage,
        perPage,
        search: searchQuery,
        cashier_id: filters.cashier_id || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        shift_status: filters.shift_status || undefined,
      };

      const result = await getTimesheetReport(accessToken, params);
      if (!result?.status) throw new Error(result?.message || "Failed to load timesheet");

      setData({
        data: result.data || [],
        meta: result.meta || {},
        summary: result.summary || {},
        cash_handover_logs: result.cash_handover_logs || [],
      });
    } catch (error) {
      toast.error(error.message || "Error loading timesheet report");
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, perPage, searchQuery, filters]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (loadData) fetchData();
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

  const resetFilters = () => {
    setFilters({
      cashier_id: "",
      date_from: "",
      date_to: "",
      shift_status: "",
    });
    setSearchQuery("");
    setCurrentPage(1);
    setLoadData(true);
  };

  const onFilterSubmit = () => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const exportToExcel = () => {
    if (data.data.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const headers = [
      "Shift ID",
      "Cashier",
      "Started At",
      "Ended At",
      "Duration",
      "Cash In Hand",
      "Cash Out Hand",
      "Net Cash",
      "Status",
      "Notes",
    ];

    const rows = data.data.map((shift) => [
      shift.id,
      getFullName(shift.subject_user),
      formatDateTime(shift.start_time),
      shift.end_time ? formatDateTime(shift.end_time) : "-",
      shift.duration || "-",
      formatPrice(shift.cash_in_hand || 0),
      formatPrice(shift.cash_out_hand || 0),
      formatPrice((shift.cash_out_hand || 0) - (shift.cash_in_hand || 0)),
      getShiftStatus(shift),
      (shift.comments || "").replace(/\n/g, " | "),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Timesheet_Report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const copyToClipboard = async () => {
    if (data.data.length === 0) {
      toast.warning("No data to copy");
      return;
    }

    const header = "ID,Cashier,Start,End,Duration,Cash In,Cash Out,Net,Status\n";
    const text = data.data
      .map(
        (shift) =>
          `${shift.id},${getFullName(shift.subject_user)},${formatDateTime(
            shift.start_time,
            ""
          )},${shift.end_time ? formatDateTime(shift.end_time, "") : ""},${shift.duration || ""},${
            shift.cash_in_hand || 0
          },${shift.cash_out_hand || 0},${
            (shift.cash_out_hand || 0) - (shift.cash_in_hand || 0)
          },${getShiftStatus(shift)}`
      )
      .join("\n");

    await navigator.clipboard.writeText(header + text);
    toast.success("Copied to clipboard!");
  };

  const totalShifts = data.summary.total_shifts || data.data.length;
  const activeShifts =
    data.summary.active_shifts ??
    data.data.filter((shift) => !shift.end_time).length;
  const closedShifts = Math.max(totalShifts - activeShifts, 0);
  const totalCashIn = data.summary.total_cash_in || 0;
  const totalCashOut = data.summary.total_cash_out || 0;
  const netCash = totalCashOut - totalCashIn;
  const handoverCount = data.cash_handover_logs?.length || 0;
  const pageCount = data.meta.last_page || 1;
  const currentCount = data.data.length;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.82),rgba(255,255,255,1))]" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
              <PiCalendar size={14} />
              Reports
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Timesheet report
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review cashier shifts, cash handovers, and daily performance in a cleaner, quicker view.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            <div className={cardBase}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Total shifts
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {totalShifts.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Loaded in the selected period</p>
            </div>
            <div className={cardBase}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Active shifts
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                {activeShifts.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Shifts currently open</p>
            </div>
            <div className={cardBase}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Net cash
              </p>
              <p className={`mt-2 text-2xl font-bold tracking-tight ${netCash >= 0 ? "text-slate-950" : "text-rose-600"}`}>
                {formatPrice(netCash)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Cash out minus cash in</p>
            </div>
            <div className={cardBase}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Handover logs
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {handoverCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Linked cash handover entries</p>
            </div>
          </div>
        </div>

        <div
          ref={filterRef}
          className="relative mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search shifts
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search cashier name, shift note, or shift ID..."
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/70"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                    aria-label="Search"
                  >
                    <PiMagnifyingGlass size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen((prev) => !prev)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      isAdvancedOpen
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
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
                className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-indigo-600 px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(79,70,229,0.18)] transition hover:translate-y-[-1px] hover:bg-indigo-700"
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
                    Cashier
                  </label>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/70"
                    value={filters.cashier_id}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, cashier_id: event.target.value }))
                    }
                  >
                    <option value="">All cashiers</option>
                    {cashiers.map((cashier) => (
                      <option key={cashier.id} value={cashier.id}>
                        {cashier.first_name} {cashier.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date from
                  </label>
                  <input
                    type="date"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/70"
                    value={filters.date_from}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, date_from: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date to
                  </label>
                  <input
                    type="date"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/70"
                    value={filters.date_to}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, date_to: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shift status
                  </label>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/70"
                    value={filters.shift_status}
                    onChange={(event) =>
                      setFilters((previous) => ({ ...previous, shift_status: event.target.value }))
                    }
                  >
                    <option value="">All shifts</option>
                    <option value="active">Active only</option>
                    <option value="closed">Closed only</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Reset
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)]">
          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Shift records</h3>
                <p className="text-sm text-slate-500">
                  {currentCount.toLocaleString()} rows on this page out of{" "}
                  {totalShifts.toLocaleString()} total shifts.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                  <PiCheckCircle size={14} className="text-emerald-500" />
                  {closedShifts.toLocaleString()} closed
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                  <PiClock size={14} className="text-amber-500" />
                  {activeShifts.toLocaleString()} active
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <FaFileExcel />
                  Export
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  <PiCopy size={14} />
                  Copy
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <TableLoading />
              ) : data.data.length === 0 ? (
                <div className="flex min-h-[320px] items-center justify-center px-6 py-12 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <PiUsers size={24} />
                    </div>
                    <h4 className="text-lg font-semibold text-slate-950">No shift records found</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Try changing the cashier, date, or status filters to surface matching shifts.
                    </p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <th className="px-4 py-4">Shift</th>
                      <th className="px-4 py-4">Cashier</th>
                      <th className="px-4 py-4">Started</th>
                      <th className="px-4 py-4">Ended</th>
                      <th className="px-4 py-4">Duration</th>
                      <th className="px-4 py-4 text-right">Cash in</th>
                      <th className="px-4 py-4 text-right">Cash out</th>
                      <th className="px-4 py-4 text-right">Net cash</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((shift, index) => {
                      const status = getShiftStatus(shift);
                      const net = (shift.cash_out_hand || 0) - (shift.cash_in_hand || 0);

                      return (
                        <tr key={shift.id || index} className="border-b border-slate-100">
                          <td className="px-4 py-4 align-top font-mono text-xs text-slate-500">
                            #{shift.id || index + 1}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="font-semibold text-slate-950">
                              {getFullName(shift.subject_user)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Shift owner</div>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-700">
                            <div className="font-medium text-slate-950">
                              {formatDateOnly(shift.start_time)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDateTime(shift.start_time).split(", ")[1] || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-700">
                            {shift.end_time ? (
                              <>
                                <div className="font-medium text-slate-950">
                                  {formatDateOnly(shift.end_time)}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {formatDateTime(shift.end_time).split(", ")[1] || "-"}
                                </div>
                              </>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Active now
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top text-slate-700">
                            {shift.duration || "-"}
                          </td>
                          <td className="px-4 py-4 align-top text-right font-medium text-slate-900">
                            {formatPrice(shift.cash_in_hand || 0)}
                          </td>
                          <td className="px-4 py-4 align-top text-right font-medium text-slate-900">
                            {formatPrice(shift.cash_out_hand || 0)}
                          </td>
                          <td className={`px-4 py-4 align-top text-right font-semibold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatPrice(net)}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                status === "Active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top text-xs leading-6 text-slate-500">
                            <div className="max-w-[18rem] truncate">
                              {shift.comments || "-"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/90 text-sm font-semibold text-slate-900">
                      <td className="px-4 py-4" colSpan={5}>
                        Totals
                      </td>
                      <td className="px-4 py-4 text-right">{formatPrice(totalCashIn)}</td>
                      <td className="px-4 py-4 text-right">{formatPrice(totalCashOut)}</td>
                      <td className={`px-4 py-4 text-right ${netCash >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatPrice(netCash)}
                      </td>
                      <td className="px-4 py-4" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {!loading && data.data.length > 0 && (
              <div className="border-t border-slate-200/80 px-4 py-4">
                <Pagination
                  currentPage={data.meta.current_page || 1}
                  lastPage={pageCount}
                  handlePrevious={() => {
                    setCurrentPage((page) => page - 1);
                    setLoadData(true);
                  }}
                  handleNextPage={() => {
                    setCurrentPage((page) => page + 1);
                    setLoadData(true);
                  }}
                  handlePageChange={(page) => {
                    setCurrentPage(page);
                    setLoadData(true);
                  }}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < pageCount}
                />
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Cash handover logs</h3>
                <p className="text-sm text-slate-500">
                  {handoverCount.toLocaleString()} linked transfer entries
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <PiTrendUp size={14} />
                Shift movement
              </div>
            </div>

            <div className="overflow-x-auto">
              {!data.cash_handover_logs || data.cash_handover_logs.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center px-6 py-12 text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <PiWallet size={24} />
                    </div>
                    <h4 className="text-lg font-semibold text-slate-950">No cash handover logs</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Once a handover is recorded, it will appear here with cashier, receiver, amount, and notes.
                    </p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <th className="px-4 py-4">ID</th>
                      <th className="px-4 py-4">Cashier</th>
                      <th className="px-4 py-4">Received by</th>
                      <th className="px-4 py-4 text-right">Amount</th>
                      <th className="px-4 py-4">Time</th>
                      <th className="px-4 py-4">Shift</th>
                      <th className="px-4 py-4">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cash_handover_logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100">
                        <td className="px-4 py-4 align-top font-mono text-xs text-slate-500">
                          #{log.id}
                        </td>
                        <td className="px-4 py-4 align-top font-medium text-slate-950">
                          {(log.cashier_name || "-").trim() || "-"}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">
                          {(log.receiver_name || "-").trim() || "-"}
                        </td>
                        <td className="px-4 py-4 align-top text-right font-semibold text-indigo-600">
                          {formatPrice(log.amount || 0)}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">
                          {log.created_at ? (
                            <>
                              <div className="font-medium text-slate-950">
                                {formatDateOnly(log.created_at)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {formatDateTime(log.created_at).split(", ")[1] || "-"}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          {log.timesheet_id ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              Shift #{log.timesheet_id}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              No shift
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top text-xs leading-6 text-slate-500">
                          <div className="max-w-[18rem] truncate">{log.notes || "-"}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

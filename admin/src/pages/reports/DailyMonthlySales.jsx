import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { getDailyMonthlySales } from "../../api/report";
import { formatPrice } from "../../hooks/currency";
import TableLoading from "../../components/loadings/TableLoading";
import {
  PiArrowCircleLeft,
  PiArrowCircleRight,
  PiCalendar,
  PiChartBar,
  PiCoins,
  PiReceipt,
  PiTrendUp,
} from "react-icons/pi";

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const toNumber = (value) => Number(value) || 0;

const metricCard = {
  base: "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur",
};

export default function DailyMonthlySales() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [viewType, setViewType] = useState("daily");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  const today = new Date();
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();
  const isCurrentYear = year === today.getFullYear();

  const fetchSalesReport = useCallback(
    async (type, reportYear, reportMonth = null) => {
      setLoading(true);
      setError(null);

      try {
        const params = { type, year: reportYear };
        if (reportMonth !== null) params.month = reportMonth;

        const result = await getDailyMonthlySales(accessToken, params);
        setData(result.data || {});
      } catch (err) {
        setError(err?.message || "Failed to fetch sales report");
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!accessToken) return;

    const reportYear = currentDate.getFullYear();
    const reportMonth = viewType === "daily" ? currentDate.getMonth() + 1 : null;
    fetchSalesReport(viewType, reportYear, reportMonth);
  }, [accessToken, fetchSalesReport, viewType, currentDate]);

  const handlePrev = () => {
    setCurrentDate((prevDate) => {
      const nextDate = new Date(prevDate);
      if (viewType === "daily") {
        nextDate.setMonth(nextDate.getMonth() - 1);
      } else {
        nextDate.setFullYear(nextDate.getFullYear() - 1);
      }
      return nextDate;
    });
  };

  const handleNext = () => {
    setCurrentDate((prevDate) => {
      const nextDate = new Date(prevDate);
      if (viewType === "daily") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      return nextDate;
    });
  };

  const formatDate = (date) =>
    viewType === "daily"
      ? date.toLocaleString("default", { month: "long", year: "numeric" })
      : date.getFullYear().toString();

  const rows =
    viewType === "daily"
      ? Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const item = data[day] || {};
          const dateObj = new Date(year, month, day);
          const total = toNumber(item["Grand Total"]);

          return {
            key: day,
            label: dateObj.toLocaleDateString("default", {
              month: "short",
              day: "numeric",
            }),
            date: dateObj.toLocaleDateString(),
            dayName: dateObj.toLocaleDateString("default", {
              weekday: "long",
            }),
            invoices: toNumber(item["Number of Invoice"]),
            qty: toNumber(item["Quantity"]),
            total,
            active: isCurrentMonth && day === today.getDate(),
          };
        })
      : Array.from({ length: 12 }, (_, i) => {
          const monthIndex = i + 1;
          const item = data[monthIndex] || {};
          const total = toNumber(item["Grand Total"]);

          return {
            key: monthIndex,
            label: new Date(year, i, 1).toLocaleString("default", {
              month: "long",
            }),
            monthIndex,
            invoices: toNumber(item["Number of Invoice"]),
            qty: toNumber(item["Quantity"]),
            total,
            active: isCurrentYear && monthIndex === today.getMonth() + 1,
          };
        });

  const summary = rows.reduce(
    (acc, row) => {
      acc.invoices += row.invoices;
      acc.qty += row.qty;
      acc.total += row.total;

      if (!acc.best || row.total > acc.best.total) {
        acc.best = row;
      }

      return acc;
    },
    { invoices: 0, qty: 0, total: 0, best: null }
  );

  const averageInvoiceValue = summary.invoices > 0 ? summary.total / summary.invoices : 0;
  const activeLabel = viewType === "daily" ? "Daily Sales" : "Monthly Sales";
  const periodLabel = formatDate(currentDate);
  const bestLabel = summary.best?.total > 0 ? summary.best.label : "No activity yet";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiCalendar size={14} />
              Reports
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Sales report
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review the sales trend for a selected month or a full year, with quick navigation and clear totals.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[440px]">
            <div className={`${metricCard.base}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Period
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {periodLabel}
              </p>
            </div>
            <div className={`${metricCard.base}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                View
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {activeLabel}
              </p>
            </div>
            <div className={`${metricCard.base}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Benchmark
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {bestLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${metricCard.base} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-blue-50 p-2 text-blue-600">
              <PiReceipt size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Invoices
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {summary.invoices.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">All records in the selected period</p>
          </div>

          <div className={`${metricCard.base} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-emerald-50 p-2 text-emerald-600">
              <PiCoins size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Quantity sold
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {summary.qty.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">Units sold across the current view</p>
          </div>

          <div className={`${metricCard.base} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-violet-50 p-2 text-violet-600">
              <PiChartBar size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Grand total
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(summary.total)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Combined revenue for the period</p>
          </div>

          <div className={`${metricCard.base} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-amber-50 p-2 text-amber-600">
              <PiTrendUp size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Average invoice
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(averageInvoiceValue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Average sale value per invoice</p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
              aria-label="Previous period"
            >
              <PiArrowCircleLeft size={22} />
            </button>

            <div className="min-w-44 rounded-xl bg-slate-50 px-4 py-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Selected period
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {periodLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
              aria-label="Next period"
            >
              <PiArrowCircleRight size={22} />
            </button>
          </div>

          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewType === "daily"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setViewType("daily")}
            >
              Daily
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewType === "monthly"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setViewType("monthly")}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-950">
                {viewType === "daily" ? "Daily breakdown" : "Monthly breakdown"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {viewType === "daily"
                  ? "Compare each day in the selected month."
                  : "Review the year by month at a glance."}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Live report
            </span>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <TableLoading />
            ) : error ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800"
              >
                <div className="mt-0.5 rounded-full bg-rose-100 p-2">
                  <PiCalendar size={16} />
                </div>
                <div>
                  <p className="font-semibold">Could not load the report</p>
                  <p className="mt-1 text-sm text-rose-700">{error}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {viewType === "daily" ? (
                        <>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 first:rounded-l-xl">
                            Date
                          </th>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                            Day
                          </th>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                            Invoices
                          </th>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                            Qty sold
                          </th>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right last:rounded-r-xl">
                            Grand total
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 first:rounded-l-xl">
                            Month
                          </th>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                            Invoices
                          </th>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                            Qty sold
                          </th>
                          <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right last:rounded-r-xl">
                            Grand total
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.key}
                        className={`group transition ${
                          row.active ? "bg-blue-50/70" : "bg-white hover:bg-slate-50/70"
                        }`}
                      >
                        {viewType === "daily" ? (
                          <>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm font-medium text-slate-900">
                              <div className="flex items-center gap-3">
                                <span className={`h-2.5 w-2.5 rounded-full ${row.active ? "bg-blue-600" : "bg-slate-300"}`} />
                                <span>{row.date}</span>
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              {row.dayName}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-medium text-slate-700">
                              {row.invoices}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-medium text-slate-700">
                              {row.qty}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-950">
                              {formatPrice(row.total)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm font-medium text-slate-900">
                              <div className="flex items-center gap-3">
                                <span className={`h-2.5 w-2.5 rounded-full ${row.active ? "bg-blue-600" : "bg-slate-300"}`} />
                                <span>{row.label}</span>
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-medium text-slate-700">
                              {row.invoices}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-medium text-slate-700">
                              {row.qty}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-950">
                              {formatPrice(row.total)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

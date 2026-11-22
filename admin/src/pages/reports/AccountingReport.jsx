import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  PiChartPieSlice,
  PiCoins,
  PiCreditCard,
  PiFileText,
  PiMoney,
  PiFunnel,
  PiX,
} from "react-icons/pi";
import { formatPrice } from "../../hooks/currency";
import { getAccountingReport } from "../../api/report";
import { getPaymentMethods, getWarehouse } from "../../api/warehouse";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString();
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

export default function AccountingReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [warehouseList, setWarehouseList] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadData, setLoadData] = useState(true);
  const [data, setData] = useState({
    summary_cards: { sales: 0, purchase: 0, collected: 0, profit: 0 },
    payment_completion: {
      sales: { complete: 0, pending: 0 },
      purchase: { complete: 0, pending: 0 },
    },
    payment_method_totals: [],
    aging: [],
    ledger: [],
    ledger_summary: {
      overall: {
        total_in: 0,
        total_out: 0,
        closing_balance: 0,
        sale_collection_total: 0,
        purchase_payment_total: 0,
        direct_sale_collection_total: 0,
        due_sale_collection_total: 0,
      },
      page: { total_in: 0, total_out: 0, closing_balance: 0 },
    },
    options: {
      customers: [],
      salesmen: [],
    },
  });
  const [meta, setMeta] = useState({ current_page: 1, per_page: 20, total: 0, last_page: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const filterRef = useRef(null);

  const { control, getValues, reset } = useForm({
    defaultValues: {
      dateRange: [null, null],
      warehouse: "",
      basis: "accrual",
      payment_method: "",
      collection_type: "",
      invoice_type: "",
      customer_id: "",
      salesman_id: "",
    },
  });

  const watchedDateRange = useWatch({ control, name: "dateRange" });
  const watchedBasis = useWatch({ control, name: "basis" });
  const watchedInvoiceType = useWatch({ control, name: "invoice_type" });
  const watchedCollectionType = useWatch({ control, name: "collection_type" });

  const currentReportHeading = useMemo(() => {
    const [from, to] = watchedDateRange || [null, null];
    const dateLabel =
      from && to
        ? `${formatDisplayDate(from)} to ${formatDisplayDate(to)}`
        : from
        ? `From ${formatDisplayDate(from)}`
        : to
        ? `Up to ${formatDisplayDate(to)}`
        : "All Time";

    const basisLabel = watchedBasis === "cash" ? "Cash Basis" : "Accrual Basis";
    const invoiceTypeLabel = watchedInvoiceType
      ? watchedInvoiceType === "sale"
        ? "Sales Only"
        : "Purchases Only"
      : "All Invoices";
    const collectionTypeLabel = watchedCollectionType
      ? watchedCollectionType === "due"
        ? "Due Collection"
        : watchedCollectionType === "direct"
        ? "Direct Sale Collection"
        : "Other Collections"
      : "All Collection Types";

    return `${dateLabel} | ${basisLabel} | ${invoiceTypeLabel} | ${collectionTypeLabel}`;
  }, [watchedBasis, watchedCollectionType, watchedDateRange, watchedInvoiceType]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [warehousesRes, paymentMethodRes] = await Promise.all([
        getWarehouse(accessToken, { perPage: 200, status: "1" }),
        getPaymentMethods(accessToken),
      ]);

      setWarehouseList(warehousesRes?.data || []);
      const activeMethods = (paymentMethodRes || [])
        .filter((method) => method.enabled)
        .map((method) => method.name);
      setPaymentMethods(activeMethods);
    } catch {
      toast.error("Failed to load report filters", {
        className: "alert alert-error",
      });
    }
  }, [accessToken]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const values = getValues();
      const [dateFrom, dateTo] = values.dateRange || [null, null];

      const params = {
        basis: values.basis,
        warehouse: values.warehouse,
        invoice_type: values.invoice_type,
        payment_method: values.payment_method,
        collection_type: values.collection_type,
        customer_id: values.customer_id,
        salesman_id: values.salesman_id,
        search: searchText.trim(),
        date_from: formatDate(dateFrom),
        date_to: formatDate(dateTo),
        perPage,
        page: currentPage,
      };

      const result = await getAccountingReport(accessToken, params);

      setData(
        result?.data || {
          summary_cards: { sales: 0, purchase: 0, collected: 0, profit: 0 },
          payment_completion: {
            sales: { complete: 0, pending: 0 },
            purchase: { complete: 0, pending: 0 },
          },
          payment_method_totals: [],
          aging: [],
          ledger: [],
          ledger_summary: {
            overall: {
              total_in: 0,
              total_out: 0,
              closing_balance: 0,
              sale_collection_total: 0,
              purchase_payment_total: 0,
              direct_sale_collection_total: 0,
              due_sale_collection_total: 0,
            },
            page: { total_in: 0, total_out: 0, closing_balance: 0 },
          },
          options: { customers: [], salesmen: [] },
        }
      );
      setMeta((previous) => result?.meta || previous);
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to load accounting report", {
        className: "alert alert-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, getValues, perPage, searchText]);

  const buildParams = useCallback(
    (page, rowsPerPage) => {
      const values = getValues();
      const [dateFrom, dateTo] = values.dateRange || [null, null];
      return {
        basis: values.basis,
        warehouse: values.warehouse,
        invoice_type: values.invoice_type,
        payment_method: values.payment_method,
        collection_type: values.collection_type,
        customer_id: values.customer_id,
        salesman_id: values.salesman_id,
        search: searchText.trim(),
        date_from: formatDate(dateFrom),
        date_to: formatDate(dateTo),
        perPage: rowsPerPage,
        page,
      };
    },
    [getValues, searchText]
  );

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (loadData) {
      fetchReportData();
    }
  }, [fetchReportData, loadData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totals = useMemo(() => {
    return (data.ledger || []).reduce(
      (acc, item) => {
        acc.totalIn += Number(item.in || 0);
        acc.totalOut += Number(item.out || 0);
        acc.closingBalance = Number(item.balance || acc.closingBalance);
        return acc;
      },
      { totalIn: 0, totalOut: 0, closingBalance: 0 }
    );
  }, [data.ledger]);

  const summaryCards = [
    {
      key: "sales",
      label: "Total Sales",
      value: Number(data.summary_cards?.sales || 0),
      icon: PiCoins,
      tone: "text-emerald-600",
    },
    {
      key: "purchase",
      label: "Total Purchases",
      value: Number(data.summary_cards?.purchase || 0),
      icon: PiMoney,
      tone: "text-sky-600",
    },
    {
      key: "collected",
      label: "Collected Amount",
      value: Number(data.summary_cards?.collected || 0),
      icon: PiCreditCard,
      tone: "text-violet-600",
    },
    {
      key: "profit",
      label: "Estimated Gross",
      value: Number(data.summary_cards?.profit || 0),
      icon: PiChartPieSlice,
      tone: "text-orange-600",
    },
  ];

  const onApplyFilters = () => {
    setCurrentPage(1);
    setFilterOpen(false);
    setLoadData(true);
  };

  const onResetFilters = () => {
    reset({
      dateRange: [null, null],
      warehouse: "",
      basis: "accrual",
      payment_method: "",
      collection_type: "",
      invoice_type: "",
      customer_id: "",
      salesman_id: "",
    });
    setSearchText("");
    setCurrentPage(1);
    setFilterOpen(false);
    setLoadData(true);
  };

  const exportLedgerCsv = async () => {
    try {
      setExporting(true);
      const exportPerPage = 500;
      let page = 1;
      let lastPage = 1;
      const rows = [];

      do {
        const result = await getAccountingReport(accessToken, buildParams(page, exportPerPage));
        rows.push(...(result?.data?.ledger || []));
        lastPage = Number(result?.meta?.last_page || 1);
        page += 1;
      } while (page <= lastPage);

      if (rows.length === 0) {
        toast.warning("No ledger rows to export", { className: "alert alert-warning" });
        return;
      }

      const headers = [
        "Date",
        "Reference",
        "Type",
        "Collection Type",
        "Payer",
        "Collector",
        "Salesman",
        "Method",
        "Invoice Total",
        "Invoice Paid",
        "Invoice Pending",
        "Payment Status",
        "Money In",
        "Money Out",
        "Running Balance",
      ];
      const csvRows = rows.map((row) => [
        row.date || "",
        row.reference || "",
        row.type || "",
        row.collection_type || "",
        row.payer || "",
        row.collector || "",
        row.salesman || "",
        row.method || "",
        row.invoice_total || 0,
        row.invoice_paid || 0,
        row.invoice_pending || 0,
        row.payment_status || "",
        row.in || 0,
        row.out || 0,
        row.balance || 0,
      ]);
      const csvContent = [headers, ...csvRows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `accounting-ledger-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to export full ledger", {
        className: "alert alert-error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <PiChartPieSlice size={14} />
              Accounting
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Accounting report
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Track sales, purchases, collections, aging, and the ledger using the same clean report shell as your other reports.
            </p>
            <div className="mt-3 inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm text-blue-800">
              Currently viewing: {currentReportHeading}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div key={card.key} className={metricCardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {card.label}
                    </p>
                    <Icon className={card.tone} size={18} />
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {formatPrice(card.value)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div ref={filterRef} className="relative">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search ledger
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search invoice no, reference..."
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        setCurrentPage(1);
                        setLoadData(true);
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-emerald-600"
                      onClick={() => {
                        setCurrentPage(1);
                        setLoadData(true);
                      }}
                      aria-label="Search"
                    >
                      <PiChartPieSlice size={18} />
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        filterOpen
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-500 hover:bg-slate-100 hover:text-emerald-600"
                      }`}
                      onClick={() => setFilterOpen((prev) => !prev)}
                      aria-label="Toggle filters"
                    >
                      <PiFunnel size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:pt-7">
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={onResetFilters}
                >
                  <PiX size={16} />
                  Reset
                </button>
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={() => {
                    setCurrentPage(1);
                    setLoadData(true);
                  }}
                >
                  Search
                </button>
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={exportLedgerCsv}
                  disabled={exporting}
                >
                  <PiFileText size={16} />
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>
              </div>
            </div>

            {filterOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                          onChange={field.onChange}
                          placeholderText="All Time (optional range)"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          isClearable
                        />
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Accounting basis
                    </label>
                    <Controller
                      control={control}
                      name="basis"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          {...field}
                        >
                          <option value="accrual">Accrual</option>
                          <option value="cash">Cash</option>
                        </select>
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
                          {...field}
                        >
                          <option value="">All Warehouses</option>
                          {warehouseList.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Invoice type
                    </label>
                    <Controller
                      control={control}
                      name="invoice_type"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          {...field}
                        >
                          <option value="">All Types</option>
                          <option value="sale">Sale</option>
                          <option value="purchase">Purchase</option>
                        </select>
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Collection type
                    </label>
                    <Controller
                      control={control}
                      name="collection_type"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          {...field}
                        >
                          <option value="">All Collection Types</option>
                          <option value="due">Due Collection Only</option>
                          <option value="direct">Direct Sale Collection</option>
                          <option value="others">Others</option>
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
                          {...field}
                        >
                          <option value="">All Methods</option>
                          {paymentMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Customer
                    </label>
                    <Controller
                      control={control}
                      name="customer_id"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          {...field}
                        >
                          <option value="">All Customers</option>
                          {(data.options?.customers || []).map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name || customer.phone || customer.id}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Salesman
                    </label>
                    <Controller
                      control={control}
                      name="salesman_id"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/70"
                          {...field}
                        >
                          <option value="">All Salesmen</option>
                          {(data.options?.salesmen || []).map((salesman) => (
                            <option key={salesman.id} value={salesman.id}>
                              {salesman.name || salesman.phone || salesman.id}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={onResetFilters}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-xl border-0 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                    onClick={onApplyFilters}
                  >
                    Apply filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <TableLoading />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.key} className={metricCardClass}>
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-slate-500">{card.label}</p>
                      <Icon className={card.tone} size={20} />
                    </div>
                    <p className="text-2xl font-bold mt-3 text-slate-950">{formatPrice(card.value)}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
              <div className={metricCardClass}>
                <p className="text-sm text-slate-500">Sales payment complete</p>
                <p className="text-xl font-semibold mt-2 text-emerald-700">
                  {formatPrice(data.payment_completion?.sales?.complete || 0)}
                </p>
              </div>
              <div className={metricCardClass}>
                <p className="text-sm text-slate-500">Sales payment pending</p>
                <p className="text-xl font-semibold mt-2 text-rose-700">
                  {formatPrice(data.payment_completion?.sales?.pending || 0)}
                </p>
              </div>
              <div className={metricCardClass}>
                <p className="text-sm text-slate-500">Purchase payment complete</p>
                <p className="text-xl font-semibold mt-2 text-sky-700">
                  {formatPrice(data.payment_completion?.purchase?.complete || 0)}
                </p>
              </div>
              <div className={metricCardClass}>
                <p className="text-sm text-slate-500">Purchase payment pending</p>
                <p className="text-xl font-semibold mt-2 text-amber-700">
                  {formatPrice(data.payment_completion?.purchase?.pending || 0)}
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-5">
              <div className="xl:col-span-2 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <div className="border-b border-slate-200/80 px-4 py-4">
                  <h5 className="text-lg font-bold text-slate-950">Payment method breakdown</h5>
                </div>
                <div className="space-y-3 p-4">
                  {(data.payment_method_totals || []).length > 0 ? (
                    data.payment_method_totals.map((row) => (
                      <div key={row.method} className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-950">{row.method}</p>
                          <p className="font-semibold text-slate-900">{formatPrice(row.amount)}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{row.tx_count || 0} transaction(s)</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No payment method data</p>
                  )}
                </div>
              </div>

              <div className="xl:col-span-3 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <div className="border-b border-slate-200/80 px-4 py-4">
                  <h5 className="text-lg font-bold text-slate-950">Receivable / payable aging</h5>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        <th className="px-4 py-4">Bucket</th>
                        <th className="px-4 py-4 text-right">Receivable</th>
                        <th className="px-4 py-4 text-right">Payable</th>
                        <th className="px-4 py-4 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.aging || []).length > 0 ? (
                        data.aging.map((row) => (
                          <tr key={row.label} className="border-b border-slate-100">
                            <td className="px-4 py-4 align-top text-slate-700">{row.label}</td>
                            <td className="px-4 py-4 align-top text-right text-slate-900">
                              {formatPrice(row.receivable || 0)}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-slate-900">
                              {formatPrice(row.payable || 0)}
                            </td>
                            <td className="px-4 py-4 align-top text-right font-medium text-slate-950">
                              {formatPrice((row.receivable || 0) - (row.payable || 0))}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-6 text-center text-slate-500">
                            No aging data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h5 className="text-lg font-bold text-slate-950">Accounting ledger</h5>
                  <p className="text-sm text-slate-500">
                    {data.ledger?.length || 0} rows in the current page.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={exportLedgerCsv}
                  disabled={exporting}
                >
                  <PiFileText size={14} />
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <th className="px-4 py-4">Date</th>
                      <th className="px-4 py-4">Reference</th>
                      <th className="px-4 py-4">Type</th>
                      <th className="px-4 py-4">Collection type</th>
                      <th className="px-4 py-4">Payer</th>
                      <th className="px-4 py-4">Collector</th>
                      <th className="px-4 py-4">Salesman</th>
                      <th className="px-4 py-4">Method</th>
                      <th className="px-4 py-4 text-right">Invoice total</th>
                      <th className="px-4 py-4 text-right">Invoice paid</th>
                      <th className="px-4 py-4 text-right">Invoice pending</th>
                      <th className="px-4 py-4">Payment status</th>
                      <th className="px-4 py-4 text-right">Money in</th>
                      <th className="px-4 py-4 text-right">Money out</th>
                      <th className="px-4 py-4 text-right">Running balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.ledger || []).length > 0 ? (
                      <>
                        {data.ledger.map((row, idx) => (
                          <tr key={`${row.reference}-${row.date}-${idx}`} className="border-b border-slate-100">
                            <td className="px-4 py-4 align-top text-slate-700">{row.date}</td>
                            <td className="px-4 py-4 align-top font-mono text-xs text-slate-500">
                              {row.reference}
                            </td>
                            <td className="px-4 py-4 align-top text-slate-700">{row.type}</td>
                            <td className="px-4 py-4 align-top text-slate-700">{row.collection_type || "-"}</td>
                            <td className="px-4 py-4 align-top text-slate-700">{row.payer || "-"}</td>
                            <td className="px-4 py-4 align-top text-slate-700">{row.collector || "-"}</td>
                            <td className="px-4 py-4 align-top text-slate-700">{row.salesman || "-"}</td>
                            <td className="px-4 py-4 align-top text-slate-700">{row.method || "-"}</td>
                            <td className="px-4 py-4 align-top text-right text-slate-900">
                              {formatPrice(row.invoice_total || 0)}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-emerald-700">
                              {formatPrice(row.invoice_paid || 0)}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-rose-700">
                              {formatPrice(row.invoice_pending || 0)}
                            </td>
                            <td className="px-4 py-4 align-top text-slate-700">{row.payment_status || "-"}</td>
                            <td className="px-4 py-4 align-top text-right text-emerald-600">
                              {Number(row.in || 0) > 0 ? formatPrice(row.in) : "-"}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-rose-600">
                              {Number(row.out || 0) > 0 ? formatPrice(row.out) : "-"}
                            </td>
                            <td className="px-4 py-4 align-top text-right font-medium text-slate-950">
                              {formatPrice(row.balance || 0)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200 bg-slate-50/90 font-semibold text-slate-900">
                          <td className="px-4 py-4" colSpan="12">
                            Page totals
                          </td>
                          <td className="px-4 py-4 text-right text-emerald-600">
                            {formatPrice(data.ledger_summary?.page?.total_in || totals.totalIn)}
                          </td>
                          <td className="px-4 py-4 text-right text-rose-600">
                            {formatPrice(data.ledger_summary?.page?.total_out || totals.totalOut)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {formatPrice(data.ledger_summary?.page?.closing_balance || totals.closingBalance)}
                          </td>
                        </tr>
                        <tr className="bg-emerald-50/70 font-semibold text-slate-950">
                          <td className="px-4 py-4" colSpan="12">
                            Overall totals
                          </td>
                          <td className="px-4 py-4 text-right text-emerald-700">
                            {formatPrice(data.ledger_summary?.overall?.total_in || 0)}
                          </td>
                          <td className="px-4 py-4 text-right text-rose-700">
                            {formatPrice(data.ledger_summary?.overall?.total_out || 0)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {formatPrice(data.ledger_summary?.overall?.closing_balance || 0)}
                          </td>
                        </tr>
                        <tr className="bg-slate-50/90 text-sm text-slate-700">
                          <td className="px-4 py-4" colSpan="5">
                            Direct sale collection:{" "}
                            <span className="font-semibold text-slate-950">
                              {formatPrice(data.ledger_summary?.overall?.direct_sale_collection_total || 0)}
                            </span>
                          </td>
                          <td className="px-4 py-4" colSpan="5">
                            Due collection:{" "}
                            <span className="font-semibold text-slate-950">
                              {formatPrice(data.ledger_summary?.overall?.due_sale_collection_total || 0)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right" colSpan="5">
                            Total sale collection:{" "}
                            <span className="font-semibold text-slate-950">
                              {formatPrice(data.ledger_summary?.overall?.sale_collection_total || 0)}
                            </span>
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan="15" className="px-4 py-6 text-center text-slate-500">
                          No ledger entries
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {(data.ledger || []).length > 0 && (
                <div className="border-t border-slate-200/80 px-4 py-4">
                  <Pagination
                    currentPage={meta.current_page || 1}
                    lastPage={meta.last_page || 1}
                    handlePrevious={() => {
                      if (currentPage > 1) {
                        setCurrentPage((prev) => prev - 1);
                        setLoadData(true);
                      }
                    }}
                    handlePageChange={(page) => {
                      setCurrentPage(page);
                      setLoadData(true);
                    }}
                    handleNextPage={() => {
                      if (currentPage < (meta.last_page || 1)) {
                        setCurrentPage((prev) => prev + 1);
                        setLoadData(true);
                      }
                    }}
                    showPrevious={currentPage > 1}
                    showNext={currentPage < (meta.last_page || 1)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import Swal from "sweetalert2";
import { Controller, useForm } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import {
  PiCopy,
  PiCreditCard,
  PiEye,
  PiMicrosoftExcelLogoFill,
  PiReceipt,
  PiSliders,
  PiTrendUp,
  PiClock,
  PiShoppingCartSimple,
  PiWarningCircle,
  PiCheckCircle,
} from "react-icons/pi";
import { LuScanEye } from "react-icons/lu";
import useSelectableList from "../../../hooks/useSelectableList";
import { fetchingDueInvoiceList } from "../../../api/report";
import { fetchPreferences } from "../../../slice/preferencesSlice";
import PaymentDrawer from "../../../components/common/PaymentDrawer";
import PrintableSaleReceipt from "../../../components/printable-invoices/PrintableSaleReceipt";
import { hasPermission } from "../../../utils/permissions";
import TableLoading from "../../../components/loadings/TableLoading";
import { formatPrice } from "../../../hooks/currency";
import Pagination from "../../../components/common/Pagination";

const initialFilters = {
  search: "",
  type: "",
  status: "",
  dateRange: [null, null],
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const toNumber = (value) => Number(value) || 0;

export default function DueInvoiceReport() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { data: prefData } = useSelector((state) => state.preferences);
  const company_id = useSelector((state) => state.auth.company_id);
  const dispatch = useDispatch();

  const [data, setData] = useState({ data: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [printWithCustomerInfo, setPrintWithCustomerInfo] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [loadData, setLoadData] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const filterRef = useRef(null);

  const { control, watch, setValue, reset } = useForm({
    defaultValues: initialFilters,
  });
  const searchValue = watch("search");

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(data?.data || []);

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        perPage,
        filterType: watch("type"),
        filterText: watch("search").trim(),
        statusFilter: watch("status"),
        startDate: watch("dateRange")[0] ? formatDate(watch("dateRange")[0]) : "",
        endDate: watch("dateRange")[1] ? formatDate(watch("dateRange")[1]) : "",
        sortField,
        sortOrder,
        page: currentPage,
      };

      const result = await fetchingDueInvoiceList(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch invoices");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch invoices error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Failed to load invoices",
        confirmButtonText: "Retry",
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          setLoadData(true);
        }
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, perPage, sortField, sortOrder, watch]);

  const fetchCompanyPreferences = useCallback(() => {
    dispatch(fetchPreferences(company_id));
  }, [dispatch, company_id]);

  const handlePayment = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentDrawerOpen(true);
  };

  const handlePaymentSuccess = () => {
    setLoadData(true);
  };

  const exportToExcel = useCallback(() => {
    setExporting(true);
    try {
      if (data.data.length === 0) {
        toast.warning("No data to export");
        return;
      }

      const exportData =
        selectedOptions.length > 0
          ? data.data.filter((item) =>
              selectedOptions.some((option) => option.id === item.id)
            )
          : data.data;

      if (exportData.length === 0) {
        toast.warning("No items selected to export");
        return;
      }

      const headers = [
        "Invoice No",
        "Date",
        "Type",
        "Customer/Supplier",
        "Quantity",
        "Discount",
        "Tax",
        "Total",
        "Paid Amount",
        "Due Amount",
        "Status",
        "Fracture",
      ];

      const rows = exportData.map((item) => [
        item.invoice_no || "N/A",
        item.date ? new Date(item.date).toLocaleDateString() : "N/A",
        item.type || "N/A",
        item.customer?.name || item.supplier?.name || "N/A",
        item.qty || 0,
        item.discount || 0,
        item.tax || 0,
        item.total || 0,
        item.paid_amount || 0,
        item.due_amount || 0,
        item.payment_status === 1
          ? "Paid"
          : item.payment_status === 0
          ? "Unpaid"
          : "Partially Paid",
        item.isFracture == 1 ? "Yes" : "No",
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `due-payments-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (error) {
      console.error("Export to CSV error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to export to CSV",
      });
    } finally {
      setExporting(false);
    }
  }, [data.data, selectedOptions]);

  const copyToClipboard = useCallback(async () => {
    if (data.data.length === 0) {
      toast.warning("No data to copy");
      return;
    }

    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) =>
            selectedOptions.some((option) => option.id === item.id)
          )
        : data.data;

    if (exportData.length === 0) {
      toast.warning("No items selected to copy");
      return;
    }

    try {
      const text = exportData
        .map(
          (item) =>
            [
              item.invoice_no || "",
              item.date ? new Date(item.date).toLocaleDateString() : "",
              item.type || "",
              item.customer?.name || item.supplier?.name || "",
              item.qty || 0,
              item.discount || 0,
              item.tax || 0,
              item.total || 0,
              item.paid_amount || 0,
              item.due_amount || 0,
              item.payment_status === 1
                ? "Paid"
                : item.payment_status === 0
                ? "Unpaid"
                : "Partially Paid",
            ].join(",")
        )
        .join("\n");

      const clipboardText = `Invoice No,Date,Type,Customer/Supplier,Quantity,Discount,Tax,Total,Paid Amount,Due Amount,Status\n${text}`;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = clipboardText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      Swal.fire({
        icon: "success",
        title: "Copied!",
        text: "Data copied to clipboard",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error("Copy to clipboard error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to copy to clipboard",
      });
    }
  }, [data.data, selectedOptions]);

  const handleSort = useCallback(
    (field) => {
      setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
      setSortField(field);
      setCurrentPage(1);
      setLoadData(true);
    },
    [sortField, sortOrder]
  );

  const handlePrint = (invoice, withCustomerInfo) => {
    setPrintInvoice(invoice);
    setPrintWithCustomerInfo(withCustomerInfo);
  };

  const totals = data.data.reduce(
    (acc, item) => ({
      qty: acc.qty + toNumber(item.qty),
      discount: acc.discount + toNumber(item.discount),
      tax: acc.tax + toNumber(item.tax),
      total: acc.total + toNumber(item.total),
      paid_amount: acc.paid_amount + toNumber(item.paid_amount),
      due_amount: acc.due_amount + toNumber(item.due_amount),
    }),
    { qty: 0, discount: 0, tax: 0, total: 0, paid_amount: 0, due_amount: 0 }
  );

  const handleNextPage = useCallback(() => {
    if (currentPage < (data.meta.last_page || 1)) {
      setCurrentPage((prev) => prev + 1);
      setLoadData(true);
    }
  }, [currentPage, data.meta.last_page]);

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      setLoadData(true);
    }
  }, [currentPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    setLoadData(true);
  }, []);

  const onFilterSubmit = useCallback(() => {
    setShowFilter(false);
    setCurrentPage(1);
    setLoadData(true);
  }, []);

  const handleReset = () => {
    reset(initialFilters);
    setLoadData(true);
  };

  useEffect(() => {
    if (loadData) {
      fetchData();
    }
  }, [fetchData, loadData]);

  useEffect(() => {
    fetchCompanyPreferences();
  }, [fetchCompanyPreferences]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchValue?.trim()) {
        setCurrentPage(1);
        setLoadData(true);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchValue]);

  const companyInfo = {
    name: prefData?.application_name || "N/A",
    address: prefData?.application_address || "N/A",
    phone: prefData?.application_phone || "N/A",
    email: prefData?.application_email || "N/A",
    logo: prefData?.site_logo || "",
    footerNote: "Thank you for your business!",
  };

  const totalInvoices = data.data.length;
  const totalDue = data.data.reduce((sum, item) => sum + toNumber(item.due_amount), 0);
  const totalPaid = data.data.reduce((sum, item) => sum + toNumber(item.paid_amount), 0);
  const unpaidCount = data.data.filter((item) => item.payment_status === 0).length;
  const partialCount = data.data.filter((item) => item.payment_status === 2).length;
  const paidCount = data.data.filter((item) => item.payment_status === 1).length;
  const activeType = watch("type") || "All types";
  const activeStatus = watch("status") || "All statuses";
  const activeDateRange = watch("dateRange");
  const hasActiveFilters =
    searchValue?.trim() ||
    activeType !== "All types" ||
    activeStatus !== "All statuses" ||
    activeDateRange?.[0] ||
    activeDateRange?.[1];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />
      <div className="relative p-5 lg:p-6">
        <PaymentDrawer
          isOpen={paymentDrawerOpen}
          onClose={() => {
            setPaymentDrawerOpen(false);
            setSelectedInvoiceForPayment(null);
          }}
          invoice={selectedInvoiceForPayment}
          onPaymentSuccess={handlePaymentSuccess}
          accessToken={accessToken}
        />

        {printInvoice && (
          <PrintableSaleReceipt
            invoice={printInvoice}
            withCustomerInfo={printWithCustomerInfo}
            onClose={() => setPrintInvoice(null)}
            companyInfo={companyInfo}
          />
        )}

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiClock size={14} />
              Payments
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Due payments
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
              Review outstanding invoices, record payments, and track due amounts
              with a cleaner report workflow.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  hasActiveFilters ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              {hasActiveFilters ? "Filters active" : "No filters applied"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[760px]">
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
                Due total
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPrice(totalDue)}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Paid total
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPrice(totalPaid)}
              </p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Payment mix
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {paidCount} paid
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
              Overdue
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(totalDue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Outstanding balance in the current filter set
            </p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-emerald-50 p-2 text-emerald-600">
              <PiTrendUp size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Average balance
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {formatPrice(totalInvoices > 0 ? totalDue / totalInvoices : 0)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Average due per invoice</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-sky-50 p-2 text-sky-600">
              <PiShoppingCartSimple size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Statuses
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {unpaidCount} unpaid
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {partialCount} partial, {paidCount} paid
            </p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-amber-50 p-2 text-amber-600">
              <PiWarningCircle size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Search mode
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {searchValue?.trim() ? "Keyword" : "Browse"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {watch("search")?.trim() ? "Filtering by text query" : "No text filter applied"}
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div ref={filterRef} className="relative">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search due invoices
                </label>
                <div className="relative">
                  <Controller
                    control={control}
                    name="search"
                    render={({ field }) => (
                      <input
                        type="text"
                        placeholder="Search invoice..."
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                      onClick={() => {
                        if (watch("search").trim() !== "") {
                          setCurrentPage(1);
                          setLoadData(true);
                        }
                      }}
                      aria-label="Search"
                    >
                      <CiSearch fontSize={20} />
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        showFilter
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      }`}
                      onClick={() => setShowFilter((prev) => !prev)}
                      aria-label="Toggle filters"
                    >
                      <PiSliders size={18} />
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
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onFilterSubmit}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(37,99,235,0.18)] transition hover:translate-y-[-1px] hover:from-blue-700 hover:to-indigo-700"
                >
                  Apply filters
                </button>
              </div>
            </div>

            {showFilter && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                            setValue("dateRange", dates);
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
                      Type
                    </label>
                    <Controller
                      control={control}
                      name="type"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <option value="">All Types</option>
                          <option value="purchase">Purchase</option>
                          <option value="sale">Sale</option>
                        </select>
                      )}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </label>
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <select
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <option value="">All Statuses</option>
                          <option value="unpaid">Unpaid</option>
                          <option value="partially_paid">Partially Paid</option>
                        </select>
                      )}
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">
                          Quick hints
                        </span>
                        <span className="block text-xs text-slate-500">
                          Narrow results using date and payment status
                        </span>
                      </span>
                      <span className="grid size-10 place-items-center rounded-xl bg-white text-slate-500">
                        <PiSliders size={18} />
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilter(false)}
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
                Due payment list
              </h5>
              <p className="mt-1 text-sm text-slate-500">
                Manage payments, print receipts, and export the visible rows.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearSelection()}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <PiCheckCircle size={18} />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={exportToExcel}
                disabled={exporting || loading}
                className={`inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 ${
                  exporting || loading ? "opacity-70" : ""
                }`}
              >
                <PiMicrosoftExcelLogoFill size={18} />
                {exporting ? "Exporting..." : "Export"}
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
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 first:rounded-l-xl">
                        <label>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            checked={isAllSelectedOnCurrentPage()}
                          />
                        </label>
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer"
                        onClick={() => handleSort("invoice_no")}
                      >
                        Invoice No
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer"
                        onClick={() => handleSort("date")}
                      >
                        Date
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer"
                        onClick={() => handleSort("type")}
                      >
                        Type
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Bill to
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("qty")}
                      >
                        Quantity
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("discount")}
                      >
                        Discount
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("total")}
                      >
                        Total
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("paid_amount")}
                      >
                        Paid
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("payment_method")}
                      >
                        Payment method
                      </th>
                      <th
                        className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right cursor-pointer"
                        onClick={() => handleSort("due_amount")}
                      >
                        Due amount
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        Status
                      </th>
                      <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-center last:rounded-r-xl">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.length > 0 ? (
                      <>
                        {data.data.map((invoice) => (
                          <tr
                            key={invoice.id}
                            className={`bg-white transition hover:bg-slate-50/70 ${
                              selectedOptions.includes(invoice.id)
                                ? "bg-blue-50/70"
                                : ""
                            }`}
                          >
                            <td className="border-b border-slate-100 px-4 py-4">
                              <label>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  onChange={() => handleSelect(invoice)}
                                  checked={selectedOptions.includes(invoice.id)}
                                />
                              </label>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                              {invoice.invoice_no || "N/A"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                              {invoice.date
                                ? new Date(invoice.date).toLocaleDateString()
                                : "N/A"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4">
                              {invoice.type === "sale" ? (
                                <div className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Sale
                                </div>
                              ) : invoice.type === "purchase" ? (
                                <div className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                  Purchase
                                </div>
                              ) : (
                                <div className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  Unknown
                                </div>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                              {invoice.customer?.name || invoice.supplier?.name || "N/A"}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {toNumber(invoice.qty).toLocaleString()}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {formatPrice(invoice.discount || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-950">
                              {formatPrice(invoice.total || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-slate-900">
                              {formatPrice(invoice.paid_amount || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm text-slate-600">
                              {invoice.payment_method ? (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {invoice.payment_method}
                                </span>
                              ) : (
                                "N/A"
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-rose-600">
                              {formatPrice(invoice.due_amount || 0)}
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                {invoice.payment_status === 1 ? (
                                  <div className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    Paid
                                  </div>
                                ) : invoice.payment_status === 0 ? (
                                  <div className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                    Unpaid
                                  </div>
                                ) : (
                                  <div className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                    Due
                                  </div>
                                )}
                                {invoice.isFracture == 1 && (
                                  <div className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                    Fracture
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="border-b border-slate-100 px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                {hasPermission("invoice.edit") &&
                                  (invoice.payment_status === 0 ||
                                    invoice.payment_status === 2) && (
                                    <button
                                      type="button"
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                      onClick={() => handlePayment(invoice)}
                                      title="Make payment"
                                    >
                                      <PiCreditCard size={16} />
                                    </button>
                                  )}
                                {hasPermission("invoice.view") && (
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                                    onClick={() => handlePrint(invoice, false)}
                                    title="View invoice without customer info"
                                  >
                                    <LuScanEye size={16} />
                                  </button>
                                )}
                                {hasPermission("invoice.view") && (
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                                    onClick={() => handlePrint(invoice, true)}
                                    title="View invoice"
                                  >
                                    <PiEye size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}

                        <tr className="bg-slate-50">
                          <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                            Totals
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {totals.qty.toLocaleString()}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totals.discount)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totals.total)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900">
                            {formatPrice(totals.paid_amount)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-rose-600">
                            {formatPrice(totals.due_amount)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500">
                            -
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={13} className="px-4 py-10 text-center">
                          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8">
                            <p className="text-sm font-semibold text-slate-700">
                              No invoices found
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Try changing your filters or search term.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {data.data.length > 0 && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <Pagination
                      currentPage={data.meta.current_page || 1}
                      lastPage={data.meta.last_page || 1}
                      handlePrevious={handlePrevious}
                      handlePageChange={handlePageChange}
                      handleNextPage={handleNextPage}
                      showPrevious={currentPage > 1}
                      showNext={currentPage < (data.meta.last_page || 1)}
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

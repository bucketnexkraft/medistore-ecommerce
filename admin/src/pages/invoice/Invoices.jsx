import { useCallback, useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import { CiSearch } from "react-icons/ci";
import {
  PiCopy,
  PiMicrosoftExcelLogoFill,
  PiPlus,
  PiShieldCheck,
  PiSliders,
  PiTrash,
  PiEye,
  PiCreditCard, // Add this import for payment button
  PiEnvelope, // Email icon
} from "react-icons/pi";
import { useSelector, useDispatch } from "react-redux";
import Swal from "sweetalert2";
import TableLoading from "../../components/loadings/TableLoading";
import useSelectableList from "../../hooks/useSelectableList";
import { Link } from "react-router-dom";
import Pagination from "../../components/common/Pagination";
import { fetchPreferences } from "../../slice/preferencesSlice";
import {
  fetchingInvoiceList,
  deleteInvoice,
  deleteMultipleInvoices,
  sendInvoiceEmail,
} from "../../api/invoice";
import { getproductSettings } from "../../api/productSettings";
import { getUsers } from "../../api/timesheet";
import PrintableSaleReceipt from "../../components/printable-invoices/PrintableSaleReceipt";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LuPrinter } from "react-icons/lu";
import { formatPrice } from "../../hooks/currency";
import PaymentDrawer from "../../components/common/PaymentDrawer";
import { hasPermission } from "../../utils/permissions";
import { PermissionUtils } from "../../utils/permissionUtils";
import PrintableInvoiceList from "../../components/printable-invoices/PrintableInvoiceList";

export default function Invoices({ forcedType = "" }) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { data: prefData } = useSelector((state) => state.preferences);
  const company_id = useSelector((state) => state.auth.company_id);
  const dispatch = useDispatch();
  const stockTrackingEnabled = ![false, 0, "0", "false"].includes(prefData?.stock_tracking_enabled);
  const [salesmen, setSalesmen] = useState([]);
  const [data, setData] = useState({ 
    data: [], 
    meta: {}, 
    summary: {
      sales: { qty: 0, discount: 0, total: 0, paid_amount: 0, due_amount: 0, cash: 0, card: 0, payment_methods: {} },
      purchases: { qty: 0, discount: 0, total: 0, paid_amount: 0, due_amount: 0, cash: 0, card: 0, payment_methods: {} },
      grand: { qty: 0, discount: 0, total: 0, paid_amount: 0, due_amount: 0, cash: 0, card: 0, payment_methods: {} },
    }
  });
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
  const [showPrintListModal, setShowPrintListModal] = useState(false);
  const [printInvoices, setPrintInvoices] = useState([]);
  const [printListLoading, setPrintListLoading] = useState(false);
  const [allowInvoiceDeleteFeature, setAllowInvoiceDeleteFeature] =
    useState(false);

  // Add payment drawer states
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] =
    useState(null);

  // Add email modal states
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: "" });

  const filterRef = useRef(null);
  const isTypeLocked = forcedType === "sale" || forcedType === "purchase" || forcedType === "quotation";
  const isQuotationPage = forcedType === "quotation";
  const documentLabel = isQuotationPage ? "Quotation" : "Invoice";

  const { control, watch, setValue, handleSubmit, reset } = useForm({
    defaultValues: {
      search: "",
      type: forcedType || "",
      status: "",
      salesman: "",
      dateRange: [null, null],
      lastPaymentDateRange: [null, null],
    },
  });
  const activeTypeFilter = isTypeLocked ? forcedType : watch().type;

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(data?.data || []);

  // Fetch invoice data
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
        filterType: activeTypeFilter,
        filterText: watch().search.trim(),
        statusFilter: isQuotationPage ? "" : watch().status,
        filterUser: watch().salesman || "",
        startDate: watch().dateRange[0] ? formatDate(watch().dateRange[0]) : "",
        endDate: watch().dateRange[1] ? formatDate(watch().dateRange[1]) : "",
        lastPaymentStartDate: !isQuotationPage && watch().lastPaymentDateRange[0]
          ? formatDate(watch().lastPaymentDateRange[0])
          : "",
        lastPaymentEndDate: !isQuotationPage && watch().lastPaymentDateRange[1]
          ? formatDate(watch().lastPaymentDateRange[1])
          : "",
        sortField,
        sortOrder,
        page: currentPage,
      };

      const result = await fetchingInvoiceList(accessToken, params);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch invoices");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
        summary: result.summary || {
          sales: { qty: 0, discount: 0, total: 0, paid_amount: 0, due_amount: 0, cash: 0, card: 0, payment_methods: {} },
          purchases: { qty: 0, discount: 0, total: 0, paid_amount: 0, due_amount: 0, cash: 0, card: 0, payment_methods: {} },
          grand: { qty: 0, discount: 0, total: 0, paid_amount: 0, due_amount: 0, cash: 0, card: 0, payment_methods: {} },
        },
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
  }, [accessToken, perPage, currentPage, sortField, sortOrder, watch, activeTypeFilter, isQuotationPage]);

  const fetchSalesmen = useCallback(async () => {
    if (!hasPermission("invoice.edit")) {
      return;
    }

    try {
      const result = await getUsers(accessToken);
      if (result?.status) {
        setSalesmen(Array.isArray(result.data) ? result.data : []);
      } else {
        setSalesmen([]);
      }
    } catch (error) {
      console.error("Fetch salesmen error:", error);
      setSalesmen([]);
    }
  }, [accessToken]);

  const fetchFeaturePreferences = useCallback(async () => {
    try {
      const result = await getproductSettings(accessToken);
      const assignedPreferences = result?.data?.preferences || [];
      const deletePreference = assignedPreferences.find(
        (preference) => preference.code === "ftr_allow_invoice_delete"
      );

      const isAllowed =
        typeof result?.data?.allow_invoice_delete !== "undefined"
          ? Boolean(Number(result.data.allow_invoice_delete))
          : Boolean(deletePreference?.is_active);

      setAllowInvoiceDeleteFeature(isAllowed);
    } catch (error) {
      console.error("Fetch feature preferences error:", error);
      setAllowInvoiceDeleteFeature(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSalesmen();
  }, [fetchSalesmen]);

  useEffect(() => {
    if (accessToken) {
      fetchFeaturePreferences();
    }
  }, [accessToken, fetchFeaturePreferences]);

  // Handle payment button click
  const handlePayment = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentDrawerOpen(true);
  };

  // Handle payment success callback
  const handlePaymentSuccess = () => {
    setLoadData(true); // Reload the invoice list
  };

  // Handle email button click
  const handleEmail = (invoice) => {
    setSelectedInvoiceForEmail(invoice);
    // Set default email from customer or supplier
    const defaultEmail = invoice.customer?.email || invoice.supplier?.email || "";
    setEmailForm({ email: defaultEmail });
    setEmailModalOpen(true);
  };

  // Handle email form submission
  const handleEmailSubmit = async () => {
    if (!emailForm.email.trim()) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Please enter an email address",
      });
      return;
    }

    const isQuotationEmail = selectedInvoiceForEmail?.type === "quotation";
    const emailDocumentLabel = isQuotationEmail ? "Quotation" : "Invoice";

    setEmailSending(true);
    try {
      const result = await sendInvoiceEmail(accessToken, selectedInvoiceForEmail.id, {
        email: emailForm.email,
      });

      if (result?.status) {
        Swal.fire({
          icon: "success",
          title: "Email Queued!",
          text: `${emailDocumentLabel} email will be sent to ${emailForm.email}`,
          showConfirmButton: false,
          timer: 2000,
        });
        setEmailModalOpen(false);
        setEmailForm({ email: "" });
        setSelectedInvoiceForEmail(null);
      } else {
        throw new Error(result?.message || `Failed to send ${emailDocumentLabel.toLowerCase()} email`);
      }
    } catch (error) {
      console.error("Send email error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Failed to send email",
      });
    } finally {
      setEmailSending(false);
    }
  };

  // Handle email modal close
  const handleEmailModalClose = () => {
    setEmailModalOpen(false);
    setEmailForm({ email: "" });
    setSelectedInvoiceForEmail(null);
  };

  // Export to CSV
  const getSelectedOrVisibleInvoices = useCallback(() => {
    if (selectedOptions.length > 0) {
      return data.data.filter((item) => selectedOptions.includes(item.id));
    }
    return data.data;
  }, [data.data, selectedOptions]);

  // Export to CSV
  const exportToExcel = useCallback(() => {
    setExporting(true);
    try {
      const headers = isQuotationPage ? [
        "Quotation No",
        "Date",
        "Type",
        "Customer",
        "Quantity",
        "Discount",
        "Tax",
        "Total",
        "Fracture",
      ] : [
        "Invoice No",
        "Date",
        "Type",
        "Customer/Supplier",
        "Quantity",
        "Discount",
        "Tax",
        "Total",
        "Last Payment Date",
        "Last Payment Amount",
        "Status",
        "Fracture",
      ];
      const exportData = getSelectedOrVisibleInvoices();
      const rows = exportData.map((item) => isQuotationPage ? [
        item.invoice_no || "N/A",
        item.date ? new Date(item.date).toLocaleDateString() : "N/A",
        item.type || "N/A",
        item.customer?.name || item.supplier?.name || "N/A",
        item.qty || 0,
        item.discount || 0,
        item.tax || 0,
        item.total || 0,
        item.isFracture == 1 ? "Yes" : "No",
      ] : [
        item.invoice_no || "N/A",
        item.date ? new Date(item.date).toLocaleDateString() : "N/A",
        item.type || "N/A",
        item.customer?.name || item.supplier?.name || "N/A",
        item.qty || 0,
        item.discount || 0,
        item.tax || 0,
        item.total || 0,
        getLastPaymentInfo(item)?.date
          ? new Date(getLastPaymentInfo(item).date).toLocaleDateString()
          : "N/A",
        getLastPaymentInfo(item)?.amount || 0,
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
      link.download = `${isQuotationPage ? "quotations" : "invoices"}_export_${
        new Date().toISOString().split("T")[0]
      }.csv`;
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
  }, [getSelectedOrVisibleInvoices, isQuotationPage]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      const exportData = getSelectedOrVisibleInvoices();
      const text = exportData
        .map((item) =>
          isQuotationPage
            ? `${item.invoice_no || ""},${
              item.date ? new Date(item.date).toLocaleDateString() : ""
            },${item.type || ""},${
              item.customer?.name || item.supplier?.name || ""
            },${item.qty || 0},${Number(item.discount || 0).toFixed(
              2
            )},${Number(item.tax || 0).toFixed(2)},${Number(
              item.total || 0
            ).toFixed(2)},${item.isFracture == 1 ? "Yes" : "No"}`
            : `${item.invoice_no || ""},${
              item.date ? new Date(item.date).toLocaleDateString() : ""
            },${item.type || ""},${
              item.customer?.name || item.supplier?.name || ""
            },${item.qty || 0},${Number(item.discount || 0).toFixed(
              2
            )},${Number(item.tax || 0).toFixed(2)},${Number(
              item.total || 0
            ).toFixed(2)},${
              getLastPaymentInfo(item)?.date
                ? new Date(getLastPaymentInfo(item).date).toLocaleDateString()
                : "N/A"
            },${Number(getLastPaymentInfo(item)?.amount || 0).toFixed(2)},${
              item.payment_status === 1
                ? "Paid"
                : item.payment_status === 0
                ? "Unpaid"
                : "Partially Paid"
            },${item.isFracture == 1 ? "Yes" : "No"}`
        )
        .join("\n");
      const clipboardText = isQuotationPage
        ? `Quotation No,Date,Type,Customer,Quantity,Discount,Tax,Total,Fracture\n${text}`
        : `Invoice No,Date,Type,Customer/Supplier,Quantity,Discount,Tax,Total,Last Payment Date,Last Payment Amount,Status,Fracture\n${text}`;
      await navigator.clipboard.writeText(clipboardText);
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
  }, [getSelectedOrVisibleInvoices, isQuotationPage]);

  const handlePrintList = useCallback(async () => {
    setPrintListLoading(true);
    try {
      const params = {
        perPage: "all",
        page: 1,
        filterType: activeTypeFilter,
        filterText: watch().search.trim(),
        statusFilter: isQuotationPage ? "" : watch().status,
        filterUser: watch().salesman || "",
        startDate: watch().dateRange[0] ? formatDate(watch().dateRange[0]) : "",
        endDate: watch().dateRange[1] ? formatDate(watch().dateRange[1]) : "",
        lastPaymentStartDate: !isQuotationPage && watch().lastPaymentDateRange[0]
          ? formatDate(watch().lastPaymentDateRange[0])
          : "",
        lastPaymentEndDate: !isQuotationPage && watch().lastPaymentDateRange[1]
          ? formatDate(watch().lastPaymentDateRange[1])
          : "",
        sortField,
        sortOrder,
      };

      const result = await fetchingInvoiceList(accessToken, params);
      const printData = Array.isArray(result?.data) ? result.data : [];

      if (printData.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "No Data",
          text: `No ${isQuotationPage ? "quotations" : "invoices"} available to print.`,
        });
        return;
      }

      setPrintInvoices(printData);
      setShowPrintListModal(true);
    } catch (error) {
      console.error("Fetch print invoices error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || `Failed to load ${isQuotationPage ? "quotations" : "invoices"} for print`,
      });
    } finally {
      setPrintListLoading(false);
    }
  }, [accessToken, sortField, sortOrder, watch, activeTypeFilter, isQuotationPage]);

  // Handle column sorting
  const handleSort = useCallback(
    (field) => {
      setSortField(field);
      setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
      setCurrentPage(1);
      setLoadData(true);
    },
    [sortField, sortOrder]
  );

  // Handle single invoice deletion
  const handleDelete = async (id) => {
    if (!canDeleteInvoice) {
      Swal.fire({
        icon: "error",
        title: "Unauthorized",
        text: `${documentLabel} delete is not allowed for this company.`,
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Do you want to delete this ${documentLabel.toLowerCase()}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        const deleteResult = await deleteInvoice(accessToken, id);
        if (deleteResult?.status) {
          Swal.fire({
            icon: "success",
            title: "Deleted!",
            text: `${documentLabel} deleted successfully`,
            showConfirmButton: false,
            timer: 1500,
          });
          setLoadData(true);
        } else {
          throw new Error(deleteResult?.message || `Failed to delete ${documentLabel.toLowerCase()}`);
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || `Failed to delete ${documentLabel.toLowerCase()}`,
        });
      }
    }
  };

  // Handle multiple invoice deletion
  const handleMultipleDelete = async () => {
    if (!canDeleteInvoice) {
      Swal.fire({
        icon: "error",
        title: "Unauthorized",
        text: `${documentLabel} delete is not allowed for this company.`,
      });
      return;
    }

    if (selectedOptions.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No Selection",
        text: `Please select at least one ${documentLabel.toLowerCase()} to delete`,
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Do you want to delete ${selectedOptions.length} ${documentLabel.toLowerCase()}(s)?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete them!",
    });

    if (result.isConfirmed) {
      try {
        const deleteResult = await deleteMultipleInvoices(
          accessToken,
          selectedOptions
        );
        if (deleteResult?.status) {
          Swal.fire({
            icon: "success",
            title: "Deleted!",
            text: `${documentLabel}s deleted successfully`,
            showConfirmButton: false,
            timer: 1500,
          });
          setLoadData(true);
          clearSelection();
        } else {
          throw new Error(deleteResult?.message || `Failed to delete ${documentLabel.toLowerCase()}s`);
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || `Failed to delete ${documentLabel.toLowerCase()}s`,
        });
      }
    }
  };

  // Handle invoice printing
  const handlePrint = (invoice, withCustomerInfo) => {
    setPrintInvoice(invoice);
    setPrintWithCustomerInfo(withCustomerInfo);
  };

  const getLastPaymentInfo = (invoice) => {
    const date = invoice?.last_payment_date || null;
    const amount =
      invoice?.last_payment_amount !== null &&
      invoice?.last_payment_amount !== undefined
        ? Number(invoice.last_payment_amount)
        : null;

    if (!date && amount === null) {
      return null;
    }

    return { date, amount };
  };

  // Calculate totals
  const totals = data.data.reduce(
    (acc, item) => ({
      qty: acc.qty + (Number(item.qty) || 0),
      discount: acc.discount + (Number(item.discount) || 0),
      tax: acc.tax + (Number(item.tax) || 0),
      total: acc.total + (Number(item.total) || 0),
      paid_amount: acc.paid_amount + (Number(item.paid_amount) || 0),
      due_amount: acc.due_amount + (Number(item.due_amount) || 0),
    }),
    { qty: 0, discount: 0, tax: 0, total: 0, paid_amount: 0, due_amount: 0 }
  );

  // Pagination handlers
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

  // Handle filter submit
  const onFilterSubmit = useCallback(() => {
    setShowFilter(false);
    setCurrentPage(1);
    setLoadData(true);
  }, []);

  // Reset filters
  const handleReset = () => {
    reset({
      search: "",
      type: forcedType || "",
      status: "",
      salesman: "",
      dateRange: [null, null],
      lastPaymentDateRange: [null, null],
    });
    setLoadData(true);
  };

  // Fetch data and preferences
  useEffect(() => {
    if (loadData) {
      fetchData();
    }
  }, [fetchData, loadData]);

  useEffect(() => {
    dispatch(fetchPreferences(company_id));
  }, [dispatch]);

  useEffect(() => {
    if (isTypeLocked) {
      setValue("type", forcedType, { shouldDirty: false, shouldValidate: false });
    }
  }, [forcedType, isTypeLocked, setValue]);

  // Click outside to close filters
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (watch().search.trim()) {
        setCurrentPage(1);
        setLoadData(true);
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [watch().search]);

  const companyInfo = {
    name: prefData?.application_name || "N/A",
    address: prefData?.application_address || "N/A",
    phone: prefData?.application_phone || "N/A",
    email: prefData?.application_email || "N/A",
    logo: prefData?.site_logo || "",
    footerNote: "Thank you for your business!",
  };
  const { sales = {}, purchases = {}, grand = {} } = data.summary || {};

  const renderPaymentMethodBreakdown = (summaryRow) => {
    const paymentMethods = summaryRow?.payment_methods || {};
    const entries = Object.entries(paymentMethods).filter(
      ([, amount]) => Number(amount || 0) > 0
    );

    if (entries.length > 0) {
      return entries.map(([method, amount]) => (
        <div key={method}>
          {method}: {formatPrice(amount)}
        </div>
      ));
    }

    return (
      <>
        <div>Cash: {formatPrice(summaryRow?.cash || 0)}</div>
        <div>Card: {formatPrice(summaryRow?.card || 0)}</div>
      </>
    );
  };

  const getPaymentMethodBadgeClass = (paymentMethod) => {
    const method = String(paymentMethod || "").trim().toLowerCase();

    if (method.includes("cash")) {
      return "bg-emerald-100 text-emerald-800";
    }

    if (method.includes("card")) {
      return "bg-red-100 text-red-800";
    }

    if (method.includes("bank")) {
      return "bg-violet-100 text-violet-800";
    }

    if (method.includes("cheque") || method.includes("check")) {
      return "bg-amber-100 text-amber-800";
    }

    return "bg-slate-100 text-slate-800";
  };

  const canDeleteInvoice = PermissionUtils.isAccessable({
    rightKey: "invoice.delete",
    featureEnabled: allowInvoiceDeleteFeature,
  });
  const pageTitle = forcedType === "sale"
    ? "Sale Invoice Management"
    : forcedType === "purchase"
      ? "Purchase Invoice Management"
      : forcedType === "quotation"
        ? "Quotation Management"
      : "Invoice Management";
  const listTitle = forcedType === "sale"
    ? "Sale Invoice List"
    : forcedType === "purchase"
      ? "Purchase Invoice List"
      : forcedType === "quotation"
        ? "Quotation List"
      : "Invoice List";
  const pageSummary = forcedType === "purchase"
    ? purchases
    : forcedType === "sale"
      ? sales
      : grand;
  const openDueCount = data.data.filter(
    (invoice) => !isQuotationPage && Number(invoice.due_amount || 0) > 0
  ).length;
  const metricCardClass =
    "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] figtree-regular">
      {/* Payment Drawer */}
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

      {/* Email Modal */}
      {emailModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box relative">
            <button
              className="btn btn-sm btn-circle absolute right-2 top-2"
              onClick={handleEmailModalClose}
            >
              ✕
            </button>
            <h3 className="font-bold text-lg mb-4">
              Send {selectedInvoiceForEmail?.type === "quotation" ? "Quotation" : "Invoice"} via Email
            </h3>
            <div className="py-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Recipient Email</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  className="input input-bordered w-full"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm({ email: e.target.value })}
                />
                <label className="label">
                  <span className="label-text-alt">
                    {selectedInvoiceForEmail?.customer?.email || 
                     selectedInvoiceForEmail?.supplier?.email ? 
                     `Default: ${selectedInvoiceForEmail?.customer?.email || selectedInvoiceForEmail?.supplier?.email}` : 
                     'No email on record, please enter manually'}
                  </span>
                </label>
              </div>
              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text">
                    {selectedInvoiceForEmail?.type === "quotation" ? "Quotation" : "Invoice"} Details
                  </span>
                </label>
                <div className="bg-gray-100 p-3 rounded text-sm">
                  <p>
                    <strong>
                      {selectedInvoiceForEmail?.type === "quotation" ? "Quotation" : "Invoice"} No:
                    </strong>{" "}
                    {selectedInvoiceForEmail?.invoice_no}
                  </p>
                  <p><strong>Date:</strong> {selectedInvoiceForEmail?.date ? new Date(selectedInvoiceForEmail.date).toLocaleDateString() : 'N/A'}</p>
                  <p><strong>Total:</strong> {formatPrice(selectedInvoiceForEmail?.total || 0)}</p>
                  <p><strong>Customer/Supplier:</strong> {selectedInvoiceForEmail?.customer?.name || selectedInvoiceForEmail?.supplier?.name || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={handleEmailModalClose}
              >
                Cancel
              </button>
              <button
                className={`btn btn-primary ${emailSending ? 'loading' : ''}`}
                onClick={handleEmailSubmit}
                disabled={emailSending}
              >
                {emailSending ? 'Queuing...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {printInvoice && (
        <PrintableSaleReceipt
          invoice={printInvoice}
          withCustomerInfo={printWithCustomerInfo}
          onClose={() => setPrintInvoice(null)}
          companyInfo={companyInfo}
        />
      )}
      {showPrintListModal && (
        <PrintableInvoiceList
          open={showPrintListModal}
          onClose={() => setShowPrintListModal(false)}
          invoices={printInvoices}
          filters={{
            search: watch().search?.trim() || "",
            type: activeTypeFilter || "",
            status: watch().status || "",
            dateRange:
              watch().dateRange?.[0] && watch().dateRange?.[1]
                ? `${formatDate(watch().dateRange[0])} to ${formatDate(
                    watch().dateRange[1]
                  )}`
                : "",
            lastPaymentDateRange:
              watch().lastPaymentDateRange?.[0] &&
              watch().lastPaymentDateRange?.[1]
                ? `${formatDate(watch().lastPaymentDateRange[0])} to ${formatDate(
                    watch().lastPaymentDateRange[1]
                  )}`
                : "",
          }}
          generatedAt={new Date().toISOString()}
        />
      )}
      <div className="relative p-5 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiShieldCheck size={14} />
              Invoices
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{pageTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              {isQuotationPage
                ? "Manage quotations from one place."
                : "Manage invoices, track supplier dues, and record payments from one place."}
            </p>
          </div>
          {!isQuotationPage && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[620px]">
              <div className={metricCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Invoices</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{data.meta.total || data.data.length || 0}</p>
              </div>
              <div className={metricCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatPrice(pageSummary?.total || totals.total)}</p>
              </div>
              <div className={metricCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Paid</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">{formatPrice(pageSummary?.paid_amount || totals.paid_amount)}</p>
              </div>
              <div className={metricCardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Due</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">{formatPrice(pageSummary?.due_amount || totals.due_amount)}</p>
              </div>
            </div>
          )}
        </div>
        <div className="w-full mt-5 max-w-5xl" ref={filterRef}>
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <div className="relative flex items-center">
              <Controller
                control={control}
                name="search"
                render={({ field }) => (
                  <input
                    type="text"
                    placeholder={`Search ${isQuotationPage ? "quotation" : "invoice"}...`}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className="absolute right-2 flex -translate-y-1/2 items-center gap-1 top-1/2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                  onClick={() => {
                    if (watch().search.trim() !== "") {
                      setCurrentPage(1);
                      setLoadData(true);
                    }
                  }}
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
                >
                  <PiSliders fontSize={20} />
                </button>
              </div>
            </div>
          </div>

          {showFilter && (
            <div className="mt-3 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
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
                        onChange={(dates) => setValue("dateRange", dates)}
                        placeholderText="Select date range"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                        isClearable
                      />
                    )}
                  />
                </div>
                {!isQuotationPage && (
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Last payment date
                    </label>
                    <Controller
                      control={control}
                      name="lastPaymentDateRange"
                      render={({ field }) => (
                        <DatePicker
                          selectsRange
                          startDate={field.value[0]}
                          endDate={field.value[1]}
                          onChange={(dates) => setValue("lastPaymentDateRange", dates)}
                          placeholderText="Select last payment range"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                          isClearable
                        />
                      )}
                    />
                  </div>
                )}
                {!isTypeLocked && (
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
                          <option value="quotation">Quotation</option>
                        </select>
                      )}
                    />
                  </div>
                )}
                {!isQuotationPage && (
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
                          <option value="paid">Paid</option>
                          <option value="unpaid">Unpaid</option>
                          <option value="partially_paid">Partially Paid</option>
                        </select>
                      )}
                    />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Salesman
                  </label>
                  <Controller
                    control={control}
                    name="salesman"
                    render={({ field }) => (
                      <select
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={!hasPermission("invoice.edit")}
                      >
                        <option value="">All Salesmen</option>
                        {salesmen.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  {!hasPermission("invoice.edit") && (
                    <p className="mt-1 text-xs text-slate-500">
                      Salesman filter is available only for users with invoice.edit permission.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  onClick={handleReset}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-xl border-0 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={handleSubmit(onFilterSubmit)}
                >
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-3 px-4">
          <div>
            <h5 className="font-semibold text-gray-900">{listTitle}</h5>
            {!isQuotationPage && (
              <p className="text-xs text-gray-500">
                {openDueCount} invoice{openDueCount === 1 ? "" : "s"} need payment on this page.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className={`inline-flex h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700 disabled:opacity-100 ${
                exporting ? "opacity-100" : ""
              }`}
              title="Export to CSV"
              disabled={exporting || loading}
            >
              <PiMicrosoftExcelLogoFill size={20} />
              <span>{exporting ? "Exporting..." : "Export"}</span>
            </button>
            <button
              onClick={handlePrintList}
              className={`inline-flex h-12 items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-indigo-200 disabled:bg-indigo-50 disabled:text-indigo-700 disabled:opacity-100 ${
                printListLoading ? "opacity-100" : ""
              }`}
              title={`Print ${documentLabel} List`}
              disabled={loading || printListLoading}
            >
              <LuPrinter size={18} />
              <span>{printListLoading ? "Printing..." : "Print"}</span>
            </button>
            <button
              onClick={copyToClipboard}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
              title="Copy to Clipboard"
            >
              <PiCopy size={20} />
              <span>Copy</span>
            </button>
            {canDeleteInvoice && selectedOptions.length > 0 && (
              <button
                onClick={handleMultipleDelete}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                title="Delete Multiple"
              >
                <PiTrash className="" />
                Delete ({selectedOptions.length})
              </button>
            )}
            {!isQuotationPage && stockTrackingEnabled && hasPermission("stock-in.create") && (
              <Link
                to="/purchases/create"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
              >
                <PiPlus className="" />
                Stock In
              </Link>
            )}
            {hasPermission("stock-out.create") && (
              <Link to="/pos" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
                <PiPlus className="" />
                Stock Out
              </Link>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <>
              <table className="table table-zebra figtree-regular">
                <thead className="sticky top-0 z-10 bg-gray-100 text-xs font-semibold uppercase tracking-normal text-gray-600">
                  <tr>
                    <th className="w-0.5/12">
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
                      className="w-1.5/12 cursor-pointer"
                      onClick={() => handleSort("invoice_no")}
                    >
                      {documentLabel} No{" "}
                      {sortField === "invoice_no" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1.5/12 cursor-pointer"
                      onClick={() => handleSort("date")}
                    >
                      Date{" "}
                      {sortField === "date" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("type")}
                    >
                      Type{" "}
                      {sortField === "type" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12">Bill To</th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("qty")}
                    >
                      Quantity{" "}
                      {sortField === "qty" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("discount")}
                    >
                      Discount{" "}
                      {sortField === "discount" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    {/* <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("tax")}
                    >
                      Tax{" "}
                      {sortField === "tax" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th> */}
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("total")}
                    >
                      Total{" "}
                      {sortField === "total" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    {!isQuotationPage && (
                      <>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("paid_amount")}
                    >
                      Paid Amount{" "}
                      {sortField === "paid_amount" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("payment_method")}
                    >
                      Payment Method{" "}
                      {sortField === "payment_method" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("due_amount")}
                    >
                      Due Amount{" "}
                      {sortField === "due_amount" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-1.5/12">LP Date</th>
                    <th className="w-1.5/12">LP Amount</th>
                    <th className="w-1.5/12">Status</th>
                      </>
                    )}
                    <th className="w-1.5/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length > 0 ? (
                    data.data.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className={`hover align-middle ${
                          selectedOptions.includes(invoice.id)
                            ? "bg-blue-100"
                            : ""
                        }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(invoice)}
                              checked={selectedOptions.includes(invoice.id)}
                            />
                          </label>
                        </th>
                        <td className="w-1.5/12">
                          <div className="font-semibold text-gray-900">
                            {invoice.invoice_no || "N/A"}
                          </div>
                        </td>
                        <td className="w-1.5/12">
                          {invoice.date
                            ? new Date(invoice.date).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="w-1/12">
                          {invoice.type === "sale" ? (
                            <div className="badge badge-outline badge-success badge-sm">
                              Sale
                            </div>
                          ) : invoice.type === "purchase" ? (
                            <div className="badge badge-outline badge-primary badge-sm">
                              Purchase
                            </div>
                          ) : invoice.type === "quotation" ? (
                            <div className="badge badge-outline badge-warning badge-sm">
                              Quotation
                            </div>
                          ) : (
                            <div className="badge badge-outline badge-info badge-sm">
                              Unknown
                            </div>
                          )}
                        </td>
                        <td className="w-2/12">
                          <div className="font-medium text-gray-900">
                            {invoice.customer?.name ||
                              invoice.supplier?.name ||
                              "N/A"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {invoice.type === "purchase" ? "Supplier" : "Customer"}
                          </div>
                        </td>
                        <td className="w-1/12">{invoice.qty || 0}</td>
                        <td className="w-1/12">
                          {formatPrice(invoice.discount || 0)}
                        </td>
                        {/* <td className="w-1/12">
                          {formatPrice(invoice.tax || 0)}
                        </td> */}
                        <td className="w-1/12">
                          {formatPrice(invoice.total || 0)}
                        </td>
                        {!isQuotationPage && (
                          <>
                        <td className="w-1/12 font-semibold text-emerald-600">
                          {formatPrice(invoice.paid_amount || 0)}
                        </td>
                        <td className="w-1/12">
                          {invoice?.payment_method && (
                            <div
                              className={`badge badge-sm ${getPaymentMethodBadgeClass(
                                invoice.payment_method
                              )}`}
                            >
                              {invoice.payment_method}
                            </div>
                          )}
                        </td>
                        <td
                          className={`w-1/12 ${
                            invoice.due_amount > 0
                              ? "text-rose-600 font-bold"
                              : "text-gray-800"
                          }`}
                        >
                          {formatPrice(invoice.due_amount || 0)}
                        </td>
                        <td className="w-1.5/12">
                          {getLastPaymentInfo(invoice)?.date
                            ? new Date(getLastPaymentInfo(invoice).date).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="w-1.5/12">
                          {getLastPaymentInfo(invoice)
                            ? formatPrice(getLastPaymentInfo(invoice).amount || 0)
                            : "N/A"}
                        </td>
                        <td className="w-1.5/12">
                            <div className="flex flex-wrap items-center gap-2">
                            {invoice.payment_status === 1 ? (
                              <div className="badge badge-success text-white badge-sm">
                                Paid
                              </div>
                            ) : invoice.payment_status === 0 ? (
                              <div className="badge badge-error text-white badge-sm">
                                Unpaid
                              </div>
                            ) : (
                              <div className="badge badge-warning text-white badge-sm">
                                Due
                              </div>
                            )}
                            {invoice.isFracture == 1 && (
                              <div className="badge badge-info text-white badge-sm">
                                Fracture
                              </div>
                            )}
                          </div>
                        </td>
                          </>
                        )}
                        <th className="w-1.5/12">
                          <div className="flex min-w-[172px] items-center justify-center gap-2">
                            {/* Email button */}
                            {hasPermission("invoice.view") && (
                              <button
                                className="btn btn-sm border-none bg-blue-100 text-blue-600 hover:bg-blue-200"
                                onClick={() => handleEmail(invoice)}
                                title={`Send ${invoice.type === "quotation" ? "Quotation" : "Invoice"} via Email`}
                              >
                                <PiEnvelope fontSize={16} />
                              </button>
                            )}
                            {/* Payment button - only show for unpaid or partially paid invoices */}
                            {hasPermission("invoice.edit") &&
                              invoice.type !== "quotation" &&
                              (invoice.payment_status === 0 ||
                                invoice.payment_status === 2) && (
                                <button
                                  className="btn btn-sm min-h-9 border-none bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                  onClick={() => handlePayment(invoice)}
                                  title="Make Payment"
                                >
                                  <PiCreditCard fontSize={16} />
                                </button>
                              )}
                            {hasPermission("invoice.view") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => handlePrint(invoice, true)}
                                title={`View ${invoice.type === "quotation" ? "Quotation" : "Invoice"}`}
                              >
                                <PiEye fontSize={16} />
                              </button>
                            )}
                            {canDeleteInvoice && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                onClick={() => handleDelete(invoice.id)}
                                title={`Delete ${invoice.type === "quotation" ? "Quotation" : "Invoice"}`}
                              >
                                <PiTrash fontSize={16} />
                              </button>
                            )}
                          </div>
                        </th>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isQuotationPage ? 9 : 15} className="text-center pt-4 pb-4">
                        No {isQuotationPage ? "quotations" : "invoices"} found
                      </td>
                    </tr>
                  )}
                  {data.data.length > 0 && (
                    <>
                    <tr className="bg-gray-100 font-semibold border-white">
                      <td colSpan="5" className="text-left">
                        Page Totals:
                      </td>
                      <td>{totals.qty}</td>
                      <td>{formatPrice(totals.discount)}</td>
                      {/* <td>
                        {formatPrice(totals.tax)}
                      </td> */}
                      <td>{formatPrice(totals.total)}</td>
                      {!isQuotationPage ? (
                        <>
                      <td>{formatPrice(totals.paid_amount)}</td>
                      <td></td>
                      <td>{formatPrice(totals.due_amount)}</td>
                      <td></td>
                      <td></td>
                      <td colSpan="2"></td>
                        </>
                      ) : (
                        <td></td>
                      )}
                    </tr>

                    {/* Sales Total */}
                      {!isQuotationPage && sales.total > 0 && (
                        <tr className="bg-gray-100 font-normal border-white">
                          <td colSpan="5">Sales Total</td>
                          <td>{sales.qty}</td>
                          <td>{formatPrice(sales.discount)}</td>
                          <td>{formatPrice(sales.total)}</td>
                          <td>{formatPrice(sales.paid_amount)}</td>
                          <td className="text-xs">
                            {renderPaymentMethodBreakdown(sales)}
                          </td>
                          <td >{formatPrice(sales.due_amount)}</td>
                          <td></td>
                          <td></td>
                          <td colSpan="2"></td>
                        </tr>
                      )}

                      {/* Purchases Total */}
                      {!isQuotationPage && purchases.total > 0 && (
                        <tr className="bg-gray-100 font-normal border-white">
                          <td colSpan="5">Purchases Total</td>
                          <td>{purchases.qty}</td>
                          <td>{formatPrice(purchases.discount)}</td>
                          <td>{formatPrice(purchases.total)}</td>
                          <td>{formatPrice(purchases.paid_amount)}</td>
                          <td className="text-xs">
                            {renderPaymentMethodBreakdown(purchases)}
                          </td>
                          <td className="text-red-600 font-bold">{formatPrice(purchases.due_amount)}</td>
                          <td></td>
                          <td></td>
                          <td colSpan="2"></td>
                        </tr>
                      )}

                      {/* Grand Total */}
                      {!isQuotationPage && (sales.total > 0 || purchases.total > 0) && (
                        <tr className="bg-gray-200 font-semibold">
                          <td colSpan="5" className="text-left">Grand Total</td>
                          <td>{grand.qty}</td>
                          <td>{formatPrice(grand.discount)}</td>
                          <td>{formatPrice(grand.total)}</td>
                          <td>{formatPrice(grand.paid_amount)}</td>
                          <td className="text-xs">
                            {renderPaymentMethodBreakdown(grand)}
                          </td>
                          <td className="text-red-700 font-bold">{formatPrice(grand.due_amount)}</td>
                          <td></td>
                          <td></td>
                          <td colSpan="2"></td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
              {data.data.length > 0 && (
                <Pagination
                  currentPage={data.meta.current_page || 1}
                  lastPage={data.meta.last_page || 1}
                  handlePrevious={handlePrevious}
                  handlePageChange={handlePageChange}
                  handleNextPage={handleNextPage}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < (data.meta.last_page || 1)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Invoices.propTypes = {
  forcedType: PropTypes.string,
};

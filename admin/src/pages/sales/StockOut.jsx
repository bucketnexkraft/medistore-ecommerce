import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { CiSearch } from "react-icons/ci";
import {
  PiCopy,
  PiMicrosoftExcelLogoFill,
  PiPlus,
  PiSliders,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import TableLoading from "../../components/loadings/TableLoading";
import { fetchingStockOutList } from "../../api/stock";
import { getSaleReturnPreview, submitSaleReturn, getSearchProducts } from "../../api/sales";
import { getCategories } from "../../api/category";
import { getBrands } from "../../api/brand";
import { getproductSettings } from "../../api/productSettings";
import Pagination from "../../components/common/Pagination";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import useSelectableList from "../../hooks/useSelectableList";
import { formatPrice } from "../../hooks/currency";
import { hasPermission } from "../../utils/permissions";
import noImage from "../../../public/images/no-images/no-img.jpg";
import Swal from "sweetalert2";

export default function StockOut({
  returnOnlyMode = false,
  onExitReturnOnly = null,
  onReturnItemsConfirmed = null,
}) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filterText, setFilterText] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [data, setData] = useState({ data: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loadData, setLoadData] = useState(true);
  const [categories, setCategories] = useState({ data: [], meta: {} });
  const [brands, setBrands] = useState({ data: [], meta: {} });
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [showReturnDrawer, setShowReturnDrawer] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnInvoiceInfo, setReturnInvoiceInfo] = useState(null);
  const [returnPolicyInfo, setReturnPolicyInfo] = useState(null);
  const [scanInput, setScanInput] = useState("");
  const [returnType, setReturnType] = useState("exchange");
  const [exchangeTotal, setExchangeTotal] = useState("");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [managerApproved, setManagerApproved] = useState(false);
  const [managerApprovalNote, setManagerApprovalNote] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [isSellReturnEnabled, setIsSellReturnEnabled] = useState(false);
  const [exchangeSearch, setExchangeSearch] = useState("");
  const [exchangeSuggestions, setExchangeSuggestions] = useState([]);
  const [exchangeItems, setExchangeItems] = useState([]);
  const [isExchangeSearching, setIsExchangeSearching] = useState(false);
  const [isLoadingReturnByInvoice, setIsLoadingReturnByInvoice] = useState(false);
  const filterRef = useRef(null);
  const canUseSellReturn = hasPermission("stock-out.view") && isSellReturnEnabled;
  const shouldLoadReturnToPos = typeof onReturnItemsConfirmed === "function";

  const invoiceReturnStates = useMemo(() => {
    return (data.data || []).reduce((states, row) => {
      const key = row?.invoice_id || row?.invoice_number;
      if (!key) {
        return states;
      }

      const current = states[key] || { hasReturned: false };
      states[key] = {
        hasReturned:
          current.hasReturned ||
          row?.is_fully_returned ||
          Number(row?.returned_qty || 0) > 0,
      };
      return states;
    }, {});
  }, [data.data]);

  const getReturnStatus = (row) => {
    const soldQty = Math.abs(Number(row?.sold_qty ?? row?.quantity ?? 0));
    const returnedQty = Math.abs(Number(row?.returned_qty || 0));
    const returnableQty = Math.max(Number(row?.returnable_qty ?? soldQty - returnedQty), 0);
    const invoiceKey = row?.invoice_id || row?.invoice_number;
    const invoiceHasReturned = invoiceReturnStates[invoiceKey]?.hasReturned;

    if (invoiceHasReturned) {
      return {
        label: "Return used",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    }

    if (soldQty > 0 && (row?.is_fully_returned || returnableQty <= 0)) {
      return {
        label: "Returned",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    }

    if (returnedQty > 0) {
      return {
        label: "Partially returned",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }

    return {
      label: "Returnable",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  };

  // Initialize useSelectableList
  const {
    selectedOptions,
    handleSelect,
    handleSelectAll,
    isAllSelectedOnCurrentPage,
  } = useSelectableList(data.data || []);

  // Fetch stock-out data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        perPage,
        filterText,
        filterCategory,
        filterBrand,
        sortField,
        sortOrder,
        page: currentPage,
        startDate: startDate ? startDate.toISOString().split('T')[0] : "",
        endDate: endDate ? endDate.toISOString().split('T')[0] : "",
      };
      const result = await fetchingStockOutList(accessToken, params);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch stock-out data");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch stock-out error:", error);
      setError(error.message || "Failed to load stock-out data");
      toast.error(error.message || "Failed to load stock-out data", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [
    accessToken,
    perPage,
    filterText,
    filterCategory,
    filterBrand,
    sortField,
    sortOrder,
    currentPage,
    startDate,
    endDate,
  ]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const params = {
        perPage: 100,
        status: "",
        search: filterText,
        sortField: "title",
        sortOrder: "asc",
        page: 1,
      };
      const result = await getCategories(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch categories");
      }
      setCategories({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch categories error:", error);
      toast.error(error.message || "Failed to load categories", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken, filterText]);

  // Fetch brands
  const fetchBrands = useCallback(async () => {
    try {
      const params = {
        perPage: 100,
        status: "",
        search: filterText,
        page: 1,
      };
      const result = await getBrands(accessToken, params);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch brands");
      }
      setBrands({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error("Fetch brands error:", error);
      toast.error(error.message || "Failed to load brands", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [accessToken, filterText]);

  // Handle column sorting
  const handleSort = useCallback(
    (field) => {
      setSortField(field);
      setSortOrder((prevOrder) =>
        sortField === field && prevOrder === "asc" ? "desc" : "asc"
      );
      setLoadData(true);
    },
    [sortField]
  );

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilterText("");
    setFilterBrand("");
    setFilterCategory("");
    setDateRange([null, null]);
    setSortField("created_at");
    setSortOrder("asc");
    setCurrentPage(1);
    setLoadData(true);
  }, []);

  // Export to Excel
  const exportToExcel = () => {
    if (data.data.length === 0) {
      toast.warning("No data to export", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;

    if (exportData.length === 0) {
      toast.warning("No items selected to export", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const headers = [
      "Invoice",
      "Date",
      "Product",
      "Variant",
      "Quantity",
      "Unit Price",
      "Discount",
      "Tax",
      "Total",
    ];

    // Helper function to escape CSV fields
    const escapeCsvField = (field) => {
      if (field == null) return "";
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const rows = exportData.map((item) => [
      escapeCsvField(item.invoice_number || "N/A"),
      escapeCsvField(String(item.date) || "N/A"),
      escapeCsvField(item.name || "N/A"),
      escapeCsvField(item.variant || "N/A"),
      escapeCsvField(item.quantity || 0),
      escapeCsvField(item.unit_price || 0),
      escapeCsvField(item.discount || 0),
      escapeCsvField(item.tax || 0),
      escapeCsvField(item.total || 0),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "StockOut.csv";
    link.click();
  };

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      const exportData =
        selectedOptions.length > 0
          ? data.data.filter((item) =>
              selectedOptions.some((option) => option.id === item.id)
            )
          : data.data;

      // Helper function to escape CSV fields
      const escapeCsvField = (field) => {
        if (field == null) return "";
        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
      };

      const text = exportData
        .map(
          (item) =>
            `${escapeCsvField(item.invoice_number || "")},${escapeCsvField(item.date || "")},${
              escapeCsvField(item.name || "")
            },${escapeCsvField(item.variant || "N/A")},${escapeCsvField(item.quantity || 0)},${escapeCsvField(item.unit_price || 0)},${escapeCsvField(item.discount || 0)},${escapeCsvField(item.tax || 0)},${escapeCsvField(item.total || 0)}`
        )
        .join("\n");
      const clipboardText = `Invoice No,Date,Product,Variant,Quantity,Unit Price,Discount,Tax,Total\n${text}`;
      await navigator.clipboard.writeText(clipboardText);
      toast.success("Data copied to clipboard", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
    } catch (error) {
      console.error("Copy to clipboard error:", error);
      toast.error("Failed to copy to clipboard", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  }, [data.data, selectedOptions]);

  // Calculate totals
  const totals = data.data.reduce(
    (acc, item) => ({
      quantity: acc.quantity + (Number(item.quantity) || 0),
      unit_price: acc.unit_price + (Number(item.unit_price) || 0),
      discount: acc.discount + Number(item.discount_amount || 0),
      tax: acc.tax + Number(item.tax || 0),
      total: acc.total + Number(item.total || 0),
    }),
    { quantity: 0, unit_price: 0, discount: 0, tax: 0, total: 0 }
  );

  // Pagination handlers
  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => prev + 1);
    setLoadData(true);
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
    setLoadData(true);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    setLoadData(true);
  }, []);

  // Handle search
  const handleSearch = useCallback(() => {
    if (filterText.trim() !== "") {
      setCurrentPage(1);
      setLoadData(true);
    }
  }, [filterText]);

  // Handle filter submit
  const onFilterSubmit = useCallback(() => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  }, []);

  // Handle filter change (no immediate fetch)
  const handleFilterChange = useCallback((key, value) => {
    if (key === "category") setFilterCategory(value);
    if (key === "brand") setFilterBrand(value);
    // Do not set loadData here to delay fetch until Search button
  }, []);

  const openReturnDrawer = useCallback((product) => {
    setReturnTarget(product);
    setReturnItems([]);
    setReturnPolicyInfo(null);
    setRefundMethod(product?.payment_method || "Cash");
    setShowReturnDrawer(true);
  }, []);

  const closeReturnDrawer = useCallback(() => {
    if (isReturning) {
      return;
    }
    setShowReturnDrawer(false);
    setReturnTarget(null);
    setReturnItems([]);
    setReturnInvoiceInfo(null);
    setReturnPolicyInfo(null);
    setScanInput("");
    setReturnType("exchange");
    setExchangeTotal("");
    setExchangeSearch("");
    setExchangeSuggestions([]);
    setExchangeItems([]);
    setRefundMethod("Cash");
    setManagerApproved(false);
    setManagerApprovalNote("");
    if (returnOnlyMode && typeof onExitReturnOnly === "function") {
      onExitReturnOnly();
    }
  }, [isReturning, onExitReturnOnly, returnOnlyMode]);

  useEffect(() => {
    if (!showReturnDrawer || !returnTarget?.invoice_id) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const response = await getSaleReturnPreview(accessToken, returnTarget.invoice_id);
        if (!active) return;
        if (!response?.status) {
          throw new Error(response?.message || "Failed to load return preview");
        }
        const previewItems = Array.isArray(response?.data?.items)
          ? response.data.items.map((item) => ({
              ...item,
              selected_qty: 0,
              reason_code: "changed_mind",
              is_damaged: false,
            }))
          : [];
        setReturnItems(previewItems);
        setReturnInvoiceInfo(response?.data?.invoice || null);
        setReturnPolicyInfo(response?.data?.policy || null);
      } catch (err) {
        toast.error(err?.error?.message || err?.message || "Failed to load return preview");
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, returnTarget, showReturnDrawer]);

  useEffect(() => {
    if (returnType !== "exchange") {
      return;
    }
    const total = exchangeItems.reduce(
      (sum, row) => sum + Number(row.qty || 0) * Number(row.unit_price || 0),
      0
    );
    setExchangeTotal(total ? total.toFixed(2) : "");
  }, [exchangeItems, returnType]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const result = await getproductSettings(accessToken);
        const assignedPreferences = result?.data?.preferences || [];
        const sellReturnPreference = assignedPreferences.find(
          (preference) => preference.code === "ftr_sell_return"
        );

        if (active) {
          setIsSellReturnEnabled(!!sellReturnPreference?.is_active);
        }
      } catch (_error) {
        if (active) {
          setIsSellReturnEnabled(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken]);

  const submitReturn = useCallback(async () => {
    if (!returnTarget) {
      toast.error("No sale line selected");
      return;
    }

    const lines = returnItems
      .filter((item) => Number(item.selected_qty || 0) > 0)
      .map((item) => ({
        invoice_item_id: item.invoice_item_id,
        qty: Number(item.selected_qty),
        reason_code: item.reason_code || "changed_mind",
        is_damaged: !!item.is_damaged,
      }));

    if (lines.length === 0) {
      toast.error("Select at least one return item");
      return;
    }
    if (!shouldLoadReturnToPos && returnType === "exchange" && exchangeItems.length === 0) {
      toast.error("Add at least one exchange product");
      return;
    }

    if (shouldLoadReturnToPos) {
      const selectedItems = returnItems
        .filter((item) => Number(item.selected_qty || 0) > 0)
        .map((item) => ({
          ...item,
          selected_qty: Math.min(
            Number(item.selected_qty || 0),
            Number(item.returnable_qty || 0)
          ),
          reason_code: item.reason_code || "changed_mind",
          is_damaged: !!item.is_damaged,
        }));

      onReturnItemsConfirmed({
        invoice: returnInvoiceInfo || {
          id: returnTarget.invoice_id,
          invoice_no: returnTarget.invoice_number,
        },
        items: selectedItems,
      });
      closeReturnDrawer();
      return;
    }

    const previewReturnAmount = lines.reduce((sum, line) => {
      const row = returnItems.find((x) => x.invoice_item_id === line.invoice_item_id);
      return sum + Number(row?.unit_price || 0) * Number(line.qty || 0);
    }, 0);
    const previewExchangeAmount = returnType === "exchange"
      ? exchangeItems.reduce((sum, row) => sum + Number(row.qty || 0) * Number(row.unit_price || 0), 0)
      : 0;
    const previewBalanceCredit = Math.max(previewReturnAmount - previewExchangeAmount, 0);
    const previewExtraPayable = Math.max(previewExchangeAmount - previewReturnAmount, 0);

    const confirmResult = await Swal.fire({
      title: "Confirm Return Submission",
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.6">
          <div><strong>Return Items:</strong> ${lines.length}</div>
          <div><strong>Return Amount:</strong> ${Number(previewReturnAmount || 0).toFixed(2)}</div>
          <div><strong>Exchange Amount:</strong> ${Number(previewExchangeAmount || 0).toFixed(2)}</div>
          <div><strong>Balance Credit:</strong> ${Number(previewBalanceCredit || 0).toFixed(2)}</div>
          <div><strong>Extra Payable:</strong> ${Number(previewExtraPayable || 0).toFixed(2)}</div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm Return",
      cancelButtonText: "Back",
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    const totalReverse = lines.reduce((sum, line) => {
      const row = returnItems.find((x) => x.invoice_item_id === line.invoice_item_id);
      return sum + Number(row?.unit_price || 0) * Number(line.qty || 0);
    }, 0);
    const exchangeAmount = Number(exchangeTotal || 0);
    const calculatedRefund = returnType === "exchange" ? Math.max(totalReverse - exchangeAmount, 0) : totalReverse;

    const payload = {
      items: lines,
      return_type: returnType,
      exchange_total: exchangeAmount,
      refund_amount: calculatedRefund,
      refund_method: refundMethod,
      manager_approved: managerApproved,
      manager_approval_note: managerApprovalNote,
      exchange_items:
        returnType === "exchange"
          ? exchangeItems.map((row) => ({
              inventory_item_id: row.inventory_item_id,
              product_id: row.product_id,
              inventory_id: row.inventory_id,
              lot_number: row.lot_number,
              qty: Number(row.qty || 0),
              unit_price: Number(row.unit_price || 0),
              barcode: row.barcode || null,
            }))
          : [],
    };

    try {
      setIsReturning(true);
      const response = await submitSaleReturn(accessToken, returnTarget.invoice_id, payload);
      await Swal.fire({
        icon: "success",
        title: "Return Processed",
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.7">
            <div><strong>Return Invoice:</strong> ${response?.data?.return_invoice_no || "N/A"}</div>
            <div><strong>Exchange Invoice:</strong> ${response?.data?.exchange_invoice_no || "N/A"}</div>
            <div><strong>Balance Credit:</strong> ${Number(response?.data?.refund_amount || 0).toFixed(2)}</div>
            <div><strong>Extra Payable:</strong> ${Number(response?.data?.extra_payable || 0).toFixed(2)}</div>
          </div>
        `,
      });
      closeReturnDrawer();
      setLoadData(true);
    } catch (err) {
      const message = err?.error?.message || err?.message || err?.data?.message || "Failed to process return";
      toast.error(message);
    } finally {
      setIsReturning(false);
    }
  }, [
    accessToken,
    closeReturnDrawer,
    exchangeItems,
    exchangeTotal,
    managerApprovalNote,
    managerApproved,
    onReturnItemsConfirmed,
    refundMethod,
    returnInvoiceInfo,
    returnItems,
    returnTarget,
    returnType,
    shouldLoadReturnToPos,
  ]);

  const handleScanAddQty = useCallback(() => {
    const normalize = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s\-_/]/g, "");
    const term = normalize(scanInput);
    if (!term) {
      return;
    }

    let updated = false;
    setReturnItems((prev) =>
      prev.map((item) => {
        const searchableFields = [
          item.code,
          item.product_name,
          item.lot_number,
          item.inventory_item_id,
          item.product_id,
        ];
        const matches = searchableFields
          .map((field) => normalize(field))
          .filter(Boolean)
          .some((field) => field === term || field.includes(term) || term.includes(field));

        if (!matches || updated || item.blocked_reason) {
          return item;
        }

        const currentQty = Number(item.selected_qty || 0);
        const maxQty = Number(item.returnable_qty || 0);
        if (currentQty >= maxQty) {
          return item;
        }

        updated = true;
        return {
          ...item,
          selected_qty: currentQty + 1,
        };
      })
    );

    if (!updated) {
      toast.error("No matching returnable product found for scanned code");
    }
    setScanInput("");
  }, [scanInput]);

  const searchExchangeProducts = useCallback(async () => {
    const term = String(exchangeSearch || "").trim();
    if (term.length < 2) {
      setExchangeSuggestions([]);
      return;
    }

    try {
      setIsExchangeSearching(true);
      const response = await getSearchProducts(accessToken, {
        query: term,
        for_return: 0,
        customer_id: null,
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setExchangeSuggestions(rows);
    } catch (_err) {
      setExchangeSuggestions([]);
      toast.error("Failed to search exchange products");
    } finally {
      setIsExchangeSearching(false);
    }
  }, [accessToken, exchangeSearch]);

  const addExchangeItem = useCallback((product) => {
    setExchangeItems((prev) => {
      const existingIndex = prev.findIndex(
        (row) =>
          String(row.inventory_item_id || "") ===
          String(product.inventory_item_id || "")
      );
      if (existingIndex >= 0) {
        return prev.map((row, idx) =>
          idx === existingIndex
            ? { ...row, qty: Number(row.qty || 0) + 1 }
            : row
        );
      }

      return [
        ...prev,
        {
          product_id: product.product_id || product.id,
          inventory_id: product.inventory_id,
          inventory_item_id: product.inventory_item_id,
          lot_number: product.lot_number || "",
          name: product.name,
          barcode: product.barcode || "",
          qty: 1,
          unit_price: Number(product.unitPrice ?? product.unit_price ?? 0),
          available_quantity: Number(product.available_quantity ?? product.stock ?? 0),
        },
      ];
    });
    setExchangeSearch("");
    setExchangeSuggestions([]);
  }, []);

  const openReturnByInvoiceNo = useCallback(async () => {
    const term = String(filterText || "").trim();
    if (!term) {
      toast.error("Enter receipt/invoice number");
      return;
    }

    try {
      setIsLoadingReturnByInvoice(true);
      const result = await fetchingStockOutList(accessToken, {
        perPage: 10,
        page: 1,
        filterText: term,
        filterCategory: "",
        filterBrand: "",
        returnableOnly: false,
        sortField: "created_at",
        sortOrder: "desc",
      });

      const rows = Array.isArray(result?.data) ? result.data : [];
      const invoiceRows = rows.filter(
        (row) =>
          row?.invoice_id &&
          row?.invoice_number &&
          String(row.invoice_number).toLowerCase() === term.toLowerCase()
      );
      const first = invoiceRows.find(
        (row) => Number(row.returnable_qty || 0) > 0 && !row.is_fully_returned
      ) || invoiceRows[0];

      if (!first) {
        toast.error("No matching sold invoice found");
        return;
      }

      const invoiceHasReturn = invoiceRows.some(
        (row) => row.is_fully_returned || Number(row.returned_qty || 0) > 0
      );
      if (invoiceHasReturn) {
        toast.error("This invoice has already been used for a return");
        return;
      }

      openReturnDrawer({
        invoice_id: first.invoice_id,
        invoice_number: first.invoice_number,
        payment_method: first.payment_method || "Cash",
      });
    } catch (_err) {
      toast.error("Failed to find invoice");
    } finally {
      setIsLoadingReturnByInvoice(false);
    }
  }, [accessToken, filterText, openReturnDrawer]);

  // Click outside to close advanced filters
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch data on load or when loadData changes
  useEffect(() => {
    if (loadData) {
      fetchData();
    }
  }, [fetchData, loadData]);

  // Fetch categories and brands on mount or when filterText changes
  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, [fetchCategories, fetchBrands, filterText]);

  useEffect(() => {
    if (returnOnlyMode) {
      setShowReturnDrawer(true);
    }
  }, [returnOnlyMode]);

  const selectedReturnItems = returnItems.filter(
    (row) => Number(row.selected_qty || 0) > 0
  );
  const returnSelectedCount = selectedReturnItems.length;
  const returnAmount = selectedReturnItems.reduce(
    (sum, row) => sum + Number(row.selected_qty || 0) * Number(row.unit_price || 0),
    0
  );
  const exchangeAmountCalculated = exchangeItems.reduce(
    (sum, row) => sum + Number(row.qty || 0) * Number(row.unit_price || 0),
    0
  );
  const netRefund = Math.max(returnAmount - exchangeAmountCalculated, 0);
  const netExtraPayable = Math.max(exchangeAmountCalculated - returnAmount, 0);
  const allowedReturnModes = Array.isArray(returnPolicyInfo?.allowed_return_modes)
    ? returnPolicyInfo.allowed_return_modes
    : ["refund", "exchange"];

  return (
    <div className="min-h-screen figtree-regular">
      {!returnOnlyMode && (
      <>
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Stock Out</h2>
        <p className="text-sm text-gray-600">
          Manage your stock-out records from this page. Use filters to narrow down results or create a new sale.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search invoice or product..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={filterText}
                onChange={(e) => {
                  setFilterText(e.target.value);
                  setLoadData(true);
                }}
                onKeyUp={(e) => {
                  if (e.key === "Enter" && filterText.trim() !== "") {
                    handleSearch();
                  }
                }}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={handleSearch}
                >
                  <CiSearch fontSize={20} />
                </button>
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                >
                  <PiSliders fontSize={20} />
                </button>
              </div>
            </div>
          </div>
          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Category</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                  value={filterCategory}
                  onChange={(e) =>
                    handleFilterChange("category", e.target.value)
                  }
                >
                  <option value="">All Categories</option>
                  {categories.data.map((category) => (
                    <option key={category?.id} value={category?.id}>
                      {category?.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Brand</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                  value={filterBrand}
                  onChange={(e) => handleFilterChange("brand", e.target.value)}
                >
                  <option value="">All Brands</option>
                  {brands.data.map((brand) => (
                    <option key={brand?.id} value={brand?.id}>
                      {brand?.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Date Range</span>
                </label>
                <DatePicker
                  selectsRange
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(update) => {
                    setDateRange(update);
                  }}
                  placeholderText="Select date range"
                  className="input input-bordered h-10 min-h-10 w-full"
                  wrapperClassName="w-full"
                  isClearable
                />
              </div>
              <div className="w-full flex justify-end gap-2">
                <button
                  className="btn btn-error btn-outline h-10 min-h-10"
                  onClick={resetFilters}
                >
                  Reset
                </button>
                <button className="btn h-10 min-h-10" onClick={onFilterSubmit}>
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">
            {returnOnlyMode ? "Returnable Sales" : "Stock Out List"}
          </h5>
          {!returnOnlyMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className="btn btn-outline btn-success"
                title="Export to Excel"
              >
                <PiMicrosoftExcelLogoFill size={20} />
              </button>
              <button
                onClick={copyToClipboard}
                className="btn btn-outline btn-info"
                title="Copy to Clipboard"
              >
                <PiCopy size={20} />
              </button>
              {hasPermission("stock-out.create") && (
                <Link to="/pos" className="btn btn-outline btn-primary">
                  <PiPlus className="" /> New Sale
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : error ? (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
              <button
                onClick={() => setLoadData(true)}
                className="btn btn-sm btn-primary"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <table className={`table figtree-regular ${returnOnlyMode ? "return-only-table" : ""}`}>
                <thead>
                  <tr className="bg-gray-100 font-semibold">
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
                      onClick={() => handleSort("invoice_number")}
                    >
                      Invoice No
                      {sortField === "invoice_number" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1.5/12 cursor-pointer"
                      onClick={() => handleSort("created_at")}
                    >
                      Date
                      {sortField === "created_at" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-2.5/12 cursor-pointer"
                      onClick={() => handleSort("product_id")}
                    >
                      Product
                      {sortField === "product_id" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th>Variant</th>
                    <th>Return Status</th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("qty")}
                    >
                      Quantity
                      {sortField === "qty" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("unit_price")}
                    >
                      Unit Price
                      {sortField === "unit_price" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("discount_amount")}
                    >
                      Discount
                      {sortField === "discount_amount" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("tax")}
                    >
                      VAT
                      {sortField === "vat" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("total")}
                    >
                      Total
                      {sortField === "total" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data?.length ? (
                    data.data.map((product) => (
                      <tr
                        key={product.id}
                        className={`hover ${
                          selectedOptions.includes(product.id)
                            ? "bg-blue-100"
                            : ""
                        }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(product)}
                              checked={selectedOptions.includes(product.id)}
                            />
                          </label>
                        </th>
                        <td className="w-1.5/12">
                          {product.invoice_number || "N/A"}
                        </td>
                        <td className="w-1.5/12">
                          {product.date
                            ? new Date(product.date).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="w-2.5/12">
                          <div className="flex items-center space-x-4">
                            <div className="avatar">
                              <div className="w-8 h-10 rounded">
                                <img
                                  src={product.product_info?.thumbnail || noImage}
                                  alt={product.name || "Product"}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {product.name || "N/A"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {product.code || "N/A"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>{product.variant || ""}</td>
                        <td>
                          {(() => {
                            const status = getReturnStatus(product);
                            return (
                              <div className="space-y-1">
                                <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                                  {status.label}
                                </span>
                                <div className="text-[11px] text-gray-500">
                                  Returned: {Number(product.returned_qty || 0)} / Returnable: {Number(product.returnable_qty || 0)}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="w-1/12">{product.quantity || 0}</td>
                        <td className="w-1/12">
                          {formatPrice(Number(product.unit_price || 0))}
                        </td>
                        <td className="w-1/12">
                          {formatPrice(Number(product.discount || 0))}
                        </td>
                        <td className="w-1/12">
                          {formatPrice(Number(product.vat || 0))}
                        </td>
                        <td className="w-1/12">
                          {formatPrice(Number(product.total || 0))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" className="text-center pt-4 pb-4">
                        No data found
                      </td>
                    </tr>
                  )}
                  {!returnOnlyMode && data.data?.length > 0 && (
                    <tr className="bg-gray-100 font-semibold">
                      <td colSpan="6" className="text-left">
                        Page Total:
                      </td>
                      <td>{totals.quantity}</td>
                      <td>{formatPrice(totals.unit_price)}</td>
                      <td>{formatPrice(totals.discount)}</td>
                      <td>{formatPrice(totals.tax)}</td>
                      <td>{formatPrice(totals.total)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data.data?.length > 0 && (
                <Pagination
                  currentPage={data?.meta?.current_page || 1}
                  lastPage={data?.meta?.last_page || 1}
                  handlePrevious={handlePrevious}
                  handlePageChange={handlePageChange}
                  handleNextPage={handleNextPage}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < (data?.meta?.last_page || 1)}
                />
              )}
            </>
          )}
        </div>
      </div>
      </>
      )}

      {showReturnDrawer && (
        <>
          <div
            className={`fixed inset-0 z-40 ${returnOnlyMode ? "bg-white" : "bg-black/40"}`}
            onClick={closeReturnDrawer}
          />
          <div
            className={`fixed h-full w-full bg-white shadow-2xl z-50 p-6 overflow-y-auto ${
              returnOnlyMode ? "inset-0 max-w-none" : "top-0 right-0 max-w-6xl"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-semibold text-slate-800">
                {shouldLoadReturnToPos ? "Customer Return" : "Customer Return / Exchange"}
              </h3>
              <button className="btn btn-sm btn-ghost" onClick={closeReturnDrawer}>
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {returnOnlyMode && (
                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <p className="font-semibold text-slate-700 mb-2">Enter Invoice / Receipt Number</p>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <input
                      type="text"
                      placeholder="Enter receipt/invoice number (e.g., INV-20260511-7667)"
                      className="input input-bordered w-full"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          openReturnByInvoiceNo();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={`btn btn-primary ${isLoadingReturnByInvoice ? "loading" : ""}`}
                      onClick={openReturnByInvoiceNo}
                      disabled={isLoadingReturnByInvoice}
                    >
                      Load Invoice
                    </button>
                  </div>
                </div>
              )}
              <div>
                <p className="text-gray-500">Invoice</p>
                <p className="font-medium">{returnTarget?.invoice_number || "N/A"}</p>
              </div>
              {returnPolicyInfo && (
                <div className="text-xs bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p>Policy: {returnPolicyInfo.enabled ? "Enabled" : "Disabled"}</p>
                  <p>Window: {returnPolicyInfo.return_window_days} day(s)</p>
                  <p>Partial Return: {returnPolicyInfo.allow_partial_return ? "Allowed" : "Not Allowed"}</p>
                </div>
              )}
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                <p className="font-semibold text-slate-700 mb-2">Select Returned Item(s)</p>
                {!shouldLoadReturnToPos && (
                  <div>
                    <label className="label">
                      <span className="label-text">Scan product barcode/code</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleScanAddQty();
                          }
                        }}
                        placeholder="Scan barcode/code and press Enter"
                        className="input input-bordered w-full"
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleScanAddQty}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {!shouldLoadReturnToPos && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">Return option</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={allowedReturnModes.includes("exchange") ? "Exchange" : "Unavailable"}
                      readOnly
                    />
                  </div>
                  {returnType === "exchange" && (
                    <div>
                      <label className="label">
                        <span className="label-text">Exchange Total</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={exchangeTotal}
                        onChange={(e) => setExchangeTotal(e.target.value)}
                        className="input input-bordered w-full"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-7">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={managerApproved}
                      onChange={(e) => setManagerApproved(e.target.checked)}
                    />
                    <span className="text-sm">Manager Approved</span>
                  </div>
                </div>
              )}
              <div className={`grid grid-cols-1 ${shouldLoadReturnToPos ? "" : "lg:grid-cols-2"} gap-3`}>
                <div className="overflow-x-auto border rounded">
                  <div className="px-3 py-2 font-semibold text-slate-700 bg-slate-50 border-b">Return Items</div>
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Sold</th>
                        <th>Returned</th>
                        <th>Returnable</th>
                        <th>Reason</th>
                        <th>Damaged</th>
                        <th>Return Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-4 text-gray-500">
                            No returnable items found
                          </td>
                        </tr>
                      ) : (
                        returnItems.map((item) => (
                          <tr key={item.invoice_item_id}>
                            <td>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-[11px] text-gray-500">{item.code || "N/A"}</p>
                              {item.blocked_reason && (
                                <p className="text-[11px] text-red-500">{item.blocked_reason}</p>
                              )}
                            </td>
                            <td>{item.sold_qty}</td>
                            <td>{item.returned_qty}</td>
                            <td>{item.returnable_qty}</td>
                            <td>
                              <select
                                className="select select-bordered select-xs w-24"
                                value={item.reason_code || "changed_mind"}
                                onChange={(e) =>
                                  setReturnItems((prev) =>
                                    prev.map((p) =>
                                      p.invoice_item_id === item.invoice_item_id
                                        ? { ...p, reason_code: e.target.value }
                                        : p
                                    )
                                  )
                                }
                              >
                                <option value="defective">Defective</option>
                                <option value="wrong_size">Wrong Size</option>
                                <option value="changed_mind">Changed Mind</option>
                                <option value="damaged">Damaged</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs"
                                checked={!!item.is_damaged}
                                onChange={(e) =>
                                  setReturnItems((prev) =>
                                    prev.map((p) =>
                                      p.invoice_item_id === item.invoice_item_id
                                        ? { ...p, is_damaged: e.target.checked }
                                        : p
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={Number(item.returnable_qty || 0)}
                                value={item.selected_qty ?? 0}
                                disabled={!!item.blocked_reason || Number(item.returnable_qty || 0) <= 0}
                                onChange={(e) => {
                                  const next = Number(e.target.value || 0);
                                  setReturnItems((prev) =>
                                    prev.map((p) =>
                                      p.invoice_item_id === item.invoice_item_id
                                        ? {
                                            ...p,
                                            selected_qty: Math.max(0, Math.min(next, Number(p.returnable_qty || 0))),
                                          }
                                        : p
                                    )
                                  );
                                }}
                                className="input input-bordered input-sm w-20"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!shouldLoadReturnToPos && (
                <div className="rounded border p-3 space-y-3">
                  <div className="font-semibold text-slate-700">Step 2: Select Replacement Product(s)</div>
                  {returnType === "exchange" ? (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={exchangeSearch}
                          onChange={(e) => setExchangeSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              searchExchangeProducts();
                            }
                          }}
                          className="input input-bordered w-full"
                          placeholder="Search replacement product by name/barcode"
                        />
                        <button
                          type="button"
                          className={`btn btn-outline ${isExchangeSearching ? "loading" : ""}`}
                          onClick={searchExchangeProducts}
                        >
                          Search
                        </button>
                      </div>
                      {exchangeSuggestions.length > 0 && (
                        <div className="max-h-40 overflow-auto border rounded">
                          {exchangeSuggestions.map((row) => (
                            <button
                              type="button"
                              key={`${row.inventory_item_id || row.id}-${row.inventory_id || "inv"}`}
                              className="w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0"
                              onClick={() => addExchangeItem(row)}
                            >
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-gray-500">
                                {row.barcode || "N/A"} • Stock: {row.available_quantity ?? row.stock ?? 0} • {formatPrice(Number(row.unitPrice ?? row.unit_price ?? 0))}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="overflow-x-auto border rounded">
                        <table className="table table-xs">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Qty</th>
                              <th>Price</th>
                              <th>Total</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {exchangeItems.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="text-center py-3 text-gray-500">
                                  No exchange product selected
                                </td>
                              </tr>
                            ) : (
                              exchangeItems.map((row, idx) => (
                                <tr key={`${row.inventory_item_id}-${idx}`}>
                                  <td>
                                    <div className="font-medium">{row.name}</div>
                                    <div className="text-[11px] text-gray-500">{row.barcode || "N/A"}</div>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="1"
                                      max={row.available_quantity || 999999}
                                      className="input input-bordered input-xs w-20"
                                      value={row.qty}
                                      onChange={(e) => {
                                        const qty = Math.max(1, Number(e.target.value || 1));
                                        setExchangeItems((prev) =>
                                          prev.map((item, itemIdx) =>
                                            itemIdx === idx ? { ...item, qty } : item
                                          )
                                        );
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="input input-bordered input-xs w-24"
                                      value={row.unit_price}
                                      onChange={(e) => {
                                        const unitPrice = Math.max(0, Number(e.target.value || 0));
                                        setExchangeItems((prev) =>
                                          prev.map((item, itemIdx) =>
                                            itemIdx === idx ? { ...item, unit_price: unitPrice } : item
                                          )
                                        );
                                      }}
                                    />
                                  </td>
                                  <td>{formatPrice(Number(row.qty || 0) * Number(row.unit_price || 0))}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-xs text-red-500"
                                      onClick={() =>
                                        setExchangeItems((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                                      }
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                      Replacement product is needed only for <strong>Exchange</strong> mode.
                    </div>
                  )}
                </div>
                )}
              </div>
              {!shouldLoadReturnToPos && (
                <div>
                  <label className="label">
                    <span className="label-text">Manager Approval Note (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={managerApprovalNote}
                    onChange={(e) => setManagerApprovalNote(e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
              )}
              <div className={`grid grid-cols-1 ${shouldLoadReturnToPos ? "md:grid-cols-2" : "md:grid-cols-4"} gap-3`}>
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-500">Selected Return Items</div>
                  <div className="text-lg font-semibold">{returnSelectedCount}</div>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-500">Return Amount</div>
                  <div className="text-lg font-semibold">{formatPrice(returnAmount)}</div>
                </div>
                {!shouldLoadReturnToPos && (
                  <>
                    <div className="rounded-lg border p-3 bg-white">
                      <div className="text-xs text-gray-500">Exchange Amount</div>
                      <div className="text-lg font-semibold">{formatPrice(exchangeAmountCalculated)}</div>
                    </div>
                    <div className="rounded-lg border p-3 bg-indigo-50 border-indigo-100">
                      <div className="text-xs text-gray-600">Final Settlement</div>
                      <div className="text-sm font-semibold">
                        {netRefund > 0
                          ? `Balance Credit: ${formatPrice(netRefund)}`
                          : netExtraPayable > 0
                            ? `Extra Payable: ${formatPrice(netExtraPayable)}`
                            : "Even Exchange (No payment)"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3 sticky bottom-0 bg-white py-3">
              <button
                className="btn btn-outline flex-1"
                onClick={closeReturnDrawer}
                disabled={isReturning}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning flex-1 text-slate-900 font-semibold"
                onClick={submitReturn}
                disabled={isReturning}
              >
                {isReturning
                  ? "Processing..."
                  : shouldLoadReturnToPos
                    ? "Add To POS"
                    : "Confirm Return"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

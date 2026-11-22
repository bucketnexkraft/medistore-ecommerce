import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FaFileExcel } from "react-icons/fa";
import {
  PiCopy,
  PiFunnel,
  PiMagnifyingGlass,
  PiPlus,
  PiStackMinus,
  PiStackPlus,
  PiTrendUp,
  PiX,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { closeModal } from "../../hooks/modalConfig";
import TableLoading from "../../components/loadings/TableLoading";
import useSelectableList from "../../hooks/useSelectableList";
import {
  createPurchaseReturn,
  getInvoiceItemsHistory,
  updatePurchaseQuantity,
} from "../../api/purchase";
import { getWarehouse } from "../../api/warehouse";
import { getSuppliers } from "../../api/supplier";
import Pagination from "../../components/common/Pagination";
import { fetchProductOptions } from "../../api/products";
import { getproductSettings } from "../../api/productSettings";
import { formatPrice } from "../../hooks/currency";
import { hasPermission } from "../../utils/permissions";
import noImage from "../../../public/images/no-images/no-img.jpg";
import { fetchStockGuardOptions } from "../../api/stockGuard";

const emptyFilters = {
  supplier: "",
  category: "",
  brand: "",
  warehouse: "",
  status: "",
};

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]";

const calculatePurchaseReturnLineTotal = (item) => {
  const qty = Number(item.return_qty || 0);
  const purchasedQty = Math.max(Number(item.purchased_qty || 0), 0.0001);
  const unitPrice = Number(item.unit_price || 0);

  if (qty <= 0 || unitPrice <= 0) {
    return 0;
  }

  const lineBase = unitPrice * qty;
  const lineDiscount = (Number(item.discount || 0) / purchasedQty) * qty;
  const lineTax = (Number(item.tax || 0) / purchasedQty) * qty;
  const lineVat = (Number(item.vat || 0) / purchasedQty) * qty;

  return Math.max(0, lineBase - lineDiscount + lineTax + lineVat);
};

export default function Purchase() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { data: preferenceData } = useSelector((state) => state.preferences);
  const stockTrackingEnabled = ![false, 0, "0", "false"].includes(preferenceData?.stock_tracking_enabled);

  // Filters & Search
  const [filters, setFilters] = useState(emptyFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const filterRef = useRef(null);

  // Data & Pagination
  const [data, setData] = useState({ data: [], meta: {}, others_data: {} });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loadData, setLoadData] = useState(true);

  // Filter Options
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [isPurchaseReturnEnabled, setIsPurchaseReturnEnabled] = useState(false);

  // Modal & Form
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [formErrors, setFormErrors] = useState("");
  const [returnFormErrors, setReturnFormErrors] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [stockGuardReasons, setStockGuardReasons] = useState([]);
  const [stockGuardEnabled, setStockGuardEnabled] = useState(false);
  const [returnMeta, setReturnMeta] = useState({
    original_invoice_id: "",
    original_due_amount: 0,
    return_date: new Date().toISOString().split("T")[0],
    refund_amount: "",
    payment_method: "Cash",
    note: "",
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm({
    defaultValues: { invoice_no: "", quantity: "", reason: "", note: "" },
  });

  // Selection
  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
  } = useSelectableList(data.data);
  const selectedRows = data.data.filter((item) => selectedOptions.includes(item.id));

  const calculatedRefundAmount = useMemo(() => {
    return returnItems.reduce((sum, item) => {
      return sum + calculatePurchaseReturnLineTotal(item);
    }, 0);
  }, [returnItems]);

  const dueAdjustmentAmount = useMemo(() => {
    return Math.min(
      Number(returnMeta.original_due_amount || 0),
      Number(calculatedRefundAmount || 0)
    );
  }, [returnMeta.original_due_amount, calculatedRefundAmount]);

  const eligibleCashRefundAmount = useMemo(() => {
    return Math.max(0, Number(calculatedRefundAmount || 0) - Number(dueAdjustmentAmount || 0));
  }, [calculatedRefundAmount, dueAdjustmentAmount]);

  const pendingSupplierRefundAmount = useMemo(() => {
    return Math.max(
      0,
      Number(calculatedRefundAmount || 0) -
        Number(dueAdjustmentAmount || 0) -
        Number(returnMeta.refund_amount || 0)
    );
  }, [calculatedRefundAmount, dueAdjustmentAmount, returnMeta.refund_amount]);

  useEffect(() => {
    setReturnMeta((prev) => {
      const currentRefund = Number(prev.refund_amount || 0);

      if (!prev.refund_amount || currentRefund <= eligibleCashRefundAmount) {
        return prev;
      }

      return {
        ...prev,
        refund_amount:
          eligibleCashRefundAmount > 0 ? eligibleCashRefundAmount.toFixed(2) : "",
      };
    });
  }, [eligibleCashRefundAmount]);

  // ==============================================================
  // 1. FETCH PURCHASE DATA
  // ==============================================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        perPage,
        page: currentPage,
        search: searchQuery,
        sortField,
        sortOrder,
        category: filters.category,
        brand: filters.brand,
        supplier: filters.supplier,
        warehouse: filters.warehouse,
        status: filters.status,
      };

      const result = await getInvoiceItemsHistory(accessToken, params);
      if (!result?.status) throw new Error(result?.message || "Failed to fetch");

      setData({
        data: result.data || [],
        meta: result.meta || {},
        others_data: result.others_data || {},
      });
    } catch (error) {
      toast.error(error.message || "Failed to load purchase", {
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
    currentPage,
    searchQuery,
    filters,
    sortField,
    sortOrder,
  ]);

  // ==============================================================
  // 2. FETCH FILTER OPTIONS
  // ==============================================================
  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await getWarehouse(accessToken, { perPage: 100 });
      if (res?.status) setWarehouses(res.data || []);
    } catch {
      toast.error("Failed to load warehouses");
    }
  }, [accessToken]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await getSuppliers(accessToken, { perPage: 100 });
      if (res?.status) setSuppliers(res.data || []);
    } catch {
      toast.error("Failed to load suppliers");
    }
  }, [accessToken]);

  const fetchFilterSelect = useCallback(async () => {
    try {
      const res = await fetchProductOptions(accessToken);
      if (res?.data) {
        setCategoryList(res.data.categories || []);
        setBrandList(res.data.brands || []);
      }
    } catch {
      toast.error("Failed to load filters");
    }
  }, [accessToken]);

  const fetchFeatureSettings = useCallback(async () => {
    try {
      const result = await getproductSettings(accessToken);
      const assignedPreferences = result?.data?.preferences || [];
      const purchaseReturnPreference = assignedPreferences.find(
        (preference) => preference.code === "ftr_purchase_return"
      );
      setIsPurchaseReturnEnabled(!!purchaseReturnPreference?.is_active);
    } catch {
      setIsPurchaseReturnEnabled(false);
    }
  }, [accessToken]);

  // ==============================================================
  // 3. EFFECTS
  // ==============================================================
  useEffect(() => {
    if (loadData) fetchData();
  }, [fetchData, loadData]);

  useEffect(() => {
    fetchWarehouses();
    fetchSuppliers();
    fetchFilterSelect();
    fetchFeatureSettings();
  }, [fetchWarehouses, fetchSuppliers, fetchFilterSelect, fetchFeatureSettings]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsAdvancedOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==============================================================
  // 4. ACTIONS
  // ==============================================================
  const handleSort = (field) => {
    setSortField(field);
    setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setSearchQuery("");
    setSortField("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setCurrentPage(1);
      setLoadData(true);
    }
  };

  const onFilterSubmit = () => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // ==============================================================
  // 5. EXPORT & COPY
  // ==============================================================
  const exportToExcel = () => {
    if (data.data.length === 0) return toast.warning("No data to export");

    const exportData = selectedOptions.length > 0
      ? data.data.filter((i) => selectedOptions.includes(i.id))
      : data.data;

    const headers = [
      "Invoice", "Date", "Product", "Variant", "Lot Number", "Category",
      "Brand", "Warehouse", "In Stock", "Selling Price"
    ];
    
    // Helper function to escape CSV fields
    const escapeCsvField = (field) => {
      if (field == null) return "";
      const stringField = String(field);
      // If field contains comma, quote, or newline, wrap in quotes and escape existing quotes
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const rows = exportData.map((i) => [
      escapeCsvField(i?.invoice?.invoice_no || ""),
      escapeCsvField(new Date(i.created_at).toLocaleDateString()),
      escapeCsvField(i.product_info?.name || ""),
      escapeCsvField(i.variant || "N/A"),
      escapeCsvField(i.batch_no || ""),
      escapeCsvField(i.category || ""),
      escapeCsvField(i.brand || ""),
      escapeCsvField(i.warehouse || ""),
      escapeCsvField(i.total_qty || 0),
      escapeCsvField(i.selling_price || 0),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Purchase.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    if (data.data.length === 0) return toast.warning("No data to copy");
  };

  const openReturnModal = (rows) => {
    if (!isPurchaseReturnEnabled) {
      toast.warning("Purchase return feature is not enabled for your company.");
      return;
    }

    if (!rows?.length) {
      toast.warning("Select at least one purchase row to return");
      return;
    }

    const invoiceIds = [...new Set(rows.map((row) => row?.invoice?.id).filter(Boolean))];
    if (invoiceIds.length !== 1) {
      toast.warning("Please select rows from the same purchase invoice");
      return;
    }

    setReturnFormErrors("");
    setReturnMeta({
      original_invoice_id: invoiceIds[0],
      original_invoice_no: rows[0]?.invoice?.invoice_no || "",
      supplier_name: rows[0]?.supplier?.name || rows[0]?.invoice?.supplier?.name || "",
      original_due_amount: Number(rows[0]?.invoice?.due_amount || 0),
      return_date: new Date().toISOString().split("T")[0],
      refund_amount: "",
      payment_method: "Cash",
      note: "",
    });
    setReturnItems(
      rows.map((row) => ({
        original_purchase_item_id: row.id,
        product_name: row.product_info?.name || row.product,
        barcode: row.product_info?.barcode || "",
        batch_no: row.batch_no || "",
        purchased_qty: Number(row.total_qty || 0),
        available_qty: Number(row.invItem?.quantity ?? row.total_qty ?? 0),
        remaining_return_qty: Number(
          row.remaining_return_qty ?? row.invItem?.quantity ?? row.total_qty ?? 0
        ),
        unit_price: Number(row.purchase_price || 0),
        discount: Number(row.discount || 0),
        tax: Number(row.tax || 0),
        vat: Number(row.vat || 0),
        return_qty: Number(row.invItem?.quantity ?? row.total_qty ?? 0) > 0 ? 1 : 0,
        input_error: "",
      }))
    );

    document.getElementById("purchase_return_modal").showModal();
  };

  const closeReturnModal = () => {
    closeModal("purchase_return_modal");
    setReturnFormErrors("");
    setReturnItems([]);
  };

  const updateReturnItemQty = (index, value) => {
    const rawValue = value;
    const numericValue = Number(rawValue);

    setReturnItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const limit = Math.min(
          Number(item.available_qty || 0),
          Number(item.remaining_return_qty || 0)
        );

        if (rawValue === "") {
          return {
            ...item,
            return_qty: "",
            input_error: "",
          };
        }

        if (Number.isNaN(numericValue) || numericValue < 0) {
          return {
            ...item,
            return_qty: item.return_qty,
            input_error: "Return qty must be 0 or more.",
          };
        }

        if (numericValue > limit) {
          return {
            ...item,
            return_qty: limit,
            input_error: `Max returnable qty is ${limit}.`,
          };
        }

        return {
          ...item,
          return_qty: numericValue,
          input_error: "",
        };
      })
    );
  };

  const submitPurchaseReturn = async () => {
    const activeItems = returnItems
      .filter((item) => Number(item.return_qty) > 0)
      .map((item) => ({
        original_purchase_item_id: item.original_purchase_item_id,
        return_qty: Number(item.return_qty),
      }));

    if (activeItems.length === 0) {
      setReturnFormErrors("Enter a return quantity for at least one item.");
      return;
    }

    const itemWithInlineError = returnItems.find((item) => item.input_error);
    if (itemWithInlineError) {
      setReturnFormErrors(
        `Fix the quantity for ${itemWithInlineError.product_name} before submitting.`
      );
      return;
    }

    const invalidItem = returnItems.find(
      (item) =>
        Number(item.return_qty) < 0 ||
        Number(item.return_qty) > Number(item.available_qty) ||
        Number(item.return_qty) > Number(item.remaining_return_qty)
    );

    if (invalidItem) {
      setReturnFormErrors(
        `Return quantity cannot exceed remaining purchased quantity for ${invalidItem.product_name}.`
      );
      return;
    }

    const requestedCashRefund = Number(returnMeta.refund_amount || 0);
    if (requestedCashRefund < 0) {
      setReturnFormErrors("Cash refund received cannot be negative.");
      return;
    }

    if (requestedCashRefund > eligibleCashRefundAmount) {
      setReturnFormErrors(
        `Cash refund received cannot exceed ${formatPrice(eligibleCashRefundAmount)} after due adjustment.`
      );
      return;
    }

    setLoading(true);
    setReturnFormErrors("");

    try {
      const result = await createPurchaseReturn(accessToken, {
        ...returnMeta,
        refund_amount: requestedCashRefund,
        items: activeItems,
      });

      if (!result?.status) {
        throw new Error(
          result?.error?.message ||
            result?.message ||
            "Failed to create purchase return"
        );
      }

      toast.success(`Purchase return created: ${result.data?.invoice_no || ""}`);
      closeReturnModal();
      setLoadData(true);
    } catch (error) {
      setReturnFormErrors(error.message || "Failed to create purchase return");
    } finally {
      setLoading(false);
    }
  };

  // ==============================================================
  // 6. UPDATE MODAL
  // ==============================================================

  const openUpdateModal = (purchase) => {
    setSelectedPurchase(purchase);
    setValue("invoice_no", purchase?.invoice?.invoice_no || "");
    setValue("quantity", purchase.total_qty || "");
    setValue("reason", "");
    setValue("note", "");
    setFormErrors("");
    document.getElementById("update_quantity_modal").showModal();
  };

  const onUpdateSubmit = async (formData) => {
    setFormErrors("");
    setLoading(true);
    try {
      const res = await updatePurchaseQuantity(accessToken, {
        inventoryId: selectedPurchase.invItem?.id || selectedPurchase.inventory_item_id || selectedPurchase.id,
        invoice_no: formData.invoice_no,
        quantity: parseFloat(formData.quantity),
        reason: formData.reason,
        note: formData.note,
      });

      if (res.status) {
        const successMessage =
          res.message ||
            (res.approval_required
              ? "Approval required. Request sent to manager."
              : "Stock added successfully");
        setLoadData(true);
        reset();
        closeModal("update_quantity_modal");
        setTimeout(() => toast.success(successMessage), 0);
      } else {
        throw new Error(res.message || "Update failed");
      }
    } catch (error) {
      const responseData = error?.response?.data;
      setFormErrors(
        responseData?.errors
          ? Object.values(responseData.errors).flat().join("\n")
          : responseData?.error || responseData?.message || error.message || "Update failed"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    fetchStockGuardOptions(accessToken)
      .then((result) => {
        setStockGuardReasons(result?.data?.reasons || []);
        setStockGuardEnabled(true);
      })
      .catch(() => {
        setStockGuardReasons([]);
        setStockGuardEnabled(false);
      });
  }, [accessToken]);


  // ==============================================================
  // 7. TOTALS
  // ==============================================================
  const pageTotalQty = data.data.reduce((s, i) => s + (i.total_qty || 0), 0);
  const pageTotalPurchase = data.data.reduce(
    (s, i) => s + (i.purchase_price || 0) * (i.total_qty || 0),
    0
  );

  const grandTotalQty = data.others_data?.grand_total_qty || 0;
  const grandTotalPurchase = data.others_data?.grand_total_purchase_price || 0;
  const totalRows = data.meta?.total || data.data.length || 0;
  const hasActiveFilters =
    searchQuery.trim() || filters.supplier || filters.category || filters.brand || filters.warehouse || filters.status;

  // ==============================================================
  // 8. PAGINATION
  // ==============================================================
  const handleNextPage = () => { setCurrentPage(p => p + 1); setLoadData(true); };
  const handlePrevious = () => { setCurrentPage(p => Math.max(p - 1, 1)); setLoadData(true); };
  const handlePageChange = (page) => { setCurrentPage(page); setLoadData(true); };

  // ==============================================================
  // 9. RENDER
  // ==============================================================
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] figtree-regular">
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiTrendUp size={14} />
              Stock In
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Stock in</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Manage incoming purchase stock, supplier returns, warehouse quantities, and purchase values.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rows</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{totalRows.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">Matched purchase lines</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Page qty</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{pageTotalQty.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">Quantity on this page</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grand qty</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{Number(grandTotalQty || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">All matched quantity</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Purchase value</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatPrice(grandTotalPurchase)}</p>
              <p className="mt-1 text-xs text-slate-500">Grand purchase value</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="relative" ref={filterRef}>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search products..."
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setLoadData(true); }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                >
                  <PiMagnifyingGlass fontSize={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    isAdvancedOpen ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                  }`}
                >
                  <PiFunnel fontSize={20} />
                </button>
              </div>
            </div>

            {isAdvancedOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-20 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { key: "supplier", list: suppliers, label: "Supplier", valueKey: "name" },
                    { key: "category", list: categoryList, label: "Category" },
                    { key: "brand", list: brandList, label: "Brand" },
                    { key: "warehouse", list: warehouses, label: "Warehouse", valueKey: "name" },
                    { key: "status", list: [{ id: "1", name: "Active" }, { id: "0", name: "Inactive" }], label: "Status", valueKey: "name" },
                  ].map(({ key, list, label, valueKey = "title" }) => (
                    <div key={key}>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
                      <select
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                        value={filters[key]}
                        onChange={(e) => handleFilterChange(key, e.target.value)}
                      >
                        <option value="">All {label}s</option>
                        {list.map((item) => (
                          <option key={item.id} value={item.id}>
                            {valueKey === "name" ? item.name : item[valueKey]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"><PiX size={16} />Reset</button>
                  <button type="button" onClick={onFilterSubmit} className="inline-flex h-10 items-center rounded-xl border-0 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">Search</button>
                </div>
              </div>
            )}
            {hasActiveFilters && (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Filters active
              </div>
            )}
          </div>
        </div>

      {/* UPDATE MODAL */}
      <dialog id="update_quantity_modal" className="modal">
        <div className="modal-box w-11/12 max-w-xl flex flex-col p-0">
          <div className="sticky top-0 bg-white z-10 border-b p-4 flex justify-between items-center">
            <h3 className="font-bold text-lg">Update Quantity</h3>
            <button className="btn btn-sm btn-circle" onClick={() => closeModal("update_quantity_modal")}>X</button>
          </div>
          <div className="flex-1 overflow-y-auto py-4 px-6">
            {formErrors && (
              <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                {formErrors.split("\n").map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <form onSubmit={handleSubmit(onUpdateSubmit)}>
              <div className="space-y-4">
                <div>
                  <label className="label"><span className="label-text">Invoice No</span></label>
                  <input
                    type="text"
                    {...register("invoice_no", { required: "Required" })}
                    className="input input-bordered w-full"
                  />
                  {errors.invoice_no && <p className="text-red-500">{errors.invoice_no.message}</p>}
                </div>
                <div>
                  <label className="label"><span className="label-text">Quantity</span></label>
                  <input
                    type="number"
                    {...register("quantity", {
                      required: "Required",
                      min: { value: 1, message: "Min 1" },
                    })}
                    className="input input-bordered w-full"
                    min="1"
                  />
                  {errors.quantity && <p className="text-red-500">{errors.quantity.message}</p>}
                </div>
                {stockGuardEnabled && (
                  <>
                    <div>
                      <label className="label"><span className="label-text">Reason</span></label>
                      <select
                        {...register("reason", { required: "Reason is required" })}
                        className="select select-bordered w-full"
                      >
                        <option value="">Select reason</option>
                        {stockGuardReasons.map((reason) => (
                          <option key={reason.value} value={reason.value}>{reason.label}</option>
                        ))}
                      </select>
                      {errors.reason && <p className="text-red-500">{errors.reason.message}</p>}
                    </div>
                    <div>
                      <label className="label"><span className="label-text">Note</span></label>
                      <textarea
                        {...register("note")}
                        className="textarea textarea-bordered w-full"
                        placeholder="Optional context for audit log"
                      />
                    </div>
                  </>
                )}
              </div>
            </form>
          </div>
          <div className="sticky bottom-0 bg-white z-10 border-t p-4 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => closeModal("update_quantity_modal")} disabled={loading}>
              Cancel
            </button>
            <button
              className={`btn btn-primary ${loading ? "loading" : ""}`}
              onClick={handleSubmit(onUpdateSubmit)}
              disabled={loading}
            >
              Submit
            </button>
          </div>
        </div>
      </dialog>

      <dialog id="purchase_return_modal" className="modal">
        <div className="modal-box w-11/12 max-w-6xl flex max-h-[92vh] flex-col overflow-hidden rounded-lg p-0">
          <div className="sticky top-0 z-10 border-b bg-white px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Purchase Return
                </div>
                <h3 className="mt-1 text-xl font-semibold text-gray-900">
                  Create Supplier Return
                </h3>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span>Invoice: {returnMeta.original_invoice_no || "N/A"}</span>
                  <span>Supplier: {returnMeta.supplier_name || "N/A"}</span>
                  <span>Original Due: {formatPrice(returnMeta.original_due_amount || 0)}</span>
                </div>
              </div>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={closeReturnModal}>X</button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto bg-gray-50 px-6 py-5">
            {returnFormErrors && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {returnFormErrors}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs font-medium uppercase text-gray-500">Return Value</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">
                  {formatPrice(calculatedRefundAmount)}
                </div>
                <div className="mt-1 text-xs text-gray-500">Net of discount, tax, and VAT</div>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs font-medium uppercase text-gray-500">Supplier Due Reduced</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-700">
                  {formatPrice(dueAdjustmentAmount)}
                </div>
                <div className="mt-1 text-xs text-gray-500">Applied before cash refund</div>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs font-medium uppercase text-gray-500">Cash Received</div>
                <div className="mt-2 text-2xl font-semibold text-blue-700">
                  {formatPrice(Number(returnMeta.refund_amount || 0))}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Max now {formatPrice(eligibleCashRefundAmount)}
                </div>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs font-medium uppercase text-gray-500">Pending Supplier Refund</div>
                <div className="mt-2 text-2xl font-semibold text-amber-700">
                  {formatPrice(pendingSupplierRefundAmount)}
                </div>
                <div className="mt-1 text-xs text-gray-500">Tracked on return invoice</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-lg border bg-white p-4 md:grid-cols-12">
              <div className="md:col-span-3">
                <label className="label py-1"><span className="label-text font-medium">Return Date</span></label>
                <input
                  type="date"
                  className="input input-bordered w-full bg-white"
                  value={returnMeta.return_date}
                  onChange={(event) =>
                    setReturnMeta((prev) => ({ ...prev, return_date: event.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-3">
                <label className="label py-1"><span className="label-text font-medium">Cash Refund Now</span></label>
                <input
                  type="number"
                  min="0"
                  max={eligibleCashRefundAmount}
                  step="0.01"
                  className="input input-bordered w-full bg-white"
                  value={returnMeta.refund_amount}
                  placeholder={
                    eligibleCashRefundAmount > 0
                      ? `Max ${formatPrice(eligibleCashRefundAmount)}`
                      : "No cash refund available"
                  }
                  disabled={eligibleCashRefundAmount <= 0}
                  onChange={(event) => {
                    const rawValue = event.target.value;

                    if (rawValue === "") {
                      setReturnMeta((prev) => ({ ...prev, refund_amount: "" }));
                      return;
                    }

                    const nextValue = Math.max(0, Number(rawValue || 0));
                    setReturnMeta((prev) => ({
                      ...prev,
                      refund_amount:
                        nextValue > eligibleCashRefundAmount
                          ? eligibleCashRefundAmount.toFixed(2)
                          : rawValue,
                    }));
                  }}
                />
              </div>
              <div className="md:col-span-3">
                <label className="label py-1"><span className="label-text font-medium">Refund Method</span></label>
                <select
                  className="select select-bordered w-full bg-white"
                  value={returnMeta.payment_method}
                  onChange={(event) =>
                    setReturnMeta((prev) => ({ ...prev, payment_method: event.target.value }))
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Mobile Banking">Mobile Banking</option>
                  <option value="Adjustment">Adjustment</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="label py-1"><span className="label-text font-medium">Return Total</span></label>
                <input
                  type="text"
                  className="input input-bordered w-full bg-gray-100 font-semibold"
                  value={formatPrice(calculatedRefundAmount)}
                  readOnly
                />
              </div>
              <div className="md:col-span-12">
                <label className="label py-1"><span className="label-text font-medium">Note</span></label>
                <textarea
                  className="textarea textarea-bordered min-h-20 w-full bg-white"
                  value={returnMeta.note}
                  placeholder="Supplier reason, credit note reference, or approval note"
                  onChange={(event) =>
                    setReturnMeta((prev) => ({ ...prev, note: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <div className="font-semibold text-gray-900">Returned Items</div>
                  <div className="text-sm text-gray-500">{returnItems.length} selected line item{returnItems.length === 1 ? "" : "s"}</div>
                </div>
                <div className="text-sm font-semibold text-gray-700">
                  {formatPrice(calculatedRefundAmount)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="bg-gray-100 text-xs uppercase text-gray-600">
                      <th className="min-w-56">Product</th>
                      <th>Barcode</th>
                      <th>Lot</th>
                      <th className="text-right">Purchased</th>
                      <th className="text-right">Available</th>
                      <th className="text-right">Returnable</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Return Qty</th>
                      <th className="text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map((item, index) => (
                      <tr key={item.original_purchase_item_id} className="align-top">
                        <td>
                          <div className="font-medium text-gray-900">{item.product_name}</div>
                          <div className="text-xs text-gray-500">Max {Math.min(item.available_qty, item.remaining_return_qty)} can be returned</div>
                        </td>
                        <td>{item.barcode || "N/A"}</td>
                        <td>{item.batch_no || "N/A"}</td>
                        <td className="text-right">{item.purchased_qty}</td>
                        <td className="text-right">{item.available_qty}</td>
                        <td className="text-right">{item.remaining_return_qty}</td>
                        <td className="text-right">{formatPrice(item.unit_price)}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            max={Math.min(item.available_qty, item.remaining_return_qty)}
                            step="0.01"
                            className="input input-bordered input-sm w-28 text-right"
                            value={item.return_qty}
                            onChange={(event) => updateReturnItemQty(index, event.target.value)}
                          />
                          {item.input_error && (
                            <p className="mt-1 w-36 text-left text-xs text-red-500">{item.input_error}</p>
                          )}
                        </td>
                        <td className="text-right font-semibold">{formatPrice(calculatePurchaseReturnLineTotal(item))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan="8" className="text-right">Return Total</td>
                      <td className="text-right">{formatPrice(calculatedRefundAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t bg-white px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Settlement:</span>{" "}
              {formatPrice(dueAdjustmentAmount)} due reduction + {formatPrice(Number(returnMeta.refund_amount || 0))} cash
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={closeReturnModal} disabled={loading}>
                Cancel
              </button>
              <button className={`btn btn-warning ${loading ? "loading" : ""}`} onClick={submitPurchaseReturn} disabled={loading}>
                Submit Return
              </button>
            </div>
          </div>
        </div>
      </dialog>

      {/* TABLE */}
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4">
          <div>
            <h5 className="text-lg font-bold text-slate-950">Purchase list</h5>
            <p className="text-sm text-slate-500">{data.data.length.toLocaleString()} rows on this page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportToExcel} className="inline-flex h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"><FaFileExcel />Export</button>
            <button onClick={copyToClipboard} className="inline-flex h-12 items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"><PiCopy size={18} />Copy</button>
            {isPurchaseReturnEnabled && hasPermission("stock-in.create") && (
              <button
                onClick={() => openReturnModal(selectedRows)}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedRows.length === 0}
              >
                <PiStackMinus /> Purchase Return
              </button>
            )}
            {stockTrackingEnabled && hasPermission("stock-in.create") && (
              <Link to="/purchases/create" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100">
                <PiPlus /> Stock In
              </Link>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="w-0.5/12"><input type="checkbox" className="checkbox checkbox-sm" onChange={(e) => handleSelectAll(e.target.checked)} checked={isAllSelectedOnCurrentPage()} /></th>
                    <th className="w-1/12">Invoice</th>
                    <th className="w-1/12 cursor-pointer" onClick={() => handleSort("created_at")}>
                      Date {sortField === "created_at" && (sortOrder === "asc" ? "Up" : "Down")}
                    </th>
                    <th className="w-2/12 cursor-pointer" onClick={() => handleSort("product_id")}>
                      Product {sortField === "product_id" && (sortOrder === "asc" ? "Up" : "Down")}
                    </th>
                    <th className="w-1/12">Variant</th>
                    <th className="w-1/12 cursor-pointer" onClick={() => handleSort("lot_number")}>
                      Lot {sortField === "lot_number" && (sortOrder === "asc" ? "Up" : "Down")}
                    </th>
                    <th className="w-1/12">Category</th>
                    <th className="w-1/12">Brand</th>
                    <th className="w-1/12 cursor-pointer" onClick={() => handleSort("warehouse_id")}>
                      Warehouse {sortField === "warehouse_id" && (sortOrder === "asc" ? "Up" : "Down")}
                    </th>
                    <th className="w-1/12 cursor-pointer" onClick={() => handleSort("quantity")}>
                      In Stock {sortField === "quantity" && (sortOrder === "asc" ? "Up" : "Down")}
                    </th>
                    <th className="w-1/12 cursor-pointer" onClick={() => handleSort("purchase_price")}>
                      Purchase {sortField === "purchase_price" && (sortOrder === "asc" ? "Up" : "Down")}
                    </th>
                    <th className="w-1/12 cursor-pointer" onClick={() => handleSort("price")}>
                      Selling {sortField === "price" && (sortOrder === "asc" ? "Up" : "Down")}
                    </th>
                    <th className="w-1/12">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length > 0 ? (
                    <>
                      {data.data.map((p) => (
                        <tr key={p.id} className={`hover:bg-slate-50 ${selectedOptions.includes(p.id) ? "bg-blue-50" : ""}`}>
                          <th><input type="checkbox" className="checkbox checkbox-sm" onChange={() => handleSelect(p.id)} checked={selectedOptions.includes(p.id)} /></th>
                          <td><span className="text-primary">{p?.invoice?.invoice_no}</span></td>
                          <td>{new Date(p.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="flex items-center space-x-4">
                                <div className="avatar">
                                  <div className="w-8 h-10 rounded">
                                    <img src={p.product_info?.thumbnail || noImage} alt={p.product_info?.name} />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{p.product_info?.name}</p>
                                  <p className="text-xs text-blue-500">{p.product_info?.barcode}</p>
                              </div>
                            </div>
                          </td>
                          <td>{p.variant || "N/A"}</td>
                          <td><span className="text-primary">#{p.batch_no}</span></td>
                          <td>{p.category}</td>
                          <td>{p.brand}</td>
                          <td>{p.warehouse}</td>
                          <td>{p.total_qty}</td>
                          <td>{formatPrice(p.purchase_price)}</td>
                          <td>{formatPrice(p.selling_price)}</td>
                          <td>
                            {hasPermission("stock-in.edit") && (
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                onClick={() => openUpdateModal(p)}
                              >
                                <PiStackPlus className="size-[1.2em]" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* PAGE TOTAL */}
                      <tr className="bg-slate-100 font-semibold">
                        <td colSpan="10" className="text-left py-2">Page Total:</td>
                        <td className="text-left">{pageTotalQty}</td>
                        <td className="text-right">{formatPrice(pageTotalPurchase)}</td>
                        <td colSpan="1"></td>
                      </tr>

                      {/* GRAND TOTAL */}
                      <tr className="border-t border-slate-300 bg-slate-200 font-bold">
                        <td colSpan="10" className="text-left py-2">Grand Total:</td>
                        <td className="text-left">{grandTotalQty}</td>
                        <td className="text-right">{formatPrice(grandTotalPurchase)}</td>
                        <td colSpan="1"></td>
                      </tr>
                    </>
                  ) : (
                    <tr><td colSpan="13" className="text-center py-4">No products found</td></tr>
                  )}
                </tbody>
              </table>

              {data.data.length > 0 && (
                <Pagination
                  currentPage={data.meta.current_page}
                  lastPage={data.meta.last_page}
                  handlePrevious={handlePrevious}
                  handlePageChange={handlePageChange}
                  handleNextPage={handleNextPage}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < data.meta.last_page}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import { toast } from "react-toastify";
import { PiMicrosoftExcelLogoFill, PiSliders, PiTag, PiTrendUp, PiCube, PiClock } from "react-icons/pi";
import TableLoading from "../../../components/loadings/TableLoading";
import Pagination from "../../../components/common/Pagination";
import { fetchingProductLedger } from "../../../api/report";
import { getAllProduct } from "../../../api/products";

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

const toNumber = (value) => Number(value) || 0;

const customSelectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 56,
    borderRadius: "1rem",
    borderColor: "#e2e8f0",
    boxShadow: "none",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

export default function ProductLedger() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [productList, setProductList] = useState([]);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, summary: {} });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(50);
  const [showFilter, setShowFilter] = useState(false);
  const [loadData, setLoadData] = useState(false);
  const filterRef = useRef(null);

  const { control, watch, setValue, handleSubmit, reset } = useForm({
    defaultValues: {
      product_id: null,
      variant_selection: {},
      dateRange: [null, null],
      type: "",
    },
  });

  const selectedProductId = watch("product_id");
  const variantSelection = useMemo(() => watch("variant_selection") || {}, [watch]);
  const dateRange = useMemo(() => watch("dateRange") || [null, null], [watch]);
  const transactionType = watch("type") || "";
  const variantSelectionKey = useMemo(() => JSON.stringify(variantSelection), [variantSelection]);
  const dateRangeKey = useMemo(
    () => JSON.stringify(dateRange?.map((date) => (date ? new Date(date).toISOString() : null)) || []),
    [dateRange]
  );

  const selectedProduct = useMemo(
    () => productList.find((p) => p.id === selectedProductId),
    [productList, selectedProductId]
  );

  const productOptions = useMemo(() => {
    return productList.map((p) => {
      const defaultBarcode = p.code || p.sku || "";
      const customBarcodes = [
        ...new Set(
          (p.barcodes || [])
            .flatMap((b) => [b?.custom_barcode, b?.barcode])
            .filter(Boolean)
        ),
      ];

      return {
        value: p.id,
        label: `${p.name} (${defaultBarcode || "No SKU"})`,
        searchText: [p.name, defaultBarcode, ...customBarcodes].join(" ").toLowerCase(),
      };
    });
  }, [productList]);

  const selectedProductOption = useMemo(
    () => productOptions.find((opt) => opt.value === selectedProductId) || null,
    [productOptions, selectedProductId]
  );

  const variantKeys = useMemo(() => {
    if (!selectedProduct || selectedProduct.has_variant !== 1) return [];
    const variantMap = (selectedProduct.variants || []).reduce((acc, variant) => {
      const key = Object.keys(variant || {})[0];
      if (key) acc[key] = true;
      return acc;
    }, {});
    return Object.keys(variantMap);
  }, [selectedProduct]);

  const variantOptions = useMemo(() => {
    return variantKeys.reduce((acc, key) => {
      const values = [
        ...new Set(
          (selectedProduct?.variants || [])
            .filter((variant) => variant?.[key])
            .map((variant) => variant[key])
        ),
      ];
      acc[key] = values.map((value) => ({ value, label: value }));
      return acc;
    }, {});
  }, [selectedProduct, variantKeys]);

  const fetchProducts = useCallback(async () => {
    try {
      setIsProductLoading(true);
      const res = await getAllProduct(accessToken);
      setProductList(res?.status && Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load products");
      setProductList([]);
    } finally {
      setIsProductLoading(false);
    }
  }, [accessToken]);

  const fetchLedger = useCallback(async () => {
    if (!selectedProductId) {
      setData({ data: [], meta: {}, summary: {} });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = {
        product_id: selectedProductId,
        variant_selection:
          Object.keys(variantSelection).length > 0 ? variantSelection : undefined,
        startDate: dateRange[0] ? new Date(dateRange[0]).toISOString().split("T")[0] : "",
        endDate: dateRange[1] ? new Date(dateRange[1]).toISOString().split("T")[0] : "",
        type: transactionType,
        page: currentPage,
        perPage,
      };

      const result = await fetchingProductLedger(accessToken, params);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch ledger");
      }

      setData({
        data: Array.isArray(result.data) ? result.data : [],
        meta: result.meta || {},
        summary: result.summary || {},
      });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to load ledger");
      setData({ data: [], meta: {}, summary: {} });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, dateRange, perPage, selectedProductId, transactionType, variantSelection]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (loadData && selectedProductId) {
      fetchLedger();
    }
  }, [fetchLedger, loadData, selectedProductId]);

  useEffect(() => {
    setValue("variant_selection", {});
  }, [selectedProductId, setValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProductId, variantSelectionKey, dateRangeKey, transactionType]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilter(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const exportToExcel = () => {
    setExporting(true);
    try {
      const headers = ["Date", "Type", "Invoice No", "Reference", "In Qty", "Out Qty", "Balance", "Notes"];
      const rows = data.data.map((item) => [
        item.date || "",
        item.type === "purchase" ? "Purchase" : item.type === "sale" ? "Sale" : "Adjustment",
        item.invoice_no || "-",
        item.reference || "-",
        item.in_qty || 0,
        item.out_qty || 0,
        item.balance || 0,
        item.notes || "",
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = selectedProduct?.name || "Product";
      const variantStr = Object.values(variantSelection).filter(Boolean).join("_");
      a.download = `${name}${variantStr ? `_${variantStr}` : ""}_Ledger_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    reset({
      product_id: null,
      variant_selection: {},
      dateRange: [null, null],
      type: "",
    });
    setData({ data: [], meta: {}, summary: {} });
    setCurrentPage(1);
    setShowFilter(false);
  };

  const onFilterSubmit = () => {
    setShowFilter(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const selectedVariantCount = Object.values(variantSelection).filter(Boolean).length;
  const currentStock = toNumber(data.summary?.current_stock);
  const totalIn = toNumber(data.summary?.total_in);
  const totalOut = toNumber(data.summary?.total_out);
  const totalTransactions = data.data.length;
  const activeTypeLabel = transactionType ? transactionType.replace("_", " ") : "All transactions";
  const hasActiveFilters =
    selectedProductId ||
    selectedVariantCount > 0 ||
    dateRange[0] ||
    dateRange[1] ||
    transactionType;

  const handleNextPage = () => {
    setCurrentPage((prev) => prev + 1);
    setLoadData(true);
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
    setLoadData(true);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setLoadData(true);
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.85),rgba(255,255,255,1))]" />
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiCube size={14} />
              Ledger report
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Product ledger
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
              Track every movement for a product or variant with date filters, transaction type filters, and export support.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${hasActiveFilters ? "bg-emerald-500" : "bg-slate-300"}`} />
              {hasActiveFilters ? "Filters active" : "No filters applied"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[760px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Current stock
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentStock.toLocaleString()}</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Total in
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{totalIn.toLocaleString()}</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Total out
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{totalOut.toLocaleString()}</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Records
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{totalTransactions.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-blue-50 p-2 text-blue-600">
              <PiTrendUp size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Movement summary
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {currentStock.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current stock level</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-emerald-50 p-2 text-emerald-600">
              <PiClock size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Type
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {activeTypeLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current transaction filter</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-sky-50 p-2 text-sky-600">
              <PiTag size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Product
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {selectedProduct?.name || "No product selected"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{selectedProduct?.code || "Choose a product to load the ledger"}</p>
          </div>

          <div className={`${metricCardClass} relative overflow-hidden`}>
            <div className="absolute right-3 top-3 rounded-full bg-amber-50 p-2 text-amber-600">
              <PiSliders size={18} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Variants
            </p>
            <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">
              {selectedVariantCount > 0 ? selectedVariantCount : "All"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Active variant filters</p>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end gap-4" ref={filterRef}>
            <div className="min-w-[320px] flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Select product
              </label>
              <Controller
                control={control}
                name="product_id"
                render={({ field }) => (
                  <Select
                    options={productOptions}
                    value={selectedProductOption}
                    onChange={(opt) => {
                      field.onChange(opt ? opt.value : null);
                      setValue("variant_selection", {});
                      setCurrentPage(1);
                      setLoadData(true);
                    }}
                    placeholder="Search product by name or SKU..."
                    isLoading={isProductLoading}
                    isClearable
                    filterOption={(option, inputValue) => {
                      const term = inputValue.trim().toLowerCase();
                      if (!term) return true;
                      return (option.data.searchText || "").includes(term);
                    }}
                    styles={customSelectStyles}
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilter((prev) => !prev)}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-slate-700 transition ${
                showFilter
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <PiSliders size={20} />
            </button>
          </div>

          {showFilter && (
            <div className="mt-4 rounded-[1.5rem] border border-slate-200/80 bg-slate-50 p-4">
              <div className="grid gap-4 xl:grid-cols-2">
                {selectedProduct?.has_variant === 1 && variantKeys.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-900">
                      Variant filters
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {variantKeys.map((key) => (
                        <div key={key}>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {key}
                          </label>
                          <Controller
                            control={control}
                            name={`variant_selection.${key}`}
                            render={({ field }) => (
                              <select
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                                value={field.value || ""}
                                onChange={(e) => {
                                  field.onChange(e.target.value || undefined);
                                }}
                              >
                                <option value="">All {key}</option>
                                {variantOptions[key]?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-900">
                    Time & transaction filters
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                              setLoadData(true);
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
                        Transaction type
                      </label>
                      <Controller
                        control={control}
                        name="type"
                        render={({ field }) => (
                          <select
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                            {...field}
                          >
                            <option value="">All transactions</option>
                            <option value="purchase">Purchase only</option>
                            <option value="sale">Sale only</option>
                            <option value="stock_adjustment">Stock adjustment only</option>
                            <option value="return">Return</option>
                          </select>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Reset all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSubmit(onFilterSubmit)();
                    setShowFilter(false);
                  }}
                  className="inline-flex h-10 items-center rounded-xl border-0 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Apply filters
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedProductId ? (
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h5 className="text-lg font-bold tracking-tight text-slate-950">
                  {selectedProduct?.name} ({selectedProduct?.code})
                  {selectedVariantCount > 0 && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {Object.values(variantSelection).filter(Boolean).join(" • ")}
                    </span>
                  )}
                </h5>
                <p className="mt-1 text-sm text-slate-500">
                  Current stock: <strong>{currentStock}</strong> | Total in: <strong>{totalIn}</strong> | Total out: <strong>{totalOut}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportToExcel}
                  disabled={exporting || loading || data.data.length === 0}
                  className={`inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 ${
                    exporting || loading || data.data.length === 0 ? "opacity-70" : ""
                  }`}
                >
                  <PiMicrosoftExcelLogoFill size={18} />
                  {exporting ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <TableLoading />
              ) : data.data.length > 0 ? (
                <>
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 first:rounded-l-xl">
                          Date
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          Type
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          Invoice no
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          Reference
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          Lot
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          Variant
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          Price
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                          In
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right">
                          Out
                        </th>
                        <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right last:rounded-r-xl">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((item, i) => (
                        <tr key={i} className="bg-white transition hover:bg-slate-50/70">
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                            {item.date || "-"}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            {item.type === "purchase" && (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Purchase
                              </span>
                            )}
                            {item.type === "sale" && (
                              <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                Sale
                              </span>
                            )}
                            {item.type === "stock_adjustment" && (
                              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                Adj
                              </span>
                            )}
                            {item.type === "return" && (
                              <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                Return
                              </span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-900">
                            {item.invoice_no || "-"}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                            {item.reference || "-"}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                            {item.notes || "-"}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                            {item.variant || "-"}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
                            {toNumber(item.unit_price)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-emerald-700">
                            {item.in_qty > 0 ? item.in_qty : ""}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-semibold text-rose-700">
                            {item.out_qty > 0 ? item.out_qty : ""}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-blue-700">
                            {item.balance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t border-slate-100 px-4 py-4">
                    <Pagination
                      currentPage={currentPage}
                      lastPage={data.meta.last_page || 1}
                      handlePrevious={handlePrevious}
                      handleNextPage={handleNextPage}
                      handlePageChange={handlePageChange}
                      showPrevious={currentPage > 1}
                      showNext={currentPage < (data.meta.last_page || 1)}
                    />
                  </div>
                </>
              ) : (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8">
                    <p className="text-sm font-semibold text-slate-700">No transactions found.</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try a different product, filter, or date range.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-16 text-center shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-blue-50 text-blue-600">
              <PiCube size={28} />
            </div>
            <p className="text-xl font-semibold text-slate-900">Please select a product to view its ledger</p>
            <p className="mt-2 text-sm text-slate-500">
              Use the product search above to load movements, balances, and transaction history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

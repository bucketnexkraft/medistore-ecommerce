import { useCallback, useEffect, useState, useRef } from "react";
import { FaFileExcel } from "react-icons/fa";
import { PiClock, PiCopy, PiCube, PiFunnel, PiMagnifyingGlass, PiX } from "react-icons/pi";
import { RiLoginBoxLine } from "react-icons/ri";
import { LuSquareArrowOutUpLeft } from "react-icons/lu";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { getStockOverview } from "../../api/purchase";
import { fetchStockMovements } from "../../api/stock";
import { fetchProductOptions } from "../../api/products";
import { getproductSettings } from "../../api/productSettings";
import useSelectableList from "../../hooks/useSelectableList";
import { getWarehouse } from "../../api/warehouse";
import { formatPrice } from "../../hooks/currency";
import { hasPermission } from "../../utils/permissions";
import noImage from "../../../public/images/no-images/no-img.jpg";
import { getDemandTag, normalizeDemandTags } from "../../utils/demandTags";

const emptyFilters = { category: "", brand: "", warehouse: "", demand_tag: "" };

const metricCardClass =
  "rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur";

export default function Stock() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { data: preferenceData } = useSelector((state) => state.preferences);
  const stockTrackingEnabled = ![false, 0, "0", "false"].includes(preferenceData?.stock_tracking_enabled);

  const [filters, setFilters] = useState(emptyFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, others_data: {} });
  const [categoryList, setCategoryList] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [warehouseList, setWarehouseList] = useState([]);
  const [demandTagOptions, setDemandTagOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [timelineEnabled, setTimelineEnabled] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineProduct, setTimelineProduct] = useState(null);
  const [timelineRows, setTimelineRows] = useState([]);
  const filterRef = useRef(null);

  const { selectedOptions, handleSelectAll, handleSelect, isAllSelectedOnCurrentPage } =
    useSelectableList(data.data);

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
        warehouse: filters.warehouse,
        demand_tag: filters.demand_tag,
      };

      const result = await getStockOverview(accessToken, params);
      if (!result?.status) throw new Error(result?.message || "Failed to fetch stock");

      setData({
        data: result.data,
        meta: result.meta,
        others_data: result.others_data,
      });
    } catch (error) {
      toast.error(error.message, { className: "alert alert-error" });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, perPage, currentPage, searchQuery, filters, sortField, sortOrder]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [filterOptions, warehouseRes, featureRes] = await Promise.all([
        fetchProductOptions(accessToken),
        getWarehouse(accessToken, { perPage: 100, status: "1" }),
        getproductSettings(accessToken),
      ]);

      if (filterOptions?.data && warehouseRes?.status) {
        setCategoryList(filterOptions.data.categories || []);
        setBrandList(filterOptions.data.brands || []);
        setDemandTagOptions(Array.isArray(filterOptions.data.demand_tags) ? filterOptions.data.demand_tags : []);
        setWarehouseList(warehouseRes.data || []);
      }

      const featureEnabled = featureRes?.data?.preferences?.some(
        (preference) => preference.code === "ftr_stock_movement_timeline" && preference.is_active
      );
      setTimelineEnabled(Boolean(featureEnabled));
    } catch {
      toast.error("Failed to load filters");
    }
  }, [accessToken]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
  useEffect(() => { if (loadData) fetchData(); }, [fetchData, loadData]);

  const handleSearch = () => { setCurrentPage(1); setLoadData(true); };
  const handleSort = (field) => {
    setSortField(field);
    setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
    setLoadData(true);
  };

  const exportToExcel = () => {
    if (data.data.length === 0) return toast.warning("No data to export");
    const exportData = selectedOptions.length > 0
      ? data.data.filter((i) => selectedOptions.includes(i.id))
      : data.data;

    const headers = ["Product", "Variant", "Lot Number", "Category", "Brand", "Demand Tags", "Warehouse", "In Stock", "Purchase Price", "Selling Price"];
    const rows = exportData.map((i) => [
      i.product_info?.name || "",
      i.variant,
      i.lots?.join(", ") || "",
      i.category,
      i.brand,
      normalizeDemandTags(i.demand_tags || i.product_info?.demand_tags).map((tag) => getDemandTag(tag).label).join(" | "),
      i.warehouse,
      i.total_qty,
      i.purchase_price,
      i.selling_price,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Stock.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    if (data.data.length === 0) return toast.warning("No data to copy");
    const exportData = selectedOptions.length > 0
      ? data.data.filter((i) => selectedOptions.includes(i.id))
      : data.data;

    const text = exportData.map((i) =>
      `${i.product_info?.name},${i.variant},${i.lots?.join(", ")},${i.category},${i.brand},${normalizeDemandTags(i.demand_tags || i.product_info?.demand_tags).map((tag) => getDemandTag(tag).label).join(" | ")},${i.warehouse},${i.total_qty},${i.purchase_price},${i.selling_price}`
    ).join("\n");
    const header = "Product,Variant,Lot Number,Category,Brand,Demand Tags,Warehouse,In Stock,Purchase Price,Selling Price\n";
    await navigator.clipboard.writeText(header + text);
    toast.success("Copied to clipboard");
  };

  const onFilterSubmit = () => { setIsAdvancedOpen(false); setCurrentPage(1); setLoadData(true); };
  const resetFilters = () => {
    setFilters(emptyFilters);
    setSearchQuery("");
    setCurrentPage(1);
    setLoadData(true);
  };

  const openTimeline = async (item) => {
    setTimelineProduct(item);
    setTimelineOpen(true);
    setTimelineLoading(true);
    try {
      const result = await fetchStockMovements(accessToken, {
        product_id: item.product_id,
        inventory_id: item.id,
        perPage: 20,
      });

      if (!result?.status) {
        throw new Error(result?.message || result?.error?.message || "Failed to fetch timeline");
      }

      setTimelineRows(result.data || []);
    } catch (error) {
      toast.error(error.message, { className: "alert alert-error" });
      setTimelineRows([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  // Page Totals
  const pageTotalQty = data.data.reduce((s, i) => s + (Number(i.total_qty) || 0), 0);
  const totalRows = data.meta?.total || data.data.length || 0;
  const grandTotalQty = data.others_data?.grand_total_qty || 0;
  const grandPurchaseValue = data.others_data?.grand_total_purchase_price || 0;
  const hasActiveFilters =
    searchQuery.trim() || filters.category || filters.brand || filters.warehouse || filters.demand_tag;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] figtree-regular">
      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              <PiCube size={14} />
              Stock
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Stock overview</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Manage product stock, warehouse quantity, demand tags, and movement timeline from one clean view.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            <div className={metricCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rows</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{totalRows.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">Matched stock records</p>
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
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatPrice(grandPurchaseValue)}</p>
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
                  {["category", "brand", "warehouse"].map((key) => (
                    <div key={key}>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                      <select
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                        value={filters[key]}
                        onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                      >
                        <option value="">All {key}s</option>
                        {(key === "category" ? categoryList : key === "brand" ? brandList : warehouseList).map((item) => (
                          <option key={item.id} value={item.id}>{item.title || item.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Demand tag</label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                      value={filters.demand_tag}
                      onChange={(e) => setFilters((p) => ({ ...p, demand_tag: e.target.value }))}
                    >
                      <option value="">All Demand Tags</option>
                      {demandTagOptions.map((tag) => (
                        <option key={tag.value} value={tag.value}>{tag.label}</option>
                      ))}
                    </select>
                  </div>
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

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200/80 px-4 py-4">
            <div>
              <h5 className="text-lg font-bold text-slate-950">Stock list</h5>
              <p className="text-sm text-slate-500">{data.data.length.toLocaleString()} rows on this page.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={exportToExcel} className="inline-flex h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"><FaFileExcel />Export</button>
              <button onClick={copyToClipboard} className="inline-flex h-12 items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"><PiCopy size={18} />Copy</button>
              {stockTrackingEnabled && hasPermission("stock-in.view") && <Link to="/stock/in" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"><RiLoginBoxLine /> Stock In</Link>}
              {hasPermission("stock-out.view") && <Link to="/stock/out" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"><LuSquareArrowOutUpLeft /> Stock Out</Link>}
            </div>
          </div>

          <div className="overflow-x-auto">
          {loading ? <TableLoading /> : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100 font-semibold">
                  <th className="w-0.5/12"><input type="checkbox" className="checkbox checkbox-sm" onChange={(e) => handleSelectAll(e.target.checked)} checked={isAllSelectedOnCurrentPage()} /></th>
                  <th className="w-3/12 cursor-pointer" onClick={() => handleSort("product_id")}>Product {sortField === "product_id" && (sortOrder === "asc" ? "Up" : "Down")}</th>
                  <th className="w-2/12">Variant</th>
                  <th className="w-2/12">Lot Number</th>
                  <th className="w-2/12">Category</th>
                  <th className="w-2/12">Brand</th>
                  <th className="w-3/12">Warehouse</th>
                  <th className="w-1/12">In Stock</th>
                  {timelineEnabled && <th className="w-1/12">Timeline</th>}
                  {/* <th className="w-1/12">Purchase Price</th> */}
                  {/* <th className="w-1/12">Selling Price</th> */}
                </tr>
              </thead>
              <tbody>
                {data.data.length > 0 ? (
                  <>
                    {data.data.map((item) => (
                      <tr key={item.id} className={`hover ${selectedOptions.includes(item.id) ? "bg-blue-100" : ""}`}>
                        <th><input type="checkbox" className="checkbox checkbox-sm" onChange={() => handleSelect(item.id)} checked={selectedOptions.includes(item.id)} /></th>
                        <td>
                          <div className="flex items-center space-x-4">
                            <div className="avatar">
                              <div className="w-8 h-10 rounded">
                                <img src={item.product_info?.thumbnail || noImage} alt={item.product_info?.name} />
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{item.product_info?.name}</p>
                              <p className="text-xs text-blue-500">{item.product_info?.barcode}</p>
                              {normalizeDemandTags(item.demand_tags || item.product_info?.demand_tags).length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {normalizeDemandTags(item.demand_tags || item.product_info?.demand_tags).map((tag) => {
                                    const demandTag = getDemandTag(tag);
                                    return (
                                      <span
                                        key={tag}
                                        className={`rounded border px-1.5 py-0.5 text-[11px] leading-tight ${demandTag.className}`}
                                      >
                                        {demandTag.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{item.variant}</td>
                        <td><span className="text-primary">#{item.lots?.join(", ") || "N/A"}</span></td>
                        <td>{item.category}</td>
                        <td>{item.brand}</td>
                        <td>{item.warehouse}</td>
                        <td>{item.total_qty}</td>
                        {timelineEnabled && (
                          <td>
                            <button
                              className="btn btn-sm btn-outline btn-primary"
                              onClick={() => openTimeline(item)}
                            >
                              <PiClock />
                            </button>
                          </td>
                        )}
                        {/* <td>{formatPrice(item.purchase_price)}</td>
                        <td>{formatPrice(item.selling_price)}</td> */}
                      </tr>
                    ))}

                    {/* Page Total */}
                    <tr className="bg-gray-100 font-semibold">
                      <td colSpan="7" className="text-left py-2">Page Total:</td>
                      <td colSpan="1" className="text-left">{pageTotalQty}</td>
                      {timelineEnabled && <td></td>}
                      {/* <td colSpan="2" className="text-left">{formatPrice(pageTotalPurchase)}</td> */}
                    </tr>

                    {/* Grand Totals */}
                    <tr className="bg-gray-200 font-bold border-t border-gray-300">
                      <td colSpan="7" className="py-2 text-left">Grand Total</td>
                      <td colSpan="1" className="text-left">
                        {data.others_data.grand_total_qty || 0}
                      </td>
                      {timelineEnabled && <td></td>}
                      {/* <td colSpan="2" className="text-left">
                        {formatPrice(data.others_data.grand_total_purchase_price || 0)}
                      </td> */}
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan="10" className="text-center py-4">No products found</td></tr>
                )}
              </tbody>
            </table>
          )}
          {data.data.length > 0 && (
            <Pagination
              currentPage={data.meta.current_page}
              lastPage={data.meta.last_page}
              handlePrevious={() => { setCurrentPage(p => p - 1); setLoadData(true); }}
              handleNextPage={() => { setCurrentPage(p => p + 1); setLoadData(true); }}
              handlePageChange={(p) => { setCurrentPage(p); setLoadData(true); }}
              showPrevious={currentPage > 1}
              showNext={currentPage < data.meta.last_page}
            />
            )}
          </div>
        </div>

      {timelineOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <div className="flex items-start justify-between gap-4 border-b pb-3">
              <div>
                <h3 className="font-bold text-lg">Stock Timeline</h3>
                <p className="text-sm text-gray-600">{timelineProduct?.product_info?.name || "Product"}</p>
              </div>
              <button className="btn btn-sm btn-circle" onClick={() => setTimelineOpen(false)}>X</button>
            </div>

            <div className="py-4 max-h-[60vh] overflow-y-auto">
              {timelineLoading ? (
                <TableLoading />
              ) : timelineRows.length > 0 ? (
                <div className="space-y-3">
                  {timelineRows.map((movement) => {
                    const qty = Number(movement.quantity_change || 0);
                    const isPositive = qty >= 0;
                    return (
                      <div key={movement.id} className="flex gap-3 border rounded-lg p-3">
                        <div className={`mt-1 h-3 w-3 rounded-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}></div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold capitalize">{movement.type?.replaceAll("_", " ")}</p>
                            <p className={`font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                              {isPositive ? "+" : ""}{qty}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600">
                            {movement.created_at ? new Date(movement.created_at).toLocaleString() : "N/A"}
                            {" "}• {movement.warehouse?.name || "N/A"}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Before: {movement.quantity_before ?? "N/A"} | After: {movement.quantity_after ?? "N/A"}
                            {movement.reference_type ? ` | ${movement.reference_type.replaceAll("_", " ")} ${movement.reference_id || ""}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-6">No movement found for this product yet.</p>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setTimelineOpen(false)} />
        </div>
      )}
      </div>
    </div>
  );
}

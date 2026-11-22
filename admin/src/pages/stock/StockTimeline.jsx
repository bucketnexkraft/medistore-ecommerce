import React, { useCallback, useEffect, useRef, useState } from "react";
import { PiArrowDown, PiArrowUp, PiClock, PiMagnifyingGlass, PiSliders } from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { fetchStockMovements } from "../../api/stock";
import { getWarehouse } from "../../api/warehouse";
import noImage from "../../../public/images/no-images/no-img.jpg";

const typeOptions = [
  { value: "", label: "All Types" },
  { value: "added", label: "Added" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "adjusted", label: "Adjusted" },
  { value: "returned", label: "Returned" },
  { value: "purchase_returned", label: "Purchase Returned" },
  { value: "transferred_in", label: "Transferred In" },
  { value: "transferred_out", label: "Transferred Out" },
];

const typeLabels = typeOptions.reduce((acc, option) => {
  if (option.value) acc[option.value] = option.label;
  return acc;
}, {});

const typeStyles = {
  added: "bg-emerald-100 text-emerald-700",
  returned: "bg-emerald-100 text-emerald-700",
  transferred_in: "bg-emerald-100 text-emerald-700",
  sold: "bg-rose-100 text-rose-700",
  reserved: "bg-amber-100 text-amber-700",
  adjusted: "bg-sky-100 text-sky-700",
  purchase_returned: "bg-rose-100 text-rose-700",
  transferred_out: "bg-rose-100 text-rose-700",
};

export default function StockTimeline() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState({ type: "", warehouse_id: "", startDate: "", endDate: "" });
  const [warehouses, setWarehouses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [data, setData] = useState({ data: [], meta: {}, summary: {} });
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const filterRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchStockMovements(accessToken, {
        perPage,
        page: currentPage,
        search: searchQuery,
        ...filters,
      });

      if (!result?.status) {
        throw new Error(result?.message || result?.error?.message || "Failed to fetch stock movements");
      }

      setData({
        data: result.data || [],
        meta: result.meta || {},
        summary: result.summary || {},
      });
    } catch (error) {
      toast.error(error.message, { className: "alert alert-error" });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, filters, perPage, searchQuery]);

  const fetchWarehouses = useCallback(async () => {
    try {
      const result = await getWarehouse(accessToken, { perPage: 100, status: "1" });
      if (result?.status) setWarehouses(result.data || []);
    } catch {
      toast.error("Failed to load warehouses");
    }
  }, [accessToken]);

  useEffect(() => { if (loadData) fetchData(); }, [fetchData, loadData]);
  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applySearch = () => {
    setCurrentPage(1);
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters({ type: "", warehouse_id: "", startDate: "", endDate: "" });
    setSearchQuery("");
    setCurrentPage(1);
    setLoadData(true);
  };

  const summaryCards = [
    { label: "Added Today", value: data.summary.added_today || 0 },
    { label: "Sold Today", value: data.summary.sold_today || 0 },
    { label: "Reserved Today", value: data.summary.reserved_today || 0 },
    { label: "Returned Today", value: data.summary.returned_today || 0 },
    { label: "Adjusted Today", value: data.summary.adjusted_today || 0 },
  ];

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Stock Timeline</h2>
            <p className="text-sm text-gray-600">At-a-glance stock movement audit across products.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="border rounded-lg p-3 bg-gray-50">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-lg font-semibold mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search product, reference, or note..."
                className="input w-full pr-16"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setLoadData(true); }}
                onKeyDown={(event) => event.key === "Enter" && applySearch()}
              />
              <div className="absolute right-1 flex gap-0.5">
                <button onClick={applySearch} className="text-gray-500 hover:text-primary px-1 py-2">
                  <PiMagnifyingGlass fontSize={20} />
                </button>
                <button onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="text-gray-500 hover:text-primary px-1 py-2">
                  <PiSliders fontSize={20} />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="label"><span className="label-text">Type</span></label>
                <select
                  className="select select-bordered h-10 w-full"
                  value={filters.type}
                  onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="label"><span className="label-text">Warehouse</span></label>
                <select
                  className="select select-bordered h-10 w-full"
                  value={filters.warehouse_id}
                  onChange={(event) => setFilters((prev) => ({ ...prev, warehouse_id: event.target.value }))}
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="label"><span className="label-text">From</span></label>
                <input
                  type="date"
                  className="input input-bordered h-10 w-full"
                  value={filters.startDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="label"><span className="label-text">To</span></label>
                <input
                  type="date"
                  className="input input-bordered h-10 w-full"
                  value={filters.endDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 w-full">
                <button onClick={resetFilters} className="btn btn-error btn-outline h-10">Reset</button>
                <button onClick={() => { setIsAdvancedOpen(false); applySearch(); }} className="btn h-10">Search</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm py-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <h5 className="font-semibold text-custom-gray-400">Movement List</h5>
        </div>
        <div className="overflow-x-auto">
          {loading ? <TableLoading /> : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100 font-semibold">
                  <th>Time</th>
                  <th>Movement</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Reference</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length > 0 ? data.data.map((movement) => {
                  const quantity = Number(movement.quantity_change || 0);
                  const isPositive = quantity >= 0;
                  return (
                    <tr key={movement.id} className="hover">
                      <td>
                        <div className="flex items-center gap-2">
                          <PiClock className="text-gray-500" />
                          <span>{movement.created_at ? new Date(movement.created_at).toLocaleString() : "N/A"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeStyles[movement.type] || "bg-gray-100 text-gray-700"}`}>
                          {isPositive ? <PiArrowUp /> : <PiArrowDown />}
                          {typeLabels[movement.type] || movement.type} {isPositive ? "+" : ""}{quantity}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-8 h-10 rounded">
                              <img src={movement.product?.thumbnail || noImage} alt={movement.product?.name || "Product"} />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{movement.product?.name || "N/A"}</p>
                            <p className="text-xs text-blue-500">{movement.product?.code || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td>{movement.warehouse?.name || "N/A"}</td>
                      <td>{movement.quantity_before ?? "N/A"}</td>
                      <td>{movement.quantity_after ?? "N/A"}</td>
                      <td>
                        <p className="capitalize">{(movement.reference_type || "N/A").replaceAll("_", " ")}</p>
                        <p className="text-xs text-gray-500">{movement.reference_id || ""}</p>
                      </td>
                      <td>{movement.user?.name || "System"}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="8" className="text-center py-4">No stock movements found</td></tr>
                )}
              </tbody>
            </table>
          )}
          {data.data.length > 0 && (
            <Pagination
              currentPage={data.meta.current_page}
              lastPage={data.meta.last_page}
              handlePrevious={() => { setCurrentPage((page) => Math.max(page - 1, 1)); setLoadData(true); }}
              handleNextPage={() => { setCurrentPage((page) => page + 1); setLoadData(true); }}
              handlePageChange={(page) => { setCurrentPage(page); setLoadData(true); }}
              showPrevious={currentPage > 1}
              showNext={currentPage < data.meta.last_page}
            />
          )}
        </div>
      </div>
    </div>
  );
}

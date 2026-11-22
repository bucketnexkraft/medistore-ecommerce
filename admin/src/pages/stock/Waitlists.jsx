import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import { PiEye, PiSliders, PiX } from "react-icons/pi";
import Pagination from "../../components/common/Pagination";
import TableLoading from "../../components/loadings/TableLoading";
import {
  cancelWaitlist,
  fetchWaitlistDetails,
  fetchWaitlists,
} from "../../api/waitlist";

const STATUS_STYLES = {
  pending: "badge badge-warning",
  partially_reserved: "badge badge-info",
  reserved: "badge badge-primary",
  notified: "badge badge-secondary",
  completed: "badge badge-success",
  cancelled: "badge badge-error",
};

export default function Waitlists() {
  const accessToken = useSelector((state) => state.auth.accessToken);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [status, setStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [actionId, setActionId] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [shouldLoadData, setShouldLoadData] = useState(true);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedWaitlist, setSelectedWaitlist] = useState(null);
  const filterRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchWaitlists(accessToken, {
        page: currentPage,
        perPage,
        filterText,
        status,
        sortField,
        sortOrder,
      });
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch waitlists");
      }
      setRows(Array.isArray(result.data) ? result.data : []);
      setMeta(result.meta || {});
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to fetch waitlists";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setShouldLoadData(false);
    }
  }, [accessToken, currentPage, perPage, filterText, status, sortField, sortOrder]);

  useEffect(() => {
    if (shouldLoadData) {
      fetchData();
    }
  }, [fetchData, shouldLoadData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    setShouldLoadData(true);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterText("");
    setStatus("");
    setPerPage(20);
    setSortField("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
    setShouldLoadData(true);
    setIsAdvancedOpen(false);
  }, []);

  const handleSort = useCallback((field) => {
    setSortField(field);
    setSortOrder((prev) => (sortField === field && prev === "asc" ? "desc" : "asc"));
    setCurrentPage(1);
    setShouldLoadData(true);
  }, [sortField]);

  const handlePrevious = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
    setShouldLoadData(true);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    setShouldLoadData(true);
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(meta.last_page || 1, prev + 1));
    setShouldLoadData(true);
  }, [meta.last_page]);

  const handleAction = async (id, type) => {
    try {
      setActionId(id);
      let result;
      if (type === "cancel") result = await cancelWaitlist(accessToken, id);

      if (!result?.status) {
        throw new Error(result?.message || `Failed to ${type} waitlist`);
      }
      toast.success(result?.message || "Action completed");
      setShouldLoadData(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Action failed");
    } finally {
      setActionId("");
    }
  };

  const handleView = async (id) => {
    try {
      setDetailLoading(true);
      const result = await fetchWaitlistDetails(accessToken, id);
      if (!result?.status) throw new Error(result?.message || "Failed to fetch waitlist details");
      setSelectedWaitlist(result.data || null);
      setShowDetailsDrawer(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to fetch details");
    } finally {
      setDetailLoading(false);
    }
  };

  const sortIndicator = (field) => (
    sortField === field ? (sortOrder === "asc" ? " asc" : " desc") : ""
  );

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Customer Waitlists</h2>
        <p className="text-sm text-gray-600">
          Track out-of-stock customer requests, reservations, and claim status.
        </p>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search customer, phone, email, or product..."
              className="input w-full pr-16 focus:outline-none focus:border-none"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setCurrentPage(1);
                setShouldLoadData(true);
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={handleSearch}
                  title="Search"
                >
                  <CiSearch fontSize={20} />
                </button>
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={() => setIsAdvancedOpen((prev) => !prev)}
                  title="Advanced filters"
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
                  <span className="label-text">Status</span>
                </label>
            <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
              }}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="partially_reserved">Partially Reserved</option>
              <option value="reserved">Reserved</option>
              <option value="notified">Notified</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[160px]">
                <label className="label">
                  <span className="label-text">Rows Per Page</span>
                </label>
            <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                    setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>
                  Reset
                </button>
                <button
                  className="btn h-10 min-h-10"
                  onClick={() => {
                    setCurrentPage(1);
                    setShouldLoadData(true);
                    setIsAdvancedOpen(false);
                  }}
                >
                  Search
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Waitlist List</h5>
          <div className="text-sm text-gray-500">
            Total: {meta.total || 0}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : error ? (
            <div className="alert alert-error m-4">
              <span>{error}</span>
              <button onClick={() => setShouldLoadData(true)} className="btn btn-sm btn-primary">
                Retry
              </button>
            </div>
          ) : (
          <table className="table figtree-regular">
            <thead>
              <tr className="bg-gray-100 font-semibold">
                <th className="cursor-pointer" onClick={() => handleSort("created_at")}>
                  Created {sortIndicator("created_at")}
                </th>
                <th>Customer</th>
                <th>Product</th>
                <th className="cursor-pointer" onClick={() => handleSort("requested_qty")}>
                  Requested {sortIndicator("requested_qty")}
                </th>
                <th className="cursor-pointer" onClick={() => handleSort("status")}>
                  Status {sortIndicator("status")}
                </th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center pt-4 pb-4">
                    No waitlists found
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="hover">
                  <td className="whitespace-nowrap">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString() : "N/A"}
                  </td>
                  <td>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{row.customer?.name || "N/A"}</p>
                      <p className="text-xs text-gray-500">{row.customer?.phone || row.customer?.email || "No contact"}</p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{row.product?.name || "N/A"}</p>
                      <p className="text-xs text-gray-500">{row.product?.code || row.product?.id || "N/A"}</p>
                    </div>
                  </td>
                  <td>{Number(row.requested_qty || 0)}</td>
                  <td>
                    <span className={STATUS_STYLES[row.status] || "badge"}>
                      {String(row.status || "N/A").replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-3 flex-wrap">
                      <button
                        className="h-12 w-12 rounded-xl bg-[#ede8ff] text-[#5a35ff] hover:bg-[#e3dcff] transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
                        onClick={() => handleView(row.id)}
                        title="View"
                      >
                        <PiEye className="w-5 h-5" />
                      </button>
                      <button
                        className="h-12 w-12 rounded-xl bg-[#fff0f1] text-[#ff4d5e] hover:bg-[#ffe3e6] transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
                        disabled={actionId === row.id || ["completed", "cancelled"].includes(row.status)}
                        onClick={() => handleAction(row.id, "cancel")}
                        title="Cancel"
                      >
                        <PiX className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {rows.length > 0 && (
          <Pagination
            currentPage={meta.current_page || 1}
            lastPage={meta.last_page || 1}
            handlePrevious={handlePrevious}
            handlePageChange={handlePageChange}
            handleNextPage={handleNextPage}
          />
        )}
      </div>

      {showDetailsDrawer && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowDetailsDrawer(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out translate-x-0">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold">Waitlist Details</h3>
              <button
                onClick={() => setShowDetailsDrawer(false)}
                className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                <PiX className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-auto h-[calc(100%-88px)]">
              {detailLoading ? (
                <p className="text-sm text-gray-500">Loading details...</p>
              ) : !selectedWaitlist ? (
                <p className="text-sm text-gray-500">No details found.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Customer</p>
                      <p className="text-sm font-semibold">
                        {(selectedWaitlist?.customer?.first_name || "") + " " + (selectedWaitlist?.customer?.last_name || "") || "N/A"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedWaitlist?.customer?.phone || selectedWaitlist?.customer?.email || "No contact"}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Product</p>
                      <p className="text-sm font-semibold">
                        {selectedWaitlist?.product?.name || selectedWaitlist?.product_id || "N/A"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Code: {selectedWaitlist?.product?.code || "N/A"}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Requested Qty</p>
                      <p className="text-sm font-semibold">{Number(selectedWaitlist?.requested_qty || 0)}</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-gray-500">Fulfilled Qty</p>
                      <p className="text-sm font-semibold">{Number(selectedWaitlist?.fulfilled_qty || 0)}</p>
                    </div>
                  </div>

                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

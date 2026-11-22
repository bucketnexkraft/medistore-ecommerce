import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiMagnifyingGlass, PiSliders } from "react-icons/pi";
import TableLoading from "../../../components/loadings/TableLoading";
import Pagination from "../../../components/common/Pagination";
import { getPlanPaymentLogs, updatePlanPaymentLogStatus } from "../../../api/backoffice/planPaymentLogs";

const statusOptions = ["pending", "approved", "rejected"];

export default function PlanPaymentLogs() {
  const accessToken = useSelector((state) => state.auth.accessToken);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const filterRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailStatus, setDetailStatus] = useState("pending");
  const [detailRemarks, setDetailRemarks] = useState("");
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const isSelectedRowFinalized = ["approved", "rejected"].includes(
    String(selectedRow?.status || "").toLowerCase()
  );
  const isSelectedRowAutomatic = selectedRow && selectedRow?.gateway?.gateway_type !== "manual";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPlanPaymentLogs(accessToken, {
        page,
        perPage: 20,
        keyword,
        status,
      });
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch payment logs");
      }
      setRows(result?.data || []);
      setMeta(result?.meta || meta);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to fetch payment logs");
    } finally {
      setLoading(false);
    }
  }, [accessToken, keyword, page, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
    } else {
      loadData();
    }
    setIsAdvancedOpen(false);
  };

  const resetFilters = () => {
    setKeyword("");
    setStatus("");
    if (page !== 1) {
      setPage(1);
    } else {
      loadData();
    }
    setIsAdvancedOpen(false);
  };

  const openDetails = (row) => {
    setSelectedRow(row);
    setDetailStatus(row.status || "pending");
    setDetailRemarks(row.remarks || "");
  };

  const closeDetails = () => {
    if (savingId) return;
    setSelectedRow(null);
  };

  const handleUpdateFromDetails = async (forcedStatus = null) => {
    if (!selectedRow) return;
    if (isSelectedRowAutomatic) return;
    if (["approved", "rejected"].includes(String(selectedRow.status || "").toLowerCase())) {
      return;
    }
    const statusToSave = forcedStatus || detailStatus;
    setSavingId(selectedRow.id);
    try {
      const result = await updatePlanPaymentLogStatus(accessToken, selectedRow.id, {
        status: statusToSave,
        remarks: detailRemarks || null,
      });
      if (!result?.status) {
        throw new Error(result?.message || "Failed to update status");
      }
      toast.success("Payment updated and company email queued.");
      setSelectedRow(null);
      loadData();
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      toast.error(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-xl font-semibold">Plan Payment Logs</h2>
          <p className="text-sm text-gray-600 mt-1">Review company plan purchase and gateway submissions.</p>

          <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
            <div className="rounded-lg border">
              <div className="relative flex items-center">
                <input
                  type="text"
                  className="input w-full pr-16 focus:outline-none focus:border-none"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search company, email, gateway..."
                />
                <div className="absolute right-1 w-full max-w-16 flex items-center justify-end gap-0.5">
                  <button
                    onClick={handleSearch}
                    className="text-gray-500 hover:text-primary px-1 py-2"
                    title="Search"
                  >
                    <PiMagnifyingGlass className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsAdvancedOpen((prev) => !prev)}
                    className="text-gray-500 hover:text-primary px-1 py-2"
                    title="Advanced Search"
                  >
                    <PiSliders className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {isAdvancedOpen && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
                <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                  <label className="label">
                    <span className="label-text">Payment Status</span>
                  </label>
                  <select
                    className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All</option>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full flex justify-end gap-2">
                  <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>
                    Reset
                  </button>
                  <button className="btn h-10 min-h-10" onClick={handleSearch}>
                    Search
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="overflow-x-auto">
            {loading ? (
              <TableLoading />
            ) : (
              <table className="table">
                <thead>
                  <tr className="bg-gray-100">
                    <th>Company</th>
                    <th>Plan</th>
                    <th>Gateway</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        No payment logs found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="font-medium">{row.company?.name || row.company_id}</div>
                          <div className="text-xs text-gray-500">{row.company?.email || "-"}</div>
                        </td>
                        <td>
                          <div className="font-medium">{row.plan?.name || "-"}</div>
                          <div className="text-xs text-gray-500">{row.plan?.billing_period || "-"}</div>
                        </td>
                        <td>{row.gateway_name}</td>
                        <td>
                          {Number(row.payable_amount || 0).toFixed(2)} {row.currency?.code || ""}
                        </td>
                        <td>
                          <span
                            className={`badge text-white ${
                              row.status === "approved"
                                ? "badge-success"
                                : row.status === "rejected"
                                  ? "badge-error"
                                  : "badge-warning"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td>{new Date(row.created_at).toLocaleString()}</td>
                        <td className="text-center">
                          <button className="btn btn-sm btn-outline" onClick={() => openDetails(row)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            currentPage={meta.current_page || 1}
            lastPage={meta.last_page || 1}
            handlePrevious={() => setPage((prev) => Math.max(prev - 1, 1))}
            handlePageChange={setPage}
            handleNextPage={() => setPage((prev) => Math.min(prev + 1, meta.last_page || 1))}
            showPrevious={(meta.current_page || 1) > 1}
            showNext={(meta.current_page || 1) < (meta.last_page || 1)}
          />
        </div>
      </div>

      {selectedRow && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeDetails} />
          <div className="fixed inset-y-0 right-0 top-0 m-0 h-screen max-h-screen w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Payment Details</h3>
                <p className="text-xs text-gray-500">
                  {selectedRow.company?.name || selectedRow.company_id} • {selectedRow.gateway_name}
                </p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={closeDetails} disabled={Boolean(savingId)}>
                Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="font-semibold">Company:</span> {selectedRow.company?.name || "-"}</div>
                <div><span className="font-semibold">Email:</span> {selectedRow.company?.email || "-"}</div>
                <div><span className="font-semibold">Plan:</span> {selectedRow.plan?.name || "-"}</div>
                <div><span className="font-semibold">Gateway:</span> {selectedRow.gateway_name}</div>
                <div><span className="font-semibold">Gateway Type:</span> {selectedRow.gateway?.gateway_type || "-"}</div>
                <div><span className="font-semibold">TRX:</span> {selectedRow.trx || "-"}</div>
                <div>
                  <span className="font-semibold">Amount:</span> {Number(selectedRow.payable_amount || 0).toFixed(2)}{" "}
                  {selectedRow.currency?.code || ""}
                </div>
                <div><span className="font-semibold">Submitted:</span> {new Date(selectedRow.created_at).toLocaleString()}</div>
                <div><span className="font-semibold">Updated:</span> {new Date(selectedRow.updated_at).toLocaleString()}</div>
              </div>

              {!isSelectedRowAutomatic && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold mb-2">Remarks</h4>
                  <p className="text-sm text-gray-700">{selectedRow.remarks || "No remarks."}</p>
                </div>
              )}

              {!isSelectedRowAutomatic && (
                <>
                  <div className="border rounded-lg p-3">
                    <h4 className="font-semibold mb-2">Submitted Text Fields</h4>
                    {Object.keys(selectedRow?.payment_payload?.fields || {}).length === 0 ? (
                      <p className="text-sm text-gray-500">No text fields submitted.</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {Object.entries(selectedRow.payment_payload.fields).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-3 gap-2">
                            <div className="font-medium">{key}</div>
                            <div className="col-span-2 break-all">{String(value)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-3">
                    <h4 className="font-semibold mb-2">Submitted Files</h4>
                    {Object.keys(selectedRow?.payment_payload?.file_urls || {}).length === 0 ? (
                      <p className="text-sm text-gray-500">No files submitted.</p>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(selectedRow.payment_payload.file_urls).map(([key, url]) => {
                          const lower = String(url).toLowerCase();
                          const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].some((ext) =>
                            lower.includes(ext)
                          );

                          return (
                            <div key={key} className="border rounded p-2">
                              <p className="text-sm font-medium mb-2">{key}</p>
                              {isImage ? (
                                <a href={url} target="_blank" rel="noreferrer" className="inline-block">
                                  <img src={url} alt={key} className="h-36 rounded border object-contain" />
                                </a>
                              ) : (
                                <a href={url} target="_blank" rel="noreferrer" className="link link-primary text-sm">
                                  Open file
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Decision</label>
                      <select
                        className="select select-bordered w-full"
                        value={detailStatus}
                        onChange={(e) => setDetailStatus(e.target.value)}
                        disabled={isSelectedRowFinalized || Boolean(savingId)}
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Remarks (mail will include this)</label>
                      <textarea
                        className="textarea textarea-bordered w-full"
                        rows={4}
                        value={detailRemarks}
                        onChange={(e) => setDetailRemarks(e.target.value)}
                        placeholder="Write approval/rejection reason"
                        disabled={isSelectedRowFinalized || Boolean(savingId)}
                      />
                    </div>
                  </div>
                </>
              )}
              {isSelectedRowFinalized && !isSelectedRowAutomatic && (
                <div className="alert alert-info py-2">
                  <span>
                    This payment is already {selectedRow.status}. You cannot submit/update it again.
                  </span>
                </div>
              )}
            </div>

            {!isSelectedRowAutomatic && (
              <div className="p-4 pb-8 border-t grid grid-cols-1 md:grid-cols-3 gap-2">
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setDetailStatus("pending");
                    handleUpdateFromDetails("pending");
                  }}
                  disabled={isSelectedRowFinalized || Boolean(savingId)}
                >
                  Save Pending
                </button>
                <button
                  className="btn btn-error"
                  onClick={() => {
                    setDetailStatus("rejected");
                    handleUpdateFromDetails("rejected");
                  }}
                  disabled={isSelectedRowFinalized || Boolean(savingId)}
                >
                  Reject
                </button>
                <button
                  className="btn btn-success text-white"
                  onClick={() => {
                    setDetailStatus("approved");
                    handleUpdateFromDetails("approved");
                  }}
                  disabled={isSelectedRowFinalized || Boolean(savingId)}
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

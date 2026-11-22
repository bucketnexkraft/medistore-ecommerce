import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiMagnifyingGlass, PiSliders } from "react-icons/pi";
import TableLoading from "../../../components/loadings/TableLoading";
import Pagination from "../../../components/common/Pagination";
import {
  disableCommissionCompanyStore,
  getCommissionPaymentLogs,
  sendCommissionPaymentWarning,
  updateCommissionPaymentLogStatus,
} from "../../../api/backoffice/commissionPaymentLogs";

const statusOptions = ["pending", "submitted", "received", "disabled", "active", "clear"];
const reviewStatusOptions = ["pending", "approved", "rejected"];

const statusClasses = {
  pending: "badge-warning",
  submitted: "badge-info",
  received: "badge-success",
  disabled: "badge-error",
  active: "badge-primary",
  clear: "badge-ghost",
  approved: "badge-success",
  rejected: "badge-error",
};

export default function CommissionPaymentLogs() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const filterRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailStatus, setDetailStatus] = useState("pending");
  const [detailRemarks, setDetailRemarks] = useState("");
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCommissionPaymentLogs(accessToken, {
        page,
        perPage: 20,
        keyword,
        status,
      });
      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch commission receivables");
      }
      setRows(result?.data || []);
      setMeta((prev) => result?.meta || prev);
      setSummary(result?.summary || {});
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to fetch commission receivables");
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (page !== 1) setPage(1);
    else loadData();
    setIsAdvancedOpen(false);
  };

  const resetFilters = () => {
    setKeyword("");
    setStatus("");
    if (page !== 1) setPage(1);
    else loadData();
    setIsAdvancedOpen(false);
  };

  const openDetails = (row) => {
    const reviewablePayment = row.reviewable_payment || null;
    setSelectedRow(row);
    setDetailStatus(reviewablePayment?.status || "pending");
    setDetailRemarks(reviewablePayment?.remarks || "");
  };

  const closeDetails = () => {
    if (savingKey) return;
    setSelectedRow(null);
  };

  const formatMoney = (value, currency = "") => {
    const amount = Number(value || 0).toFixed(2);
    return currency ? `${amount} ${currency}` : amount;
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const handleUpdateStatus = async (nextStatus) => {
    const paymentId = selectedRow?.reviewable_payment?.id;
    if (!paymentId) {
      toast.info("No submitted payment is available to review for this company.");
      return;
    }

    setSavingKey(`status-${paymentId}`);
    try {
      const result = await updateCommissionPaymentLogStatus(accessToken, paymentId, {
        status: nextStatus,
        remarks: detailRemarks || null,
      });
      if (!result?.status) throw new Error(result?.message || "Failed to update payment");
      toast.success("Commission payment updated successfully.");
      setSelectedRow(null);
      loadData();
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      toast.error(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message || "Failed to update payment");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSendWarning = async (row) => {
    setSavingKey(`warn-${row.company_id}`);
    try {
      const result = await sendCommissionPaymentWarning(accessToken, row.company_id, {
        remarks: `Outstanding due: ${formatMoney(row.outstanding_amount)}`,
      });
      if (!result?.status) throw new Error(result?.message || "Failed to send warning");
      toast.success(result?.message || "Warning email queued successfully.");
      loadData();
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      toast.error(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message || "Failed to send warning");
    } finally {
      setSavingKey(null);
    }
  };

  const handleDisableStore = async (row) => {
    if (!window.confirm(`Disable ${row.company?.name || "this company"} and its store?`)) {
      return;
    }

    setSavingKey(`disable-${row.company_id}`);
    try {
      const result = await disableCommissionCompanyStore(accessToken, row.company_id, {
        remarks: "Store disabled from commission receivables due screen.",
      });
      if (!result?.status) throw new Error(result?.message || "Failed to disable store");
      toast.success(result?.message || "Store disabled successfully.");
      setSelectedRow((prev) => (prev?.company_id === row.company_id ? { ...prev, company: { ...prev.company, status: 0 }, status: "disabled" } : prev));
      loadData();
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      toast.error(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message || "Failed to disable store");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <>
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-xl font-semibold">Commission Receivables</h2>
          <p className="text-sm text-gray-600 mt-1">Track outstanding commission by company, review submitted payments, send warning emails, and disable overdue stores.</p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase text-amber-700">Pending</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{formatMoney(summary.pending_receivable)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase text-blue-700">Submitted</p>
              <p className="mt-1 text-xl font-bold text-blue-900">{formatMoney(summary.submitted_receivable)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase text-emerald-700">Received</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{formatMoney(summary.received_amount)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Companies</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{Number(summary.active_companies || 0)}</p>
            </div>
          </div>

          <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
            <div className="rounded-lg border">
              <div className="relative flex items-center">
                <input
                  type="text"
                  className="input w-full pr-16 focus:outline-none focus:border-none"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search company, trx, gateway..."
                />
                <div className="absolute right-1 w-full max-w-16 flex items-center justify-end gap-0.5">
                  <button onClick={handleSearch} className="text-gray-500 hover:text-primary px-1 py-2" title="Search">
                    <PiMagnifyingGlass className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsAdvancedOpen((prev) => !prev)} className="text-gray-500 hover:text-primary px-1 py-2" title="Advanced Search">
                    <PiSliders className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {isAdvancedOpen && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
                <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                  <label className="label"><span className="label-text">Receivable Status</span></label>
                  <select className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All</option>
                    {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="w-full flex justify-end gap-2">
                  <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>Reset</button>
                  <button className="btn h-10 min-h-10" onClick={handleSearch}>Search</button>
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
                    <th>Store</th>
                    <th>Orders</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Latest Activity</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8">No commission receivables found.</td></tr>
                  ) : (
                    rows.map((row) => {
                      const latestPayment = row.latest_payment;
                      return (
                        <tr key={row.company_id}>
                          <td>
                            <div className="font-medium">{row.company?.name || row.company_id}</div>
                            <div className="text-xs text-gray-500">{row.company?.email || "-"}</div>
                            <div className="text-xs text-gray-500">{row.company?.phone_number || "-"}</div>
                          </td>
                          <td>
                            <div className="font-medium">{row.plan?.name || "-"}</div>
                            <div className="text-xs text-gray-500 capitalize">{row.plan?.plan_type || "-"}</div>
                          </td>
                          <td>
                            <div className="font-medium">{row.company?.domain || "No domain"}</div>
                            <div className="text-xs text-gray-500">{Number(row.company?.status || 0) === 1 ? "Store active" : "Store disabled"}</div>
                          </td>
                          <td>{Number(row.orders_count || 0)}</td>
                          <td>
                            <div className="font-medium">{formatMoney(row.outstanding_amount)}</div>
                            <div className="text-xs text-gray-500">Pending {formatMoney(row.pending_payable)} | Submitted {formatMoney(row.submitted_payable)}</div>
                          </td>
                          <td>
                            <span className={`badge capitalize ${statusClasses[row.status] || "badge-ghost"}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <div className="font-medium">{latestPayment?.trx || "-"}</div>
                            <div className="text-xs text-gray-500">{formatDateTime(latestPayment?.submitted_at || latestPayment?.created_at)}</div>
                          </td>
                          <td className="text-center">
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <button className="btn btn-sm btn-outline" onClick={() => openDetails(row)}>View</button>
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => handleSendWarning(row)}
                                disabled={Boolean(savingKey) || Number(row.outstanding_amount || 0) <= 0}
                              >
                                Warn
                              </button>
                              <button
                                className="btn btn-sm btn-error"
                                onClick={() => handleDisableStore(row)}
                                disabled={Boolean(savingKey) || Number(row.company?.status || 0) !== 1}
                              >
                                Disable
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
          <div className="fixed inset-y-0 right-0 top-0 h-screen w-full max-w-3xl bg-white z-50 shadow-2xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Receivable Details</h3>
                <p className="text-xs text-gray-500">{selectedRow.company?.name || selectedRow.company_id} | {selectedRow.company?.domain || "No domain"}</p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={closeDetails} disabled={Boolean(savingKey)}>Close</button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="font-semibold">Company:</span> {selectedRow.company?.name || "-"}</div>
                <div><span className="font-semibold">Email:</span> {selectedRow.company?.email || "-"}</div>
                <div><span className="font-semibold">Phone:</span> {selectedRow.company?.phone_number || "-"}</div>
                <div><span className="font-semibold">Store:</span> {selectedRow.company?.domain || "-"}</div>
                <div><span className="font-semibold">Plan:</span> {selectedRow.plan?.name || "-"}</div>
                <div><span className="font-semibold">Orders:</span> {Number(selectedRow.orders_count || 0)}</div>
                <div><span className="font-semibold">Pending:</span> {formatMoney(selectedRow.pending_payable)}</div>
                <div><span className="font-semibold">Submitted:</span> {formatMoney(selectedRow.submitted_payable)}</div>
                <div><span className="font-semibold">Received:</span> {formatMoney(selectedRow.received_amount)}</div>
                <div><span className="font-semibold">Outstanding:</span> {formatMoney(selectedRow.outstanding_amount)}</div>
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">Store Control</h4>
                    <p className="text-sm text-gray-500">Send payment warning or disable the company store if dues remain unpaid.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => handleSendWarning(selectedRow)}
                      disabled={Boolean(savingKey) || Number(selectedRow.outstanding_amount || 0) <= 0}
                    >
                      Send Warning
                    </button>
                    <button
                      className="btn btn-sm btn-error"
                      onClick={() => handleDisableStore(selectedRow)}
                      disabled={Boolean(savingKey) || Number(selectedRow.company?.status || 0) !== 1}
                    >
                      Disable Store
                    </button>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <h4 className="font-semibold mb-2">Pending Charges</h4>
                {selectedRow.pending_charges?.length ? (
                  <div className="space-y-2">
                    {selectedRow.pending_charges.map((charge) => (
                      <div key={charge.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">{charge.order_no || charge.id}</div>
                          <div className="text-xs text-gray-500">{formatDateTime(charge.charged_at)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatMoney(charge.commission_amount)}</div>
                          <div className="text-xs text-gray-500 capitalize">{charge.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No pending charges found.</p>
                )}
              </div>

              <div className="border rounded-lg p-3">
                <h4 className="font-semibold mb-2">Recent Payments</h4>
                {selectedRow.recent_payments?.length ? (
                  <div className="space-y-3">
                    {selectedRow.recent_payments.map((payment) => (
                      <div key={payment.id} className="rounded border p-3 text-sm space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div><span className="font-semibold">TRX:</span> {payment.trx || "-"}</div>
                          <div><span className="font-semibold">Gateway:</span> {payment.gateway_name || "-"}</div>
                          <div><span className="font-semibold">Amount:</span> {formatMoney(payment.amount, payment.currency?.code || "")}</div>
                          <div>
                            <span className={`badge capitalize ${statusClasses[payment.status] || "badge-ghost"}`}>
                              {payment.status}
                            </span>
                          </div>
                        </div>

                        {Object.keys(payment?.payment_payload?.fields || {}).length > 0 && (
                          <div className="rounded bg-gray-50 p-2">
                            <p className="font-medium mb-1">Submitted Fields</p>
                            <div className="space-y-1">
                              {Object.entries(payment.payment_payload.fields).map(([key, value]) => (
                                <div key={key} className="grid grid-cols-3 gap-2">
                                  <div className="font-medium">{key}</div>
                                  <div className="col-span-2 break-all">{String(value)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No payment history found.</p>
                )}
              </div>

              {selectedRow.reviewable_payment?.id && (
                <div className="border rounded-lg p-3 space-y-3">
                  <div>
                    <h4 className="font-semibold">Review Latest Submitted Payment</h4>
                    <p className="text-sm text-gray-500">Approve, reject, or keep the latest reviewable settlement in pending status.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Decision</label>
                      <select className="select select-bordered w-full" value={detailStatus} onChange={(e) => setDetailStatus(e.target.value)} disabled={Boolean(savingKey)}>
                        {reviewStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Remarks</label>
                      <textarea className="textarea textarea-bordered w-full" rows={4} value={detailRemarks} onChange={(e) => setDetailRemarks(e.target.value)} disabled={Boolean(savingKey)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button className="btn btn-outline" onClick={() => handleUpdateStatus("pending")} disabled={Boolean(savingKey)}>Save Pending</button>
                    <button className="btn btn-error" onClick={() => handleUpdateStatus("rejected")} disabled={Boolean(savingKey)}>Reject</button>
                    <button className="btn btn-success text-white" onClick={() => handleUpdateStatus("approved")} disabled={Boolean(savingKey)}>Approve</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

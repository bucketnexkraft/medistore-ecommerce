import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  approveStockGuardRequest,
  fetchStockGuardOptions,
  fetchStockGuardRequests,
  rejectStockGuardRequest,
  updateStockGuardRules,
} from "../../api/stockGuard";
import TableLoading from "../../components/loadings/TableLoading";

const tabs = [
  { key: "requests", label: "Requests" },
  { key: "logs", label: "Logs" },
  { key: "rules", label: "Rules" },
];

const statusMeta = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  applied: "bg-emerald-100 text-emerald-800 border-emerald-200",
  approved: "bg-sky-100 text-sky-800 border-sky-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

function Metric({ label, value, tone = "slate" }) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-900 border-slate-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-900 border-emerald-200",
    sky: "bg-sky-50 text-sky-900 border-sky-200",
  }[tone];

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
    </div>
  );
}

function EmptyState({ activeTab }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="text-base font-semibold text-slate-900">No StockGuard records found</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
        {activeTab === "requests"
          ? "There are no pending requests right now. New manual stock adjustment requests will appear here."
          : "No adjustment records match the current filter. Try changing the status filter."}
      </p>
    </div>
  );
}

export default function StockGuard() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [activeTab, setActiveTab] = useState("requests");
  const [options, setOptions] = useState({ reasons: [], rules: {}, inventory_items: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [rulesForm, setRulesForm] = useState({ unit_threshold: "5", value_threshold: "100" });
  const [savingRules, setSavingRules] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const isRulesTab = activeTab === "rules";
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const appliedCount = rows.filter((row) => row.status === "applied").length;
  const rejectedCount = rows.filter((row) => row.status === "rejected").length;
  const reasonsCount = Array.isArray(options.reasons) ? options.reasons.length : 0;
  const totalItems = Array.isArray(options.inventory_items) ? options.inventory_items.length : 0;

  const loadOptions = useCallback(async () => {
    const result = await fetchStockGuardOptions(accessToken);
    const payload = result.data || { reasons: [], rules: {}, inventory_items: [] };
    setOptions(payload);
    setRulesForm({
      unit_threshold: String(payload?.rules?.unit_threshold ?? 5),
      value_threshold: String(payload?.rules?.value_threshold ?? 100),
    });
  }, [accessToken]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const result = await fetchStockGuardRequests(accessToken, params);
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load StockGuard requests");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

  useEffect(() => {
    loadOptions().catch(() => toast.error("Failed to load StockGuard options"));
  }, [loadOptions]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "requests") setFilter("pending");
    if (tab === "logs") setFilter("");
  };

  const handleApprove = async (id) => {
    const result = await approveStockGuardRequest(accessToken, id);
    toast.success(result.message || "Request approved");
    loadRows();
    loadOptions();
  };

  const openRejectModal = (row) => {
    setRejectTarget(row);
    setRejectNote("");
  };

  const closeRejectModal = () => {
    if (rejecting) return;
    setRejectTarget(null);
    setRejectNote("");
  };

  const handleReject = async () => {
    if (!rejectTarget) return;

    setRejecting(true);
    try {
      const result = await rejectStockGuardRequest(accessToken, rejectTarget.id, { note: rejectNote });
      toast.success(result.message || "Request rejected");
      setRejectTarget(null);
      setRejectNote("");
      loadRows();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reject request");
    } finally {
      setRejecting(false);
    }
  };

  const handleSaveRules = async () => {
    const unitThreshold = Number(rulesForm.unit_threshold);
    const valueThreshold = Number(rulesForm.value_threshold);

    if (!unitThreshold || unitThreshold <= 0) {
      toast.error("Quantity threshold must be greater than 0");
      return;
    }
    if (!valueThreshold || valueThreshold <= 0) {
      toast.error("Value threshold must be greater than 0");
      return;
    }

    setSavingRules(true);
    try {
      const result = await updateStockGuardRules(accessToken, {
        unit_threshold: unitThreshold,
        value_threshold: valueThreshold,
      });
      toast.success(result.message || "Rules updated");
      const updatedRules = result?.data?.rules || {};
      setOptions((prev) => ({
        ...prev,
        rules: {
          ...prev.rules,
          ...updatedRules,
        },
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update StockGuard rules");
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 figtree-regular lg:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">StockGuard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Approval workflow and audit trail for manual stock adjustments.
          </p>
        </div>
        <div className="text-sm font-medium text-slate-500">
          {rows.length} record{rows.length === 1 ? "" : "s"} in current view
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Pending" value={pendingCount} tone="amber" />
        <Metric label="Applied" value={appliedCount} tone="emerald" />
        <Metric label="Rejected" value={rejectedCount} tone="slate" />
        <Metric label="Rules" value={reasonsCount} tone="sky" />
        <Metric label="Items" value={totalItems} tone="slate" />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="rounded-lg bg-slate-100 p-1">
            <div className="grid grid-cols-3 gap-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.key;
                const count = tab.key === "requests" ? pendingCount : tab.key === "logs" ? rows.length : reasonsCount;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={`flex min-w-[140px] items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-transparent text-slate-700 hover:bg-white hover:text-blue-700"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        active ? "bg-white text-blue-700" : "bg-white text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!isRulesTab ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700">Status</span>
              <select
                className="select select-bordered select-sm h-10 rounded-md border-slate-300 bg-white text-slate-900"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="applied">Applied</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          ) : null}
        </div>

        {!isRulesTab ? (
          <div>
            <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {activeTab === "requests" ? "Pending Requests" : "Adjustment Logs"}
                </h2>
                <p className="text-sm text-slate-600">
                  {activeTab === "requests"
                    ? "Review manual stock adjustment requests before they affect inventory."
                    : "Track completed, rejected, and applied stock adjustments."}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                {rows.length} shown
              </span>
            </div>

            <div className="p-5">
              {loading ? (
                <TableLoading />
              ) : rows.length ? (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Reason</th>
                        <th>Flags</th>
                        <th>Status</th>
                        <th>User</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const qty = Number(row.qty_change || 0);
                        const statusClass = statusMeta[row.status] || "bg-slate-100 text-slate-700 border-slate-200";

                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td>
                              <div className="font-semibold text-slate-950">{row.product || "Unknown product"}</div>
                              <div className="text-xs text-slate-500">{row.warehouse || "N/A"}</div>
                            </td>
                            <td>
                              <div className={`font-bold ${qty < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                {qty > 0 ? "+" : ""}
                                {qty}
                              </div>
                              <div className="text-xs text-slate-500">
                                {row.quantity_before ?? "N/A"} -&gt; {row.quantity_after ?? "Pending"}
                              </div>
                            </td>
                            <td className="text-sm text-slate-700">{row.reason_label || "N/A"}</td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {row.flags?.length ? (
                                  row.flags.map((flag) => (
                                    <span
                                      key={flag.value}
                                      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                                    >
                                      {flag.label}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400">None</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                                {row.status_label || row.status}
                              </span>
                            </td>
                            <td>
                              <div className="text-sm font-semibold text-slate-900">{row.requested_by || "N/A"}</div>
                              {row.approved_by ? (
                                <div className="text-xs text-slate-500">By {row.approved_by}</div>
                              ) : null}
                            </td>
                            <td>
                              {row.status === "pending" ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm border-none bg-success/10 text-success hover:bg-success/20"
                                    onClick={() => handleApprove(row.id)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                    onClick={() => openRejectModal(row)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">Done</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState activeTab={activeTab} />
              )}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-950">Guard Rules</h2>
              <p className="mt-1 text-sm text-slate-600">
                Configure when manual stock changes should require approval.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <span className="text-sm font-bold text-slate-900">Quantity Threshold</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Adjustments above this quantity are sent for review.
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={rulesForm.unit_threshold}
                  onChange={(event) => setRulesForm((prev) => ({ ...prev, unit_threshold: event.target.value }))}
                  className="input input-bordered mt-3 h-11 w-full rounded-md border-slate-300 bg-white text-slate-950"
                />
              </label>

              <label className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <span className="text-sm font-bold text-slate-900">Value Threshold</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Adjustments above this value are marked as sensitive.
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={rulesForm.value_threshold}
                  onChange={(event) => setRulesForm((prev) => ({ ...prev, value_threshold: event.target.value }))}
                  className="input input-bordered mt-3 h-11 w-full rounded-md border-slate-300 bg-white text-slate-950"
                />
              </label>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">Suspicious Negative Reasons</p>
              <p className="mt-1 text-sm text-amber-800">
                Negative adjustments outside approved loss or correction reasons are flagged automatically.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveRules}
                className="btn h-11 rounded-md border-0 bg-blue-600 px-6 font-bold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
                disabled={savingRules}
              >
                {savingRules ? "Saving..." : "Save Rules"}
              </button>
            </div>
          </div>
        )}
      </section>

      {rejectTarget ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-md rounded-lg p-0">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-950">Reject Adjustment</h3>
              <p className="mt-1 text-sm text-slate-600">
                {rejectTarget.product || "Selected product"} request will be marked as rejected.
              </p>
            </div>

            <div className="px-5 py-4">
              <label className="label px-0">
                <span className="label-text font-semibold text-slate-700">Reject reason</span>
              </label>
              <textarea
                className="textarea textarea-bordered min-h-28 w-full rounded-md border-slate-300 bg-white text-slate-950"
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                placeholder="Optional note"
                disabled={rejecting}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeRejectModal}
                disabled={rejecting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-error ${rejecting ? "loading" : ""}`}
                onClick={handleReject}
                disabled={rejecting}
              >
                Reject
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeRejectModal}
            disabled={rejecting}
            aria-label="Close reject modal"
          />
        </div>
      ) : null}
    </div>
  );
}

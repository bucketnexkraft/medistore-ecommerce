import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  PiArrowClockwise,
  PiBank,
  PiCalendarBlank,
  PiCheckCircle,
  PiClock,
  PiCurrencyDollar,
  PiEye,
  PiUser,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import extractLaravelErrors from "../../hooks/handleError";
import { approveCompanyPayout, getCompanyPayouts, rejectCompanyPayout } from "../../api/companyPayouts";

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} $`;

const formatDateTime = (value, fallback = "N/A") => {
  if (!value) return fallback;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
};

const titleize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const statusBadgeClass = {
  pending: "badge-warning",
  completed: "badge-success",
  rejected: "badge-error",
};

export default function CustomerPayouts() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [statusFilter, setStatusFilter] = useState("all");
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayoutId, setSelectedPayoutId] = useState(null);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [processingAction, setProcessingAction] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPayouts = useCallback(async () => {
    setLoading(true);

    try {
      const result = await getCompanyPayouts(accessToken, {
        status: statusFilter,
      });

      const nextRows = result.data || [];
      setPayouts(nextRows);
      setSummary(result.summary || null);
      setSelectedPayoutId((currentSelected) => {
        const nextSelected =
          nextRows.find((item) => item.id === currentSelected)?.id || nextRows[0]?.id || null;
        return nextSelected;
      });
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || "Failed to load payout requests";
      toast.error(message, {
        className: "alert alert-error",
      });
      setPayouts([]);
      setSummary(null);
      setSelectedPayoutId(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  useEffect(() => {
    setSelectedPayout(payouts.find((item) => item.id === selectedPayoutId) || null);
  }, [payouts, selectedPayoutId]);

  const fallbackSummary = useMemo(() => {
    const pending = payouts.filter((item) => item.status === "pending").length;
    const completed = payouts.filter((item) => item.status === "completed").length;
    const rejected = payouts.filter((item) => item.status === "rejected").length;
    const totalAmount = payouts.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      total_requests: payouts.length,
      pending_requests: pending,
      completed_requests: completed,
      rejected_requests: rejected,
      total_amount: totalAmount,
    };
  }, [payouts]);

  const dashboardSummary = summary || fallbackSummary;

  const summaryCards = [
    { label: "All Requests", value: dashboardSummary.total_requests || 0, icon: PiBank },
    { label: "Pending", value: dashboardSummary.pending_requests || 0, icon: PiClock },
    { label: "Completed", value: dashboardSummary.completed_requests || 0, icon: PiCheckCircle },
    { label: "Requested Total", value: formatCurrency(dashboardSummary.total_amount || 0), icon: PiCurrencyDollar },
  ];

  const updateRow = (updatedRow) => {
    setPayouts((current) =>
      current.map((item) => (item.id === updatedRow.id ? updatedRow : item))
    );
    setSelectedPayoutId(updatedRow.id);
  };

  const handleApprove = async () => {
    if (!selectedPayout || selectedPayout.status !== "pending") {
      return;
    }

    setProcessingAction("approve");

    try {
      const result = await approveCompanyPayout(accessToken, selectedPayout.id);
      updateRow(result.data);
      toast.success(result.message || "Payout request approved successfully", {
        className: "alert alert-success",
      });
      void fetchPayouts();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        extractLaravelErrors(error?.response?.data?.errors || {})[0] ||
        error?.message ||
        "Failed to approve payout request";
      toast.error(message, {
        className: "alert alert-error",
      });
    } finally {
      setProcessingAction("");
    }
  };

  const openRejectModal = () => {
    if (!selectedPayout || selectedPayout.status !== "pending") {
      return;
    }

    setRejectTarget(selectedPayout);
    setRejectReason("");
  };

  const closeRejectModal = () => {
    if (processingAction === "reject") {
      return;
    }

    setRejectTarget(null);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectTarget) {
      return;
    }

    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason", {
        className: "alert alert-error",
      });
      return;
    }

    setProcessingAction("reject");

    try {
      const result = await rejectCompanyPayout(accessToken, rejectTarget.id, {
        rejection_reason: rejectReason.trim(),
      });
      updateRow(result.data);
      setRejectTarget(null);
      setRejectReason("");
      toast.success(result.message || "Payout request rejected successfully", {
        className: "alert alert-success",
      });
      void fetchPayouts();
    } catch (error) {
      const validationErrors = extractLaravelErrors(error?.response?.data?.errors || {});
      const message =
        validationErrors[0] ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to reject payout request";
      toast.error(message, {
        className: "alert alert-error",
      });
    } finally {
      setProcessingAction("");
    }
  };

  return (
    <div className="min-h-screen figtree-regular space-y-6">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Payout Requests</h2>
            <p className="text-sm text-slate-600">
              Review customer and company referral-wallet payout requests from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className="select select-bordered"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>

            <button className="btn btn-outline" onClick={fetchPayouts} disabled={loading}>
              <PiArrowClockwise size={18} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{card.label}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-primary shadow-sm">
                    <Icon size={20} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="rounded-lg bg-white py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 pb-3">
            <div>
              <h5 className="font-semibold text-slate-900">Payout Requests</h5>
              <p className="text-sm text-slate-500">
                Open a customer request from the table to inspect description and customer balance context.
              </p>
            </div>
            <span className="badge badge-ghost">{payouts.length} records</span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableLoading />
            ) : (
              <table className="table figtree-regular">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th>Requester</th>
                    <th>Amount</th>
                    <th>Wallet</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length > 0 ? (
                    payouts.map((item) => (
                      <tr key={item.id} className={selectedPayoutId === item.id ? "bg-blue-50" : ""}>
                        <td>
                          <div className="font-medium">{item.customer?.name || "Customer"}</div>
                          <div className="mt-1 text-xs font-semibold uppercase text-primary">{titleize(item.request_type || "customer")}</div>
                          <div className="text-xs text-slate-500">
                            {item.customer?.phone || item.customer?.email || "N/A"}
                          </div>
                        </td>
                        <td className="font-semibold">{formatCurrency(item.amount)}</td>
                        <td>{formatCurrency(item.customer?.wallet_balance || 0)}</td>
                        <td>
                          <span className={`badge ${statusBadgeClass[item.status] || "badge-ghost"}`}>
                            {titleize(item.status)}
                          </span>
                        </td>
                        <td>{formatDateTime(item.requested_at)}</td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline btn-primary"
                            onClick={() => setSelectedPayoutId(item.id)}
                          >
                            <PiEye size={16} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-sm text-slate-500">
                        No payout requests found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h5 className="font-semibold text-slate-900">Payout Details</h5>
              <p className="text-sm text-slate-500">
                Review the request note, then complete the payout or reject it with a reason.
              </p>
            </div>
          </div>

          {selectedPayout ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Payout Request</p>
                    <h3 className="text-lg font-bold text-slate-900">{formatCurrency(selectedPayout.amount)}</h3>
                  </div>
                  <span className={`badge ${statusBadgeClass[selectedPayout.status] || "badge-ghost"} badge-lg`}>
                    {titleize(selectedPayout.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-slate-500">
                      <PiUser size={16} />
                      <span className="text-xs font-semibold uppercase tracking-wide">Customer</span>
                    </div>
                    <p className="font-semibold text-slate-900">{selectedPayout.customer?.name || "Customer"}</p>
                    <p className="text-sm text-slate-600">{selectedPayout.customer?.email || "No email"}</p>
                    <p className="text-sm text-slate-600">{selectedPayout.customer?.phone || "No phone"}</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-slate-500">
                      <PiCalendarBlank size={16} />
                      <span className="text-xs font-semibold uppercase tracking-wide">Timeline</span>
                    </div>
                    <p className="text-sm text-slate-700">Requested: {formatDateTime(selectedPayout.requested_at)}</p>
                    <p className="text-sm text-slate-700">Resolved: {formatDateTime(selectedPayout.resolved_at, "Not resolved yet")}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <PiCurrencyDollar size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Wallet Snapshot</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-500">Requested Amount</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(selectedPayout.amount)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-500">Current Wallet Balance</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(selectedPayout.customer?.wallet_balance || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <PiBank size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Customer Description</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {selectedPayout.description || "No description was provided."}
                </div>
              </div>

              {selectedPayout.payout_method ? (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payout destination</p>
                  <p className="mt-2 font-semibold text-slate-900">{selectedPayout.payout_method}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{selectedPayout.payout_details?.account_information || "No account information"}</p>
                </div>
              ) : null}

              {selectedPayout.rejection_reason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                    Rejection Reason Sent To Customer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-rose-700">{selectedPayout.rejection_reason}</p>
                </div>
              ) : null}

              {selectedPayout.status === "pending" ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn btn-success"
                    onClick={handleApprove}
                    disabled={processingAction !== ""}
                  >
                    {processingAction === "approve" ? "Completing..." : "Complete Payout"}
                  </button>
                  <button
                    className="btn btn-error btn-outline"
                    onClick={openRejectModal}
                    disabled={processingAction !== ""}
                  >
                    Reject Request
                  </button>
                </div>
              ) : selectedPayout.status === "completed" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  This payout request has been completed successfully.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  This payout request has already been resolved.
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              Select a payout request from the table to inspect its details.
            </div>
          )}
        </div>
      </div>

      {rejectTarget ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg rounded-lg p-0">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-950">Reject Payout Request</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add a clear reason. The customer will be able to see this message.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{rejectTarget.customer?.name || "Customer"}</p>
                <p>{formatCurrency(rejectTarget.amount)}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Rejection Reason
                </label>
                <textarea
                  className="textarea textarea-bordered min-h-28 w-full rounded-md border-slate-300 bg-white text-slate-950"
                  placeholder="Explain why this payout request is being rejected"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                className="btn btn-ghost"
                onClick={closeRejectModal}
                disabled={processingAction === "reject"}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleReject}
                disabled={processingAction === "reject"}
              >
                {processingAction === "reject" ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>

          <div className="modal-backdrop" onClick={closeRejectModal} />
        </div>
      ) : null}
    </div>
  );
}

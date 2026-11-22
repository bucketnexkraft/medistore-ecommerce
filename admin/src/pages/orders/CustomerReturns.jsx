import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  PiArrowClockwise,
  PiCalendarBlank,
  PiCheckCircle,
  PiClock,
  PiCurrencyDollar,
  PiEye,
  PiPackage,
  PiReceipt,
  PiUser,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import extractLaravelErrors from "../../hooks/handleError";
import { approveCompanyReturn, getCompanyReturns, rejectCompanyReturn } from "../../api/companyReturns";

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
  approved: "badge-success",
  rejected: "badge-error",
};

export default function CustomerReturns() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [statusFilter, setStatusFilter] = useState("all");
  const [returnsState, setReturnsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturnId, setSelectedReturnId] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [processingAction, setProcessingAction] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchReturns = useCallback(async () => {
    setLoading(true);

    try {
      const result = await getCompanyReturns(accessToken, {
        status: statusFilter,
      });

      const nextRows = result.data || [];
      setReturnsState(nextRows);
      setSelectedReturnId((currentSelected) => {
        const nextSelected =
          nextRows.find((item) => item.id === currentSelected)?.id || nextRows[0]?.id || null;
        return nextSelected;
      });
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || "Failed to load return requests";
      toast.error(message, {
        className: "alert alert-error",
      });
      setReturnsState([]);
      setSelectedReturnId(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  useEffect(() => {
    setSelectedReturn(returnsState.find((item) => item.id === selectedReturnId) || null);
  }, [returnsState, selectedReturnId]);

  const summary = useMemo(() => {
    const pending = returnsState.filter((item) => item.status === "pending").length;
    const approved = returnsState.filter((item) => item.status === "approved").length;
    const rejected = returnsState.filter((item) => item.status === "rejected").length;
    const refundTotal = returnsState.reduce(
      (sum, item) => sum + Number(item.refund_amount || 0),
      0
    );

    return {
      total: returnsState.length,
      pending,
      approved,
      rejected,
      refundTotal,
    };
  }, [returnsState]);

  const summaryCards = [
    { label: "All Requests", value: summary.total, icon: PiReceipt },
    { label: "Pending", value: summary.pending, icon: PiClock },
    { label: "Approved", value: summary.approved, icon: PiCheckCircle },
    { label: "Refund Total", value: formatCurrency(summary.refundTotal), icon: PiCurrencyDollar },
  ];

  const updateRow = (updatedRow) => {
    setReturnsState((current) =>
      current.map((item) => (item.id === updatedRow.id ? updatedRow : item))
    );
    setSelectedReturnId(updatedRow.id);
  };

  const handleApprove = async () => {
    if (!selectedReturn || selectedReturn.status !== "pending") {
      return;
    }

    setProcessingAction("approve");

    try {
      const result = await approveCompanyReturn(accessToken, selectedReturn.id);
      updateRow(result.data);
      toast.success(result.message || "Return request approved successfully", {
        className: "alert alert-success",
      });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        extractLaravelErrors(error?.response?.data?.errors || {})[0] ||
        error?.message ||
        "Failed to approve return request";
      toast.error(message, {
        className: "alert alert-error",
      });
    } finally {
      setProcessingAction("");
    }
  };

  const openRejectModal = () => {
    if (!selectedReturn || selectedReturn.status !== "pending") {
      return;
    }

    setRejectTarget(selectedReturn);
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
      const result = await rejectCompanyReturn(accessToken, rejectTarget.id, {
        rejection_reason: rejectReason.trim(),
      });

      updateRow(result.data);
      setRejectTarget(null);
      setRejectReason("");
      toast.success(result.message || "Return request rejected successfully", {
        className: "alert alert-success",
      });
    } catch (error) {
      const validationErrors = extractLaravelErrors(error?.response?.data?.errors || {});
      const message =
        validationErrors[0] ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to reject return request";
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
            <h2 className="text-xl font-semibold text-slate-900">Customer Returns</h2>
            <p className="text-sm text-slate-600">
              Customers can submit return requests with message. Review details, then approve or reject from one place.
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
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <button className="btn btn-outline" onClick={fetchReturns} disabled={loading}>
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
              <h5 className="font-semibold text-slate-900">Return Requests</h5>
              <p className="text-sm text-slate-500">
                View every customer-submitted return request and open details from the table.
              </p>
            </div>
            <span className="badge badge-ghost">{returnsState.length} records</span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableLoading />
            ) : (
              <table className="table figtree-regular">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Refund</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsState.length > 0 ? (
                    returnsState.map((item) => (
                      <tr key={item.id} className={selectedReturnId === item.id ? "bg-blue-50" : ""}>
                        <td>
                          <div className="font-semibold">{item.order?.order_no || "N/A"}</div>
                          <div className="text-xs text-slate-500">
                            {titleize(item.order?.order_status || "unknown")} / {titleize(item.order?.payment_status || "unknown")}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium">{item.customer?.name || "Customer"}</div>
                          <div className="text-xs text-slate-500">
                            {item.customer?.phone || item.customer?.email || "N/A"}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium">{item.item?.name || "Product"}</div>
                          <div className="text-xs text-slate-500">
                            Qty: {item.item?.quantity ?? 0}
                          </div>
                        </td>
                        <td className="font-semibold">{formatCurrency(item.refund_amount)}</td>
                        <td>
                          <span className={`badge ${statusBadgeClass[item.status] || "badge-ghost"}`}>
                            {titleize(item.status)}
                          </span>
                        </td>
                        <td>{formatDateTime(item.requested_at)}</td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline btn-primary"
                            onClick={() => setSelectedReturnId(item.id)}
                          >
                            <PiEye size={16} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-sm text-slate-500">
                        No return requests found for this filter.
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
              <h5 className="font-semibold text-slate-900">Return Details</h5>
              <p className="text-sm text-slate-500">
                Open a request from the table, inspect customer message, then accept or reject.
              </p>
            </div>
          </div>

          {selectedReturn ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Return Request</p>
                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedReturn.order?.order_no || "N/A"}
                    </h3>
                  </div>
                  <span className={`badge ${statusBadgeClass[selectedReturn.status] || "badge-ghost"} badge-lg`}>
                    {titleize(selectedReturn.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-slate-500">
                      <PiUser size={16} />
                      <span className="text-xs font-semibold uppercase tracking-wide">Customer</span>
                    </div>
                    <p className="font-semibold text-slate-900">{selectedReturn.customer?.name || "Customer"}</p>
                    <p className="text-sm text-slate-600">{selectedReturn.customer?.email || "No email"}</p>
                    <p className="text-sm text-slate-600">{selectedReturn.customer?.phone || "No phone"}</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-slate-500">
                      <PiCalendarBlank size={16} />
                      <span className="text-xs font-semibold uppercase tracking-wide">Timeline</span>
                    </div>
                    <p className="text-sm text-slate-700">
                      Requested: {formatDateTime(selectedReturn.requested_at)}
                    </p>
                    <p className="text-sm text-slate-700">
                      Resolved: {formatDateTime(selectedReturn.resolved_at, "Not resolved yet")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <PiPackage size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Returned Item</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{selectedReturn.item?.name || "Product"}</p>
                  <p className="text-sm text-slate-600">
                    {selectedReturn.item?.brand_name || "Brand unavailable"} / {selectedReturn.item?.category_name || "Category unavailable"}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-slate-700">Qty: {selectedReturn.item?.quantity ?? 0}</p>
                    <p className="text-sm text-slate-700">Unit Price: {formatCurrency(selectedReturn.item?.unit_price)}</p>
                    <p className="text-sm text-slate-700">Line Total: {formatCurrency(selectedReturn.item?.line_total)}</p>
                    <p className="text-sm font-semibold text-slate-900">
                      Refund Amount: {formatCurrency(selectedReturn.refund_amount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <PiReceipt size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Customer Message</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {selectedReturn.reason || "No return reason was provided."}
                </div>
              </div>

              {selectedReturn.shipping ? (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping Address
                  </p>
                  <div className="mt-3 text-sm leading-6 text-slate-700">
                    <p className="font-semibold text-slate-900">{selectedReturn.shipping.full_name}</p>
                    <p>{selectedReturn.shipping.phone || selectedReturn.shipping.email || "N/A"}</p>
                    <p>
                      {[
                        selectedReturn.shipping.address,
                        selectedReturn.shipping.city,
                        selectedReturn.shipping.country,
                        selectedReturn.shipping.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ") || "N/A"}
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedReturn.rejection_reason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                    Rejection Reason Sent To Customer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-rose-700">
                    {selectedReturn.rejection_reason}
                  </p>
                </div>
              ) : null}

              {selectedReturn.status === "pending" ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn btn-success"
                    onClick={handleApprove}
                    disabled={processingAction !== ""}
                  >
                    {processingAction === "approve" ? "Approving..." : "Accept Return"}
                  </button>
                  <button
                    className="btn btn-error btn-outline"
                    onClick={openRejectModal}
                    disabled={processingAction !== ""}
                  >
                    Reject Return
                  </button>
                </div>
              ) : selectedReturn.status === "approved" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  Return accepted. Refund amount has been added to the customer's balance.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  This request has already been resolved.
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              Select a return request from the table to inspect its details.
            </div>
          )}
        </div>
      </div>

      {rejectTarget ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg rounded-lg p-0">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-950">Reject Return Request</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add a clear reason. The customer will be able to see this message.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{rejectTarget.order?.order_no || "N/A"}</p>
                <p>{rejectTarget.item?.name || "Product"}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Rejection Reason
                </label>
                <textarea
                  className="textarea textarea-bordered min-h-28 w-full rounded-md border-slate-300 bg-white text-slate-950"
                  placeholder="Explain why this return request is being rejected"
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

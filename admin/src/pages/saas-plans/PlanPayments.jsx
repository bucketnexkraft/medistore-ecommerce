import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiCoins, PiCreditCard, PiReceipt, PiX } from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import { getPlanPayments } from "../../api/companyOnboarding";
import { setPlanAccess } from "../../slice/authSlice";

const statusClass = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-rose-100 text-rose-700",
  failed: "bg-rose-100 text-rose-700",
};

const formatAmount = (value, currency = "") => {
  const amount = Number(value || 0).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
};

export default function PlanPayments() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPlanPayments(accessToken);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load plan payments");
      }
      const nextPayload = result?.data || {};
      setPayload(nextPayload);

      const currentPlan = nextPayload.current_plan;
      const hasActivePlan = Boolean(
        currentPlan?.id && nextPayload?.company?.plan_subscribed_at,
      );
      dispatch(setPlanAccess({
        has_active_plan: hasActivePlan,
        needs_plan_selection: !hasActivePlan,
        selected_plan_id: hasActivePlan ? currentPlan.id : null,
        selected_plan: hasActivePlan ? currentPlan : null,
        selected_plan_features: hasActivePlan
          ? currentPlan.effective_features || currentPlan.features || []
          : [],
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load plan payments");
    } finally {
      setLoading(false);
    }
  }, [accessToken, dispatch]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const payments = payload?.payments || [];
  const currentPlan = payload?.current_plan;
  const latestPayment = payload?.latest_payment;

  const latestCurrency = latestPayment?.currency?.code || "";
  const selectedFields = useMemo(() => {
    const fields = selectedPayment?.payment_payload?.fields;
    return fields && typeof fields === "object" ? Object.entries(fields) : [];
  }, [selectedPayment]);

  const selectedFiles = useMemo(() => {
    const files = selectedPayment?.payment_payload?.files;
    return files && typeof files === "object" ? Object.entries(files) : [];
  }, [selectedPayment]);

  if (loading) {
    return (
      <div className="p-4">
        <TableLoading />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Billing History</h2>
          <p className="mt-1 text-sm text-slate-500">Review your subscription plan and submitted payment details.</p>
        </div>
        <Link to="/subscription/plans" className="btn btn-primary">
          <PiCoins size={18} />
          Choose Plan
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <PiCoins size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Current Plan</p>
              <h3 className="text-lg font-bold text-slate-950">{currentPlan?.name || "No active plan"}</h3>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Billing</p>
              <p className="font-semibold text-slate-900">{currentPlan?.billing_period || "-"}</p>
            </div>
            <div>
              <p className="text-slate-500">Price</p>
              <p className="font-semibold text-slate-900">
                {currentPlan?.is_free === "free" ? "Free" : formatAmount(currentPlan?.price)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <PiCreditCard size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Latest Payment</p>
              <h3 className="text-lg font-bold text-slate-950">
                {latestPayment ? formatAmount(latestPayment.payable_amount, latestCurrency) : "No payment yet"}
              </h3>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">Status</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[latestPayment?.status] || "bg-slate-100 text-slate-600"}`}>
              {latestPayment?.status || "N/A"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-700">
              <PiReceipt size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Total Requests</p>
              <h3 className="text-lg font-bold text-slate-950">{payments.length}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Submitted plan payments are reviewed by backoffice.</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-base font-bold text-slate-950">Payment History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>TRX</th>
                <th>Plan</th>
                <th>Gateway</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? (
                payments.map((payment) => {
                  const currency = payment?.currency?.code || "";
                  return (
                    <tr key={payment.id}>
                      <td className="font-mono text-xs">{payment.trx}</td>
                      <td>{payment?.plan?.name || "-"}</td>
                      <td>{payment?.gateway?.name || payment.gateway_name || "-"}</td>
                      <td>{formatAmount(payment.payable_amount, currency)}</td>
                      <td>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[payment.status] || "bg-slate-100 text-slate-600"}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : "-"}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => setSelectedPayment(payment)}>
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    No plan payment requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Payment Details</h3>
                <p className="text-sm text-slate-500">{selectedPayment.trx}</p>
              </div>
              <button className="btn btn-ghost btn-square" onClick={() => setSelectedPayment(null)} aria-label="Close details">
                <PiX size={20} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Plan</p>
                <p className="font-semibold text-slate-900">{selectedPayment?.plan?.name || "-"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Gateway</p>
                <p className="font-semibold text-slate-900">{selectedPayment?.gateway?.name || selectedPayment.gateway_name || "-"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Base Amount</p>
                <p className="font-semibold text-slate-900">{formatAmount(selectedPayment.amount, selectedPayment?.currency?.code)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Gateway Charge</p>
                <p className="font-semibold text-slate-900">{formatAmount(selectedPayment.gateway_charge, selectedPayment?.currency?.code)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Payable</p>
                <p className="font-semibold text-slate-900">{formatAmount(selectedPayment.payable_amount, selectedPayment?.currency?.code)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Status</p>
                <p className="font-semibold capitalize text-slate-900">{selectedPayment.status}</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-950">Submitted Fields</h4>
              {selectedFields.length ? (
                <div className="mt-3 space-y-2 text-sm">
                  {selectedFields.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                      <span className="text-slate-500">{key}</span>
                      <span className="text-right font-medium text-slate-900">{String(value || "-")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No manual fields submitted.</p>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-950">Uploaded Files</h4>
              {selectedFiles.length ? (
                <div className="mt-3 space-y-2 text-sm">
                  {selectedFiles.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                      <span className="text-slate-500">{key}</span>
                      <span className="text-right font-medium text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No files uploaded.</p>
              )}
            </div>

            {selectedPayment.remarks && (
              <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                {selectedPayment.remarks}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

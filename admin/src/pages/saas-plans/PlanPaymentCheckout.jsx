import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { PiArrowLeft, PiCheckCircle, PiClock } from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import { getPlanPaymentCheckout } from "../../api/companyOnboarding";
import { setPlanAccess } from "../../slice/authSlice";

export default function PlanPaymentCheckout() {
  const { paymentLogId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);

  const loadCheckoutInfo = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPlanPaymentCheckout(accessToken, paymentLogId);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load checkout");
      }
      const nextPayload = result?.data || null;
      setPayload(nextPayload);
      if (String(nextPayload?.status || "").toLowerCase() === "approved") {
        dispatch(setPlanAccess({
          has_active_plan: true,
          needs_plan_selection: false,
          selected_plan_id: nextPayload?.plan?.id || null,
          selected_plan: nextPayload?.plan || null,
          selected_plan_features: nextPayload?.plan?.effective_features || nextPayload?.plan?.features || [],
        }));
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load checkout");
      navigate("/subscription/plans", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [accessToken, dispatch, navigate, paymentLogId]);

  useEffect(() => {
    loadCheckoutInfo();
  }, [loadCheckoutInfo]);

  if (loading) {
    return (
      <div className="p-4">
        <TableLoading />
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  const gateway = payload.gateway;
  const gatewayName = gateway?.name || payload.gateway_name || "Gateway";
  const currency = payload?.currency?.code || gateway?.currency?.code || "";
  const paymentStatus = String(payload?.status || "").toLowerCase();
  const isApproved = paymentStatus === "approved";
  const isPending = paymentStatus === "pending";
  const setupPath = "/subscription/overview?plan_payment=success";

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-7">
          <Link to="/subscription/plans" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
            <PiArrowLeft size={16} />
            Back to plans
          </Link>
          <h2 className="mt-3 text-3xl font-bold text-slate-950">Complete Payment</h2>
          <p className="mt-2 text-sm text-slate-500">
            You selected <span className="font-medium">{gatewayName}</span>. Follow the gateway instructions to finish this payment.
          </p>
        </div>

        {isApproved && (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
            <div className="flex items-start gap-3">
              <PiCheckCircle size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Payment completed successfully</p>
                <p className="mt-1 text-sm text-emerald-800">Your subscription is active. Return to the admin area to continue.</p>
              </div>
            </div>
          </div>
        )}

        {isPending && (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <PiClock size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Payment is still pending</p>
                <p className="mt-1 text-sm text-amber-800">If you already paid through the gateway, wait a moment for the callback or check the payment status from your payment history.</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-7">
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-950">Plan:</span> {payload?.plan?.name || "-"}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Billing:</span> {payload?.plan?.billing_period || "-"}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Payable Amount:</span> {Number(payload?.payable_amount || 0).toFixed(2)} {currency}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Gateway:</span> {gatewayName}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Status:</span> {payload?.status || "-"}
            </p>
          </div>

          <div className="alert alert-info mt-5">
            <span>
              Gateway redirection is configured like the kit flow. For fully live gateway transaction callbacks (PayPal/Stripe/Paystack/etc.), add your live gateway credentials and callback handlers.
            </span>
          </div>

          <div className="flex flex-col gap-3 pt-5 sm:flex-row">
            {isApproved ? (
              <Link
                to={setupPath}
                className="btn btn-primary"
              >
                Continue To Admin
              </Link>
            ) : (
              <Link to="/plan-payments" className="btn btn-primary">
                View Payment Status
              </Link>
            )}
            <Link to="/subscription/plans" className="btn btn-ghost">
              Back to Plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

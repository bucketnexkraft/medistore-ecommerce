import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../../config/constants";

const resolveApiBase = () => API_URL.replace(/\/api\/v\d+\/?$/, "");

export default function CustomerOrderPaymentCallback({ mode = "success" }) {
  const navigate = useNavigate();
  const { trx } = useParams();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Verifying your payment...");

  const callbackUrl = useMemo(() => {
    const query = new URLSearchParams(searchParams);
    query.set("frontend_url", window.location.origin);
    return `${API_URL}/landing/order-payments/${encodeURIComponent(trx || "")}/${mode}?${query.toString()}`;
  }, [mode, searchParams, trx]);

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      try {
        const response = await axios.get(callbackUrl, {
          headers: {
            Accept: "application/json",
          },
        });

        const payload = response.data || {};
        const redirectPath = payload?.data?.redirect_path || (mode === "cancel" ? "/payment-cancel" : "/order-success");
        const orderId = payload?.data?.order_id ? `?orderId=${encodeURIComponent(payload.data.order_id)}&method=gateway` : "";

        if (!mounted) return;
        navigate(`${redirectPath}${orderId}`, { replace: true });
      } catch (error) {
        const fallbackPath = mode === "cancel" ? "/payment-cancel" : "/payment-failed";
        if (!mounted) return;
        setMessage(error?.response?.data?.message || error?.message || "Payment verification failed.");
        setTimeout(() => {
          navigate(fallbackPath, {
            replace: true,
            state: {
              error: error?.response?.data?.message || error?.message || "Payment verification failed.",
            },
          });
        }, 1200);
      }
    };

    if (trx) {
      verify();
    } else {
      navigate("/payment-failed", { replace: true });
    }

    return () => {
      mounted = false;
    };
  }, [callbackUrl, mode, navigate, trx]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <span className="text-2xl">...</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-950">Processing Payment</h1>
        <p className="mt-3 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

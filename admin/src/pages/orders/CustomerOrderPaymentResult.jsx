import { Link, useLocation, useSearchParams } from "react-router-dom";

const RESULT_CONFIG = {
  success: {
    badge: "Success",
    title: "Order Payment Successful",
    description: "Your ecommerce order payment was completed successfully.",
    accent: "emerald",
  },
  cancel: {
    badge: "Cancelled",
    title: "Payment Cancelled",
    description: "You cancelled the ecommerce order payment before completion.",
    accent: "amber",
  },
  failed: {
    badge: "Failed",
    title: "Payment Failed",
    description: "We could not confirm your ecommerce order payment.",
    accent: "rose",
  },
};

export default function CustomerOrderPaymentResult({ mode = "success" }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const config = RESULT_CONFIG[mode] || RESULT_CONFIG.failed;
  const orderId = searchParams.get("orderId") || "";
  const errorMessage = location.state?.error || "";

  const accentClasses =
    mode === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : mode === "cancel"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${accentClasses}`}>
          {config.badge}
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">{config.title}</h1>
        <p className="mt-3 text-sm text-slate-500">{config.description}</p>

        {orderId ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <span className="font-semibold">Order ID:</span> {orderId}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className="btn border-0 bg-slate-900 text-white hover:bg-slate-800">
            Go to Storefront
          </Link>
          <Link to="/customer/dashboard" className="btn border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            Customer Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  PiMagnifyingGlass,
  PiMapPin,
  PiPackage,
  PiPhone,
  PiTruck,
  PiUser,
} from "react-icons/pi";
import { trackCompanyOrderByNumber } from "../../api/customerOrders";

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} $`;

const titleize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getStepClassName = (step) => {
  if (step.current) {
    return "border-slate-900 bg-slate-900 text-white";
  }

  if (step.completed) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-white text-slate-400";
};

export default function OrderTracking() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [orderNo, setOrderNo] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTrackOrder = async () => {
    if (!orderNo.trim()) {
      toast.error("Enter an order number first");
      return;
    }

    setLoading(true);

    try {
      const result = await trackCompanyOrderByNumber(accessToken, orderNo.trim());
      setTrackingData(result.data || null);
    } catch (error) {
      setTrackingData(null);
      toast.error(
        error?.response?.data?.message || error?.message || "Failed to track order"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Order Tracking</h2>
        <p className="mt-2 text-sm text-slate-500">
          Search by order number and view the latest delivery progress for the customer.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
            <PiMagnifyingGlass size={18} className="text-slate-400" />
            <input
              type="text"
              value={orderNo}
              onChange={(event) => setOrderNo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleTrackOrder();
                }
              }}
              placeholder="Enter order number"
              className="w-full text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <button
            type="button"
            onClick={handleTrackOrder}
            disabled={loading}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Tracking..." : "Track Order"}
          </button>
        </div>
      </div>

      {trackingData ? (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Order Number
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">
                    {trackingData.order_no}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">{trackingData.tracking_note}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Status</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {titleize(trackingData.order_status)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Estimated delivery: {trackingData.estimated_delivery || "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                {(trackingData.tracking_steps || []).map((step) => (
                  <div
                    key={step.id}
                    className={`rounded-2xl border p-4 ${getStepClassName(step)}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em]">
                      Step {step.id}
                    </p>
                    <p className="mt-2 text-sm font-semibold">{step.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Order Items
              </p>
              <div className="mt-4 space-y-3">
                {(trackingData.items || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.brand_name || "Storefront"} / {item.category_name || "General"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(item.line_total)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Unit: {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <PiUser size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Customer
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {trackingData.customer?.name || trackingData.shipping?.full_name || "Customer"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <PiPhone size={16} />
                  {trackingData.customer?.phone || trackingData.shipping?.phone || "N/A"}
                </p>
                <p className="flex items-start gap-2">
                  <PiMapPin size={16} className="mt-0.5" />
                  <span>
                    {[
                      trackingData.shipping?.address,
                      trackingData.shipping?.city,
                      trackingData.shipping?.country,
                      trackingData.shipping?.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ") || "N/A"}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <PiTruck size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Delivery Summary
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {titleize(trackingData.order_status)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Payment status</span>
                  <span className="font-medium text-slate-900">
                    {titleize(trackingData.payment_status)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Payment method</span>
                  <span className="font-medium text-slate-900">
                    {trackingData.payment_method_label || trackingData.payment_method}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Shipping charge</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(trackingData.shipping_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total amount</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(trackingData.total_amount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <PiPackage size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Seller
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {trackingData.seller?.name || "Seller support"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>{trackingData.seller?.contact_name || "Support Team"}</p>
                <p>{trackingData.seller?.phone || "N/A"}</p>
                <p>{trackingData.seller?.email || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Search an order number to view delivery progress and tracking details.
        </div>
      )}
    </div>
  );
}

import PropTypes from "prop-types";
import { Dialog } from "@headlessui/react";

const formatDateTime = (value) => {
  if (!value) return "N/A";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} $`;
};

const buildAddressLine = (shipping) => {
  if (!shipping) return "N/A";

  return [
    shipping.address,
    shipping.upazila_name || shipping.city,
    shipping.district_name,
    shipping.division_name,
    shipping.country,
    shipping.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
};

export default function PrintableDeliveryPacket({ open, onClose, order }) {
  if (!open || !order) return null;

  const packet = order.delivery_packet || {};
  const customer = packet.customer || order.customer || {};
  const shipping = packet.shipping || order.shipping || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const qrCodeHtml = order.qr_code_html || "";

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <style>{`
        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body > *:not(#headlessui-portal-root) {
            display: none !important;
          }

          #headlessui-portal-root {
            display: block !important;
          }

          #headlessui-portal-root * {
            visibility: hidden !important;
          }

          #headlessui-portal-root .delivery-packet-print-wrapper,
          #headlessui-portal-root .delivery-packet-print-wrapper * {
            visibility: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .delivery-packet-print-wrapper {
            position: static !important;
            inset: auto !important;
            background: #fff !important;
            padding: 0 !important;
          }

          .delivery-packet-print-panel {
            margin: 0 !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .delivery-packet-grid {
            break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/30 no-print" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-8 delivery-packet-print-wrapper">
        <Dialog.Panel className="w-full max-w-5xl bg-white rounded-xl overflow-y-auto max-h-[90vh] delivery-packet-print-panel">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 no-print">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Delivery Packet</h2>
                <p className="text-sm text-slate-500">Auto-generated from the selected order for packing and delivery.</p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={onClose}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={handlePrint}>
                  Print Packet
                </button>
              </div>
            </div>

            <div className="delivery-packet-grid mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Order</p>
                        <h3 className="text-2xl font-black text-slate-950">{packet.order_no || order.order_no || "N/A"}</h3>
                        <p className="mt-1 text-sm text-slate-500">Placed: {formatDateTime(packet.placed_at || order.placed_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
                        <p className="text-2xl font-black text-slate-950">{packet.items_count ?? items.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                      <p className="mt-2 text-lg font-bold text-slate-950">{customer.name || "Customer"}</p>
                      <p className="text-sm text-slate-600">{customer.phone || "No phone"}</p>
                      <p className="text-sm text-slate-600">{customer.email || "No email"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Shipping Address</p>
                      <p className="mt-2 text-lg font-bold text-slate-950">{shipping.full_name || customer.name || "N/A"}</p>
                      <p className="text-sm text-slate-600">{shipping.phone || customer.phone || "No phone"}</p>
                      <p className="text-sm text-slate-600">{shipping.email || customer.email || "No email"}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{buildAddressLine(shipping)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Items to Pack</p>
                    <div className="mt-3 space-y-3">
                      {items.length > 0 ? (
                        items.map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.brand_name || "Storefront"} / {item.category_name || "General"}</p>
                                <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-slate-950">{formatCurrency(item.line_total)}</p>
                                <p className="text-xs text-slate-500">Unit: {formatCurrency(item.unit_price)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                          No item details available.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Scan QR</p>
                    <div className="mt-4 grid place-items-center rounded-xl border border-slate-200 bg-white p-4">
                      <div
                        className="delivery-packet-qr max-w-full overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: qrCodeHtml }}
                      />
                    </div>
                    <p className="mt-3 text-center text-sm text-slate-600">
                      Scan to verify {packet.order_no || order.order_no || "the order"}.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Summary</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Order Total</span>
                        <span className="font-semibold">{formatCurrency(packet.total_amount ?? order.total_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Shipping</span>
                        <span className="font-semibold">{formatCurrency(order.shipping_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Payment</span>
                        <span className="font-semibold">{order.payment_method_label || order.payment_method || "COD"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <span className="font-semibold">{order.order_status || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Keep this sheet on top of the parcel so the delivery team can read the address and customer details immediately.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

PrintableDeliveryPacket.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  order: PropTypes.shape({
    order_no: PropTypes.string,
    placed_at: PropTypes.string,
    shipping_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    total_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    payment_method_label: PropTypes.string,
    payment_method: PropTypes.string,
    order_status: PropTypes.string,
    customer: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string,
      phone: PropTypes.string,
      address: PropTypes.string,
    }),
    shipping: PropTypes.shape({
      full_name: PropTypes.string,
      email: PropTypes.string,
      phone: PropTypes.string,
      address: PropTypes.string,
      upazila_name: PropTypes.string,
      city: PropTypes.string,
      district_name: PropTypes.string,
      division_name: PropTypes.string,
      country: PropTypes.string,
      postal_code: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
    delivery_packet: PropTypes.shape({
      order_no: PropTypes.string,
      placed_at: PropTypes.string,
      items_count: PropTypes.number,
      total_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      customer: PropTypes.object,
      shipping: PropTypes.object,
    }),
    items: PropTypes.arrayOf(PropTypes.object),
    qr_code_html: PropTypes.string,
  }),
};

PrintableDeliveryPacket.defaultProps = {
  order: null,
};

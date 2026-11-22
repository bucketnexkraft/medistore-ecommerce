import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiMagnifyingGlass, PiPackage, PiPrinter, PiReceipt, PiUsersThree, PiX } from "react-icons/pi";
import Pagination from "../../components/common/Pagination";
import TableLoading from "../../components/loadings/TableLoading";
import { getCompanyOrder, getCompanyOrders, updateCompanyOrderStatus } from "../../api/customerOrders";
import PrintableDeliveryPacket from "../../components/printable-orders/PrintableDeliveryPacket";
import { hasPermission } from "../../utils/permissions";

const ORDER_STATUS_OPTIONS = ["pending", "processing", "shipped", "delivered", "cancelled", "returned"];
const PAYMENT_STATUS_OPTIONS = ["pending", "paid", "failed", "refunded"];

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} $`;
};

const formatDateTime = (value) => {
  if (!value) return "N/A";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
};

const titleize = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const getPaymentChannelLabel = (order) => {
  if (order?.payment_channel === "cod") return "COD";
  if (order?.payment_channel === "gateway") return "Gateway";

  const paymentMethod = String(order?.payment_method || "").trim().toLowerCase();
  return paymentMethod === "cod" || paymentMethod === "" ? "COD" : "Gateway";
};

export default function CustomerOrders() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [filters, setFilters] = useState({
    status: "",
    payment_status: "",
    type: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [ordersState, setOrdersState] = useState({ data: [], meta: {}, others_data: {} });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState("placed_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [packetOpen, setPacketOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({
    order_status: "processing",
    payment_status: "pending",
  });

  const canManageOrders = hasPermission("invoice.view");

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    try {
      const result = await getCompanyOrders(accessToken, {
        page: currentPage,
        perPage: 10,
        search: searchQuery,
        status: filters.status,
        payment_status: filters.payment_status,
        type: filters.type,
        sortField,
        sortOrder,
      });

      setOrdersState({
        data: result.data || [],
        meta: result.meta || {},
        others_data: result.others_data || {},
      });

      setSelectedOrderId((currentSelected) => {
        const exists = (result.data || []).some((order) => order.id === currentSelected);
        if (exists) {
          return currentSelected;
        }

        return result.data?.[0]?.id || null;
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to load company orders", {
        className: "alert alert-error",
      });
      setOrdersState({ data: [], meta: {}, others_data: {} });
      setSelectedOrderId(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentPage, filters.payment_status, filters.status, filters.type, searchQuery, sortField, sortOrder]);

  const fetchOrderDetails = useCallback(async (orderId) => {
    if (!orderId) {
      setSelectedOrder(null);
      return;
    }

    setDetailsLoading(true);

    try {
      const result = await getCompanyOrder(accessToken, orderId);
      setSelectedOrder(result.data || null);
      setStatusForm({
        order_status: result.data?.order_status || "processing",
        payment_status: PAYMENT_STATUS_OPTIONS.includes(result.data?.payment_status)
          ? result.data.payment_status
          : "pending",
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to load order details", {
        className: "alert alert-error",
      });
      setSelectedOrder(null);
    } finally {
      setDetailsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrderDetails(selectedOrderId);
  }, [fetchOrderDetails, selectedOrderId]);

  useEffect(() => {
    if (!detailsOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailsOpen]);

  const summary = ordersState.others_data?.summary || {};

  const summaryCards = useMemo(
    () => [
      { label: "Total Orders", value: summary.total_orders || 0, icon: PiReceipt },
      { label: "Group Orders", value: summary.group_orders || 0, icon: PiUsersThree },
      { label: "Pending", value: summary.pending_orders || 0, icon: PiPackage },
      { label: "Delivered", value: summary.delivered_orders || 0, icon: PiPackage },
    ],
    [summary.delivered_orders, summary.group_orders, summary.pending_orders, summary.total_orders]
  );

  const handleSort = (field) => {
    setSortField(field);
    setSortOrder((prev) => (sortField === field && prev === "asc" ? "desc" : "asc"));
  };

  const handleStatusSubmit = async () => {
    if (!selectedOrder?.id || !canManageOrders) {
      return;
    }

    setSavingStatus(true);

    try {
      const result = await updateCompanyOrderStatus(accessToken, selectedOrder.id, statusForm);
      setSelectedOrder(result.data || null);
      setOrdersState((current) => ({
        ...current,
        data: (current.data || []).map((order) =>
          order.id === result.data?.id
            ? {
                ...order,
                order_status: result.data?.order_status,
                payment_status: result.data?.payment_status,
              }
            : order
        ),
      }));

      toast.success("Order updated successfully", {
        className: "alert alert-success",
      });
    } catch (error) {
      toast.error(
        error?.response?.data?.errors?.[0] ||
          error?.response?.data?.message ||
          error.message ||
          "Failed to update order",
        {
          className: "alert alert-error",
        }
      );
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="min-h-screen figtree-regular space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-4">
        <h2 className="text-xl font-semibold">Customer Orders</h2>
        <p className="text-sm text-gray-600">
          Review normal and group-purchase orders, inspect customers, and update fulfillment status from one place.
        </p>

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

        <div className="mt-4 grid gap-3 lg:grid-cols-[2fr_repeat(3,1fr)]">
          <label className="input input-bordered flex items-center gap-2">
            <PiMagnifyingGlass size={18} />
            <input
              type="text"
              className="grow"
              placeholder="Search order no, customer, product..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
          </label>

          <select
            className="select select-bordered"
            value={filters.status}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, status: event.target.value }));
              setCurrentPage(1);
            }}
          >
            <option value="">All Order Status</option>
            {ORDER_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {titleize(status)}
              </option>
            ))}
          </select>

          <select
            className="select select-bordered"
            value={filters.payment_status}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, payment_status: event.target.value }));
              setCurrentPage(1);
            }}
          >
            <option value="">All Payment Status</option>
            {PAYMENT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {titleize(status)}
              </option>
            ))}
          </select>

          <select
            className="select select-bordered"
            value={filters.type}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, type: event.target.value }));
              setCurrentPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="regular">Regular Orders</option>
            <option value="group">Group Purchase Orders</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-lg shadow-sm py-4">
          <div className="px-4 pb-3">
            <h5 className="font-semibold text-custom-gray-400">Order List</h5>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableLoading />
            ) : (
              <>
                <table className="table figtree-regular">
                  <thead>
                    <tr className="bg-gray-100 font-semibold">
                      <th className="cursor-pointer" onClick={() => handleSort("order_no")}>Order</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th className="cursor-pointer" onClick={() => handleSort("order_status")}>Order Status</th>
                      <th className="cursor-pointer" onClick={() => handleSort("payment_status")}>Payment</th>
                      <th>Coupon</th>
                      <th className="cursor-pointer" onClick={() => handleSort("total_amount")}>Total</th>
                      <th className="cursor-pointer" onClick={() => handleSort("placed_at")}>Placed</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersState.data?.length > 0 ? (
                      ordersState.data.map((order) => (
                        <tr key={order.id} className={selectedOrderId === order.id ? "bg-blue-50" : ""}>
                          <td>
                            <div className="font-semibold">{order.order_no}</div>
                            <div className="text-xs text-slate-500">
                              {order.items_count} item{order.items_count === 1 ? "" : "s"}
                            </div>
                          </td>
                          <td>
                            <div className="font-medium">{order.customer?.name || "Customer"}</div>
                            <div className="text-xs text-slate-500">{order.customer?.phone || order.customer?.email || "N/A"}</div>
                          </td>
                          <td>
                            <span className={`badge ${order.group_purchase ? "badge-secondary" : "badge-ghost"}`}>
                              {order.group_purchase ? "Group" : "Regular"}
                            </span>
                          </td>
                          <td>{titleize(order.order_status)}</td>
                          <td>
                            <div className="space-y-1">
                              <div className="font-medium text-slate-900">{getPaymentChannelLabel(order)}</div>
                              <div className="text-xs text-slate-500">{order.payment_method_label || order.payment_method || "Cash on Delivery"}</div>
                              <div className="text-xs text-slate-500">{titleize(order.payment_status)}</div>
                            </div>
                          </td>
                          <td>
                            {order.coupon_code ? (
                              <div className="space-y-1">
                                <div className="font-medium text-violet-700">{order.coupon_code}</div>
                                <div className="text-xs text-emerald-600">-{formatCurrency(order.coupon_discount_amount)}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">No coupon</span>
                            )}
                          </td>
                          <td className="font-semibold">{formatCurrency(order.total_amount)}</td>
                          <td>{formatDateTime(order.placed_at)}</td>
                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-outline btn-primary"
                              onClick={() => {
                                setSelectedOrderId(order.id);
                                setDetailsOpen(true);
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="text-center py-6">
                          No orders found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <Pagination
                  currentPage={ordersState.meta?.current_page || 1}
                  lastPage={ordersState.meta?.last_page || 1}
                  handlePrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  handlePageChange={(page) => setCurrentPage(page)}
                  handleNextPage={() => setCurrentPage((prev) => prev + 1)}
                />
              </>
            )}
          </div>
        </div>

        {detailsOpen ? (
          <button
            type="button"
            aria-label="Close order details"
            className="fixed inset-0 z-40 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => setDetailsOpen(false)}
          />
        ) : null}

        <div
          className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            detailsOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Order workspace</p>
              <h5 className="mt-1 text-lg font-semibold text-slate-900">Order Details</h5>
              <p className="text-sm text-slate-500">Customer, delivery, items, payment, and status.</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedOrder ? (
                <button className="btn btn-outline btn-primary btn-sm" onClick={() => setPacketOpen(true)}>
                  <PiPrinter size={16} />
                  Print
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Close order details"
                onClick={() => setDetailsOpen(false)}
              >
                <PiX size={20} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {detailsLoading ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading order details...</div>
            ) : selectedOrder ? (
              <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Order</p>
                    <h3 className="text-lg font-bold text-slate-900">{selectedOrder.order_no}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Placed</p>
                    <p className="text-sm font-medium text-slate-700">{formatDateTime(selectedOrder.placed_at)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                    <p className="font-semibold text-slate-900">{selectedOrder.customer?.name || "Customer"}</p>
                    <p className="text-sm text-slate-600">{selectedOrder.customer?.email || "No email"}</p>
                    <p className="text-sm text-slate-600">{selectedOrder.customer?.phone || "No phone"}</p>
                    {selectedOrder.customer?.address ? (
                      <p className="text-sm text-slate-600">{selectedOrder.customer.address}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Shipping</p>
                    <p className="font-semibold text-slate-900">{selectedOrder.shipping?.full_name || "N/A"}</p>
                    <p className="text-sm text-slate-600">{selectedOrder.shipping?.phone || selectedOrder.shipping?.email || "N/A"}</p>
                    <p className="text-sm text-slate-600">
                      {[
                        selectedOrder.shipping?.address,
                        selectedOrder.shipping?.city,
                        selectedOrder.shipping?.country,
                        selectedOrder.shipping?.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ") || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Payment Type</p>
                    <p className="font-semibold text-slate-900">{getPaymentChannelLabel(selectedOrder)}</p>
                    <p className="text-sm text-slate-600">{selectedOrder.payment_method_label || selectedOrder.payment_method || "Cash on Delivery"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Coupon</p>
                    <p className="font-semibold text-slate-900">{selectedOrder.coupon_code || "No coupon applied"}</p>
                    <p className="text-sm text-slate-600">
                      Discount: {formatCurrency(selectedOrder.coupon_discount_amount || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {selectedOrder.group_purchase ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-violet-600">Group Purchase</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {selectedOrder.group_purchase.product?.name || "Group Product"}
                      </p>
                      <p className="text-sm text-slate-600">
                        Status: {titleize(selectedOrder.group_purchase.purchase_status)}
                      </p>
                      <p className="text-sm text-slate-600">
                        Discount: {formatCurrency(selectedOrder.group_purchase.discount_amount)} ({selectedOrder.group_purchase.discount_type})
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Base Price: {formatCurrency(selectedOrder.group_purchase.base_price)}</p>
                      <p className="text-sm text-slate-600">Discounted Price: {formatCurrency(selectedOrder.group_purchase.discounted_price)}</p>
                      <p className="text-sm text-slate-600">
                        Discount on this order: {formatCurrency(selectedOrder.group_discount_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
                <div className="mt-3 space-y-3">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.brand_name || "Storefront"} / {item.category_name || "General"}</p>
                          <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{formatCurrency(item.line_total)}</p>
                          <p className="text-xs text-slate-500">Unit: {formatCurrency(item.unit_price)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Totals</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(selectedOrder.tax_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(selectedOrder.shipping_amount)}</span>
                  </div>
                  {(Number(selectedOrder.coupon_discount_amount || 0) > 0 || Number(selectedOrder.group_discount_amount || 0) > 0) ? (
                    <>
                      <div className="flex items-center justify-between text-emerald-600">
                        <span>Coupon Discount</span>
                        <span>-{formatCurrency(selectedOrder.coupon_discount_amount || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between text-violet-600">
                        <span>Group Discount</span>
                        <span>-{formatCurrency(selectedOrder.group_discount_amount || 0)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Update Status</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <select
                    className="select select-bordered"
                    value={statusForm.order_status}
                    onChange={(event) => setStatusForm((prev) => ({ ...prev, order_status: event.target.value }))}
                  >
                    {ORDER_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {titleize(status)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select select-bordered"
                    value={statusForm.payment_status}
                    onChange={(event) => setStatusForm((prev) => ({ ...prev, payment_status: event.target.value }))}
                  >
                    {PAYMENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {titleize(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn btn-primary mt-4"
                  disabled={savingStatus || !canManageOrders}
                  onClick={handleStatusSubmit}
                >
                  {savingStatus ? "Saving..." : "Save Status"}
                </button>
              </div>
            </div>
              ) : (
                <div className="py-16 text-center text-sm text-slate-500">Select an order to view its details.</div>
              )}
          </div>
        </div>
      </div>

      <PrintableDeliveryPacket
        open={packetOpen}
        onClose={() => setPacketOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}

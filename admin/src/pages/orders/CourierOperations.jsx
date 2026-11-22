import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  PiArrowClockwise,
  PiCalendarBlank,
  PiCheckCircle,
  PiClock,
  PiEye,
  PiMagnifyingGlass,
  PiMapPin,
  PiPackage,
  PiPlus,
  PiReceipt,
  PiPhone,
  PiTruck,
  PiUser,
  PiUsersThree,
  PiX,
} from "react-icons/pi";
import {
  createCompanyOrder,
  dispatchCompanyOrderToPathao,
  getCompanyOrder,
  getCompanyOrders,
  trackCompanyOrderByNumber,
  updateCompanyOrderStatus,
} from "../../api/customerOrders";
import { getUsers } from "../../api/users";
import { hasPermission } from "../../utils/permissions";

const ORDER_STATUS_OPTIONS = ["pending", "processing", "shipped", "delivered", "cancelled", "returned"];
const PAYMENT_STATUS_OPTIONS = ["pending", "paid", "failed", "refunded"];

const COURIER_PARTNERS = [
  { value: "pathao", label: "Pathao", code: "PA", note: "Best for merchant API and live token flow." },
  { value: "steadfast", label: "Steadfast", code: "ST", note: "Simple parcel line for daily pickup." },
  { value: "redx", label: "RedX", code: "RX", note: "Good for city-to-city operational lanes." },
  { value: "paperfly", label: "Paperfly", code: "PF", note: "Useful for mixed-zone fulfillment." },
  { value: "carrybee", label: "CarryBee", code: "CB", note: "Quick fallback for dispatch overflow." },
];

const QUICK_STATUS_ACTIONS = [
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

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

const statusTone = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  processing: "border-cyan-200 bg-cyan-50 text-cyan-700",
  shipped: "border-sky-200 bg-sky-50 text-sky-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  returned: "border-violet-200 bg-violet-50 text-violet-700",
};

const statusDotTone = {
  online: "bg-emerald-500",
  busy: "bg-amber-500",
  offline: "bg-slate-400",
};

const getStaffStatus = (user) => {
  if (Number(user?.status) === 1) {
    return "online";
  }

  return "offline";
};

const getInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const getTrackingSteps = (status) => {
  const statusOrder = {
    pending: 1,
    processing: 2,
    shipped: 3,
    delivered: 4,
    returned: 5,
    cancelled: 0,
  };

  const currentStep = statusOrder[status] ?? 2;

  return [
    { id: 1, label: "Order Placed" },
    { id: 2, label: "Processing" },
    { id: 3, label: "Shipped" },
    { id: 4, label: "Delivered" },
  ].map((step) => ({
    ...step,
    completed: status !== "cancelled" && step.id <= currentStep,
    current: status !== "cancelled" && step.id === currentStep,
  }));
};

const getPaymentChannelLabel = (order) => {
  if (order?.payment_channel === "cod") return "COD";
  if (order?.payment_channel === "gateway") return "Gateway";

  const paymentMethod = String(order?.payment_method || "").trim().toLowerCase();
  return paymentMethod === "cod" || paymentMethod === "" ? "COD" : "Gateway";
};

const createDraftOrder = (form, courier) => ({
  order_no: form.order_no.trim() || null,
  customer_name: form.customer_name.trim(),
  customer_phone: form.customer_phone.trim(),
  customer_email: form.customer_email.trim() || null,
  customer_address: form.customer_address.trim(),
  customer_city: form.customer_city.trim(),
  customer_country: form.customer_country.trim(),
  postal_code: form.postal_code.trim() || null,
  courier_partner: courier.value,
  payment_method: form.payment_method,
  payment_status: form.payment_status,
  order_status: "pending",
  amount: Number(form.amount || 0),
  shipping_fee: Number(form.shipping_fee || 0),
  discount: Number(form.discount || 0),
  service_level: form.service_level,
  priority: form.priority,
  items_count: Number(form.items_count || 1),
  item_weight: Number(form.item_weight || 0.5),
  item_type: Number(form.item_type || 2),
  delivery_type: Number(form.delivery_type || 48),
  coupon_code: form.coupon_code.trim() || null,
  note: form.note.trim() || null,
});

export default function CourierOperations() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const canManageOrders = hasPermission("invoice.view");
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
  });
  const [queueState, setQueueState] = useState({ data: [], meta: {}, others_data: {} });
  const [loading, setLoading] = useState(true);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const hasLoadedOrdersRef = useRef(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [dispatchingPathao, setDispatchingPathao] = useState(false);
  const [refreshingTracking, setRefreshingTracking] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [staffState, setStaffState] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [draftOrders, setDraftOrders] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [trackingLookup, setTrackingLookup] = useState("");
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draftForm, setDraftForm] = useState({
    order_no: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    customer_city: "",
    customer_country: "Bangladesh",
    postal_code: "",
    courier_partner: "pathao",
    payment_method: "cod",
    payment_status: "pending",
    service_level: "standard",
    priority: "normal",
    amount: "",
    shipping_fee: "0",
    discount: "0",
    items_count: "1",
    item_weight: "0.5",
    item_type: "2",
    delivery_type: "48",
    coupon_code: "",
    note: "",
  });

  const logEvent = useCallback((title, note) => {
    setActivityLog((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        note,
        time: new Date().toISOString(),
      },
      ...current.slice(0, 5),
    ]);
  }, []);

  const fetchOrders = useCallback(async (showRefreshIndicator = false, silent = false) => {
    if (!hasLoadedOrdersRef.current) {
      setLoading(true);
    }
    if (showRefreshIndicator) {
      setQueueRefreshing(true);
    }

    try {
      const result = await getCompanyOrders(accessToken, {
        page: 1,
        perPage: 20,
        search: filters.search,
        status: filters.status === "all" ? "" : filters.status,
        sortField: "placed_at",
        sortOrder: "desc",
      });

      setQueueState({
        data: result.data || [],
        meta: result.meta || {},
        others_data: result.others_data || {},
      });
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      if (!silent) {
        toast.error(error?.response?.data?.message || error.message || "Failed to load courier queue", {
          className: "alert alert-error",
        });
      }
      if (!hasLoadedOrdersRef.current) {
        setQueueState({ data: [], meta: {}, others_data: {} });
      }
    } finally {
      hasLoadedOrdersRef.current = true;
      setLoading(false);
      setQueueRefreshing(false);
    }
  }, [accessToken, filters.search, filters.status]);

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);

    try {
      const result = await getUsers(accessToken, {
        perPage: 50,
        page: 1,
        status: 1,
      });

      const nextStaff = Array.isArray(result.data)
        ? result.data.map((user) => ({
            id: user.id,
            name: user.role_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Staff",
            role: user.roles?.name || user.role_name || "Team member",
            status: getStaffStatus(user),
            email: user.email || "",
            phone: user.phone || "",
            company: user.company?.name || "",
          }))
        : [];

      setStaffState(nextStaff);
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to load courier staff", {
        className: "alert alert-error",
      });
      setStaffState([]);
    } finally {
      setStaffLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders(false, true);
    }, 20000);

    return () => clearInterval(timer);
  }, [fetchOrders]);

  const visibleQueue = useMemo(() => {
    const remoteRows = Array.isArray(queueState.data) ? queueState.data : [];
    const drafts = draftOrders.map((draft) => ({
      ...draft,
      source: "draft",
      order_status: draft.order_status || "pending",
      payment_status: draft.payment_status || "pending",
    }));

    const combined = [...drafts, ...remoteRows];

    if (filters.status !== "all") {
      return combined.filter((item) => item.order_status === filters.status);
    }

    return combined;
  }, [draftOrders, filters.status, queueState.data]);

  const selectedQueueItem = useMemo(
    () => visibleQueue.find((item) => item.id === selectedOrderId) || null,
    [selectedOrderId, visibleQueue]
  );
  const selectedDraftOrder = selectedQueueItem?.source === "draft" ? selectedQueueItem : null;

  useEffect(() => {
    if (!selectedOrderId && visibleQueue.length > 0) {
      setSelectedOrderId(visibleQueue[0].id);
      return;
    }

    if (selectedOrderId && !selectedQueueItem && visibleQueue.length > 0) {
      setSelectedOrderId(visibleQueue[0].id);
    }
  }, [selectedOrderId, selectedQueueItem, visibleQueue]);

  const summary = useMemo(() => {
    const queueRows = visibleQueue;
    const allRows = [...(queueState.data || []), ...draftOrders];
    const remoteTotal = Number(queueState.meta?.total || queueState.others_data?.summary?.total_orders || 0);

    const countByStatus = (status) => allRows.filter((item) => item.order_status === status).length;

    return {
      total: remoteTotal > 0 ? remoteTotal + draftOrders.length : allRows.length,
      pending: countByStatus("pending"),
      processing: countByStatus("processing"),
      shipped: countByStatus("shipped"),
      delivered: countByStatus("delivered"),
      exceptions: countByStatus("cancelled") + countByStatus("returned"),
      visible: queueRows.length,
    };
  }, [draftOrders, queueState.data, queueState.meta?.total, queueState.others_data?.summary?.total_orders, visibleQueue]);

  const summaryCards = [
    { label: "Live Queue", value: summary.visible, icon: PiReceipt },
    { label: "Pending", value: summary.pending, icon: PiClock },
    { label: "In Transit", value: summary.processing + summary.shipped, icon: PiTruck },
    { label: "Delivered", value: summary.delivered, icon: PiCheckCircle },
    { label: "Exceptions", value: summary.exceptions, icon: PiPackage },
  ];

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null);
      return;
    }

    if (selectedDraftOrder) {
      setSelectedOrder(selectedDraftOrder);
      return;
    }

    setDetailsLoading(true);

    getCompanyOrder(accessToken, selectedOrderId)
      .then((result) => {
        setSelectedOrder(result.data || null);
      })
      .catch((error) => {
        toast.error(error?.response?.data?.message || error.message || "Failed to load order details", {
          className: "alert alert-error",
        });
        setSelectedOrder(null);
      })
      .finally(() => {
        setDetailsLoading(false);
      });
  }, [accessToken, selectedDraftOrder, selectedOrderId]);

  const fetchSelectedTracking = useCallback(async () => {
    if (!selectedOrder?.order_no || selectedOrder.source === "draft") {
      return;
    }

    setRefreshingTracking(true);

    try {
      const result = await trackCompanyOrderByNumber(accessToken, selectedOrder.order_no);
      const syncedOrder = result.data || null;
      setTrackingResult(syncedOrder);
      setSelectedOrder(syncedOrder);
      if (syncedOrder?.id) {
        setQueueState((current) => ({
          ...current,
          data: (current.data || []).map((item) =>
            item.id === syncedOrder.id
              ? { ...item, order_status: syncedOrder.order_status, courier: syncedOrder.courier }
              : item
          ),
        }));
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to refresh tracking view", {
        className: "alert alert-error",
      });
    } finally {
      setRefreshingTracking(false);
    }
  }, [accessToken, selectedOrder]);

  useEffect(() => {
    if (!selectedOrder?.courier?.consignment_id || selectedOrder.source === "draft") {
      return undefined;
    }

    const timer = setInterval(fetchSelectedTracking, 60000);
    return () => clearInterval(timer);
  }, [fetchSelectedTracking, selectedOrder?.courier?.consignment_id, selectedOrder?.source]);

  useEffect(() => {
    if (!selectedOrder?.order_no || selectedOrder.source === "draft") {
      setTrackingResult(selectedOrder?.source === "draft" ? selectedOrder : null);
      return;
    }

    setTrackingResult(selectedOrder);
  }, [selectedOrder]);

  const liveOrder = trackingResult || selectedOrder;
  const liveSteps = useMemo(
    () => liveOrder?.tracking_steps || getTrackingSteps(liveOrder?.order_status || "pending"),
    [liveOrder]
  );
  const activeStaffCount = useMemo(
    () => staffState.filter((staff) => staff.status === "online").length,
    [staffState]
  );
  const fieldClass =
    "input input-bordered w-full border-slate-200 bg-slate-50/90 shadow-sm transition focus:border-slate-400 focus:bg-white";
  const textAreaClass =
    "textarea textarea-bordered min-h-24 w-full border-slate-200 bg-slate-50/90 shadow-sm transition focus:border-slate-400 focus:bg-white";
  const selectClass =
    "select select-bordered w-full border-slate-200 bg-slate-50/90 shadow-sm transition focus:border-slate-400 focus:bg-white";

  const handleCreateDraft = () => {
    if (!draftForm.customer_name.trim() || !draftForm.customer_phone.trim()) {
      toast.error("Customer name and phone are required for a dispatch draft.", {
        className: "alert alert-error",
      });
      return;
    }

    const courier = COURIER_PARTNERS.find((item) => item.value === draftForm.courier_partner) || COURIER_PARTNERS[0];
    const payload = createDraftOrder(draftForm, courier);

    createCompanyOrder(accessToken, payload)
      .then((result) => {
        const createdOrder = result.data || null;

        if (createdOrder?.id) {
          setQueueState((current) => ({
            ...current,
            data: [createdOrder, ...(current.data || []).filter((item) => item.id !== createdOrder.id)],
          }));
          setSelectedOrderId(createdOrder.id);
          setSelectedOrder(createdOrder);
          setTrackingResult(createdOrder);
        }

        logEvent("Order created", `${createdOrder?.order_no || payload.order_no || "New order"} saved to courier queue.`);
        toast.success(result.message || "Courier order created", {
          className: "alert alert-success",
        });
        setIsCreateOpen(false);

        setDraftForm((current) => ({
          ...current,
          order_no: "",
          customer_name: "",
          customer_phone: "",
          customer_email: "",
          customer_address: "",
          customer_city: "",
          postal_code: "",
          amount: "",
          shipping_fee: "0",
          discount: "0",
          items_count: "1",
          coupon_code: "",
          note: "",
        }));
      })
      .catch((error) => {
        toast.error(error?.response?.data?.message || error.message || "Failed to create courier order", {
          className: "alert alert-error",
        });
      });
  };

  const handleQuickStatusUpdate = async (nextStatus) => {
    if (!liveOrder?.id || !canManageOrders) {
      return;
    }

    if (liveOrder.source === "draft") {
      setDraftOrders((current) =>
        current.map((item) =>
          item.id === liveOrder.id
            ? {
                ...item,
                order_status: nextStatus,
                tracking_note: `Draft order moved to ${titleize(nextStatus)}.`,
                tracking_steps: getTrackingSteps(nextStatus),
              }
            : item
        )
      );
      setSelectedOrder((current) =>
        current
          ? {
              ...current,
              order_status: nextStatus,
              tracking_note: `Draft order moved to ${titleize(nextStatus)}.`,
              tracking_steps: getTrackingSteps(nextStatus),
            }
          : current
      );
      setTrackingResult((current) =>
        current && current.id === liveOrder.id
          ? {
              ...current,
              order_status: nextStatus,
              tracking_note: `Draft order moved to ${titleize(nextStatus)}.`,
              tracking_steps: getTrackingSteps(nextStatus),
            }
          : current
      );
      logEvent("Draft updated", `${liveOrder.order_no} marked as ${titleize(nextStatus)}.`);
      toast.success("Draft status updated", {
        className: "alert alert-success",
      });
      return;
    }

    setSavingStatus(true);

    try {
      const result = await updateCompanyOrderStatus(accessToken, liveOrder.id, {
        order_status: nextStatus,
        payment_status: liveOrder.payment_status || "pending",
      });

      setSelectedOrder(result.data || null);
      setQueueState((current) => ({
        ...current,
        data: (current.data || []).map((item) =>
          item.id === result.data?.id
            ? {
                ...item,
                order_status: result.data?.order_status,
                payment_status: result.data?.payment_status,
              }
            : item
        ),
      }));
      setSelectedOrderId(result.data?.id || liveOrder.id);
      logEvent("Live order updated", `${result.data?.order_no || liveOrder.order_no} is now ${titleize(nextStatus)}.`);
      toast.success("Order status updated", {
        className: "alert alert-success",
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to update order status", {
        className: "alert alert-error",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const handlePathaoDispatch = async () => {
    if (!liveOrder?.id || liveOrder.source === "draft") return;

    setDispatchingPathao(true);
    try {
      const result = await dispatchCompanyOrderToPathao(accessToken, liveOrder.id);
      setSelectedOrder(result.data || null);
      setTrackingResult(result.data || null);
      setQueueState((current) => ({
        ...current,
        data: (current.data || []).map((item) => (item.id === result.data?.id ? { ...item, ...result.data } : item)),
      }));
      logEvent("Sent to Pathao", `${result.data?.order_no || liveOrder.order_no} received a Pathao consignment.`);
      toast.success(result.message || "Order submitted to Pathao", { className: "alert alert-success" });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to submit order to Pathao", {
        className: "alert alert-error",
      });
    } finally {
      setDispatchingPathao(false);
    }
  };

  const handleTrackingLookup = async () => {
    if (!trackingLookup.trim()) {
      toast.error("Enter an order number first", {
        className: "alert alert-error",
      });
      return;
    }

    setTrackingLoading(true);

    try {
      const result = await trackCompanyOrderByNumber(accessToken, trackingLookup.trim());
      setTrackingResult(result.data || null);
      if (result.data?.id) {
        setSelectedOrderId(result.data.id);
      }
      toast.success("Tracking data refreshed", {
        className: "alert alert-success",
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to track order", {
        className: "alert alert-error",
      });
    } finally {
      setTrackingLoading(false);
    }
  };

  const orderSourceLabel = liveOrder?.source === "draft" ? "Dispatch Draft" : "Live Order";

  return (
    <div className="min-h-screen bg-[#f7f8fa] p-4 sm:p-6">
      {isCreateOpen && (
        <button
          className="fixed inset-0 z-[70] cursor-default bg-slate-950/50 backdrop-blur-sm"
          onClick={() => setIsCreateOpen(false)}
          aria-label="Close create order"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.10),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.7),_rgba(243,245,251,1))]" />
      <div className="mx-auto max-w-[1760px] space-y-6">
        <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-slate-950 shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1 bg-blue-600" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" /> Delivery operations
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Courier command center
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Dispatch, track and resolve every delivery from one workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden rounded-xl px-2 py-1 text-right sm:block">
                <p className="text-[11px] font-semibold text-slate-400">Last synced</p>
                <p className="text-xs font-semibold text-slate-700">{formatDateTime(lastSyncedAt)}</p>
              </div>
              <button className="btn h-11 border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => fetchOrders(true)} disabled={queueRefreshing}>
                <PiArrowClockwise className={queueRefreshing ? "animate-spin" : ""} size={18} />
                Refresh
              </button>
              <button className="btn h-11 border-0 bg-blue-600 px-5 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700" onClick={() => setIsCreateOpen(true)}>
                <PiPlus size={18} /> Create order
              </button>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 md:grid-cols-5">
            {summaryCards.map((card, index) => {
              const Icon = card.icon;
              const accent = [
                "from-cyan-400 to-blue-500",
                "from-amber-400 to-orange-500",
                "from-sky-400 to-cyan-500",
                "from-emerald-400 to-teal-500",
                "from-rose-400 to-pink-500",
              ][index % 5];

              return (
                <div
                  key={card.label}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{card.value}</p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600">
                      <Icon size={20} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className={`${isCreateOpen ? "fixed inset-4 z-[80] mx-auto max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto sm:inset-8" : "hidden"} rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Fast entry
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Create Courier Order</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Save a courier-ready order directly into the queue. The form is tuned for speed, not decoration.
                  </p>
                </div>
                <span className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm">
                  Draft
                </span>
                <button className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200" onClick={() => setIsCreateOpen(false)} aria-label="Close create order"><PiX size={19} /></button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Order Number</label>
                  <input
                    className={fieldClass}
                    placeholder="Optional custom order number"
                    value={draftForm.order_no}
                    onChange={(event) => setDraftForm((current) => ({ ...current, order_no: event.target.value }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Customer Name</label>
                    <input
                      className={fieldClass}
                      placeholder="Customer name"
                      value={draftForm.customer_name}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, customer_name: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Phone</label>
                    <input
                      className={fieldClass}
                      placeholder="01XXXXXXXXX"
                      value={draftForm.customer_phone}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, customer_phone: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                  <input
                    className={fieldClass}
                    placeholder="customer@example.com"
                    value={draftForm.customer_email}
                    onChange={(event) => setDraftForm((current) => ({ ...current, customer_email: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Address</label>
                  <textarea
                    className={textAreaClass}
                    placeholder="Street, area, landmark"
                    value={draftForm.customer_address}
                    onChange={(event) =>
                      setDraftForm((current) => ({ ...current, customer_address: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">City</label>
                    <input
                      className={fieldClass}
                      placeholder="Dhaka"
                      value={draftForm.customer_city}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, customer_city: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Postal Code</label>
                    <input
                      className={fieldClass}
                      placeholder="1207"
                      value={draftForm.postal_code}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, postal_code: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Courier Partner</label>
                    <select
                      className={selectClass}
                      value={draftForm.courier_partner}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, courier_partner: event.target.value }))
                      }
                    >
                      {COURIER_PARTNERS.map((courier) => (
                        <option key={courier.value} value={courier.value}>
                          {courier.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Service Level</label>
                    <select
                      className={selectClass}
                      value={draftForm.service_level}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, service_level: event.target.value }))
                      }
                    >
                      <option value="standard">Standard</option>
                      <option value="express">Express</option>
                      <option value="priority">Priority</option>
                    </select>
                  </div>
                </div>

                {draftForm.courier_partner === "pathao" && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Pathao parcel details</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Weight (kg)</label>
                        <input className={fieldClass} type="number" min="0.5" max="10" step="0.5" value={draftForm.item_weight} onChange={(event) => setDraftForm((current) => ({ ...current, item_weight: event.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Item Type</label>
                        <select className={selectClass} value={draftForm.item_type} onChange={(event) => setDraftForm((current) => ({ ...current, item_type: event.target.value }))}>
                          <option value="2">Parcel</option>
                          <option value="1">Document</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Delivery</label>
                        <select className={selectClass} value={draftForm.delivery_type} onChange={(event) => setDraftForm((current) => ({ ...current, delivery_type: event.target.value }))}>
                          <option value="48">Normal / 48 hours</option>
                          <option value="12">Same day / 12 hours</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Payment</label>
                    <select
                      className={selectClass}
                      value={draftForm.payment_method}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, payment_method: event.target.value }))
                      }
                    >
                      <option value="cod">COD</option>
                      <option value="gateway">Gateway</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Amount</label>
                    <input
                      className={fieldClass}
                      type="number"
                      placeholder="0"
                      value={draftForm.amount}
                      onChange={(event) => setDraftForm((current) => ({ ...current, amount: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Shipping Fee</label>
                    <input
                      className={fieldClass}
                      type="number"
                      placeholder="0"
                      value={draftForm.shipping_fee}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, shipping_fee: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Priority</label>
                    <select
                      className={selectClass}
                      value={draftForm.priority}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, priority: event.target.value }))
                      }
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Items Count</label>
                    <input
                      className={fieldClass}
                      type="number"
                      min="1"
                      value={draftForm.items_count}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, items_count: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Coupon</label>
                    <input
                      className={fieldClass}
                      placeholder="Optional"
                      value={draftForm.coupon_code}
                      onChange={(event) =>
                        setDraftForm((current) => ({ ...current, coupon_code: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Staff Note</label>
                  <textarea
                    className={textAreaClass}
                    placeholder="Any special handling instructions"
                    value={draftForm.note}
                    onChange={(event) => setDraftForm((current) => ({ ...current, note: event.target.value }))}
                  />
                </div>

                <button className="btn btn-primary w-full gap-2 shadow-lg shadow-blue-500/20" onClick={handleCreateDraft}>
                  <PiPlus size={18} />
                  Save Courier Order
                </button>
              </div>

              <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Selected courier hint</p>
                <p className="mt-1">
                  {COURIER_PARTNERS.find((item) => item.value === draftForm.courier_partner)?.note}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-slate-950">Live Queue</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Review recent orders, filter by status, and open one to see live progress.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {visibleQueue.length} visible
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                <label className="input input-bordered flex items-center gap-2 border-slate-200 bg-slate-50/90 shadow-sm">
                  <PiMagnifyingGlass size={18} className="text-slate-400" />
                  <input
                    type="text"
                    className="grow bg-transparent outline-none placeholder:text-slate-400"
                    placeholder="Search order no, customer, address..."
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  />
                </label>

                <select
                  className={selectClass}
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="all">All Status</option>
                  {ORDER_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {titleize(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="animate-pulse rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="h-4 w-1/2 rounded bg-slate-200" />
                        <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : visibleQueue.length > 0 ? (
                  visibleQueue.map((order) => {
                    const isSelected = selectedOrderId === order.id;
                    const tone = statusTone[order.order_status] || "border-slate-200 bg-slate-50 text-slate-700";
                    const partner = order.courier?.label || order.courier?.name || "Courier desk";

                    return (
                      <button
                        key={order.id}
                        className={`group w-full rounded-[22px] border p-4 text-left transition ${
                          isSelected
                            ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.25)]"
                            : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                        }`}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-[11px] uppercase tracking-[0.18em] ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                              {order.source === "draft" ? "Draft" : "Live"}
                            </p>
                            <h4 className="mt-1 text-lg font-semibold tracking-tight">{order.order_no}</h4>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              isSelected ? "border-white/15 bg-white/10 text-white" : tone
                            }`}
                          >
                            {titleize(order.order_status)}
                          </span>
                        </div>

                        <div className={`mt-3 grid gap-2 text-sm ${isSelected ? "text-slate-200" : "text-slate-600"}`}>
                          <div className="flex items-center gap-2">
                            <PiUser size={15} />
                            <span>{order.customer?.name || "Customer"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <PiPhone size={15} />
                            <span>{order.customer?.phone || order.shipping?.phone || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <PiMapPin size={15} />
                            <span className="truncate">
                              {order.shipping?.address || order.customer?.address || "No address yet"}
                            </span>
                          </div>
                        </div>

                        <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 text-xs ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                          <span>{partner}</span>
                          <span>{formatDateTime(order.placed_at)}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No orders found for the current filter.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{orderSourceLabel}</p>
                <h3 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                  {liveOrder?.order_no || "Select an order"}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Live order status, payment state, assignment, and timeline are shown here.
                </p>
                {liveOrder?.courier?.consignment_id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <PiCheckCircle size={15} /> Pathao consignment: {liveOrder.courier.consignment_id}
                    </span>
                    {liveOrder.courier.pathao_status && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        Pathao: {titleize(liveOrder.courier.pathao_status)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {!liveOrder?.courier?.consignment_id && liveOrder?.source !== "draft" && (
                  <button
                    className="btn btn-sm border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={handlePathaoDispatch}
                    disabled={!liveOrder || dispatchingPathao}
                  >
                    <PiTruck size={16} />
                    {dispatchingPathao ? "Sending..." : "Send to Pathao"}
                  </button>
                )}
                <button
                  className="btn btn-outline btn-sm border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  onClick={fetchSelectedTracking}
                  disabled={!liveOrder || refreshingTracking || liveOrder?.source === "draft"}
                >
                  <PiArrowClockwise size={16} />
                  {refreshingTracking ? "Refreshing..." : "Refresh Live"}
                </button>
                <button
                  className="btn btn-outline btn-sm border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => setTrackingResult(liveOrder)}
                  disabled={!liveOrder}
                >
                  <PiEye size={16} />
                  Preview
                </button>
              </div>
            </div>

            {detailsLoading ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading order details...</div>
            ) : liveOrder ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Status</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{titleize(liveOrder.order_status)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {liveOrder.tracking_note || "Order is being monitored."}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Payment</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{titleize(liveOrder.payment_status)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{getPaymentChannelLabel(liveOrder)}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Total</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(liveOrder.total_amount)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{liveOrder.items_count || 0} item(s)</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">ETA</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{liveOrder.estimated_delivery || "N/A"}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Estimated delivery date</p>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Live Status</p>
                          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                            Courier progress timeline
                          </h4>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            statusTone[liveOrder.order_status] || "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {titleize(liveOrder.order_status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        {liveSteps.map((step) => (
                          <div
                            key={step.id}
                            className={`rounded-[20px] border p-3 ${
                              step.current
                                ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_36px_rgba(15,23,42,0.22)]"
                                : step.completed
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Step {step.id}</p>
                            <p className="mt-2 text-sm font-semibold">{step.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Customer</p>
                          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                            {liveOrder.customer?.name || liveOrder.shipping?.full_name || "Customer"}
                          </h4>
                        </div>
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white shadow-md shadow-slate-950/20">
                          <PiUser size={18} />
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Phone</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {liveOrder.customer?.phone || liveOrder.shipping?.phone || "N/A"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Placed</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(liveOrder.placed_at)}</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Address</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {[
                            liveOrder.shipping?.address,
                            liveOrder.shipping?.city,
                            liveOrder.shipping?.country,
                            liveOrder.shipping?.postal_code,
                          ]
                            .filter(Boolean)
                            .join(", ") || liveOrder.customer?.address || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Actions</p>
                          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                            Move the order forward
                          </h4>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {canManageOrders ? "Editable" : "Read only"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {QUICK_STATUS_ACTIONS.map((action) => (
                          <button
                            key={action.value}
                            className="btn btn-outline btn-sm border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                            onClick={() => handleQuickStatusUpdate(action.value)}
                            disabled={savingStatus || !canManageOrders}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <select
                          className={selectClass}
                          value={liveOrder.order_status}
                          onChange={(event) => handleQuickStatusUpdate(event.target.value)}
                          disabled={savingStatus || !canManageOrders}
                        >
                          {ORDER_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {titleize(status)}
                            </option>
                          ))}
                        </select>
                        <select
                          className={selectClass}
                          value={liveOrder.payment_status}
                          onChange={async (event) => {
                            const nextPaymentStatus = event.target.value;

                            if (liveOrder.source === "draft") {
                              setDraftOrders((current) =>
                                current.map((item) =>
                                  item.id === liveOrder.id ? { ...item, payment_status: nextPaymentStatus } : item
                                )
                              );
                              setSelectedOrder((current) =>
                                current ? { ...current, payment_status: nextPaymentStatus } : current
                              );
                              setTrackingResult((current) =>
                                current && current.id === liveOrder.id
                                  ? { ...current, payment_status: nextPaymentStatus }
                                  : current
                              );
                              return;
                            }

                            setSavingStatus(true);
                            try {
                              const result = await updateCompanyOrderStatus(accessToken, liveOrder.id, {
                                order_status: liveOrder.order_status,
                                payment_status: nextPaymentStatus,
                              });
                              setSelectedOrder(result.data || null);
                              setQueueState((current) => ({
                                ...current,
                                data: (current.data || []).map((item) =>
                                  item.id === result.data?.id
                                    ? {
                                        ...item,
                                        payment_status: result.data?.payment_status,
                                        order_status: result.data?.order_status,
                                      }
                                    : item
                                ),
                              }));
                            } catch (error) {
                              toast.error(error?.response?.data?.message || error.message || "Failed to update payment status", {
                                className: "alert alert-error",
                              });
                            } finally {
                              setSavingStatus(false);
                            }
                          }}
                          disabled={savingStatus || !canManageOrders}
                        >
                          {PAYMENT_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {titleize(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Courier Staff</p>
                          <h4 className="mt-1 text-lg font-semibold tracking-tight text-white">Who is handling the line</h4>
                        </div>
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white">
                          <PiUsersThree size={18} />
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-slate-300">
                        <span>Total staff: {staffState.length}</span>
                        <span className="font-semibold text-emerald-300">{activeStaffCount} online</span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {staffLoading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                              <div key={index} className="animate-pulse rounded-[22px] border border-white/10 bg-white/8 p-3">
                                <div className="h-4 w-1/2 rounded bg-white/20" />
                                <div className="mt-2 h-3 w-2/3 rounded bg-white/10" />
                                <div className="mt-4 h-3 w-1/3 rounded bg-white/10" />
                              </div>
                            ))}
                          </div>
                        ) : staffState.length > 0 ? (
                          staffState.map((staff) => (
                            <div key={staff.id} className="rounded-[22px] border border-white/10 bg-white/8 p-3 backdrop-blur">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-sm font-semibold text-cyan-100 ring-1 ring-white/10">
                                    {getInitials(staff.name)}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-white">{staff.name}</p>
                                    <p className="text-xs text-slate-300">{staff.role}</p>
                                  </div>
                                </div>
                                <span
                                  className={`mt-1 h-3 w-3 rounded-full ${statusDotTone[staff.status] || "bg-slate-400"}`}
                                />
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                                <span>{staff.email || staff.phone || "No contact"}</span>
                                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 font-semibold text-white">
                                  {titleize(staff.status)}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[22px] border border-dashed border-white/15 bg-white/8 p-4 text-sm text-slate-300">
                            No active staff found in the company yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tracking Lookup</p>
                          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Search by order number</h4>
                        </div>
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                          <PiMagnifyingGlass size={18} />
                        </span>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <input
                          className={fieldClass}
                          placeholder="e.g. ORD-10024"
                          value={trackingLookup}
                          onChange={(event) => setTrackingLookup(event.target.value)}
                        />
                        <button className="btn btn-primary shadow-lg shadow-blue-500/20" onClick={handleTrackingLookup} disabled={trackingLoading}>
                          {trackingLoading ? "..." : "Track"}
                        </button>
                      </div>

                      {trackingResult?.tracking_note ? (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                          {trackingResult.tracking_note}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-500">
                          The tracking preview will appear here after a lookup or when you select a live order.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Activity</p>
                          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Latest actions</h4>
                        </div>
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                          <PiCalendarBlank size={18} />
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {(activityLog.length > 0
                          ? activityLog
                          : [
                              {
                                id: "empty",
                                title: "No recent activity",
                                note: "Create an order or update one to start the live feed.",
                                time: new Date().toISOString(),
                              },
                            ]
                        ).map((event) => (
                          <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="font-semibold text-slate-950">{event.title}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{event.note}</p>
                            <p className="mt-2 text-xs text-slate-400">{formatDateTime(event.time)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">
                Select a queue item to inspect its live status and courier handling controls.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

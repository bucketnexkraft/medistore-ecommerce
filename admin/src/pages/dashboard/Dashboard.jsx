import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { getDashboardDetails, getDashboardReport } from "../../api/dashboard";
import { useSelector } from "react-redux";
import {
  FaUsers,
  FaBox,
  FaShoppingCart,
  FaDollarSign,
  FaUndo,
  FaExclamationTriangle,
  FaCubes,
  FaTruck,
  FaChartLine,
  FaCalendarAlt,
  FaCreditCard,
  FaEye,
  FaPercentage,
} from "react-icons/fa";
import noimage from "../../../public/images/no-images/user-no-image.png";
import { Link } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import DashboardLoading from "../../components/loadings/DashboardLoading";
import { formatPrice } from "../../hooks/currency";
import { useTranslation } from "react-i18next";

const COLORS = ["#2563eb", "#0f766e", "#f97316", "#be123c", "#7c3aed"];

const getStatusColor = (status) => {
  switch (status) {
    case "Completed":
      return "bg-green-100 text-green-800";
    case "Pending":
      return "bg-yellow-100 text-yellow-800";
    case "Cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const Dashboard = () => {
  const { t } = useTranslation();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { data: preferenceData } = useSelector((state) => state.preferences);
  const stockTrackingEnabled = ![false, 0, "0", "false"].includes(preferenceData?.stock_tracking_enabled);
  const [dashboardData, setDashboardData] = useState(null);
  const [filterType, setFilterType] = useState("monthly");
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState({ isOpen: false, type: "", data: null });
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerDetails, setDrawerDetails] = useState({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters =
        filterType === "custom"
          ? {
            type: filterType,
            startDate: dateRange.startDate?.toISOString().split("T")[0],
            endDate: dateRange.endDate?.toISOString().split("T")[0],
          }
          : { type: filterType };
      const response = await getDashboardReport(accessToken, filters);
      if (response.status === 1) {
        setDashboardData(response.data);
        setDrawerDetails({});
      } else {
        setError(response.message || t("Failed to fetch dashboard data"));
        setDashboardData(null);
      }
    } catch (error) {
      setError(error.message || t("An error occurred while fetching data"));
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filterType !== "custom" || (dateRange.startDate && dateRange.endDate)) {
      fetchData();
    }
  }, [accessToken, filterType, dateRange]);

  const handleFilterChange = (e) => {
    const newFilterType = e.target.value;
    setFilterType(newFilterType);
    if (newFilterType !== "custom") {
      setDateRange({ startDate: null, endDate: null });
    }
  };

  const handleDateChange = (dates) => {
    const [start, end] = dates;
    setDateRange({
      startDate: start,
      endDate: end,
    });
  };

  const handleRetry = () => {
    fetchData();
  };

  const getDrawerCacheKey = (type, data = null) =>
    type === "category" ? `${type}:${data?.name || ""}` : type;

  const fetchDrawerDetails = async (type, data = null) => {
    if (type === "planPayments") {
      return dashboardData?.planPayment || null;
    }

    const cacheKey = getDrawerCacheKey(type, data);
    if (drawerDetails[cacheKey]) {
      return drawerDetails[cacheKey];
    }

    setDrawerLoading(true);
    try {
      const response = await getDashboardDetails(accessToken, {
        startDate: filterType === "custom" ? dateRange.startDate?.toISOString().split("T")[0] : undefined,
        endDate: filterType === "custom" ? dateRange.endDate?.toISOString().split("T")[0] : undefined,
        periodType: filterType,
        detailType: type,
        ...(type === "category" && data?.name ? { category: data.name } : {}),
      });

      const payload = response?.data ?? null;
      setDrawerDetails((prev) => ({
        ...prev,
        [cacheKey]: payload,
      }));

      return payload;
    } catch (detailError) {
      setError(detailError.message || t("An error occurred while fetching details"));
      return null;
    } finally {
      setDrawerLoading(false);
    }
  };

  const openDrawer = async (type, data = null) => {
    setDrawer({ isOpen: true, type, data });
    await fetchDrawerDetails(type, data);
  };

  const closeDrawer = () => {
    setDrawer({ isOpen: false, type: "", data: null });
  };

  const getBarDataKey = () => {
    if (filterType === "monthly") return "day";
    if (filterType === "yearly") return "month";
    if (filterType === "custom") {
      if (!dateRange.startDate || !dateRange.endDate) return "day";
      const diffDays =
        (dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 31 ? "day" : "month";
    }
    return "day";
  };

  const generateSalesData = (data) => {
    if (!data || !data.length) return [];
    const key = getBarDataKey();
    let start, end;
    const now = new Date();

    if (filterType === "monthly") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (filterType === "yearly") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else if (
      filterType === "custom" &&
      dateRange.startDate &&
      dateRange.endDate
    ) {
      start = new Date(dateRange.startDate);
      end = new Date(dateRange.endDate);
    } else {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    }

    const result = [];

    if (key === "month") {
      let current = new Date(start);
      while (current <= end) {
        const monthStr = current.toLocaleString("default", { month: "short" });
        const found = data.find((item) => item.name === monthStr);

        result.push({
          name: monthStr,
          sales: found ? parseFloat(found.sales) : 0,
        });

        current.setMonth(current.getMonth() + 1);
      }
    } else {
      let current = new Date(start);
      while (current <= end) {
        const dayStr = current.getDate().toString().padStart(2, "0");
        const dateStr = current.toISOString().split("T")[0];

        const found = data.find(
          (item) => item.name === dayStr || item.name === dateStr
        );

        result.push({
          name: dayStr,
          sales: found ? parseFloat(found.sales) : 0,
        });

        current.setDate(current.getDate() + 1);
      }
    }

    return result;
  };

  const getDynamicLabel = (baseLabel) => {
    const translatedBase = t(baseLabel);
    switch (filterType) {
      case "daily":
        return t("Today's {{label}}", { label: translatedBase });
      case "monthly":
        return t("Monthly {{label}}", { label: translatedBase });
      case "yearly":
        return t("Yearly {{label}}", { label: translatedBase });
      case "custom":
        return dateRange.startDate && dateRange.endDate
          ? t("Custom {{label}}", { label: translatedBase })
          : translatedBase;
      default:
        return translatedBase;
    }
  };

  const getChartLabel = () => {
    switch (filterType) {
      case "daily":
        return t("Daily Sales");
      case "monthly":
        return t("Monthly Sales");
      case "yearly":
        return t("Yearly Sales");
      case "custom": {
        const start = dateRange.startDate
          ? dateRange.startDate.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
          : "";
        const end = dateRange.endDate
          ? dateRange.endDate.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
          : "";
        return start && end ? t("{{start}} - {{end}} Sales", { start, end }) : t("Custom Sales");
      }
      default:
        return t("Sales Overview");
    }
  };

  const renderDrawerContent = () => {
    const drawerData = drawerDetails[getDrawerCacheKey(drawer.type, drawer.data)];

    if (drawerLoading && !drawerData && drawer.type !== "planPayments") {
      return (
        <div className="flex min-h-[240px] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      );
    }

    switch (drawer.type) {
      case "todayOrders":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Orders")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Date")}</th>
                    <th>{t("Customer")}</th>
                    <th>{t("Product")}</th>
                    <th>{t("Quantity")}</th>
                    <th>{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((sale) => (
                    <tr
                      key={sale.orderId}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>{sale.date}</td>
                      <td>{sale.customer}</td>
                      <td>{sale.product}</td>
                      <td>{sale.quantity}</td>
                      <td>{formatPrice(sale.price)}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="5">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "todayRevenue":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Revenue")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Date")}</th>
                    <th>{t("Customer")}</th>
                    <th>{t("Product")}</th>
                    <th>{t("Quantity")}</th>
                    <th>{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((sale) => (
                    <tr
                      key={sale.orderId}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>{sale.date}</td>
                      <td>{sale.customer}</td>
                      <td>{sale.product}</td>
                      <td>{sale.quantity}</td>
                      <td>{formatPrice(sale.price)}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="5">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "todayPurchases":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Purchases")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Date")}</th>
                    <th>{t("Supplier")}</th>
                    <th>{t("Product")}</th>
                    <th>{t("Quantity")}</th>
                    <th>{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>{purchase.date}</td>
                      <td>{purchase.customer}</td>
                      <td>{purchase.product}</td>
                      <td>{purchase.quantity}</td>
                      <td>{formatPrice(purchase.price)}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="5">{t("No purchase data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "totalStock":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Stock")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Lot Number")}</th>
                    <th>{t("Product")}</th>
                    <th>{t("Category")}</th>
                    <th>{t("Brand")}</th>
                    <th>{t("Warehouse")}</th>
                    <th>{t("In Stock")}</th>
                    <th>{t("Purchase Price")}</th>
                    <th>{t("Selling Price")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((stock) => (
                    <tr
                      key={stock.id}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>
                        <span className="font-semibold text-primary">
                          #{stock.batch_no}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="avatar">
                            <div className="w-10 h-10 rounded">
                              <img
                                src={stock.thumbnail || noimage}
                                alt={stock.name}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {stock.name}
                            </p>
                            <p className="text-xs text-blue-500">
                              {stock.barcode}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{stock.category}</td>
                      <td>{stock.brand}</td>
                      <td>{stock.warehouse_id}</td>
                      <td>{stock.total_qty}</td>
                      <td>{formatPrice(stock.stock_price)}</td>
                      <td>{formatPrice(stock.selling_price)}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="8">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "todayReturns":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Returns")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Date")}</th>
                    <th>{t("Customer")}</th>
                    <th>{t("Product")}</th>
                    <th>{t("Quantity")}</th>
                    <th>{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((sale) => (
                    <tr
                      key={sale.orderId}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>{sale.date}</td>
                      <td>{sale.customer}</td>
                      <td>{sale.product}</td>
                      <td>{sale.quantity}</td>
                      <td>{formatPrice(sale.price)}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="5">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "totalProducts":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Products")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Product")}</th>
                    <th>{t("Brand")}</th>
                    <th>{t("Category")}</th>
                    <th>{t("Stock")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((product) => (
                    <tr
                      key={product.id}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="avatar">
                            <div className="w-8 h-10 rounded">
                              <img
                                src={product.thumbnail || noimage}
                                alt={product.name}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {product.name}
                            </p>
                            <p className="text-xs text-blue-500">
                              {product.barcode}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{product.brand}</td>
                      <td>{product.category}</td>
                      <td>{product.stock}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="4">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "lowStockItems":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">
                {getDynamicLabel("Low Stock Items")}
              </h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Product")}</th>
                    <th>{t("Brand")}</th>
                    <th>{t("Category")}</th>
                    <th>{t("Stock")}</th>
                    <th>{t("Alert Quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((product) => (
                    <tr
                      key={product.id}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="avatar">
                            <div className="w-8 h-10 rounded">
                              <img
                                src={product.thumbnail || noimage}
                                alt={product.product}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {product.product}
                            </p>
                            <p className="text-xs text-blue-500">
                              {product.barcode}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{product.brand}</td>
                      <td>{product.category}</td>
                      <td className="font-semibold text-error">
                        {product.quantity}
                      </td>
                      <td className="font-semibold text-error">
                        {product.alert_quantity}
                      </td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="5">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "planPayments":
        return (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">{t("Plan Payments")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">{t("Current Plan")}</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {drawerData?.current_plan?.name || dashboardData?.planPayment?.current_plan?.name || t("No active plan")}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">{t("Latest Payment")}</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {drawerData?.latest_payment
                    ? formatPrice(drawerData.latest_payment.payable_amount)
                    : t("No payment submitted")}
                </p>
                {drawerData?.latest_payment?.status && (
                  <p className="mt-1 text-xs text-slate-500">
                    {t("Status")}: {drawerData.latest_payment.status}
                  </p>
                )}
              </div>
              <Link to="/plan-payments" className="btn btn-primary w-full" onClick={closeDrawer}>
                {t("View Payment Details")}
              </Link>
            </div>
          </div>
        );
      case "totalCustomers":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Customers")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Name")}</th>
                    <th>{t("Email")}</th>
                    <th>{t("Phone")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((customer) => (
                    <tr
                      key={customer.id}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="avatar">
                            <div className="w-8 h-10 rounded">
                              <img
                                src={customer.profile_image || noimage}
                                alt={customer.first_name}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {customer.first_name} {customer?.last_name}
                            </p>
                            <p className="text-xs text-blue-500">
                              {customer.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{customer.email}</td>
                      <td>{customer.phone}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="3">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "activeSuppliers":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{getDynamicLabel("Suppliers")}</h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Name")}</th>
                    <th>{t("Email")}</th>
                    <th>{t("Phone")}</th>
                    <th>{t("Address")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((supplier) => (
                    <tr
                      key={supplier.id}
                      className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                    >
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="avatar">
                            <div className="w-8 h-10 rounded">
                              <img
                                src={supplier.profile_image || noimage}
                                alt={supplier.name}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {supplier.name}
                            </p>
                            <p className="text-xs text-blue-500">
                              {supplier.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{supplier.email}</td>
                      <td>{supplier.phone}</td>
                      <td>{supplier.address}</td>
                    </tr>
                  )) || (
                      <tr>
                        <td colSpan="4">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "category":
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold figtree-regular">
                Category Details - {drawer.data?.name}
              </h2>
              <button className="btn btn-sm btn-circle" onClick={closeDrawer}>x</button>
            </div>
            <div className="overflow-x-auto">
              <table className="table figtree-regular text-base w-full">
                <thead>
                  <tr className="bg-zinc-100 text-base">
                    <th>{t("Product ID")}</th>
                    <th>{t("Name")}</th>
                    <th>{t("Stock")}</th>
                    <th>{t("Price")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerData?.map((product) => (
                      <tr
                        key={product.id}
                        className="text-custom-gray-400 hover:bg-zinc-200 transition-all duration-300 ease-in-out"
                      >
                        <td>
                          <div className="flex items-center space-x-2">
                            <div className="avatar">
                              <div className="w-10 h-10 rounded">
                                <img
                                  src={product.thumbnail || noimage}
                                  alt={product.name}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {product.name}
                              </p>
                              <p className="text-xs text-blue-500">
                                {product.barcode}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>{product.name}</td>
                        <td>{product.stock}</td>
                        <td>{formatPrice(product.price)}</td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan="4">{t("No data available")}</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        );
      default:
        return <div>{t("No details available")}</div>;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center figtree-regular">
        <div className="alert alert-error shadow-lg max-w-md">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
          <div className="flex-none">
            <button className="btn btn-sm btn-primary" onClick={handleRetry}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-6 bg-base-100 min-h-screen">
        <DashboardLoading />
      </div>
    );
  }

  const salesDataWithAllDates = generateSalesData(dashboardData.salesData);
  const highestSellingProducts =
    dashboardData?.highestSellingProducts?.length > 0
      ? dashboardData.highestSellingProducts
      : dashboardData?.highestSellingProduct
        ? [dashboardData.highestSellingProduct]
        : [];
  const lowestSellingProducts =
    dashboardData?.lowestSellingProducts?.length > 0
      ? dashboardData.lowestSellingProducts
      : dashboardData?.lowestSellingProduct
        ? [dashboardData.lowestSellingProduct]
        : [];
  const planPayment = dashboardData?.planPayment || {};
  const latestPlanPayment = planPayment?.latest_payment || null;
  const currentPlan = planPayment?.current_plan || null;
  const ecommerceAnalytics = dashboardData?.ecommerceAnalytics || {};
  const analyticsSummary = ecommerceAnalytics.summary || {};
  const analyticsTrend = ecommerceAnalytics.trend || [];
  const analyticsFunnel = ecommerceAnalytics.funnel || [];
  const analyticsSources = ecommerceAnalytics.sources || [];
  const analyticsDevices = ecommerceAnalytics.devices || [];
  const highestSellingChartData = highestSellingProducts.map((item) => ({
    name: item.name,
    qty: Number(item.total_qty) || 0,
    sales: Number(item.total_sales) || 0,
    code: item.code || "N/A",
  }));
  const lowestSellingChartData = lowestSellingProducts.map((item) => ({
    name: item.name,
    qty: Number(item.total_qty) || 0,
    sales: Number(item.total_sales) || 0,
    code: item.code || "N/A",
  }));
  const selectedPeriodLabel =
    filterType === "custom" && dateRange.startDate && dateRange.endDate
      ? `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`
      : t(filterType.charAt(0).toUpperCase() + filterType.slice(1));
  const totalSalesAmount = salesDataWithAllDates.reduce(
    (total, item) => total + Number(item.sales || 0),
    0
  );

  return (
    <div className="dashboard-shell figtree-regular">
      <div className="dashboard-hero mb-5 md:mb-6">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-900 p-5 text-white md:p-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-teal-100">
              <FaChartLine className="text-sm" />
              {t("Live business overview")}
            </div>
            <h2 className="text-2xl font-bold md:text-3xl">{t("Dashboard")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
              {t("Track revenue, stock health, sales momentum, and customer activity from one command view.")}
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[34rem]">
            <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-slate-300">{t("Selected period")}</p>
              <p className="mt-1 text-lg font-semibold">{selectedPeriodLabel}</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-slate-300">{t("Sales in view")}</p>
              <p className="mt-1 text-lg font-semibold">{formatPrice(totalSalesAmount)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <FaCalendarAlt className="text-slate-400" />
            {t("Performance filter")}
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <select
              className="select select-bordered h-11 min-h-11 w-full rounded-lg border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 md:w-44"
              value={filterType}
              onChange={handleFilterChange}
            >
              <option value="daily">{t("Daily")}</option>
              <option value="monthly">{t("Monthly")}</option>
              <option value="yearly">{t("Yearly")}</option>
              <option value="custom">{t("Custom Range")}</option>
            </select>
            {filterType === "custom" && (
              <div className="w-full md:min-w-72">
                <DatePicker
                  selectsRange={true}
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                  onChange={handleDateChange}
                  isClearable={true}
                  placeholderText={t("Select date range")}
                  className="input input-bordered h-11 w-full rounded-lg border-slate-200 bg-slate-50 text-sm"
                  dateFormat="MMM d, yyyy"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:mb-6">
        {[
          {
            type: "todayOrders",
            url: "/stock/out",
            icon: FaShoppingCart,
            title: "Orders",
            value: dashboardData.summary.todayOrders,
            change: dashboardData.summary.todayOrdersChange,
            bg: "bg-emerald-50",
            text: "text-emerald-900",
            fixed_title: false,
          },
          {
            type: "todayPurchases",
            url: "/stock/in", // change to your actual purchase list route
            icon: FaTruck, // you can use FaShoppingBag or any other icon
            title: "Purchases",
            value: `${formatPrice(dashboardData.summary.todayPurchasesAmount)}`,
            change: dashboardData.summary.todayPurchasesCountChange,
            bg: "bg-orange-50",
            text: "text-orange-900",
            fixed_title: false,
          },
          {
            type: "todayRevenue",
            url: "/stock/out",
            icon: FaDollarSign,
            title: "Sale",
            value: `${formatPrice(dashboardData.summary.todayRevenue)}`,
            change: dashboardData.summary.todayRevenueChange,
            bg: "bg-purple-50",
            text: "text-purple-900",
            fixed_title: false,
          },
          {
            type: "totalStock",
            url: "/stock/overview",
            icon: FaCubes,
            title: "Stock",
            value: dashboardData.summary.totalStock,
            change: dashboardData.summary.totalStockChange,
            bg: "bg-green-50",
            text: "text-green-900",
            fixed_title: false,
          },
          {
            type: "todayReturns",
            url: "/stock/out",
            icon: FaUndo,
            title: "Returns",
            value: dashboardData.summary.todayReturns,
            change: dashboardData.summary.todayReturnsChange,
            bg: "bg-rose-50",
            text: "text-rose-900",
            fixed_title: false,
          },
          {
            type: "totalProducts",
            url: "/product-setup/products",
            icon: FaBox,
            title: "Products",
            value: dashboardData.summary.totalProducts,
            change: dashboardData.summary.totalProductsChange,
            bg: "bg-blue-50",
            text: "text-blue-900",
            fixed_title: true,
          },
          {
            type: "lowStockItems",
            url: "/stock/overview",
            icon: FaExclamationTriangle,
            title: "Low Stock",
            value: dashboardData.summary.lowStockItems,
            change: dashboardData.summary.lowStockItemsChange,
            bg: "bg-red-50",
            text: "text-red-900",
            fixed_title: true,
          },
          {
            type: "totalCustomers",
            url: "/users",
            icon: FaUsers,
            title: "Customers",
            value: dashboardData.summary.totalCustomers,
            change: dashboardData.summary.totalCustomersChange,
            bg: "bg-cyan-50",
            text: "text-cyan-900",
            fixed_title: true,
          },
          {
            type: "planPayments",
            url: "/plan-payments",
            icon: FaCreditCard,
            title: "Plan Payments",
            value: latestPlanPayment
              ? formatPrice(latestPlanPayment.payable_amount)
              : currentPlan?.name || t("No Plan"),
            secondaryValue: latestPlanPayment?.status
              ? `${t("Status")}: ${latestPlanPayment.status}`
              : currentPlan?.billing_period,
            change: null,
            bg: "bg-slate-50",
            text: "text-slate-900",
            fixed_title: true,
          },
          // {
          //   type: "activeSuppliers",
          //   url: "/suppliers",
          //   icon: FaTruck,
          //   title: "Suppliers",
          //   value: dashboardData.summary.activeSuppliers,
          //   change: dashboardData.summary.activeSuppliersChange,
          //   bg: "bg-yellow-50",
          //   text: "text-yellow-900",
          //   fixed_title: true,
          // },
        ].filter((card) => stockTrackingEnabled || card.type !== "todayPurchases").map((card) => (
          <div
            key={card.type}
            className="dashboard-card cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                  <card.icon className="text-lg" />
                </div>
                <div>
                  <h3
                    className="text-xs font-semibold uppercase text-slate-500"
                    onClick={() => openDrawer(card.type)}
                  >
                    {card.fixed_title ? t(card.title) : getDynamicLabel(card.title)}
                  </h3>
                  <Link to={card.url} className="block">
                    <div className="mt-1 truncate text-2xl font-bold text-slate-950">
                      {card.value}
                    </div>
                    {card.type !== "todayPurchases" && Boolean(card.secondaryValue) && (
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {card.secondaryValue}
                      </div>
                    )}
                  </Link>
                </div>
              </div>
              {card.change && (
                <span
                  className={`badge ${parseFloat(card.change) >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                    } rounded-lg px-2 py-1 text-xs font-semibold`}
                >
                  {parseFloat(card.change) >= 0 ? "Up" : "Down"} {card.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="mb-5 space-y-4 md:mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{t("Ecommerce intelligence")}</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">{t("Storefront Analytics")}</h3>
            <p className="mt-1 text-sm text-slate-500">{t("First-party visitor, funnel, campaign, and product behavior for the selected period.")}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            {analyticsDevices.map((device) => (
              <span key={device.name} className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                {t(device.name)}: {device.value}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Visitors", value: analyticsSummary.visitors || 0, icon: FaUsers, tone: "bg-cyan-50 text-cyan-800" },
            { title: "Page views", value: analyticsSummary.page_views || 0, icon: FaEye, tone: "bg-blue-50 text-blue-800", detail: `${analyticsSummary.pages_per_session || 0} ${t("pages/session")}` },
            { title: "Conversion rate", value: `${analyticsSummary.conversion_rate || 0}%`, icon: FaPercentage, tone: "bg-emerald-50 text-emerald-800", detail: `${analyticsSummary.purchases || 0} ${t("purchases")}` },
            { title: "Tracked revenue", value: formatPrice(analyticsSummary.revenue || 0), icon: FaDollarSign, tone: "bg-amber-50 text-amber-800", detail: `${analyticsSummary.cart_abandonment_rate || 0}% ${t("cart abandonment")}` },
          ].map((metric) => (
            <div key={metric.title} className="dashboard-card">
              <div className="flex items-start gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${metric.tone}`}>
                  <metric.icon className="text-lg" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-slate-500">{t(metric.title)}</p>
                  <p className="mt-1 truncate text-2xl font-bold text-slate-950">{metric.value}</p>
                  {metric.detail ? <p className="mt-1 text-xs text-slate-500">{metric.detail}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h3 className="text-base font-bold text-slate-950">{t("Traffic trend")}</h3>
                <p className="text-xs text-slate-500">{t("Visitors and page views over time")}</p>
              </div>
            </div>
            {analyticsTrend.length > 0 ? (
              <div className="h-72 p-3 md:p-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsTrend} margin={{ top: 8, right: 8, left: -14, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="page_views" name={t("Page views")} fill="#2563eb" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="visitors" name={t("Visitors")} fill="#0f766e" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="dashboard-empty m-4">{t("Analytics will appear after storefront visits are recorded.")}</div>}
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h3 className="text-base font-bold text-slate-950">{t("Conversion funnel")}</h3>
                <p className="text-xs text-slate-500">{t("Unique sessions progressing toward purchase")}</p>
              </div>
            </div>
            {analyticsFunnel.some((item) => Number(item.value) > 0) ? (
              <div className="h-72 p-3 md:p-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsFunnel} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }} />
                    <Bar dataKey="value" name={t("Sessions")} fill="#0f766e" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="dashboard-empty m-4">{t("No funnel activity in this period.")}</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h3 className="text-base font-bold text-slate-950">{t("Traffic sources")}</h3>
                <p className="text-xs text-slate-500">{t("First-touch source by session")}</p>
              </div>
            </div>
            {analyticsSources.length > 0 ? (
              <div className="h-72 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analyticsSources} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>
                      {analyticsSources.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="dashboard-empty m-4">{t("No source data available.")}</div>}
          </div>

          <div className="dashboard-panel xl:col-span-2">
            <div className="dashboard-panel-header">
              <div>
                <h3 className="text-base font-bold text-slate-950">{t("Top storefront pages")}</h3>
                <p className="text-xs text-slate-500">{t("Content attracting the most attention")}</p>
              </div>
            </div>
            {ecommerceAnalytics.top_pages?.length > 0 ? (
              <div className="overflow-x-auto px-3 pb-3">
                <table className="dashboard-table">
                  <thead><tr><th>{t("Page")}</th><th>{t("Views")}</th><th>{t("Visitors")}</th></tr></thead>
                  <tbody>{ecommerceAnalytics.top_pages.map((page) => (
                    <tr key={page.path}>
                      <td><p className="max-w-md truncate font-semibold text-slate-900">{page.title}</p><p className="max-w-md truncate text-xs text-slate-500">{page.path}</p></td>
                      <td>{page.views}</td><td>{page.visitors}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="dashboard-empty m-4">{t("No page data available.")}</div>}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3 className="text-base font-bold text-slate-950">{t("Product engagement")}</h3>
              <p className="text-xs text-slate-500">{t("Views, cart intent, purchases, and revenue by product")}</p>
            </div>
          </div>
          {ecommerceAnalytics.top_products?.length > 0 ? (
            <div className="overflow-x-auto px-3 pb-3">
              <table className="dashboard-table">
                <thead><tr><th>{t("Product")}</th><th>{t("Views")}</th><th>{t("Cart adds")}</th><th>{t("Purchased qty")}</th><th>{t("Revenue")}</th></tr></thead>
                <tbody>{ecommerceAnalytics.top_products.map((product) => (
                  <tr key={product.product_id}>
                    <td className="font-semibold text-slate-900">{product.name}</td>
                    <td>{product.views}</td><td>{product.cart_adds}</td><td>{product.purchases}</td><td>{formatPrice(product.revenue)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="dashboard-empty m-4">{t("No product engagement data available.")}</div>}
        </div>
      </section>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2 md:mb-6">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3 className="text-base font-bold text-slate-950">{t("Top 5 Highest Selling Products")}</h3>
              <p className="text-xs text-slate-500">{t("Best product movement in the selected period")}</p>
            </div>
          </div>
          {highestSellingChartData.length > 0 ? (
            <div className="h-72 p-3 md:h-80 md:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={highestSellingChartData} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                    formatter={(value, name, props) =>
                      name === "qty"
                        ? [value, t("Qty Sold:")]
                        : [value, name]
                    }
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload
                        ? `${label} (${t("Code")}: ${payload[0].payload.code})`
                        : label
                    }
                  />
                  <Bar dataKey="qty" fill="#0f766e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-empty m-4">{t("No sales data for selected period.")}</div>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3 className="text-base font-bold text-slate-950">{t("Top 5 Lowest Selling Products")}</h3>
              <p className="text-xs text-slate-500">{t("Slow movers that may need attention")}</p>
            </div>
          </div>
          {lowestSellingChartData.length > 0 ? (
            <div className="h-72 p-3 md:h-80 md:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lowestSellingChartData} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                    formatter={(value, name, props) =>
                      name === "qty"
                        ? [value, t("Qty Sold:")]
                        : [value, name]
                    }
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload
                        ? `${label} (${t("Code")}: ${payload[0].payload.code})`
                        : label
                    }
                  />
                  <Bar dataKey="qty" fill="#f97316" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-empty m-4">{t("No sales data for selected period.")}</div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3 className="text-base font-bold text-slate-950">{getChartLabel()}</h3>
              <p className="text-xs text-slate-500">{t("Revenue rhythm across the selected period")}</p>
            </div>
          </div>
          {salesDataWithAllDates.length > 0 ? (
            <div className="h-64 p-3 md:h-80 md:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesDataWithAllDates}
                  onClick={(data) =>
                    data &&
                    openDrawer("todayOrders", data.activePayload[0].payload)
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }} />
                  <Bar dataKey="sales" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-empty m-4">{t("No sales data available")}</div>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3 className="text-base font-bold text-slate-950">{t("Category Distribution")}</h3>
              <p className="text-xs text-slate-500">{t("Inventory spread by product category")}</p>
            </div>
          </div>
          {dashboardData.categoryData?.length > 0 ? (
            <div className="h-64 p-3 md:h-80 md:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={86}
                    innerRadius={46}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={(data) => openDrawer("category", data)}
                  >
                    {dashboardData.categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-empty m-4">{t("No category data available")}</div>
          )}
        </div>
      </div>

      <div className="dashboard-panel mt-4 md:mt-6">
        <div className="dashboard-panel-header">
          <div>
            <h3 className="text-base font-bold text-slate-950">{t("Stock Time Value")}</h3>
            <p className="text-xs text-slate-500">{t("Top 10 aging stock items")}</p>
          </div>
        </div>
        {dashboardData.stockTimeValueItems?.length > 0 ? (
          <div className="overflow-x-auto px-3 pb-3">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>{t("Product")}</th>
                  <th>{t("Lot")}</th>
                  <th>{t("Age")}</th>
                  <th>{t("Qty")}</th>
                  <th>{t("STV")}</th>
                  <th>{t("Suggestion")}</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.stockTimeValueItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center space-x-2">
                        <div className="avatar">
                          <div className="w-10 h-10 rounded border bg-white">
                            <img src={item.thumbnail || noimage} alt={item.product} />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{item.product}</p>
                          <p className="text-xs text-blue-600">{item.barcode || t("N/A")}</p>
                        </div>
                      </div>
                    </td>
                    <td>{item.batch_no || t("N/A")}</td>
                    <td>{item.age_days} {t("days")}</td>
                    <td>{item.quantity}</td>
                    <td>
                      <span className="badge badge-sm bg-indigo-100 text-indigo-700">
                        {item.stv?.name}: {item.stv?.value}
                      </span>
                    </td>
                    <td className="text-sm text-slate-700">
                      {item.stv?.code === "Day61Above" ? (
                        <div className="flex flex-wrap gap-3">
                          <Link
                            to="/company-preference/discount"
                            className="link link-primary font-medium"
                          >
                            Create discount
                          </Link>
                          <Link
                            to="/product-setup/bundles"
                            className="link link-primary font-medium"
                          >
                            Create bundle
                          </Link>
                        </div>
                      ) : (
                        item.suggestion
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty m-4">{t("No stock time value data available")}</div>
        )}
      </div>

      <div className="dashboard-panel mt-4 md:mt-6">
        <div className="dashboard-panel-header">
          <div>
            <h3 className="text-base font-bold text-slate-950">{t("Recent Sales")}</h3>
            <p className="text-xs text-slate-500">{t("Latest completed sales activity")}</p>
          </div>
        </div>
        {dashboardData.recentSales?.length > 0 ? (
          <div className="overflow-x-auto px-3 pb-3">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("Product")}</th>
                  <th>{t("Customer")}</th>
                  <th>{t("Qty")}</th>
                  <th>{t("Price")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Date")}</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recentSales.map((sale, index) => (
                  <tr
                    key={sale.id}
                    className={index % 2 === 0 ? "bg-slate-50/70" : "bg-white"}
                  >
                    <td>{index + 1}</td>
                    <td className="truncate max-w-xs">{sale.product}</td>
                    <td className="truncate max-w-xs">{sale.customer}</td>
                    <td>{sale.quantity}</td>
                    <td>{formatPrice(sale.price)}</td>
                    <td>
                      <span className={`badge badge-sm ${getStatusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td>{sale.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty m-4">{t("No recent sales available")}</div>
        )}
      </div>

      {/* Drawer */}
      {drawer.isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm">
          <div
            className={`h-full w-full bg-white shadow-2xl 
                        ${drawer.type === "totalStock"
                ? "max-w-3xl"
                : drawer.type === "lowStockItems"
                  ? "max-w-xl"
                  : drawer.type === "activeSuppliers"
                    ? "max-w-3xl"
                    : "max-w-xl"
              } 
                        overflow-y-auto p-4 md:p-6`}
          >
            {renderDrawerContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  PiBuildings,
  PiCurrencyDollar,
  PiBank,
  PiCoins,
  PiClockCounterClockwise,
  PiCheckCircle,
  PiXCircle,
  PiTrendUp,
} from "react-icons/pi";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { getBackofficeDashboard } from "../../../api/backoffice/dashboard";

const StatCard = ({ title, value, icon, tone = "primary", subtext = "" }) => (
  <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <h3 className="text-2xl font-semibold mt-1">{value}</h3>
        {subtext ? <p className="text-xs text-gray-500 mt-1">{subtext}</p> : null}
      </div>
      <div
        className={`p-2 rounded-lg ${
          tone === "success"
            ? "bg-emerald-100 text-emerald-700"
            : tone === "warning"
            ? "bg-amber-100 text-amber-700"
            : tone === "danger"
            ? "bg-rose-100 text-rose-700"
            : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </div>
    </div>
  </div>
);

export default function BackofficeDashboard() {
  const { t } = useTranslation();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const result = await getBackofficeDashboard(accessToken);
      if (!result?.status) {
        throw new Error(result?.message || t("Failed to load dashboard"));
      }
      setData(result.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || t("Failed to load dashboard"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const overview = useMemo(() => data?.overview || {}, [data]);
  const charts = useMemo(() => data?.charts || {}, [data]);
  const revenueDiff = (overview.monthly_revenue || 0) - (overview.previous_month_revenue || 0);
  const revenueDiffText = t("{{amount}} vs prev month", {
    amount: revenueDiff >= 0 ? `+${revenueDiff.toFixed(2)}` : revenueDiff.toFixed(2),
  });
  const companyStatusData = [
    { name: t("Active"), value: Number(charts?.company_status?.active || 0) },
    { name: t("Inactive"), value: Number(charts?.company_status?.inactive || 0) },
  ];
  const paymentStatusData = [
    { name: t("Pending"), value: Number(charts?.payment_status?.pending || 0) },
    { name: t("Approved"), value: Number(charts?.payment_status?.approved || 0) },
    { name: t("Rejected"), value: Number(charts?.payment_status?.rejected || 0) },
  ];
  const revenueSeries = Array.isArray(charts?.revenue_series) ? charts.revenue_series : [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t("SaaS Backoffice Dashboard")}</h2>
            <p className="text-sm text-gray-600">{t("Track platform health, subscriptions, and operations from one place.")}</p>
          </div>
          <button className="btn btn-outline btn-primary" onClick={loadDashboard} disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : t("Refresh")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title={t("Total Companies")} value={overview.total_companies ?? 0} icon={<PiBuildings size={22} />} subtext={`${t("Active:")} ${overview.active_companies ?? 0}`} />
        <StatCard title={t("SaaS Plans")} value={overview.total_plans ?? 0} icon={<PiCoins size={22} />} subtext={`${t("Active:")} ${overview.active_plans ?? 0}`} />
        <StatCard title={t("Payment Gateways")} value={overview.total_gateways ?? 0} icon={<PiBank size={22} />} subtext={`${t("Active:")} ${overview.active_gateways ?? 0}`} />
        <StatCard title={t("Currencies")} value={overview.total_currencies ?? 0} icon={<PiCurrencyDollar size={22} />} subtext={`${t("Active:")} ${overview.active_currencies ?? 0}`} />
        <StatCard title={t("Pending Payments")} value={overview.pending_payments ?? 0} icon={<PiClockCounterClockwise size={22} />} tone="warning" />
        <StatCard title={t("Approved Payments")} value={overview.approved_payments ?? 0} icon={<PiCheckCircle size={22} />} tone="success" />
        <StatCard title={t("Rejected Payments")} value={overview.rejected_payments ?? 0} icon={<PiXCircle size={22} />} tone="danger" />
        <StatCard
          title={t("This Month Revenue")}
          value={Number(overview.monthly_revenue || 0).toFixed(2)}
          icon={<PiTrendUp size={22} />}
          tone={revenueDiff >= 0 ? "success" : "danger"}
          subtext={revenueDiffText}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold text-lg mb-3">{t("Company Status")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={companyStatusData} dataKey="value" nameKey="name" outerRadius={95} label>
                  <Cell fill="#10b981" />
                  <Cell fill="#9ca3af" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold text-lg mb-3">{t("Payment Status")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentStatusData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  <Cell fill="#f59e0b" />
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-semibold text-lg mb-3">{t("Revenue Trend (Last 6 Months)")}</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueSeries} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">{t("Recent Companies")}</h3>
            <Link to="/backoffice/companies" className="text-sm text-primary hover:underline">
              {t("View all")}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>{t("Name")}</th>
                  <th>{t("Email")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_companies || []).length ? (
                  data.recent_companies.map((company) => (
                    <tr key={company.company_id}>
                      <td>{company.name || "-"}</td>
                      <td>{company.email || "-"}</td>
                      <td>
                        <span className={`badge ${Number(company.status) === 1 ? "badge-success" : "badge-ghost"}`}>
                          {Number(company.status) === 1 ? t("Active") : t("Inactive")}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-gray-500">
                      {t("No recent companies")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">{t("Recent Plan Payments")}</h3>
            <Link to="/backoffice/plan-payment-logs" className="text-sm text-primary hover:underline">
              {t("View all")}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>{t("Company")}</th>
                  <th>{t("Plan")}</th>
                  <th>{t("Amount")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_payments || []).length ? (
                  data.recent_payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment?.company?.name || "-"}</td>
                      <td>{payment?.plan?.name || "-"}</td>
                      <td>
                        {Number(payment.payable_amount || 0).toFixed(2)} {payment?.currency?.code || ""}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            payment.status === "approved"
                              ? "badge-success"
                              : payment.status === "rejected"
                              ? "badge-error"
                              : "badge-warning"
                          }`}
                        >
                          {payment.status === "approved"
                            ? t("Approved")
                            : payment.status === "rejected"
                            ? t("Rejected")
                            : payment.status === "pending"
                            ? t("Pending")
                            : payment.status || "-"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-500">
                      {t("No recent payments")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  PiBank,
  PiCoins,
  PiReceipt,
  PiUpload,
} from "react-icons/pi";
import TableLoading from "../../components/loadings/TableLoading";
import {
  getCommissionGateways,
  getCommissionOverview,
  submitCommissionPayment,
} from "../../api/companyCommission";

const formatAmount = (value, currency = "") => {
  const amount = Number(value || 0).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
};

export default function CommissionBilling() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState(null);
  const [gateways, setGateways] = useState([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState("");
  const [paymentFields, setPaymentFields] = useState({});
  const [paymentFiles, setPaymentFiles] = useState({});

  const selectedGateway = useMemo(
    () => gateways.find((gateway) => String(gateway.id) === String(selectedGatewayId)) || null,
    [gateways, selectedGatewayId]
  );

  const manualParams = useMemo(
    () => (Array.isArray(selectedGateway?.parameters) ? selectedGateway.parameters : []),
    [selectedGateway]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewResult, gatewayResult] = await Promise.all([
        getCommissionOverview(accessToken),
        getCommissionGateways(accessToken),
      ]);

      if (!overviewResult?.status) {
        throw new Error(overviewResult?.message || "Failed to load commission overview");
      }

      setPayload(overviewResult?.data || null);
      const nextGateways = Array.isArray(gatewayResult?.data) ? gatewayResult.data : [];
      setGateways(nextGateways);
      setSelectedGatewayId(nextGateways[0]?.id || "");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load commission billing");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePaymentFieldChange = (name, value) => {
    setPaymentFields((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentFileChange = (name, file) => {
    setPaymentFiles((prev) => ({ ...prev, [name]: file || null }));
  };

  const submitPayment = async () => {
    if (!selectedGatewayId) {
      toast.error("Please select a bank or MFS method.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("gateway_id", selectedGatewayId);
      formData.append("payment_fields", JSON.stringify(paymentFields || {}));

      Object.entries(paymentFiles).forEach(([key, file]) => {
        if (file instanceof File) {
          formData.append(`payment_files[${key}]`, file, file.name);
        }
      });

      const result = await submitCommissionPayment(accessToken, formData);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to submit commission payment");
      }

      toast.success(result?.message || "Commission payment submitted.");
      setPaymentFields({});
      setPaymentFiles({});
      await loadData();
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      toast.error(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message || "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <TableLoading />
      </div>
    );
  }

  const summary = payload?.summary || {};
  const charges = payload?.charges || [];
  const payments = payload?.payments || [];
  const currentPlan = payload?.current_plan;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Commission Billing</h2>
          <p className="mt-1 text-sm text-slate-500">Pay outstanding commission generated from ecommerce orders and track settlement history.</p>
        </div>
        <Link to="/subscription/plans" className="btn btn-primary">
          <PiCoins size={18} />
          Change Plan
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Current Plan</p>
          <h3 className="mt-2 text-lg font-bold text-slate-950">{currentPlan?.name || "Commission plan"}</h3>
          <p className="mt-1 text-sm text-slate-500">Rate: {Number(currentPlan?.commission_rate || 0).toFixed(2)}{currentPlan?.commission_type === "fixed" ? "" : "%"}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-700">Payable</p>
          <h3 className="mt-2 text-lg font-bold text-amber-900">{formatAmount(summary.total_payable)}</h3>
          <p className="mt-1 text-sm text-amber-800">Outstanding commission due now.</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-blue-700">Submitted</p>
          <h3 className="mt-2 text-lg font-bold text-blue-900">{formatAmount(summary.submitted_amount)}</h3>
          <p className="mt-1 text-sm text-blue-800">Payments waiting for backoffice approval.</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-emerald-700">Paid</p>
          <h3 className="mt-2 text-lg font-bold text-emerald-900">{formatAmount(summary.paid_amount)}</h3>
          <p className="mt-1 text-sm text-emerald-800">Approved and received by backoffice.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <PiReceipt size={22} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-950">Outstanding order commissions</h3>
              <p className="text-sm text-slate-500">Each ecommerce order creates a payable commission based on your active plan.</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Base</th>
                  <th>Commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {charges.length ? (
                  charges.map((charge) => (
                    <tr key={charge.id}>
                      <td>{charge.order_no || charge.order_id}</td>
                      <td>{formatAmount(charge.base_amount)}</td>
                      <td>{formatAmount(charge.commission_amount)}</td>
                      <td>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          charge.status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : charge.status === "submitted"
                              ? "bg-blue-100 text-blue-700"
                              : charge.status === "void"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-amber-100 text-amber-700"
                        }`}>
                          {charge.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-500">No commission charges found yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-violet-50 text-violet-700">
              <PiBank size={22} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-950">Pay backoffice</h3>
              <p className="text-sm text-slate-500">Choose a bank or MFS method and follow the settlement instructions.</p>
            </div>
          </div>

          {gateways.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No active commission settlement methods are configured in backoffice yet.
            </div>
          ) : (
            <>
              <div className="mt-4">
                <label className="mb-2 block text-sm font-semibold text-slate-900">Settlement method</label>
                <select className="select select-bordered w-full" value={selectedGatewayId} onChange={(e) => setSelectedGatewayId(e.target.value)}>
                  {gateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>{gateway.name}</option>
                  ))}
                </select>
              </div>

              {selectedGateway?.description && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {selectedGateway.description}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {manualParams.length ? manualParams.map((param, index) => {
                  const fieldName = param?.name || `field_${index}`;
                  const fieldLabel = param?.label || fieldName;
                  const fieldType = param?.type || "text";

                  if (fieldType === "textarea") {
                    return (
                      <label key={fieldName} className="block">
                        <p className="mb-2 text-sm font-semibold text-slate-900">{fieldLabel}</p>
                        <textarea
                          rows={4}
                          className="textarea textarea-bordered w-full"
                          value={paymentFields[fieldName] || ""}
                          onChange={(e) => handlePaymentFieldChange(fieldName, e.target.value)}
                        />
                      </label>
                    );
                  }

                  if (fieldType === "file") {
                    return (
                      <label key={fieldName} className="block">
                        <p className="mb-2 text-sm font-semibold text-slate-900">{fieldLabel}</p>
                        <input
                          type="file"
                          className="file-input file-input-bordered w-full"
                          onChange={(e) => handlePaymentFileChange(fieldName, e.target.files?.[0])}
                        />
                      </label>
                    );
                  }

                  return (
                    <label key={fieldName} className="block">
                      <p className="mb-2 text-sm font-semibold text-slate-900">{fieldLabel}</p>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={paymentFields[fieldName] || ""}
                        onChange={(e) => handlePaymentFieldChange(fieldName, e.target.value)}
                      />
                    </label>
                  );
                }) : (
                  <p className="text-sm text-slate-500">This method does not require extra fields.</p>
                )}
              </div>

              <button type="button" className="btn btn-primary mt-5 w-full" disabled={submitting || Number(summary.total_payable || 0) <= 0} onClick={submitPayment}>
                <PiUpload size={18} />
                {submitting ? "Submitting..." : "Submit Payment"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-base font-bold text-slate-950">Settlement History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>TRX</th>
                <th>Gateway</th>
                <th>Payable</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-mono text-xs">{payment.trx}</td>
                    <td>{payment.gateway_name || payment.gateway?.name || "-"}</td>
                    <td>{formatAmount(payment.payable_amount, payment.currency?.code || "")}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        payment.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : payment.status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">No settlement requests submitted yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

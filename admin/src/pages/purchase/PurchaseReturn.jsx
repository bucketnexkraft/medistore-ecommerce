import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { PiMagnifyingGlass, PiPlus, PiX } from "react-icons/pi";
import { toast } from "react-toastify";
import { addPurchaseReturnPayment, getPurchaseReturns } from "../../api/purchase";
import { formatPrice } from "../../hooks/currency";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";

const paymentStatusLabel = (status) => {
  if (Number(status) === 1) return "Paid";
  if (Number(status) === 2) return "Partial";
  return "Unpaid";
};

export default function PurchaseReturn() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [data, setData] = useState({ data: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loadData, setLoadData] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "Cash",
    transaction_date: new Date().toISOString().split("T")[0],
    note: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPurchaseReturns(accessToken, {
        page: currentPage,
        perPage: 20,
        search,
      });

      if (!result?.status) {
        throw new Error(result?.error?.message || result?.message || "Failed to fetch purchase returns");
      }

      setData({
        data: result.data || [],
        meta: result.meta || {},
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, search]);

  useEffect(() => {
    if (loadData) {
      fetchData();
    }
  }, [fetchData, loadData]);

  const openDetails = (row) => {
    setSelectedReturn(row);
    setShowPaymentForm(false);
    setPaymentError("");
    setPaymentForm({
      amount: Number(row?.due_amount || 0) > 0 ? Number(row.due_amount).toFixed(2) : "",
      payment_method: "Cash",
      transaction_date: new Date().toISOString().split("T")[0],
      note: "",
    });
  };

  const submitPayment = async () => {
    if (!selectedReturn) return;

    const amount = Number(paymentForm.amount || 0);
    const remainingDue = Number(selectedReturn.due_amount || 0);

    if (amount <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }

    if (amount > remainingDue) {
      setPaymentError(`Payment cannot exceed remaining due ${formatPrice(remainingDue)}.`);
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");

    try {
      const result = await addPurchaseReturnPayment(accessToken, selectedReturn.id, paymentForm);

      if (!result?.status) {
        throw new Error(result?.error?.message || result?.message || "Failed to add payment");
      }

      setSelectedReturn(result.data);
      setShowPaymentForm(false);
      setPaymentForm({
        amount: Number(result.data?.due_amount || 0) > 0 ? Number(result.data.due_amount).toFixed(2) : "",
        payment_method: "Cash",
        transaction_date: new Date().toISOString().split("T")[0],
        note: "",
      });
      setData((prev) => ({
        ...prev,
        data: (prev.data || []).map((row) => (row.id === result.data.id ? result.data : row)),
      }));
      toast.success("Purchase return payment added");
      setLoadData(true);
    } catch (error) {
      setPaymentError(error.message || "Failed to add payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Purchase Return</h2>
        <p className="text-sm text-gray-600">
          Review purchase return invoices, refund progress, and returned items.
        </p>

        <div className="w-full max-w-3xl mt-4 rounded-lg border">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search by return invoice, original invoice, supplier, or product"
              className="input w-full pr-16"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setCurrentPage(1);
                  setLoadData(true);
                }
              }}
            />
            <button
              className="absolute right-2 text-gray-500 hover:text-primary"
              onClick={() => {
                setCurrentPage(1);
                setLoadData(true);
              }}
            >
              <PiMagnifyingGlass size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm py-4">
        <div className="px-4 mb-2">
          <h5 className="font-semibold text-custom-gray-400">Return History</h5>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th>Return Invoice</th>
                    <th>Date</th>
                    <th>Original Invoice</th>
                    <th>Supplier</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Settled</th>
                    <th>Pending Refund</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length > 0 ? (
                    data.data.map((row) => (
                      <tr key={row.id}>
                        <td className="font-medium text-primary">{row.invoice_no}</td>
                        <td>{new Date(row.date).toLocaleDateString()}</td>
                        <td>{row.reference_invoice_no || "N/A"}</td>
                        <td>{row.supplier?.name || "N/A"}</td>
                        <td>{row.qty}</td>
                        <td>{formatPrice(row.total)}</td>
                        <td>{formatPrice(row.paid_amount)}</td>
                        <td>{formatPrice(row.due_amount)}</td>
                        <td>
                          <span className="badge badge-outline">
                            {paymentStatusLabel(row.payment_status)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => openDetails(row)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="text-center py-4">
                        No purchase returns found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {data.data.length > 0 && (
                <Pagination
                  currentPage={data.meta.current_page || 1}
                  lastPage={data.meta.last_page || 1}
                  handlePrevious={() => {
                    setCurrentPage((prev) => Math.max(prev - 1, 1));
                    setLoadData(true);
                  }}
                  handlePageChange={(page) => {
                    setCurrentPage(page);
                    setLoadData(true);
                  }}
                  handleNextPage={() => {
                    setCurrentPage((prev) => prev + 1);
                    setLoadData(true);
                  }}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < (data.meta.last_page || 1)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold">Purchase Return Details</h3>
                <p className="text-sm text-gray-500">
                  {selectedReturn.invoice_no} • Original: {selectedReturn.reference_invoice_no || "N/A"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setSelectedReturn(null)}
              >
                <PiX size={20} />
              </button>
            </div>

            <div className="grid gap-4 border-b px-6 py-4 md:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Date</div>
                <div className="font-medium">{new Date(selectedReturn.date).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Supplier</div>
                <div className="font-medium">{selectedReturn.supplier?.name || "N/A"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Settled</div>
                <div className="font-medium">{formatPrice(selectedReturn.paid_amount)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                <div className="font-medium">{paymentStatusLabel(selectedReturn.payment_status)}</div>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto px-6 py-4">
              <div className="mb-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="font-semibold">Payment Log</h4>
                  {Number(selectedReturn.due_amount || 0) > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setShowPaymentForm((prev) => !prev);
                        setPaymentError("");
                      }}
                    >
                      <PiPlus size={16} /> Add Payment
                    </button>
                  )}
                </div>

                {showPaymentForm && (
                  <div className="mb-4 rounded-xl border p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-sm font-medium">Amount</div>
                        <input
                          type="number"
                          min="0.01"
                          max={selectedReturn.due_amount}
                          step="0.01"
                          className="input input-bordered w-full"
                          value={paymentForm.amount}
                          onChange={(event) =>
                            setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-sm font-medium">Payment Method</div>
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          value={paymentForm.payment_method}
                          onChange={(event) =>
                            setPaymentForm((prev) => ({ ...prev, payment_method: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-sm font-medium">Transaction Date</div>
                        <input
                          type="date"
                          className="input input-bordered w-full"
                          value={paymentForm.transaction_date}
                          onChange={(event) =>
                            setPaymentForm((prev) => ({ ...prev, transaction_date: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-sm font-medium">Note</div>
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          value={paymentForm.note}
                          onChange={(event) =>
                            setPaymentForm((prev) => ({ ...prev, note: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    {paymentError && <p className="mt-3 text-sm text-red-500">{paymentError}</p>}
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setShowPaymentForm(false);
                          setPaymentError("");
                        }}
                        disabled={paymentLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm btn-primary ${paymentLoading ? "loading" : ""}`}
                        onClick={submitPayment}
                        disabled={paymentLoading}
                      >
                        Save Payment
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {Number(selectedReturn.due_adjustment_amount || 0) > 0 && (
                    <div className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">Adjusted Against Original Purchase Due</div>
                          <div className="text-sm text-gray-500">
                            Reduced the unpaid supplier balance from the original purchase
                          </div>
                        </div>
                        <div className="font-medium">{formatPrice(selectedReturn.due_adjustment_amount)}</div>
                      </div>
                    </div>
                  )}

                  {selectedReturn.transactions?.map((transaction) => (
                    <div key={transaction.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{transaction.payment_method || "Cash Refund"}</div>
                          <div className="text-sm text-gray-500">
                            {transaction.transaction_date
                              ? new Date(transaction.transaction_date).toLocaleDateString()
                              : "No date"}
                          </div>
                        </div>
                        <div className="font-medium">{formatPrice(transaction.amount)}</div>
                      </div>
                    </div>
                  ))}

                  {Number(selectedReturn.due_amount || 0) > 0 && (
                    <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">Remaining Pending Amount</div>
                          <div className="text-sm text-gray-500">
                            Supplier still needs to refund this amount
                          </div>
                        </div>
                        <div className="font-medium">{formatPrice(selectedReturn.due_amount)}</div>
                      </div>
                    </div>
                  )}

                  {Number(selectedReturn.due_adjustment_amount || 0) <= 0 &&
                    (!selectedReturn.transactions || selectedReturn.transactions.length === 0) &&
                    Number(selectedReturn.due_amount || 0) <= 0 && (
                      <div className="rounded-xl border p-4 text-sm text-gray-500">
                        No payment log available for this return yet.
                      </div>
                    )}
                </div>
              </div>

              <h4 className="mb-4 font-semibold">Returned Items</h4>
              <div className="space-y-3">
                {selectedReturn.items?.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-gray-500">{item.product_code || "No code"}</div>
                      </div>
                      <div className="text-sm font-medium">{formatPrice(item.total)}</div>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-gray-600 md:grid-cols-3">
                      <div>Qty: {item.qty}</div>
                      <div>Lot: {item.lot_number || "N/A"}</div>
                      <div>Unit Price: {formatPrice(item.unit_price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t px-6 py-4">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedReturn(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

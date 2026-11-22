import { useState } from "react";
import { BiSearch } from "react-icons/bi";
import {
  PiBarcode,
  PiCalendar,
  PiInfo,
  PiReceipt,
  PiShieldCheck,
  PiUser,
  PiX,
} from "react-icons/pi";
import { useSelector } from "react-redux";
import { verifyProductReturn } from "../../api/report";
import { formatPrice } from "../../hooks/currency";

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]";

const formatDate = (dateString, fallback = "N/A") => {
  if (!dateString) return fallback;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString();
};

const formatDateTime = (dateString, fallback = "N/A") => {
  if (!dateString) return fallback;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString();
};

const toPlainText = (value) => String(value || "").replace(/<[^>]*>/g, "").trim();

const formatVariant = (variantValue) => {
  if (!variantValue) return "N/A";
  if (typeof variantValue === "object") {
    return Object.entries(variantValue)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  }

  const raw = String(variantValue).trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
    }
  } catch {
    // Ignore invalid JSON and use the raw value below.
  }

  return raw;
};

export default function ProductReturnVerification() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [searchValue, setSearchValue] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (event) => {
    event.preventDefault();

    if (!searchValue.trim()) {
      setError("Please enter an invoice number or barcode");
      setResults([]);
      setSearched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await verifyProductReturn(accessToken, {
        search_value: searchValue.trim(),
      });

      if (response.status === false) {
        setError(response.message || "Unable to verify this record");
        setResults([]);
        return;
      }

      setResults(response.data || []);
    } catch (err) {
      setError(err.message || "Failed to verify product return");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchValue("");
    setResults([]);
    setError(null);
    setSearched(false);
  };

  const totalRows = results.length;
  const returnedRows = results.filter((item) => item.is_returned).length;
  const pendingRows = totalRows - returnedRows;
  const totalInvoiceValue = results.reduce(
    (sum, item) => sum + Number(item.invoice_total || 0),
    0
  );

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(248,250,252,0.9),rgba(255,255,255,1))]" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <PiShieldCheck size={14} />
              Verification
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Product return verification
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Search an invoice number or barcode to confirm sale details, return status, and item context.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:min-w-[720px]">
            <div className={cardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Records
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {totalRows.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Matches found from the latest search</p>
            </div>
            <div className={cardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Returned
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                {returnedRows.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Fully or partially returned items</p>
            </div>
            <div className={cardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Pending
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {pendingRows.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Items with no return recorded</p>
            </div>
            <div className={cardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Invoice value
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {formatPrice(totalInvoiceValue)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Total value of the current result set</p>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search invoice or barcode
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Enter invoice number or barcode"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  autoFocus
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Search"
                  >
                    <BiSearch size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
                    aria-label="Reset"
                  >
                    <PiX size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:pt-7">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border-0 bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <BiSearch size={18} />
                {loading ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <PiX size={16} />
                Reset
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex items-start gap-3">
              <PiInfo className="mt-0.5 shrink-0" size={18} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex min-h-[240px] items-center justify-center rounded-[1.75rem] border border-slate-200/80 bg-white">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
              <p className="text-sm text-slate-500">Searching records...</p>
            </div>
          </div>
        )}

        {searched && !loading && (
          <div className="space-y-4">
            {results.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">
                      Found {results.length} record{results.length !== 1 ? "s" : ""}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Review the sale, customer, and return status for each match.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    <PiCalendar size={14} />
                    Latest search
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        <th className="px-4 py-4">Invoice</th>
                        <th className="px-4 py-4">Product</th>
                        <th className="px-4 py-4">Customer</th>
                        <th className="px-4 py-4">Sale</th>
                        <th className="px-4 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((item, index) => {
                        const returnedQty = Number(item.returned_qty || 0);
                        const soldQty = Number(item.quantity || 0);
                        const isFullyReturned = item.is_returned && returnedQty >= soldQty;
                        const isPartialReturned = item.is_returned && returnedQty < soldQty;

                        return (
                          <tr key={index} className="border-b border-slate-100">
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-2xl bg-slate-100 p-2 text-slate-500">
                                  <PiReceipt size={18} />
                                </div>
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-950">#{item.invoice_no}</div>
                                  <div className="text-xs text-slate-500">
                                    {formatDate(item.invoice_date)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Sold by: {item.sold_by || "N/A"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <div className="space-y-2">
                                <div className="font-semibold text-slate-950">
                                  {item.product_name || "N/A"}
                                </div>
                                {item.product_description && (
                                  <div className="max-w-md text-xs leading-6 text-slate-500">
                                    {toPlainText(item.product_description)}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                                    <PiBarcode size={12} />
                                    {item.product_code || "N/A"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                                    <PiBarcode size={12} />
                                    {item.barcode || "N/A"}
                                  </span>
                                </div>
                                {(item.category || item.brand || item.variant) && (
                                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                    {item.category && (
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                        Cat: {item.category}
                                      </span>
                                    )}
                                    {item.brand && (
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                        Brand: {item.brand}
                                      </span>
                                    )}
                                    {item.variant && (
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                        Var: {formatVariant(item.variant)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 font-semibold text-slate-950">
                                  <PiUser size={16} className="text-slate-400" />
                                  {item.customer_name || "N/A"}
                                </div>
                                {item.customer_phone && (
                                  <div className="text-xs text-slate-500">{item.customer_phone}</div>
                                )}
                                {item.customer_email && (
                                  <div className="text-xs text-slate-500">{item.customer_email}</div>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1">
                                <div className="text-xs text-slate-500">Qty: {item.quantity ?? 0}</div>
                                <div className="text-xs text-slate-500">
                                  Price: {formatPrice(item.unit_price || 0)}
                                </div>
                                {Number(item.discount_amount || 0) > 0 && (
                                  <div className="text-xs text-amber-600">
                                    Discount: {formatPrice(item.discount_amount || 0)}
                                  </div>
                                )}
                                <div className="font-semibold text-slate-950">
                                  Total: {formatPrice(item.total || 0)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {formatDateTime(item.created_at)}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <div className="space-y-2">
                                {isFullyReturned ? (
                                  <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                    Returned
                                  </span>
                                ) : isPartialReturned ? (
                                  <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                    Partial returned
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    Not returned
                                  </span>
                                )}
                                <div className="text-xs text-slate-500">
                                  Returned qty: {returnedQty}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Invoice total: {formatPrice(item.invoice_total || 0)}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-[1.75rem] border border-slate-200/80 bg-white px-6 py-12 text-center shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <BiSearch size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-950">No records found</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    No sales records found for &quot;{searchValue}&quot;.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

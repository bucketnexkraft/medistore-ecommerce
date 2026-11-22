import PropTypes from "prop-types";
import { Dialog } from "@headlessui/react";
import { formatPrice } from "../../hooks/currency";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return dateString;
  }
};

const paymentStatusLabel = (status) => {
  if (status === 1) return "Paid";
  if (status === 2) return "Due";
  return "Unpaid";
};

const PrintableInvoiceList = ({
  open,
  onClose,
  invoices,
  filters,
  generatedAt,
}) => {
  const isQuotationList =
    filters.type === "quotation" ||
    (invoices.length > 0 &&
      invoices.every((invoice) => invoice.type === "quotation"));
  const hasAnyFilter =
    Boolean(filters.search) ||
    Boolean(filters.type) ||
    (!isQuotationList && Boolean(filters.status)) ||
    Boolean(filters.dateRange);

  const handlePrint = () => {
    window.print();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
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

          #headlessui-portal-root .invoice-list-print-wrapper,
          #headlessui-portal-root .invoice-list-print-wrapper * {
            visibility: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .invoice-list-print-wrapper {
            position: static !important;
            inset: auto !important;
            z-index: auto !important;
            background: #fff !important;
            padding: 0 !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
          }

          .invoice-list-print-panel {
            margin: 0 !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .invoice-list-print-actions {
            display: none !important;
          }

          .invoice-list-print-table thead {
            display: table-header-group;
          }

          .invoice-list-print-table tr {
            break-inside: avoid;
          }

          @page {
            margin: 10mm;
            size: auto;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/30 no-print" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-8 invoice-list-print-wrapper">
        <Dialog.Panel className="w-full max-w-6xl bg-white rounded-xl overflow-y-auto max-h-[90vh] invoice-list-print-panel">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isQuotationList ? "Quotation List" : "Invoice List"}
                </h2>
                <p className="text-sm text-gray-500">
                  Generated: {formatDate(generatedAt)}
                </p>
                <p className="text-sm text-gray-500">
                  Total rows: {invoices.length}
                </p>
              </div>
              {hasAnyFilter && (
                <div className="text-sm text-gray-600">
                  {filters.search && (
                    <p>
                      <strong>Search:</strong> {filters.search}
                    </p>
                  )}
                  {filters.type && (
                    <p>
                      <strong>Type:</strong> {filters.type}
                    </p>
                  )}
                  {!isQuotationList && filters.status && (
                    <p>
                      <strong>Status:</strong> {filters.status}
                    </p>
                  )}
                  {filters.dateRange && (
                    <p>
                      <strong>Date:</strong> {filters.dateRange}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="table w-full invoice-list-print-table">
                <thead className="bg-gray-100">
                  <tr>
                    <th>{isQuotationList ? "Quotation No" : "Invoice No"}</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Bill To</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">Total</th>
                    {!isQuotationList && (
                      <>
                        <th className="text-right">Paid</th>
                        <th className="text-right">Due</th>
                        <th>Payment</th>
                        <th>Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoice_no || "N/A"}</td>
                      <td>{formatDate(invoice.date)}</td>
                      <td className="capitalize">{invoice.type || "N/A"}</td>
                      <td>
                        {invoice.customer?.name ||
                          invoice.supplier?.name ||
                          "N/A"}
                      </td>
                      <td className="text-right">{invoice.qty || 0}</td>
                      <td className="text-right">
                        {formatPrice(invoice.discount || 0)}
                      </td>
                      <td className="text-right">
                        {formatPrice(invoice.total || 0)}
                      </td>
                      {!isQuotationList && (
                        <>
                          <td className="text-right">
                            {formatPrice(invoice.paid_amount || 0)}
                          </td>
                          <td className="text-right">
                            {formatPrice(invoice.due_amount || 0)}
                          </td>
                          <td>{invoice.payment_method || "N/A"}</td>
                          <td>{paymentStatusLabel(invoice.payment_status)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="h-20 no-print" />

            <div className="invoice-list-print-actions no-print sticky bottom-0 bg-white border-t border-gray-200 pt-3 pb-2 mt-2 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>
                Print
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

PrintableInvoiceList.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invoices: PropTypes.arrayOf(PropTypes.object).isRequired,
  filters: PropTypes.shape({
    search: PropTypes.string,
    type: PropTypes.string,
    status: PropTypes.string,
    dateRange: PropTypes.string,
  }).isRequired,
  generatedAt: PropTypes.string.isRequired,
};

export default PrintableInvoiceList;

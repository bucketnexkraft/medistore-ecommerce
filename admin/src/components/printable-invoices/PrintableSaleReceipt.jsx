import { useRef } from "react";
import PropTypes from "prop-types";
import { Dialog } from "@headlessui/react";
import Barcode from "react-barcode";
import { formatPrice } from "../../hooks/currency";
import { useTranslation } from "react-i18next";

const PrintableSaleReceipt = ({
  invoice,
  withCustomerInfo,
  onClose,
  companyInfo = {},
  isDraft,
}) => {
  const invoiceRef = useRef(null);
  const { t } = useTranslation();
  const tr = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated === key ? fallback : translated;
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return dateString || "N/A";
      const options = { year: "numeric", month: "short", day: "numeric" };
      return date.toLocaleDateString(undefined, options);
    } catch {
      return dateString || "N/A";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!invoice) return null;

  const isSale = invoice.type === "sale";
  const isQuotation = invoice.type === "quotation";
  const invoiceTitle = isQuotation
    ? tr("invoice.quotation", "Quotation")
    : isSale
      ? tr("invoice.salesInvoice", "Sales Invoice")
      : tr("invoice.purchaseInvoice", "Purchase Invoice");
  const documentNumberLabel = isQuotation
    ? tr("invoice.quotationNo", "Quotation No")
    : tr("invoice.invoiceNumber", "Invoice No");
  const partyLabel = isQuotation
    ? tr("invoice.quotedTo", "Quoted To")
    : isSale
      ? tr("invoice.billTo", "Bill To")
      : tr("invoice.receivedFrom", "Received From");
  const totalLabel = isQuotation
    ? tr("invoice.quotationTotal", "Quotation Total")
    : tr("invoice.total", "Total");
  const footerNote = isQuotation
    ? (companyInfo.quotationFooterNote ||
      tr("invoice.defaultQuotationFooterNote", "This quotation is subject to stock availability and final confirmation."))
    : (companyInfo.footerNote || tr("invoice.defaultFooterNote", "Thank you for your business!"));

  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const addDays = (dateString, days) => {
    const date = dateString ? new Date(dateString) : new Date();
    if (Number.isNaN(date.getTime())) return "N/A";
    date.setDate(date.getDate() + days);
    return formatDate(date.toISOString());
  };

  const getItemName = (item) => {
    const isBundle = item.item_type === "bundle" || !!item.bundle_id;
    return (
      item.product?.name ||
      item.name ||
      item.product_name ||
      item.bundle_name ||
      (isBundle ? "Bundle Item" : "N/A")
    );
  };

  const getBundleComponentsText = (item) => {
    const isBundle = item.item_type === "bundle" || !!item.bundle_id;
    return isBundle &&
      Array.isArray(item.bundle_components) &&
      item.bundle_components.length > 0
      ? item.bundle_components
          .map(
            (component) =>
              `${component.product_name} x${Number(component.quantity_per_bundle || 0)}`
          )
          .join(" | ")
      : "";
  };

  const formatDescription = (value) => {
    if (!value) return "";

    return String(value)
      .replace(/<\/(p|div|li|h[1-6]|br)>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  };

  const quotationValidityDays = Number(companyInfo.quotationValidityDays || 7);
  const quotationValidUntil =
    companyInfo.quotationValidUntil || addDays(invoice.date, quotationValidityDays);
  const quotationPaymentTerms =
    companyInfo.quotationPaymentTerms ||
    tr("invoice.defaultQuotationPaymentTerms", "Payment terms to be confirmed before order approval.");
  const quotationDeliveryTerms =
    companyInfo.quotationDeliveryTerms ||
    tr("invoice.defaultQuotationDeliveryTerms", "Delivery schedule depends on product availability and customer confirmation.");

  const QuotationContent = () => (
    <div className="quotation-document">
      <div className="quotation-topbar" />

      <div className="quotation-header">
        <div>
          <div className="quotation-company-name">
            {companyInfo.name || tr("invoice.companyName", "Company")}
          </div>
          <div className="quotation-company-meta">
            {companyInfo.address && <div>{companyInfo.address}</div>}
            {companyInfo.phone && <div>{tr("invoice.phone", "Phone")}: {companyInfo.phone}</div>}
            {companyInfo.email && <div>{companyInfo.email}</div>}
          </div>
        </div>
        <div className="quotation-title-block">
          <div className="quotation-title">{tr("invoice.quotation", "Quotation")}</div>
          <div className="quotation-subtitle">{tr("invoice.notTaxInvoice", "Not a tax invoice")}</div>
        </div>
      </div>

      <div className="quotation-meta-grid">
        <div className="quotation-party">
          <span>{partyLabel}</span>
          <strong>{invoice.customer?.name || "Walk-in Customer"}</strong>
          {invoice.customer?.phone && <div>{tr("invoice.phone", "Phone")}: {invoice.customer.phone}</div>}
          {invoice.customer?.email && <div>{invoice.customer.email}</div>}
          {invoice.customer?.address && <div>{invoice.customer.address}</div>}
        </div>
        <div className="quotation-meta">
          <div>
            <span>{documentNumberLabel}</span>
            <strong>{invoice.invoice_no || "N/A"}</strong>
          </div>
          <div>
            <span>{tr("invoice.date", "Date")}</span>
            <strong>{formatDate(invoice.date)}</strong>
          </div>
          <div>
            <span>{tr("invoice.validUntil", "Valid Until")}</span>
            <strong>{quotationValidUntil}</strong>
          </div>
        </div>
      </div>

      <table className="quotation-items-table">
        <thead>
          <tr>
            <th>{tr("invoice.table.item", "Item")}</th>
            <th>{tr("invoice.description", "Description")}</th>
            <th className="text-right">{tr("invoice.qty", "Qty")}</th>
            <th className="text-right">{tr("invoice.table.price", "Unit Price")}</th>
            <th className="text-right">{tr("invoice.total", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, index) => {
            const itemName = getItemName(item);
            const components = getBundleComponentsText(item);
            const quantity = toNumber(item.qty ?? item.quantity);
            const unitPrice = toNumber(item.unit_price ?? item.price);
            const lineTotal = toNumber(item.total) || quantity * unitPrice;
            const productCode =
              invoice?.history?.[index]?.barcode || item?.product?.code || item.code;

            return (
              <tr key={index}>
                <td>
                  <strong>{itemName}</strong>
                  {productCode && (
                    <small>{tr("invoice.productCode", "Code")}: {productCode}</small>
                  )}
                </td>
                <td>
                  {components ||
                    formatDescription(item.product?.description || item.description) ||
                    tr("invoice.standardSupply", "Supply as specified")}
                </td>
                <td className="text-right">{quantity}</td>
                <td className="text-right">{formatPrice(unitPrice)}</td>
                <td className="text-right">{formatPrice(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="quotation-summary">
        <div className="quotation-terms">
          <div>
            <span>{tr("invoice.paymentTerms", "Payment Terms")}</span>
            <p>{quotationPaymentTerms}</p>
          </div>
          <div>
            <span>{tr("invoice.deliveryTerms", "Delivery Terms")}</span>
            <p>{quotationDeliveryTerms}</p>
          </div>
          <div>
            <span>{tr("invoice.note", "Note")}</span>
            <p>{invoice.note || footerNote}</p>
          </div>
        </div>
        <div className="quotation-totals">
          <div>
            <span>{tr("invoice.subtotal", "Subtotal")}</span>
            <strong>{formatPrice(invoice.sub_total || 0)}</strong>
          </div>
          {toNumber(invoice.discount) > 0 && (
            <div>
              <span>{tr("invoice.discount", "Discount")}</span>
              <strong>-{formatPrice(invoice.discount)}</strong>
            </div>
          )}
          {toNumber(invoice.vat || invoice.tax) > 0 && (
            <div>
              <span>{tr("invoice.totalTax", "Tax")}</span>
              <strong>{formatPrice(toNumber(invoice.vat || invoice.tax))}</strong>
            </div>
          )}
          <div className="quotation-grand-total">
            <span>{totalLabel}</span>
            <strong>{formatPrice(invoice.total || 0)}</strong>
          </div>
        </div>
      </div>

      <div className="quotation-signatures">
        <div>
          <span />
          <strong>{tr("invoice.preparedBy", "Prepared By")}</strong>
        </div>
        <div>
          <span />
          <strong>{tr("invoice.customerApproval", "Customer Approval")}</strong>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={!!invoice} onClose={onClose} className="relative z-50">
      <style>{`
        @media print {
          #root {
            display: none !important;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-row-group;
            break-inside: avoid;
          }
          .print-container {
            position: static !important;
            padding: 0 !important;
            display: block !important;
          }
          .print-panel {
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            max-height: none !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .print-panel tr {
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: ${isQuotation ? "A4" : "auto"};
            margin: ${isQuotation ? "12mm" : "0 1cm"};
          }
        }
        .quotation-document {
          width: 100%;
          margin: 0 auto;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
          line-height: 1.45;
        }
        .quotation-topbar {
          height: 6px;
          background: #0f766e;
          margin-bottom: 22px;
        }
        .quotation-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid #d1d5db;
        }
        .quotation-company-name {
          font-size: 22px;
          font-weight: 800;
          color: #111827;
        }
        .quotation-company-meta {
          margin-top: 6px;
          color: #4b5563;
        }
        .quotation-title-block {
          text-align: right;
          flex-shrink: 0;
        }
        .quotation-title {
          font-size: 28px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        .quotation-subtitle {
          color: #6b7280;
          font-size: 12px;
          margin-top: 2px;
        }
        .quotation-meta-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: 24px;
          margin: 24px 0;
        }
        .quotation-party,
        .quotation-meta {
          border: 1px solid #d1d5db;
          padding: 14px;
          border-radius: 6px;
        }
        .quotation-party span,
        .quotation-terms span {
          display: block;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .quotation-party strong {
          display: block;
          font-size: 16px;
          margin-bottom: 6px;
        }
        .quotation-meta div,
        .quotation-totals div {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 5px 0;
        }
        .quotation-meta span {
          color: #6b7280;
        }
        .quotation-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        .quotation-items-table th {
          background: #f3f4f6;
          color: #374151;
          font-size: 11px;
          text-transform: uppercase;
          text-align: left;
          padding: 10px 8px;
          border-bottom: 1px solid #d1d5db;
        }
        .quotation-items-table td {
          padding: 12px 8px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }
        .quotation-items-table small {
          display: block;
          color: #6b7280;
          margin-top: 3px;
        }
        .text-right {
          text-align: right !important;
        }
        .quotation-summary {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 24px;
          margin-top: 24px;
        }
        .quotation-terms {
          color: #374151;
        }
        .quotation-terms div {
          margin-bottom: 12px;
        }
        .quotation-terms p {
          margin: 0;
        }
        .quotation-totals {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 12px;
          align-self: start;
        }
        .quotation-grand-total {
          margin-top: 8px;
          padding-top: 12px !important;
          border-top: 2px solid #111827;
          font-size: 18px;
        }
        .quotation-signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          margin-top: 52px;
        }
        .quotation-signatures span {
          display: block;
          border-top: 1px solid #111827;
          margin-bottom: 8px;
        }
        .quotation-signatures strong {
          font-size: 12px;
          color: #374151;
        }
        @media (max-width: 640px) {
          .quotation-header,
          .quotation-meta-grid,
          .quotation-summary,
          .quotation-signatures {
            grid-template-columns: 1fr;
            flex-direction: column;
          }
          .quotation-title-block {
            text-align: left;
          }
        }
      `}</style>
      <div className="fixed inset-0 bg-black/30 no-print" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-8 print-container">
        <Dialog.Panel className="w-full max-w-5xl bg-white rounded-xl overflow-y-auto max-h-[90vh] print-panel">
          <div
            ref={invoiceRef}
            id="invoice"
            className="max-w-4xl mx-auto p-4 sm:p-6 bg-white rounded my-2 font-alata text-gray-900 text-sm"
            style={{ minWidth: "280px" }}
          >
            {isQuotation ? (
              <QuotationContent />
            ) : (
              <>
            {/* Invoice Info Section */}
            <div className="flex flex-col sm:flex-row sm:justify-between mt-6 gap-4 billing-section">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                  {invoiceTitle}
                </h2>
                <p className="text-xs sm:text-sm">
                  <strong className="text-gray-900">
                    {documentNumberLabel}:
                  </strong>{" "}
                  <span className="text-gray-500">
                    {invoice.invoice_no || "N/A"}
                  </span>
                </p>
                <p className="text-xs sm:text-sm mt-1">
                  <strong className="text-gray-900">
                    {tr("invoice.date", "Date")}:
                  </strong>{" "}
                  <span className="text-gray-500">
                    {formatDate(invoice.date)}
                  </span>
                </p>
                {withCustomerInfo && (invoice.customer || invoice.supplier) && (
                  <>
                    <p className="font-bold text-gray-800 text-xs sm:text-sm mt-2">
                      {partyLabel}:
                    </p>
                    <p className="text-gray-500 text-xs sm:text-sm">
                      {(isSale
                        ? invoice.customer?.name
                        : invoice.supplier?.name) || "N/A"}
                    </p>
                    {(isSale
                      ? invoice.customer?.email
                      : invoice.supplier?.email) && (
                      <p className="text-gray-500 text-xs sm:text-sm">
                        {isSale
                          ? invoice.customer?.email
                          : invoice.supplier?.email}
                      </p>
                    )}
                    {(isSale
                      ? invoice.customer?.phone
                      : invoice.supplier?.phone) && (
                      <p className="text-gray-500 text-xs sm:text-sm">
                        {tr("common.tel", "Tel")}:{" "}
                        {isSale
                          ? invoice.customer?.phone
                          : invoice.supplier?.phone}
                      </p>
                    )}
                    {(isSale
                      ? invoice.customer?.address
                      : invoice.supplier?.address) && (
                      <p className="text-gray-500 text-xs sm:text-sm">
                        {isSale
                          ? invoice.customer?.address
                          : invoice.supplier?.address}
                      </p>
                    )}
                  </>
                )}
              </div>
              {withCustomerInfo && (invoice.customer || invoice.supplier) ? (
                <div className="sm:text-right">
                  {!isDraft && (
                    <>
                      <div className="flex justify-end">
                        {companyInfo.logo ? (
                          <img
                            src={companyInfo.logo}
                            alt={tr("common.logo", "Logo")}
                            className="mb-2 sm:mb-2 invoice-logo-img max-h-16 sm:max-h-[100px]"
                          />
                        ) : (
                          <div className="h-16 sm:h-[100px] w-16 sm:w-[100px] bg-teal-600 rounded flex items-center justify-center text-white text-sm sm:text-lg font-bold">
                            {tr("common.logo", "Logo")}
                          </div>
                        )}
                      </div>
                      <p className="text-base sm:text-lg font-bold text-gray-900">
                        {companyInfo.name || tr("company.yourBusiness", "Your Business")}
                      </p>
                      <p className="text-gray-500 text-xs sm:text-sm mt-1">
                        {companyInfo.email || tr("company.defaultEmail", "email@example.com")}
                      </p>
                      {companyInfo.phone && (
                        <p className="text-gray-500 text-xs sm:text-sm mt-1">
                          {tr("common.tel", "Tel")}: {companyInfo.phone}
                        </p>
                      )}
                      {companyInfo.address && (
                        <p className="text-gray-500 text-xs sm:text-sm mt-1">
                          {companyInfo.address}
                        </p>
                      )}
                      {companyInfo.vat && (
                        <p className="text-gray-500 text-xs sm:text-sm mt-1">
                          {tr("invoice.vat", "VAT")}: {companyInfo.vat}
                        </p>
                      )}
                    </>
                  )}

                  {isDraft && (
                    <>
                      <p className="text-base sm:text-lg font-bold text-gray-900">
                        {tr("invoice.deliveryNote", "Delivery Note")}
                      </p>
                      <p className="text-base sm:text-lg font-bold text-gray-900">
                        MSR
                      </p>
                      <p className="text-base sm:text-lg font-bold text-gray-900">
                        942560301 r c s Paris
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="sm:text-right">
                  <p className="text-base sm:text-lg font-bold text-gray-900">
                    {tr("invoice.deliveryNote", "Delivery Note")}
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">
                    MSR
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">
                    942560301 r c s Paris
                  </p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mt-6 overflow-x-auto print:overflow-visible">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.items && invoice.items.length > 0 ? (
                    <>
                      <tr className="bg-gray-50 font-medium text-gray-500 uppercase tracking-wider">
                        <td className="px-1 py-3 text-left text-[10px] sm:text-xs">
                          {tr("invoice.table.item", "Item")}
                        </td>
                        <td className="px-1 py-3 text-right text-[10px] sm:text-xs">
                          {tr("invoice.table.qty", "Qty")}
                        </td>
                        <td className="px-1 py-3 text-right text-[10px] sm:text-xs">
                          {tr("invoice.table.price", "Price")}
                        </td>
                        <td className="px-1 py-3 text-right text-[10px] sm:text-xs">
                          {tr("invoice.table.discount", "Discount")}
                        </td>
                        <td className="px-1 py-3 text-right text-[10px] sm:text-xs">
                          {tr("invoice.table.vat", "VAT")} (TVA)
                        </td>
                        <td className="px-1 py-3 text-right text-[10px] sm:text-xs">
                          {tr("invoice.table.amount", "Amount")}
                        </td>
                      </tr>
                      {invoice.items.map((item, index) => {
                        const isBundle = item.item_type === "bundle" || !!item.bundle_id;
                        const itemName =
                          item.product?.name ||
                          item.name ||
                          item.product_name ||
                          item.bundle_name ||
                          (isBundle ? "Bundle Item" : "N/A");
                        const bundleComponentsText = Array.isArray(item.bundle_components) && item.bundle_components.length > 0
                          ? item.bundle_components
                              .map((component) => `${component.product_name} x${Number(component.quantity_per_bundle || 0)}`)
                              .join(" | ")
                          : "";

                        return (
                        <tr key={index}>
                          <td className="px-1 py-2 whitespace-normal text-[10px] sm:text-xs">
                            <div className="font-medium text-gray-900">
                              {itemName}
                            </div>
                            {bundleComponentsText && (
                              <div className="text-gray-500 text-[9px] sm:text-[10px]">
                                {bundleComponentsText}
                              </div>
                            )}
                            <div className=" text-gray-500 text-[9px] sm:text-[10px]">
                              {item.variant_id
                                ? Object.entries(item.variant_id)
                                    .map(
                                      ([key, value]) =>
                                        `${
                                          key.charAt(0).toUpperCase() +
                                          key.slice(1)
                                        }: ${value}`
                                    )
                                    .join(", ")
                                : ""}
                            </div>
                            <div className=" text-gray-500 text-[9px] sm:text-[10px]">
                              <span className="font-bold">
                                {tr("invoice.table.barcode", "Barcode")}:
                              </span>{" "}
                              {
                                invoice?.history?.[index]?.barcode ||
                                item?.product?.code
                              }
                            </div>
                          </td>
                          <td className="px-1 py-2 whitespace-nowrap text-right text-[10px] sm:text-xs text-gray-500">
                            {Number(item.qty).toFixed(0) || 0}
                          </td>
                          <td className="px-1 py-2 whitespace-nowrap text-right text-[10px] sm:text-xs text-gray-500">
                            {formatPrice(item.unit_price)}
                          </td>
                          <td className="px-1 py-2 whitespace-nowrap text-right text-[10px] sm:text-xs text-red-500" data-discount={JSON.stringify(item)}>
                            {formatPrice(item.discount_amount || 0)} (
                            {Number(item.discount || 0).toFixed(1)}%)
                          </td>
                          <td className="px-1 py-2 whitespace-nowrap text-right text-[10px] sm:text-xs text-gray-500">
                            {formatPrice(item.vat || 0)} (
                            {Number(item.vat_rate || 0).toFixed(1)}%)
                          </td>
                          <td className="px-1 py-2 whitespace-nowrap text-right text-[10px] sm:text-xs text-gray-500">
                            {formatPrice(item.total || 0)}
                          </td>
                        </tr>
                      )})}
                    </>
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-1 py-2 text-center text-gray-500"
                      >
                        {tr("invoice.table.noItems", "No items found")}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-white border-t border-gray-200">
                  <tr>
                    <th
                      scope="row"
                      colSpan="5"
                      className="hidden sm:table-cell px-1 pt-2 pb-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                    >
                      {tr("invoice.subtotal", "Subtotal")} (HT Total)
                    </th>
                    <th
                      scope="row"
                      className="sm:hidden px-1 pt-2 pb-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                    >
                      {tr("invoice.subtotal", "Subtotal")} (HT Total)
                    </th>
                    <td className="px-1 pt-2 pb-1 text-right text-xs sm:text-sm text-gray-500">
                      {formatPrice(Number(invoice.sub_total))}
                    </td>
                  </tr>
                  <tr>
                    <th
                      scope="row"
                      colSpan="5"
                      className="hidden sm:table-cell px-1 pt-2 pb-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                    >
                      {tr("invoice.ttc", "TTC")}
                    </th>
                    <th
                      scope="row"
                      className="sm:hidden px-1 pt-2 pb-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                    >
                      {tr("invoice.ttc", "TTC")}
                    </th>
                    <td className="px-1 pt-2 pb-1 text-right text-xs sm:text-sm text-gray-500">
                      {formatPrice(
                        Number(invoice.sub_total) + Number(invoice.vat)
                      )}
                    </td>
                  </tr>
                  {Number(invoice.discount) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.totalDiscount", "Total Discount")}
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.totalDiscount", "Total Discount")}
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-red-500">
                        {formatPrice(Number(invoice.discount))}
                      </td>
                    </tr>
                  )}
                  {Number(invoice.tax_rate) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.rate", "Rate")}
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.rate", "Rate")}
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-gray-500">
                        {Number(invoice.tax_rate)}%
                      </td>
                    </tr>
                  )}
                  {Number(invoice.tax) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.totalTax", "Total Tax")} (TVA)
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.totalTax", "Total Tax")} (TVA)
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-gray-500">
                        {formatPrice(Number(invoice.tax))}
                      </td>
                    </tr>
                  )}

                  {Number(invoice.vat_rate) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        Taux/VAT
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        Taux/VAT
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-gray-500">
                        {Number(invoice.vat_rate)}%
                      </td>
                    </tr>
                  )}
                  {Number(invoice.vat) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        Total Taux/VAT (TVA)
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        Total Taux/VAT (TVA)
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-gray-500">
                        {formatPrice(Number(invoice.vat))}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <th
                      scope="row"
                      colSpan="5"
                      className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-semibold text-gray-900"
                    >
                      {totalLabel}
                    </th>
                    <th
                      scope="row"
                      className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-semibold text-gray-900"
                    >
                      {totalLabel}
                    </th>
                    <td className="px-1 py-1 text-right text-xs sm:text-sm font-semibold text-gray-900">
                      {formatPrice(Number(invoice.total) || 0)}
                    </td>
                  </tr>
                  {!isQuotation && Number(invoice.paid_amount) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.paidAmount", "Paid Amount")}
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.paidAmount", "Paid Amount")}
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-green-500">
                        {formatPrice(Number(invoice.paid_amount))}
                      </td>
                    </tr>
                  )}
                  {Number(invoice.change_due) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.changeAmount", "Change Amount")}
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.changeAmount", "Change Amount")}
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-green-500">
                        {formatPrice(Number(invoice.change_due))}
                      </td>
                    </tr>
                  )}
                  {!isQuotation && Number(invoice.due_amount) > 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.dueAmount", "Due Amount")}
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-gray-500"
                      >
                        {tr("invoice.dueAmount", "Due Amount")}
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-red-500">
                        {formatPrice(Number(invoice.due_amount))}
                      </td>
                    </tr>
                  )}
                  {Number(invoice.return_amount) != 0 && (
                    <tr>
                      <th
                        scope="row"
                        colSpan="5"
                        className="hidden sm:table-cell px-1 py-1 text-right text-xs sm:text-sm font-medium text-red-500"
                      >
                        {tr("invoice.returnAmount", "Return Amount")}
                      </th>
                      <th
                        scope="row"
                        className="sm:hidden px-1 py-1 text-left text-xs sm:text-sm font-medium text-red-500"
                      >
                        {tr("invoice.returnAmount", "Return Amount")}
                      </th>
                      <td className="px-1 py-1 text-right text-xs sm:text-sm text-red-500">
                        {formatPrice(Number(invoice.return_amount))}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {/* Payment and Notes Section */}
            <div className="mt-4 flex flex-col gap-2">
              {!isDraft && !isQuotation && withCustomerInfo && invoice.payment_method && (
                <div className="text-xs sm:text-sm">
                  <strong className="text-indigo-600">
                    {tr("invoice.paymentMethod", "Payment Method")}:
                  </strong>{" "}
                  <span className="inline-block px-2 py-1 rounded-full bg-green-500 text-white text-xs">
                    {invoice.payment_method}
                  </span>
                </div>
              )}
              {!isDraft &&
                !isQuotation &&
                withCustomerInfo &&
                invoice.payment_status !== null && (
                  <div className="text-xs sm:text-sm">
                    <strong className="text-indigo-600">
                      {tr("invoice.paymentStatus", "Payment Status")}:
                    </strong>{" "}
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-white text-xs ${
                        invoice.payment_status === 1
                          ? "bg-green-500"
                          : invoice.payment_status === 0
                          ? "bg-red-500"
                          : "bg-yellow-500"
                      }`}
                    >
                      {invoice.payment_status == 1
                        ? tr("invoice.status.paid", "Paid")
                        : invoice.payment_status == 0
                        ? tr("invoice.status.unpaid", "Unpaid")
                        : tr("invoice.status.due", "Due")}
                    </span>
                  </div>
                )}
              {invoice.note && (
                <div className="p-3 sm:p-4 bg-pink-100 rounded-lg my-4 text-xs sm:text-sm border border-pink-300">
                  <strong className="text-indigo-600">
                    {tr("invoice.notes", "Notes")}:
                  </strong>{" "}
                  {invoice.note}
                </div>
              )}

              <div className="flex justify-center">
                <div className="">
                  <Barcode
                    value={invoice.invoice_no || "N/A"}
                    width={2}
                    height={40}
                    fontSize={12}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-gray-300 pt-4 text-xs text-gray-500 text-center mt-8 print:mt-12">
              {footerNote}
            </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="text-center mt-4 no-print">
              <button
                onClick={handlePrint}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                {tr("common.print", "Print")}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ml-2"
              >
                {tr("common.close", "Close")}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

PrintableSaleReceipt.propTypes = {
  invoice: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    invoice_no: PropTypes.string,
    date: PropTypes.string,
    due_date: PropTypes.string,
    qty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    discount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    tax_rate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    tax: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    vat_rate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    vat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sub_total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    note: PropTypes.string,
    paid_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    due_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    change_due: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    return_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    payment_status: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    isFracture: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    payment_method: PropTypes.string,
    status: PropTypes.string,
    currency: PropTypes.string,
    history: PropTypes.arrayOf(
      PropTypes.shape({
        barcode: PropTypes.string,
      })
    ),
    customer: PropTypes.shape({
      name: PropTypes.string,
      address: PropTypes.string,
      phone: PropTypes.string,
      email: PropTypes.string,
    }),
    supplier: PropTypes.shape({
      name: PropTypes.string,
      address: PropTypes.string,
      phone: PropTypes.string,
      email: PropTypes.string,
    }),
    items: PropTypes.arrayOf(
      PropTypes.shape({
        product: PropTypes.shape({
          name: PropTypes.string,
          code: PropTypes.string,
          description: PropTypes.string,
        }),
        lot_number: PropTypes.string,
        variant_id: PropTypes.object,
        qty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        unit_price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        discount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        discount_amount: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.number,
        ]),
        tax: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        tax_rate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        vat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        vat_rate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      })
    ),
  }).isRequired,
  withCustomerInfo: PropTypes.bool,
  onClose: PropTypes.func,
  companyInfo: PropTypes.shape({
    name: PropTypes.string,
    logo: PropTypes.string,
    address: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
    vat: PropTypes.string,
    footerNote: PropTypes.string,
    quotationFooterNote: PropTypes.string,
  }),
  isDraft: PropTypes.bool,
};

PrintableSaleReceipt.defaultProps = {
  withCustomerInfo: false,
  onClose: () => {},
  companyInfo: {},
  isDraft: false,
};

export default PrintableSaleReceipt;

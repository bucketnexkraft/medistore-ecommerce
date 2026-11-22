import PropTypes from "prop-types";
import { Dialog } from "@headlessui/react";
import Barcode from "react-barcode";
import { formatPrice } from "../../hooks/currency";
import { useTranslation } from "react-i18next";

const PosPrinterReceipt = ({
  invoice,
  withCustomerInfo,
  onClose,
  companyInfo = {},
}) => {
  const { t } = useTranslation();
  const tr = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const isSale = invoice.type === "sale";
  const isQuotation = invoice.type === "quotation";
  const invoiceTitle = isQuotation
    ? tr("invoice.quotation", "Quotation")
    : isSale
      ? tr("invoice.salesInvoice", "Sales Invoice")
      : tr("invoice.purchaseInvoice", "Purchase Invoice");
  const documentNumberLabel = isQuotation
    ? tr("invoice.quotationNo", "Quotation No")
    : invoiceTitle;
  const previewTitle = isQuotation
    ? tr("invoice.quotationPreview", "Quotation Preview")
    : tr("invoice.receiptPreview", "Receipt Preview");
  const customerLabel = isQuotation
    ? tr("invoice.quotedTo", "Quoted To")
    : tr("invoice.customer", "Customer");
  const totalLabel = isQuotation
    ? tr("invoice.quotationTotal", "Quotation Total")
    : tr("invoice.total", "Total");
  const footerNote = isQuotation
    ? (companyInfo.quotationFooterNote ||
      tr("invoice.defaultQuotationFooterNote", "This quotation is subject to stock availability and final confirmation."))
    : (companyInfo.footerNote || tr("invoice.defaultFooterNote", "Thank you for your business!"));

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
  const quotationValidUntil = companyInfo.quotationValidUntil || addDays(invoice.date, quotationValidityDays);
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
          <span>{customerLabel}</span>
          <strong>{withCustomerInfo?.name || invoice.customer?.name || "Walk-in Customer"}</strong>
          {(withCustomerInfo?.phone || invoice.customer?.phone) && (
            <div>{tr("invoice.phone", "Phone")}: {withCustomerInfo?.phone || invoice.customer?.phone}</div>
          )}
          {(withCustomerInfo?.email || invoice.customer?.email) && (
            <div>{withCustomerInfo?.email || invoice.customer?.email}</div>
          )}
          {(withCustomerInfo?.address || invoice.customer?.address) && (
            <div>{withCustomerInfo?.address || invoice.customer?.address}</div>
          )}
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

            return (
              <tr key={index}>
                <td>
                  <strong>{itemName}</strong>
                  {(item.product?.code || item.code) && (
                    <small>{tr("invoice.productCode", "Code")}: {item.product?.code || item.code}</small>
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
            <p>{footerNote}</p>
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
          {toNumber(invoice.vat) > 0 && (
            <div>
              <span>{tr("invoice.totalTax", "Tax")}</span>
              <strong>{formatPrice(invoice.vat)}</strong>
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

  const ReceiptContent = () => (
    <div className="pos-receipt">
      <div className="pos-header">
        <div className="pos-company-name">{companyInfo.name || tr("invoice.companyName", "Company")}</div>
        <div className="pos-company-address">
          {companyInfo.address && <div>{companyInfo.address}</div>}
          {companyInfo.phone && <div>{tr("invoice.phone", "Phone")}: {companyInfo.phone}</div>}
          {companyInfo.email && <div>{companyInfo.email}</div>}
        </div>
      </div>

      <div className="pos-invoice-info">
        <div className="pos-total-row">
          <span>{documentNumberLabel}:</span>
          <span>{invoice.invoice_no || "N/A"}</span>
        </div>
        <div className="pos-total-row">
            <span>{tr("invoice.date", "Date")}:</span>
          <span>{formatDate(invoice.date)}</span>
        </div>
        {withCustomerInfo && (
          <div className="pos-total-row">
            <span>{customerLabel}:</span>
            <span>{withCustomerInfo.name || "Walk-in"}</span>
          </div>
        )}
      </div>

      <table className="pos-items-table">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>{tr("invoice.items", "Items")}</th>
            <th style={{ width: "15%" }}>{tr("invoice.qty", "Qty")}</th>
            <th style={{ width: "20%", textAlign: "right" }}>{tr("invoice.table.price", "Price")}</th>
            <th style={{ width: "25%", textAlign: "right" }}>{tr("invoice.total", "Total")}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, index) => {
            const itemName = getItemName(item);
            const bundleComponentsText = getBundleComponentsText(item);

            return (
            <tr key={index}>
              <td>
                {itemName}
                {bundleComponentsText ? (
                  <>
                    <br />
                    <small>{bundleComponentsText}</small>
                  </>
                ) : null}
                {/* <br />
                <small>{
                  item?.history?.[index]?.barcode ||
                  item?.product?.code
                }</small> */}
              </td>
              <td>{item.qty || item.quantity || 0}</td>
              <td style={{ textAlign: "right" }}>
                {formatPrice(item.unit_price ?? item.price ?? 0)}
              </td>
              <td style={{ textAlign: "right" }}>{formatPrice(item.total || 0)}</td>
            </tr>
          )})}
        </tbody>
      </table>

      <div className="pos-totals">
        <div className="pos-total-row">
            <span>{tr("invoice.subtotal", "Subtotal")}:</span>
          <span>{formatPrice(invoice.sub_total || 0)}</span>
        </div>
        {invoice.discount > 0 && (
          <div className="pos-total-row">
            <span>{tr("invoice.discount", "Discount")}:</span>
            <span>-{formatPrice(invoice.discount)}</span>
          </div>
        )}
        {invoice.vat > 0 && (
          <div className="pos-total-row">
            <span>{tr("invoice.totalTax", "Tax")}:</span>
            <span>{formatPrice(invoice.vat)}</span>
          </div>
        )}
        <div className="pos-grand-total">
          <span>{totalLabel.toUpperCase()}:</span>
          <span>{formatPrice(invoice.total || 0)}</span>
        </div>
        {!isQuotation && invoice.paid_amount !== undefined && (
          <div className="pos-total-row">
            <span>{tr("invoice.paidAmount", "Paid Amount")}:</span>
            <span>{formatPrice(invoice.paid_amount || 0)}</span>
          </div>
        )}
        {!isQuotation && invoice.due_amount > 0 && (
          <div className="pos-total-row pos-emphasis-row">
            <span>{tr("invoice.dueAmount", "Due Amount")}:</span>
            <span>{formatPrice(invoice.due_amount)}</span>
          </div>
        )}
        {!isQuotation && invoice.change_due > 0 && (
          <div className="pos-total-row pos-emphasis-row">
            <span>{tr("invoice.changeDue", "Change Due")}:</span>
            <span>{formatPrice(invoice.change_due)}</span>
          </div>
        )}
      </div>

      {!isQuotation && (
        <div className="pos-barcode items-center justify-center">
          <Barcode
            value={invoice.invoice_no || "N/A"}
            width={1.2}
            height={30}
            fontSize={10}
            margin={0}
            format="CODE128"
            lineColor="#000000"
            background="#FFFFFF"
          />
        </div>
      )}

      <div className="pos-footer">
        <div>{isQuotation ? tr("invoice.quotation", "Quotation") : tr("invoice.thankYou", "Thank you")}</div>
        <div className="footer-note">{footerNote}</div>
      </div>
    </div>
  );

  return (
    <Dialog open={!!invoice} onClose={onClose} className="relative z-50">
      <style>{`
        @media screen {
          .print-area { display: none; }
          .modal-container {
            background: white;
            width: ${isQuotation ? "760px" : "400px"};
            max-width: calc(100vw - 32px);
            display: flex;
            flex-direction: column;
            max-height: 80vh;
            border-radius: 8px;
            border: 1px solid #ddd;
          }
          .modal-header { padding: 16px; border-bottom: 1px solid #eee; flex-shrink: 0; font-weight: bold; display: flex; justify-content: space-between; }
          .modal-body { padding: 20px; overflow-y: auto; flex-grow: 1; }
          .modal-footer { padding: 12px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
          .pos-receipt {
            margin: 0 auto;
            font-family: "Consolas", "Lucida Console", "Courier New", monospace;
            font-size: 12px;
            line-height: 1.3;
          }
        }

        @media print {
          /* Target the main app containers and hide them */
          #root, .no-print, [role="dialog"] > div:not(.print-area) {
            display: none !important;
          }

          /* Ensure the dialog itself doesn't add padding/centered layout */
          [role="dialog"] {
            display: block !important;
            position: static !important;
          }

          .print-area {
            display: block !important;
            width: ${isQuotation ? "186mm" : "72mm"} !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          @page {
            size: ${isQuotation ? "A4" : "80mm auto"};
            margin: ${isQuotation ? "12mm" : "0"};
          }

          html, body {
            margin: 0;
            padding: 0;
            background: white;
            -webkit-font-smoothing: none !important;
          }

          * {
            color: #000 !important;
            opacity: 1 !important;
            text-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .pos-receipt {
            width: 72mm !important;
            padding: 2mm !important;
            font-family: "Consolas", "Lucida Console", "Courier New", monospace !important;
            font-size: 12px !important;
            line-height: 1.3 !important;
            font-weight: 600 !important;
            letter-spacing: 0.15px !important;
          }
        }

        /* Essential Receipt Styles */
        .pos-header { text-align: center; border-bottom: 2px dashed #000; margin-bottom: 8px; padding-bottom: 8px; }
        .pos-company-name { font-weight: 800; font-size: 15px; color: #000; line-height: 1.2; }
        .pos-company-address {line-height: 1;}
        .pos-invoice-info { font-size: 12px; margin-bottom: 8px; color: #000; }
        .pos-items-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .pos-items-table th { border-bottom: 2px solid #000; text-align: left; font-size: 12px; padding: 4px 0; font-weight: 800; color: #000; }
        .pos-items-table td { padding: 5px 0; font-size: 12px; vertical-align: top; color: #000; font-weight: 600; }
        .pos-total-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; color: #000; }
        .pos-emphasis-row { font-weight: 800; color: #000; }
        .pos-grand-total { display: flex; justify-content: space-between; font-weight: 800; font-size: 15px; border-top: 2px solid #000; margin-top: 4px; padding-top: 5px; color: #000; }
        .pos-barcode {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
          margin: 14px 0;
        }
        .pos-barcode > svg,
        .pos-barcode > img {
          display: block !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .pos-footer { text-align: center; font-size: 12px; border-top: 2px dashed #000; padding-top: 8px; margin-top: 10px; color: #000; }
        .footer-note { font-size: 11px; margin-top: 4px; color: #000; font-weight: 600; }

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
      `}</style>

      {/* Screen Interface */}
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 no-print">
        <div className="modal-container">
          <div className="modal-header">
            <span>{previewTitle}</span>
            <button onClick={onClose} className="hover:text-red-500">✕</button>
          </div>
          <div className="modal-body">
            {isQuotation ? <QuotationContent /> : <ReceiptContent />}
          </div>
          <div className="modal-footer">
            <button onClick={onClose} className="px-4 py-2 border rounded text-sm">{tr("common.close", "Close")}</button>
            <button onClick={handlePrint} className="px-4 py-2 bg-black text-white rounded text-sm">{tr("common.print", "Print")}</button>
          </div>
        </div>
      </div>

      {/* Printer Container */}
      <div className="print-area">
        {isQuotation ? <QuotationContent /> : <ReceiptContent />}
      </div>
    </Dialog>
  );
};

PosPrinterReceipt.propTypes = {
  invoice: PropTypes.shape({
    type: PropTypes.string,
    invoice_no: PropTypes.string,
    date: PropTypes.string,
    customer: PropTypes.shape({
      name: PropTypes.string,
      phone: PropTypes.string,
      email: PropTypes.string,
      address: PropTypes.string,
    }),
    sub_total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    discount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    vat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    paid_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    due_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    change_due: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    items: PropTypes.arrayOf(
      PropTypes.shape({
        item_type: PropTypes.string,
        bundle_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string,
        code: PropTypes.string,
        description: PropTypes.string,
        product_name: PropTypes.string,
        bundle_name: PropTypes.string,
        qty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        quantity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        unit_price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        bundle_components: PropTypes.arrayOf(
          PropTypes.shape({
            product_name: PropTypes.string,
            quantity_per_bundle: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          })
        ),
        product: PropTypes.shape({
          name: PropTypes.string,
          code: PropTypes.string,
        }),
      })
    ),
  }).isRequired,
  withCustomerInfo: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.shape({
      name: PropTypes.string,
      phone: PropTypes.string,
      email: PropTypes.string,
      address: PropTypes.string,
    }),
  ]),
  onClose: PropTypes.func,
  companyInfo: PropTypes.shape({
    name: PropTypes.string,
    address: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
    footerNote: PropTypes.string,
    quotationFooterNote: PropTypes.string,
    quotationValidityDays: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    quotationValidUntil: PropTypes.string,
    quotationPaymentTerms: PropTypes.string,
    quotationDeliveryTerms: PropTypes.string,
  }),
};

PosPrinterReceipt.defaultProps = {
  withCustomerInfo: null,
  onClose: () => {},
  companyInfo: {},
};

export default PosPrinterReceipt;

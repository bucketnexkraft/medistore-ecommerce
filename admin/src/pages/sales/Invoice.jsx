import React from 'react';

const Invoice = ({ selectedCustomer, products, saleSummary }) => {
    const print = () => {
        const printWindow = window.open('', '_blank');
        const customerInfo = selectedCustomer
            ? `
                <p><strong>Name:</strong> ${selectedCustomer.name}</p>
                <p><strong>Email:</strong> ${selectedCustomer.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${selectedCustomer.phone}</p>
                <p><strong>Address:</strong> ${selectedCustomer.address || 'N/A'}</p>
                <p><strong>NID/TIN/TAX:</strong> ${selectedCustomer.nidTinTax || 'N/A'}</p>
            `
            : '<p>No customer selected</p>';

        const productsTable = products
            .filter(p => p.name !== '')
            .map(
                p => `
                    <tr>
                        <td>${p.lot_number ? p.lot_number + ' - ' : ''}${p.name}</td>
                        <td>${p.quantity}</td>
                        <td>$${p.unitPrice.toFixed(2)}</td>
                        <td>$${p.tax.toFixed(2)}</td>
                        <td>$${p.vat.toFixed(2)}</td>
                        <td>$${p.totalPrice.toFixed(2)}</td>
                    </tr>
                `
            )
            .join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Sale Receipt</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { text-align: center; }
                        .customer, .summary { margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .summary p { font-size: 14px; }
                    </style>
                </head>
                <body>
                    <h1>Sale Receipt</h1>
                    <div className="customer">
                        <h3>Customer Information</h3>
                        ${customerInfo}
                    </div>
                    <div>
                        <h3>Products</h3>
                        <table>
                            <tr>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Tax</th>
                                <th>VAT</th>
                                <th>Total</th>
                            </tr>
                            ${productsTable || '<tr><td colspan="6">No products added</td></tr>'}
                        </table>
                    </div>
                    <div className="summary">
                        <h3>Sale Summary</h3>
                        <p><strong>Sub Total:</strong> $${saleSummary.subTotal.toFixed(2)}</p>
                        <p><strong>Discount:</strong> $${saleSummary.discount.toFixed(2)}</p>
                        <p><strong>Tax:</strong> $${saleSummary.tax.toFixed(2)}</p>
                        <p><strong>VAT:</strong> $${saleSummary.vat.toFixed(2)}</p>
                        <p><strong>Grand Total:</strong> $${saleSummary.grandTotal.toFixed(2)}</p>
                        <p><strong>Paid Amount:</strong> $${saleSummary.paidAmount.toFixed(2)}</p>
                        <p><strong>Change Due:</strong> $${saleSummary.changeDue.toFixed(2)}</p>
                        <p><strong>Payment Method:</strong> ${saleSummary.paymentMethod}</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return print;
};

export default Invoice;
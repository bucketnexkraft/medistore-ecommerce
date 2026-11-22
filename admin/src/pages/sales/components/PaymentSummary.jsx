import React from 'react';
import { formatPrice } from '../../../hooks/currency';

const PaymentSummary = ({ payments, grandTotal, dueAmount, changeDue }) => {
  const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-lg border-b pb-2">Payment Summary</h3>
      
      <div className="space-y-2">
        {payments.map((payment, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              {payment.method || 'Unknown'} {payment.card_last_digits && `(${payment.card_last_digits})`}
            </span>
            <span className="font-medium">{formatPrice(payment.amount || 0)}</span>
          </div>
        ))}
        
        {payments.length === 0 && (
          <div className="text-sm text-gray-500 italic">No payments added</div>
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total Paid:</span>
          <span className="font-bold text-blue-600">{formatPrice(totalPaid)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="font-semibold">Grand Total:</span>
          <span className="font-bold">{formatPrice(grandTotal)}</span>
        </div>
        
        {dueAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-semibold text-orange-600">Due Amount:</span>
            <span className="font-bold text-orange-600">{formatPrice(dueAmount)}</span>
          </div>
        )}
        
        {changeDue > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-semibold text-green-600">Change Due:</span>
            <span className="font-bold text-green-600">{formatPrice(changeDue)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSummary;

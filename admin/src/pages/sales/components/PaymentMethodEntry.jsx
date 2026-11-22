import React from 'react';

const normalizeMethodName = (value) => String(value ?? '').trim().toLowerCase();

const PaymentMethodEntry = ({
  payment,
  index,
  paymentMethodsSettings,
  updatePayment,
  removePayment,
  isReturn = false
}) => {
  const currentMethod = paymentMethodsSettings.find(
    (m) => normalizeMethodName(m.name) === normalizeMethodName(payment.method)
  );

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-sm">Payment Method {index + 1}</h4>
        {index > 0 && (
          <button
            type="button"
            onClick={() => removePayment(index)}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Payment Method
          </label>
          <select
            value={payment.method}
            onChange={(e) => updatePayment(index, 'method', e.target.value)}
            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Method</option>
            {paymentMethodsSettings
              .filter(method => method.enabled)
              .map(method => (
                <option key={method.name} value={method.name}>
                  {method.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Amount
          </label>
          <input
            type="number"
            value={payment.amount}
            onChange={(e) => updatePayment(index, 'amount', parseFloat(e.target.value) || 0)}
            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Card Details */}
      {currentMethod?.config?.require_last_digits &&
       ['Card', 'Refund to Card'].includes(payment.method) && (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Card Last Digits
          </label>
          <input
            type="text"
            value={payment.card_last_digits || ''}
            onChange={(e) => updatePayment(index, 'card_last_digits', e.target.value)}
            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter last digits"
            maxLength={currentMethod?.config?.last_digit_length?.[0] || 6}
          />
        </div>
      )}

      {/* QR Payment Details */}
      {['QR Payment'].includes(payment.method) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              QR Provider
            </label>
            <select
              value={payment.qr_provider || ''}
              onChange={(e) => updatePayment(index, 'qr_provider', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Provider</option>
              {currentMethod?.config?.providers?.map(provider => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Transaction ID
            </label>
            <input
              type="text"
              value={payment.qr_transaction_id || ''}
              onChange={(e) => updatePayment(index, 'qr_transaction_id', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Transaction ID"
            />
          </div>
        </div>
      )}

      {/* Mobile Financial Service Details */}
      {['Refund to MF'].includes(payment.method) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              MF Provider
            </label>
            <select
              value={payment.mf_type || ''}
              onChange={(e) => updatePayment(index, 'mf_type', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Provider</option>
              {currentMethod?.config?.providers?.map(provider => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Mobile Number
            </label>
            <input
              type="text"
              value={payment.mf_number || ''}
              onChange={(e) => updatePayment(index, 'mf_number', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mobile Number"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodEntry;

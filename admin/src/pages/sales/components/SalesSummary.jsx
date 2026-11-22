
import { formatPrice, onlyCurrencySimble } from '../../../hooks/currency';

const normalizeMethodName = (value) => String(value ?? '').trim().toLowerCase();


const SalesSummary = ({
  saleSummary,
  handleOverallDiscountChange,
  handleOverallDiscountTypeChange,
  updateTax,
  updateVat,
  isRewardActive,
  canRedeemPoints,
  selectedCustomer,
  updatePointsUsed,
  selectedReward,
  appliedCoupon,
  updatePaidAmount,
  setShowPaymentScheduleDrawer,
  generatePaymentSchedules,
  numberOfInstallments,
  setSaleSummary,
  paymentMethodsSettings,
  updatePaymentDetails,
  updateNote,
  isReturn,
  payments,
  addPayment,
  updatePayment,
  removePayment,
}) => {
  const displayAmount = (value) => (
    isReturn ? Math.abs(Number(value) || 0) : Number(value) || 0
  );
  const allowedPaymentMethods = paymentMethodsSettings.filter((method) => {
    if (!method.enabled) return false;
    if (isReturn) {
      return ["Cash Refund", "Refund to Card", "Refund to MF"].some(
        (name) => normalizeMethodName(name) === normalizeMethodName(method.name)
      );
    }
    return !["Cash Refund", "Refund to Card", "Refund to MF"].some(
      (name) => normalizeMethodName(name) === normalizeMethodName(method.name)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2">
        <span className="text-sm font-bold text-gray-700">
          Billing Details
        </span>
        <span className="text-sm font-bold text-right text-gray-600">
          #{formatPrice(displayAmount(saleSummary.subTotal))}
        </span>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">
          Sub Total:
        </span>
        <span className="text-sm font-semibold text-right">
          {formatPrice(displayAmount(saleSummary.subTotal))}
        </span>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">
          Discount:
        </span>
        <div className="flex items-center">
          <input
            type="number"
            value={saleSummary.discount}
            onChange={(e) =>
              handleOverallDiscountChange(e.target.value)
            }
            className="w-20 p-1.5 text-sm border border-gray-300 rounded-l-lg focus:border-blue-500 focus:ring-blue-500 text-right transition-colors duration-200"
            min="0"
            step="1"
            tabIndex={100}
            disabled={isReturn}
          />
          <select
            value={saleSummary.discountType}
            onChange={(e) =>
              handleOverallDiscountTypeChange(e.target.value)
            }
            className="p-1.5 text-sm border border-l-0 border-gray-300 rounded-r-lg focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
            disabled={isReturn}
          >
            <option value="flat">{onlyCurrencySimble()}</option>
            <option value="percent">%</option>
          </select>
        </div>
      </div>
      {/* <div className="flex justify-between items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Tax (%):</span>
        <input
          type="number"
          value={saleSummary.tax}
          onChange={(e) => updateTax(e.target.value)}
          className="w-28 p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 text-right transition-colors duration-200"
          min="0"
          max="100"
          step="1"
          tabIndex={101}
          placeholder="0%"
        />
      </div> */}
      <div className="flex justify-between items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Vat (%):</span>
        <input
          type="number"
          value={saleSummary.vat}
          onChange={(e) => updateVat(e.target.value)}
          className="w-28 p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 text-right transition-colors duration-200"
          min="0"
          max="100"
          step="1"
          tabIndex={102}
          placeholder="0%"
        />
      </div>

      {isRewardActive() && (
        <>
          {canRedeemPoints() && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">
                Points Earned:
              </span>
              <span className="text-sm font-semibold text-right">
                {saleSummary.points_earned}
              </span>
            </div>
          )}

          {canRedeemPoints() && selectedCustomer?.reward_points > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Redeem Points (Available: {selectedCustomer.reward_points})
              </label>
              <input
                type="number"
                value={saleSummary.points_used}
                onChange={(e) => updatePointsUsed(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                min="0"
                step="1"
                placeholder="Enter points to redeem"
              />
              {selectedReward && (
                <p className="text-xs text-gray-500 mt-1">
                  {saleSummary.points_used} points = $
                  {(saleSummary.points_used * selectedReward.reword_value).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </>
      )}
      <div className="flex justify-between items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">
          Grand Total:
        </span>
        <span className="text-sm font-bold text-blue-600 text-right">
          {formatPrice(displayAmount(saleSummary.grandTotal))}
        </span>
      </div>
      {appliedCoupon && (
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            Coupon/Gift Card ({appliedCoupon.code}):
          </span>
          <span className="text-sm font-semibold text-right">
            {appliedCoupon.discountType === 'percent'
              ? `${appliedCoupon.discount}%`
              : formatPrice(appliedCoupon.discount)}
          </span>
        </div>
      )}
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-gray-600">
          Total Paid:
        </label>
        {payments.length === 1 ? (
          <input
            type="number"
            value={payments[0].amount === 0 ? "" : payments[0].amount}
            onChange={(e) => updatePayment(0, 'amount', e.target.value)}
            className="w-28 p-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-right transition-colors duration-200"
            min="0"
            step="0.01"
            placeholder="Enter amount"
          />
        ) : (
          <p className="text-sm font-semibold">
            {formatPrice(displayAmount(saleSummary?.paidAmount))}
          </p>
        )}
      </div>
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-gray-600">
          Due Amount
        </label>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">
            {formatPrice(displayAmount(saleSummary?.dueAmount))}
          </p>
          {saleSummary?.dueAmount > 0 && (
            <button
              type="button"
              onClick={() => setShowPaymentScheduleDrawer(true)}
              className="text-blue-500 hover:text-blue-700 p-1 border border-blue-300 rounded hover:bg-blue-50 transition-colors duration-200"
              title="Set Payment Schedule"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">
          Change Due:
        </span>
        <span className="text-sm font-semibold text-green-600 text-right">
          {formatPrice(displayAmount(saleSummary?.changeDue))}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-600">
            Payment Method:
          </label>
          {/* Add payment button for single payment */}
          {payments.length === 1 && (
            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={addPayment}
                className="text-blue-500 hover:text-blue-700 p-2 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors duration-200"
                title="Add Payment Method"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
          )}
          {payments.length > 1 && (
            <button
              type="button"
              onClick={addPayment}
              className="text-blue-500 hover:text-blue-700 p-1"
              title="Add Payment Method"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}
        </div>
        
        {payments.length === 1 ? (
          <select
            value={payments[0].method}
            onChange={(e) => updatePayment(0, 'method', e.target.value)}
            className="w-28 p-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-right transition-colors duration-200"
          >
            {paymentMethodsSettings
              .filter((method) =>
                allowedPaymentMethods.some(
                  (m) => normalizeMethodName(m.name) === normalizeMethodName(method.name)
                )
              )
              .map((method) => (
                <option key={method.name} value={method.name}>
                  {method.name}
                </option>
              ))}
          </select>
        ) : (
          <span className="text-sm text-gray-600">Multiple Methods</span>
        )}
      </div>
      
      {/* Payment Method Entries */}
      {payments.length > 1 && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-left p-2 text-sm font-semibold text-gray-700">Method</th>
                  <th className="text-right p-2 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-center p-2 text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, index) => (
                  <tr key={payment.id} className="border-b">
                    <td className="p-2 text-sm">{index + 1}</td>
                    <td className="p-2">
                      <select
                        value={payment.method}
                        onChange={(e) => updatePayment(index, 'method', e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                      >
                        {paymentMethodsSettings
                          .filter((method) =>
                            allowedPaymentMethods.some(
                              (m) => normalizeMethodName(m.name) === normalizeMethodName(method.name)
                            )
                          )
                          .map((method) => (
                            <option key={method.name} value={method.name}>
                              {method.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={payment.amount === 0 ? "" : payment.amount}
                        onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-right transition-colors duration-200"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="p-2 text-center">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removePayment(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove Payment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {/* Payment method specific details */}
          {payments.map((payment, index) => (
            <div key={payment.id} className="space-y-2">
              {paymentMethodsSettings.find(
                (m) => normalizeMethodName(m.name) === normalizeMethodName(payment.method)
              )?.config?.require_last_digits &&
               ['Card', 'Refund to Card'].some(
                 (name) => normalizeMethodName(name) === normalizeMethodName(payment.method)
               ) && (
                <div className="flex justify-between items-center gap-2">
                  <label className="block text-sm font-medium text-gray-600">
                    Card Last Digits:
                  </label>
                  <input
                    type="text"
                    value={payment.card_last_digits || ''}
                    onChange={(e) => updatePayment(index, 'card_last_digits', e.target.value)}
                    className="w-28 p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-200 text-right transition-colors duration-200"
                    placeholder="Enter last digits"
                  />
                </div>
              )}
              
              {['QR Payment'].includes(payment.method) && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center gap-2">
                    <label className="block text-sm font-medium text-gray-600">
                      QR Provider:
                    </label>
                    <select
                      value={payment.qr_provider || ''}
                      onChange={(e) => updatePayment(index, 'qr_provider', e.target.value)}
                      className="w-28 p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-200 text-right transition-colors duration-200"
                    >
                      <option value="">Select Provider</option>
                      {paymentMethodsSettings
                        .find((m) => normalizeMethodName(m.name) === normalizeMethodName(payment.method))
                        ?.config?.providers?.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <label className="block text-sm font-medium text-gray-600">
                      Transaction ID:
                    </label>
                    <input
                      type="text"
                      value={payment.qr_transaction_id || ''}
                      onChange={(e) => updatePayment(index, 'qr_transaction_id', e.target.value)}
                      className="w-28 p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-200 text-right transition-colors duration-200"
                      placeholder="Transaction ID"
                    />
                  </div>
                </div>
              )}
              
              {['Refund to MF'].some(
                (name) => normalizeMethodName(name) === normalizeMethodName(payment.method)
              ) && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center gap-2">
                    <label className="block text-sm font-medium text-gray-600">
                      MF Provider:
                    </label>
                    <select
                      value={payment.mf_type || ''}
                      onChange={(e) => updatePayment(index, 'mf_type', e.target.value)}
                      className="w-28 p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-200 text-right transition-colors duration-200"
                    >
                      <option value="">Select Provider</option>
                      {paymentMethodsSettings
                        .find((m) => m.name === payment.method)
                        ?.config?.providers?.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <label className="block text-sm font-medium text-gray-600">
                      Mobile Number:
                    </label>
                    <input
                      type="text"
                      value={payment.mf_number || ''}
                      onChange={(e) => updatePayment(index, 'mf_number', e.target.value)}
                      className="w-28 p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-200 text-right transition-colors duration-200"
                      placeholder="Mobile Number"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
      
     
      <div >
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Notes:
        </label>
        <textarea placeholder="Notes"
          className="textarea textarea-sm border border-gray-300 w-[100%]"
          value={saleSummary.note || ''}
          onChange={(e) => updateNote(e.target.value)}
        ></textarea>
      </div>
    </div>
  );
};

export default SalesSummary;

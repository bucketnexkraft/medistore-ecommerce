
import React from 'react';
import { FaPlus } from 'react-icons/fa';

const PaymentScheduleDrawer = ({
  showPaymentScheduleDrawer,
  setShowPaymentScheduleDrawer,
  numberOfInstallments,
  setNumberOfInstallments,
  addScheduleEntry,
  paymentSchedules,
  updateScheduleEntry,
  removeScheduleEntry,
  savePaymentSchedules,
}) => {
  if (!showPaymentScheduleDrawer) return null;
  const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-end">
      <div className="bg-white w-full max-w-xl h-full p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-700">
            Payment Schedule
          </h2>
          <button
            onClick={() => setShowPaymentScheduleDrawer(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Number of Installments
          </label>
          <input
            type="number"
            value={numberOfInstallments}
            onChange={(e) => {
              const num = Math.max(1, Number(e.target.value) || 1);
              setNumberOfInstallments(num);
            }}
            className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
            min="1"
            step="1"
          />
        </div>
        <div className="mb-6">
          <button
            onClick={addScheduleEntry}
            className="border border-success text-success p-2 rounded-lg hover:bg-success hover:text-white transition-colors duration-200 flex items-center"
          >
            <FaPlus className="w-4 h-4 inline-block mr-2" /> Add Installment
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border border-gray-200">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">
                  Amount
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">
                  Due Date
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">
                  Reminder Date (Optional)
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {paymentSchedules.map((schedule) => (
                <tr key={schedule.id} className="border-b border-gray-200">
                  <td className="p-3">
                    <input
                      type="number"
                      value={schedule.amount}
                      onChange={(e) =>
                        updateScheduleEntry(
                          schedule.id,
                          'amount',
                          Number(e.target.value)
                        )
                      }
                      className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={schedule.due_date}
                      onChange={(e) =>
                        updateScheduleEntry(
                          schedule.id,
                          'due_date',
                          e.target.value
                        )
                      }
                      className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                      min={todayLocal}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="date"
                      value={schedule.remainder_date || ''}
                      onChange={(e) =>
                        updateScheduleEntry(
                          schedule.id,
                          'remainder_date',
                          e.target.value || null
                        )
                      }
                      className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                      min={todayLocal}
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => removeScheduleEntry(schedule.id)}
                      className="border border-error text-error p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors duration-200"
                      title="Remove Installment"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowPaymentScheduleDrawer(false)}
            className="border border-gray-300 text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={savePaymentSchedules}
            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
          >
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentScheduleDrawer;

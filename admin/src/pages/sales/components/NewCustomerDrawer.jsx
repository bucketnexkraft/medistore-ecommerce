
import React from 'react';
import { BsX } from 'react-icons/bs';

const NewCustomerDrawer = ({
  showCustomerDrawer,
  setShowCustomerDrawer,
  newCustomer,
  setNewCustomer,
  nameInputRef,
  saveCustomer,
  isCustomerLoading,
}) => {
  if (!showCustomerDrawer) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setShowCustomerDrawer(false)}
      />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out translate-x-0">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold">Add New Customer</h3>
          <button
            onClick={() => setShowCustomerDrawer(false)}
            className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            <BsX className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <input
            type="text"
            placeholder="Phone Number (Required)"
            value={newCustomer.phone}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, phone: e.target.value })
            }
            className="input input-bordered w-full p-2.5 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
            tabIndex={6}
          />
          <input
            type="text"
            placeholder="Name (Required)"
            value={newCustomer.name}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, name: e.target.value })
            }
            ref={nameInputRef}
            className="input input-bordered w-full p-2.5 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
            tabIndex={7}
          />
          <input
            type="email"
            placeholder="Email (Optional)"
            value={newCustomer.email}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, email: e.target.value })
            }
            className="input input-bordered w-full p-2.5 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
            tabIndex={8}
          />
          <input
            type="text"
            placeholder="Address (Optional)"
            value={newCustomer.address}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, address: e.target.value })
            }
            className="input input-bordered w-full p-2.5 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
            tabIndex={9}
          />
          <input
            type="text"
            placeholder="NID/TIN/TAX (Optional)"
            value={newCustomer.nidTinTax}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, nidTinTax: e.target.value })
            }
            className="input input-bordered w-full p-2.5 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
            tabIndex={10}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCustomerDrawer(false)}
              className="btn btn-default flex"
              tabIndex={11}
              disabled={isCustomerLoading}
            >
              Cancel
            </button>
            <button
              onClick={saveCustomer}
              className="btn btn-primary flex"
              tabIndex={12}
              disabled={isCustomerLoading}
            >
              {isCustomerLoading && (
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2V6M12 18V22M6 12H2M22 12H18M18.364 5.636L15.536 8.464M8.464 15.536L5.636 18.364M18.364 18.364L15.536 15.536M8.464 8.464L5.636 5.636"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NewCustomerDrawer;

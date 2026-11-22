
import React from 'react';
import { BsSearch } from 'react-icons/bs';
import { FaPlus } from 'react-icons/fa';
import {
  PiEnvelope,
  PiIdentificationBadge,
  PiMapPin,
  PiPhoneCall,
  PiUser,
} from 'react-icons/pi';

const CustomerSection = ({
  customerInput,
  handleCustomerSearch,
  handleCustomerSearchKeyDown,
  customerInputRef,
  isCustomerLoading,
  customerSearchResults,
  suggestionRefs,
  setSelectedCustomer,
  setCustomerInput,
  setCustomerSearchResults,
  productInputRef,
  setNewCustomer,
  setShowCustomerDrawer,
  nameInputRef,
  selectedCustomer,
  unselectCustomer,
  defaultProfileAvater,
  customerHighlightedIndex,
  setCustomerHighlightedIndex,
  customerDropdownRef,
  customerDropdownListRef,
}) => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search customer by phone or name"
            value={customerInput}
            onChange={handleCustomerSearch}
            onKeyDown={handleCustomerSearchKeyDown}
            ref={customerInputRef}
            className="input input-bordered w-full p-2.5 pr-10 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
            tabIndex={1}
          />
          <BsSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
          {isCustomerLoading && (
            <div className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 animate-spin">
              <svg
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
            </div>
          )}
          {customerSearchResults.length > 0 && (
            <ul 
              ref={customerDropdownListRef}
              className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-40 overflow-auto shadow-sm"
            >
              {customerSearchResults.map((customer, idx) => (
                <li
                  key={customer.id}
                  ref={(el) => (suggestionRefs.current[idx] = el)}
                  className={`p-2 cursor-pointer text-sm ${
                    idx === customerHighlightedIndex 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'hover:bg-blue-50'
                  }`}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setCustomerInput('');
                    setCustomerSearchResults([]);
                    setCustomerHighlightedIndex(-1);
                    productInputRef.current?.focus();
                  }}
                  onMouseEnter={() => setCustomerHighlightedIndex(idx)}
                  tabIndex={10 + idx}
                >
                  {customer.name} ({customer.phone})
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => {
            setNewCustomer({
              phone: customerInput,
              name: '',
              email: '',
              address: '',
              nidTinTax: '',
            });
            setShowCustomerDrawer(true);
            setTimeout(() => nameInputRef.current?.focus(), 0);
          }}
          className="btn btn-outline btn-primary flex items-center gap-2"
          tabIndex={2}
        >
          <FaPlus className="h-4 w-4" />
        </button>
      </div>
      {selectedCustomer && (
        <div className="relative bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="absolute -top-3 left-4 bg-white px-2 py-1 text-xs font-semibold text-gray-700 border border-gray-200 rounded">
            Customer Info
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <img
                src={selectedCustomer.avatar || defaultProfileAvater}
                alt={selectedCustomer.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <PiUser size={16} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">Name</p>
                    <p className="text-xs font-medium text-gray-500 truncate">
                      {selectedCustomer.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <PiEnvelope size={16} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">Email</p>
                    <p className="text-xs font-medium text-gray-500 truncate">
                      {selectedCustomer.email || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <PiPhoneCall size={16} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">Phone</p>
                    <p className="text-xs font-medium text-gray-500 truncate">
                      {selectedCustomer.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <PiMapPin size={16} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">Address</p>
                    <p className="text-xs font-medium text-gray-500 truncate">
                      {selectedCustomer.address || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <PiIdentificationBadge size={16} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">NID/TIN/TAX</p>
                    <p className="text-xs font-medium text-gray-500 truncate">
                      {selectedCustomer.nidTinTax || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg p-4 min-w-[200px]">
                <div className="flex divide-x divide-indigo-300">
                  <div className="text-center pr-4">
                    <p className="text-xs font-medium text-indigo-100 mb-1">Current Rewards</p>
                    <p className="text-2xl font-bold">
                      {selectedCustomer.reward_points || 0}
                    </p>
                  </div>
                  <div className="text-center pl-4">
                    <p className="text-xs font-medium text-indigo-100 mb-1">New Rewards</p>
                    <p className="text-2xl font-bold">
                      0
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSection;

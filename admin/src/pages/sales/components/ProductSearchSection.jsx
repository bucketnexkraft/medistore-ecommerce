
import React from 'react';
import PropTypes from 'prop-types';
import { BsSearch } from 'react-icons/bs';
import { FaPlus } from 'react-icons/fa';
import { FiFileText } from 'react-icons/fi';
import { formatPrice } from '../../../hooks/currency';
import { hasPermission } from '../../../utils/permissions';

const ProductSearchSection = ({
  productSearch,
  setProductSearch,
  handleProductSearch,
  products,
  productInputRef = null,
  isGlobalProductLoading = false,
  productSuggestions,
  suggestionRefs,
  addOrUpdateProduct,
  isReturn = false,
  showModal,
  getTotalQuantityForInventoryItem,
  getReservedQuantityForProduct,
  getAvailableBundleQuantity,
  productHighlightedIndex = -1,
  setProductHighlightedIndex,
  productDropdownListRef = null,
  isConfirmingSale = false,
  canCreateQuotation = false,
  toggleReturnMode,
  createQuotation,
  onOpenSellReturn = null,
}) => {
  const canCreateSale = hasPermission("stock-out.create");

  return (
    <div className="rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative w-full max-w-3xl">
          <div className="relative w-full">
            <input
              type="text"
              placeholder={
                isReturn
                  ? "Search product, barcode, or invoice number"
                  : "Search product, barcode, or combo bundle"
              }
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) => {
                // Let the global keyboard handler manage navigation
                if (e.key === 'Enter' && productHighlightedIndex === -1) {
                  e.preventDefault();
                  // Only handle Enter if no item is highlighted
                  handleProductSearch(products.length - 1, e.currentTarget.value);
                }
              }}
              ref={productInputRef}
              className="input input-bordered w-full p-2.5 pr-10 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-200"
              tabIndex={13}
                          />
            <BsSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
            {isGlobalProductLoading && (
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
          </div>
          {productSuggestions.length > 0 && (
            <ul 
              ref={productDropdownListRef}
              className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-40 overflow-auto shadow-sm"
            >
              {productSuggestions.map((product, idx) => {
                const isSelectable = product.is_selectable !== false && product.item_type !== 'notice';
                const totalSelected = product.inventory_item_id 
                  ? getTotalQuantityForInventoryItem(product.inventory_item_id)
                  : 0;
                const isBundle = product.item_type === 'bundle';
                const reservedByBundles = isBundle
                  ? 0
                  : getReservedQuantityForProduct(product.product_id);
                const remainingStock = isBundle
                  ? getAvailableBundleQuantity(product)
                  : (product.stock || 0) - totalSelected - reservedByBundles;
                const isOutOfStock = remainingStock <= 0;

                return (
                  <li
                    key={product.inventory_id || `product-${product.id}-${idx}`}
                    ref={(el) => (suggestionRefs.current[idx] = el)}
                    className={`p-2 text-sm ${
                      isSelectable ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      idx === productHighlightedIndex 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'hover:bg-gray-100'
                    } ${
                      isOutOfStock && isSelectable ? 'bg-yellow-50 text-yellow-900' : ''
                    }`}
                    onClick={() => {
                      if (!isSelectable) return;
                      addOrUpdateProduct(products.length - 1, product);
                      setProductHighlightedIndex(-1);
                    }}
                    onMouseEnter={() => setProductHighlightedIndex(idx)}
                    tabIndex={20 + idx}
                  >
                    {product.is_return
                      ? `Return: ${product.invoice_no || 'N/A'}`
                      : `${product.item_type === 'bundle' ? '[Bundle] ' : ''}${product.barcode || ''} - ${product.name}${
                          product.variant && product.variant !== 'N/A' ? ` (${product.variant})` : ''
                        }${product.unitPrice ? ` - ${formatPrice(product.unitPrice)}` : ''}${
                          product.item_type === 'bundle'
                            ? `${product.bundle_qty !== null && product.bundle_qty !== undefined ? ` - Default qty: ${Number(product.bundle_qty)}` : ''}`
                            : isSelectable
                              ? ` - Stock: ${remainingStock}`
                              : ''
                        }${isOutOfStock && isSelectable ? ' - OUT OF STOCK' : ''}`}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button
          className="btn btn-primary px-4"
          tabIndex={14}
          title="Add Coupon / Gift Card (Ctrl+G)"
          onClick={() => showModal('verify_coupon_or_gift_card_modal')}
          disabled={isReturn}
          aria-label="Apply coupon or gift card"
        >
          <FaPlus className="w-4 h-4" />
        </button>
        {canCreateSale && canCreateQuotation && (
          <button
            onClick={createQuotation}
            className="btn bg-teal-600 text-white hover:bg-teal-500 transition-colors duration-200"
            disabled={isConfirmingSale}
            title="Create Quotation"
            aria-label="Create quotation"
          >
            <FiFileText className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

ProductSearchSection.propTypes = {
  productSearch: PropTypes.string.isRequired,
  setProductSearch: PropTypes.func.isRequired,
  handleProductSearch: PropTypes.func.isRequired,
  products: PropTypes.array.isRequired,
  productInputRef: PropTypes.object,
  isGlobalProductLoading: PropTypes.bool,
  productSuggestions: PropTypes.array.isRequired,
  suggestionRefs: PropTypes.object.isRequired,
  addOrUpdateProduct: PropTypes.func.isRequired,
  isReturn: PropTypes.bool,
  showModal: PropTypes.func.isRequired,
  getTotalQuantityForInventoryItem: PropTypes.func.isRequired,
  getReservedQuantityForProduct: PropTypes.func.isRequired,
  getAvailableBundleQuantity: PropTypes.func.isRequired,
  productHighlightedIndex: PropTypes.number,
  setProductHighlightedIndex: PropTypes.func.isRequired,
  productDropdownListRef: PropTypes.object,
  isConfirmingSale: PropTypes.bool,
  canCreateQuotation: PropTypes.bool,
  toggleReturnMode: PropTypes.func,
  createQuotation: PropTypes.func.isRequired,
  onOpenSellReturn: PropTypes.func,
};

export default ProductSearchSection;

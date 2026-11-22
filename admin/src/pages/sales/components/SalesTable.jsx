import React, { useEffect, useState } from 'react';
import { FiCornerUpLeft } from 'react-icons/fi';
import { PiClockCountdown } from 'react-icons/pi';
import { useSelector } from 'react-redux';
import { getproductSettings } from '../../../api/productSettings';
import { formatPrice } from '../../../hooks/currency';
import { hasPermission } from '../../../utils/permissions';

const SalesTable = ({
  products,
  updateProduct,
  isReturn,
  handleReturnProduct,
  removeProduct,
  addManualRow,
  getTotalQuantityForInventoryItem,
  getReservedQuantityForProduct,
  getAvailableBundleQuantity,
  submitWaitlistForProduct,
  isSubmittingWaitlist = false,
}) => {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const canCreateSale = hasPermission("stock-out.create");
  const canSubmitWaitlist = hasPermission("stock-out.view") || canCreateSale;
  const [isWaitlistFeatureEnabled, setIsWaitlistFeatureEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadWaitlistFeature = async () => {
      if (!accessToken) {
        if (isMounted) {
          setIsWaitlistFeatureEnabled(false);
        }
        return;
      }

      try {
        const result = await getproductSettings(accessToken);
        const assignedPreferences = result?.data?.preferences || [];
        const waitlistPreference = assignedPreferences.find(
          (preference) => preference.code === "ftr_customer_waitlist"
        );
        if (isMounted) {
          setIsWaitlistFeatureEnabled(!!waitlistPreference?.is_active);
        }
      } catch (error) {
        if (isMounted) {
          setIsWaitlistFeatureEnabled(false);
        }
      }
    };

    loadWaitlistFeature();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const toSafeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const visibleProducts = products.filter((product) => {
    if (isReturn && !product.name && !product.is_return_product && !product.is_return_source) {
      return false;
    }

    return Boolean(
      product.name ||
      product.is_return_product ||
      product.is_return_source
    );
  });

  const getDisplayQuantity = (product) => product.quantity;

  const getDisplayTotal = (product) => (
    Number(product.totalPrice) || 0
  );

  return (
    <div className="rounded-lg p-4">
      <table className="w-full table-auto border border-gray-200">
        <thead className="border-b border-gray-200 bg-gray-100">
          <tr>
            <th className="p-2 text-left text-sm font-semibold text-gray-700">
              Product
            </th>
            <th className="p-2 text-left text-sm font-semibold text-gray-700">
              Quantity
            </th>
            <th className="p-2 text-left text-sm font-semibold text-gray-700">
              Unit Price
            </th>
            <th className="p-2 text-left text-sm font-semibold text-gray-700">
              Discount
            </th>
            <th className="p-2 text-left text-sm font-semibold text-gray-700">
              VAT (%)
            </th>
            <th className="p-2 text-left text-sm font-semibold text-gray-700">
              Total Price
            </th>
            <th className="p-2 text-left text-sm font-semibold text-gray-700"></th>
          </tr>
        </thead>
        <tbody>
          {visibleProducts.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-4 py-10 text-center">
                <div className="flex flex-col items-center justify-center gap-1 text-gray-400">
                  <div className="text-sm font-medium text-gray-500">No products added</div>
                  <div className="text-xs">Search or add a product to start the sale.</div>
                </div>
              </td>
            </tr>
          ) : (
          visibleProducts.map((product) => {
            const index = products.findIndex((item) => item.id === product.id);
            // Calculate the remaining stock for this specific inventory item
            const reservedByBundles =
                product.is_return_source
                  ? 0
                  : product.item_type === "bundle"
                ? 0
                : getReservedQuantityForProduct(product.product_id, index);
            const totalQuantitySelected = product.inventory_item_id 
              ? getTotalQuantityForInventoryItem(product.inventory_item_id, index)
              : 0;
            const remainingStock =
              product.item_type === "bundle"
                ? getAvailableBundleQuantity(
                    {
                      ...product,
                      components: product.bundle_components || [],
                    },
                    index
                  )
                : product.stock - totalQuantitySelected - reservedByBundles;
            const requestedQty = Math.abs(Number(product.quantity || 0));
            const canWaitlistThisRow =
              canSubmitWaitlist &&
              isWaitlistFeatureEnabled &&
              !isReturn &&
              !product.is_return_product &&
              !product.is_return_source &&
              !!product.product_id &&
              requestedQty > 0;

            return (
              <tr key={product.id} className="border-b border-gray-200">
                <td className="p-2">
                  <div className="min-w-[250px]">
                    <div className="space-y-1">
                      <div className="font-medium text-sm text-indigo-600">
                        {product.barcode} - {product.name}
                      </div>
                      {isReturn && product.is_return_product && (
                        <div className="text-xs inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                          Return Item
                        </div>
                      )}
                      {isReturn && product.is_return_source && (
                        <div className="text-xs inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                          Sold Item
                        </div>
                      )}
                      {product.barcode && (
                        <div className="text-xs text-gray-900 font-mono">
                          {product.item_type === "bundle" && Array.isArray(product.bundle_components) && product.bundle_components.length > 0 ? (
                            product.bundle_components
                              .map((component) => {
                                const configuredBundleQty = Number(product.bundle_qty ?? 0);
                                const rawQty = Number(component.quantity_per_bundle || 0);
                                const perBundleQty =
                                  configuredBundleQty > 0 ? rawQty / configuredBundleQty : 0;
                                return `${component.product_name} x${Number(perBundleQty.toFixed(4))}`;
                              })
                              .join(" | ")
                          ) : (
                            <>
                              {product.barcode} {product.variant && product.variant !== 'N/A' && (
                                <><span>|</span> {product.variant}</>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {!isReturn && remainingStock <= 0 && (
                        <div className="text-xs text-red-600 font-medium">
                          Out of Stock
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={getDisplayQuantity(product)}
                      onChange={(e) =>
                        updateProduct(index, 'quantity', e.target.value)
                      }
                      className="w-20 p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                      min={
                        isReturn && product.is_return_product
                          ? -toSafeNumber(product.max_quantity, toSafeNumber(product.stock, 1))
                          : 1
                      }
                      max={
                        isReturn && product.is_return_product
                          ? -1
                          : undefined
                      }
                      tabIndex={16 + index * 6}
                      disabled={product.is_returned || product.is_return_source}
                    />
                    {product.name !== "" && (
                      <small
                        className={`text-xs font-semibold whitespace-nowrap ${
                          remainingStock <= product.alert_quantity
                            ? 'text-red-500'
                            : remainingStock <= product.alert_quantity * 2
                            ? 'text-orange-500'
                            : 'text-blue-500'
                        }`}
                      >
                        {product.item_type === "bundle"
                          ? `Bundle Qty: ${Number(product.bundle_qty ?? 0)}`
                          : isReturn && product.is_return_product
                            ? `Returnable: ${toSafeNumber(
                                product.max_quantity,
                                toSafeNumber(product.stock, 0)
                              )}`
                            : isReturn && product.is_return_source
                              ? `Returnable: ${toSafeNumber(
                                  product.returnable_qty,
                                  toSafeNumber(product.max_quantity, 0)
                                )}`
                            : `Stock: ${
                                product.is_return_product
                                  ? toSafeNumber(product.stock, 0)
                                  : toSafeNumber(remainingStock, 0)
                              }`}
                      </small>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={product.unitPrice}
                    onChange={(e) =>
                      updateProduct(index, 'unitPrice', e.target.value)
                    }
                    className="w-20 p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                    min="0"
                    step="1"
                    tabIndex={17 + index * 6}
                    disabled={
                      product.is_returned || product.is_return_product || product.is_return_source
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={product.discount}
                    onChange={(e) =>
                      updateProduct(index, 'discount', e.target.value)
                    }
                    className="w-20 p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                    min="0"
                    max={["fixed", "flat"].includes(String(product.discount_type || "").toLowerCase()) ? undefined : "100"}
                    step="1"
                    tabIndex={18 + index * 6}
                    disabled={
                      isReturn ||
                      product.is_returned ||
                      product.is_return_product ||
                      product.is_return_source
                    }
                    placeholder="0"
                  />
                </td>
                {/* <td className="p-2">
                  <input
                    type="number"
                    value={product.tax_rate * 100} // Convert to percentage for display
                    onChange={
                      (e) =>
                        updateProduct(
                          index,
                          'tax_rate',
                          Number(e.target.value) / 100
                        ) // Convert back to decimal
                    }
                    className="w-20 p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                    min="0"
                    max="100"
                    step="1"
                    tabIndex={19 + index * 6} // Adjusted tabIndex
                    disabled={
                      isReturn ||
                      product.is_returned ||
                      product.is_return_product ||
                      product.is_return_source
                    }
                    placeholder="0"
                  />
                </td> */}
                <td className="p-2">
                  <input
                    type="number"
                    value={
                      product?.vat_rate === "" || product?.vat_rate === null
                        ? ""
                        : Number((Number(product.vat_rate) * 100).toFixed(4))
                    }
                    onChange={
                      (e) =>
                        updateProduct(
                          index,
                          'vat_rate',
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value) / 100
                        )
                    }
                    className="w-20 p-2.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                    min="0"
                    max="100"
                    step="1"
                    tabIndex={19 + index * 6}
                    disabled={
                      isReturn ||
                      product.is_returned ||
                      product.is_return_product
                    }
                    placeholder="0"
                  />
                </td>
                <td className="p-2 text-center text-sm font-semibold">
                  {formatPrice(getDisplayTotal(product))}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {canWaitlistThisRow && (
                      <button
                        type="button"
                        onClick={() => submitWaitlistForProduct?.(index)}
                        className={`rounded-lg border border-sky-500 p-2 text-sky-600 transition-colors duration-200 hover:bg-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSubmittingWaitlist ? "pointer-events-none" : ""
                        }`}
                        title="Submit this product to waitlist"
                        aria-label="Submit this product to waitlist"
                        disabled={isSubmittingWaitlist}
                      >
                        <PiClockCountdown className="h-4 w-4" />
                      </button>
                    )}
                    {isReturn && product.is_return_source && (
                      <button
                        type="button"
                        onClick={() => handleReturnProduct?.(index)}
                        className="rounded-md border border-orange-500 p-2 text-orange-600 transition-colors duration-200 hover:bg-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          product.is_returned ||
                          toSafeNumber(product.returnable_qty, toSafeNumber(product.max_quantity, 0)) <= 0
                        }
                        title="Add return row"
                        aria-label="Add return row"
                      >
                        <FiCornerUpLeft className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="border border-error text-error font-semibold p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors duration-200"
                      tabIndex={21 + index * 6}
                      disabled={product.is_returned}
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
                          strokeWidth="3"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SalesTable;

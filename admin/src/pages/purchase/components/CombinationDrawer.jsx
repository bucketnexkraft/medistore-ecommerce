import React, { useEffect, useState, useRef } from "react";
import { IoClose, IoAdd, IoRemove, IoPencil, IoTrash } from "react-icons/io5";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import Swal from 'sweetalert2';
import { fetchInventoryCheck } from "../../../api/purchase";
import { createId } from "../../../utils/createId";

export default function CombinationDrawer({
  combinationDrawerOpen,
  setCombinationDrawerOpen,
  stockCombinations,
  setStockCombinations,
  currentCombination,
  setCurrentCombination,
  variantMap,
  selectProduct,
  editingCombinationIndex,
  setEditingCombinationIndex,
  handleAddToList,
  generateCustomBarcode,
  existingCombinations,
  salesChannelEnabled = false,
  salesChannels = [],
}) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [isSaving, setIsSaving] = useState(false);
  const barcodeInputRef = useRef(null);
  const quantityManuallySetRef = useRef(false);
  const [selectedExistingCombinationId, setSelectedExistingCombinationId] = useState(null);

  const emptySalesChannels = () =>
    salesChannels.reduce((acc, channel) => {
      acc[channel.code] = "";
      return acc;
    }, {});

  const normalizeSalesChannels = (values = {}) =>
    salesChannels.reduce((acc, channel) => {
      acc[channel.code] = values?.[channel.code] ?? "";
      return acc;
    }, {});

  const calculateSalesChannelsFromProduct = (quantity) => {
    const percentages = selectProduct?.sales_channel || {};
    const activeChannels = salesChannels.filter((channel) => {
      const percentage = parseFloat(percentages?.[channel.code]) || 0;
      return percentage > 0;
    });

    if (!salesChannelEnabled || activeChannels.length === 0 || Number(quantity) <= 0) {
      return normalizeSalesChannels();
    }

    let remainingQuantity = Number(quantity);
    const allocations = normalizeSalesChannels();

    activeChannels.forEach((channel, index) => {
      if (index === activeChannels.length - 1) {
        allocations[channel.code] = remainingQuantity > 0 ? String(remainingQuantity) : "";
        return;
      }

      const percentage = parseFloat(percentages?.[channel.code]) || 0;
      const channelQuantity = Math.min(Math.ceil((Number(quantity) * percentage) / 100), remainingQuantity);
      allocations[channel.code] = channelQuantity > 0 ? String(channelQuantity) : "";
      remainingQuantity -= channelQuantity;
    });

    return allocations;
  };
  useEffect(() => {
    if (selectProduct?.code && !currentCombination.default_barcode) {
      setCurrentCombination((prev) => ({
        ...prev,
        default_barcode: selectProduct.code,
        barcodes: [selectProduct.code],
        vat: selectProduct.vat || "",
      }));
    }
  }, [selectProduct, currentCombination.default_barcode, setCurrentCombination]);

  useEffect(() => {
    if (!salesChannelEnabled || salesChannels.length === 0) return;

    setCurrentCombination((prev) => ({
      ...prev,
      sales_channels: normalizeSalesChannels(prev.sales_channels),
    }));
  }, [salesChannelEnabled, salesChannels.length]);

  // Check if a combination already exists in stockCombinations
  const isCombinationInStock = (ec) => {
    return stockCombinations.some((sc) =>
      Object.keys(variantMap).every(
        (key) => sc.combination[key] === ec.combination[key]
      )
    );
  };

  const handleSelectExistingCombination = (ec) => {
    // Check if the combination is already in stockCombinations to prevent duplicates
    if (isCombinationInStock(ec)) {
      toast.warn("This combination is already in the stock list.");
      return;
    }

    // Set the selected combination ID
    setSelectedExistingCombinationId(ec.id);

    // Populate the form with the existing combination's data
    setCurrentCombination({
      ...currentCombination,
      id: createId("purchase-combination"),
      product: selectProduct?.name || "",
      combination: { ...ec.combination }, // Copy the combination object
      quantity: ec.quantity || 0,
      purchase_price: ec.purchase_price || "",
      selling_price: ec.selling_price || "",
      expiry_date: ec.expiry_date || "",
      barcodes: ec.barcodes || [selectProduct?.code || ""],
      default_barcode: ec.barcodes?.[0] || selectProduct?.code || "",
      scan_each: ec.scan_each || false,
      custom_barcodes: ec.custom_barcodes || [""],
      use_custom_code: ec.use_custom_code || false,
      segmentations: ec.segmentations || [],
      batch_no: ec.batch_no || "",
      sales_channels: normalizeSalesChannels(ec.sales_channels),
      update_selling_price: false,
      currentStock: ec.currentStock || 0,
    });

    // Set editingCombinationIndex to null since this is not editing an existing stock combination
    setEditingCombinationIndex(null);
    quantityManuallySetRef.current = true;
  };

  const handleSaveCombination = async () => {
    setIsSaving(true);
    const { combination, quantity, purchase_price, selling_price, scan_each, barcodes, batch_no, expiry_date, vat, sales_channels } = currentCombination;

    // === All your validations (unchanged) ===
    if (
      Object.keys(variantMap).length > 0 &&
      !Object.keys(variantMap).every((key) => combination[key]?.trim())
    ) {
      toast.error("Please select all variant options.");
      setIsSaving(false);
      return;
    }

    if (!quantity || quantity <= 0) {
      toast.error("Quantity must be greater than 0.");
      setIsSaving(false);
      return;
    }

    if (!purchase_price || Number(purchase_price) <= 0) {
      toast.error("Purchase price must be at grater than 0.");
      setIsSaving(false);
      return;
    }

    if (!selling_price || Number(selling_price) <= 0) {
      toast.error("Selling price must be at grater than 0.");
      setIsSaving(false);
      return;
    }

    if (vat < 0 || vat > 100) {
      toast.error("VAT must be between 0 and 100%");
      setIsSaving(false);
      return;
    }

    if (salesChannelEnabled) {
      const salesChannelTotal = Object.values(sales_channels || {}).reduce(
        (sum, value) => sum + (parseFloat(value) || 0),
        0
      );

      if (salesChannelTotal > Number(quantity)) {
        toast.error("Sales channel quantities cannot exceed quantity.");
        setIsSaving(false);
        return;
      }
    }

    if (Number(selling_price) < Number(purchase_price)) {
      const { value: proceed } = await Swal.fire({
        title: 'Price Warning',
        text: `Selling price (${selling_price}) is less than purchase price (${purchase_price}). Do you want to proceed?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, proceed',
        cancelButtonText: 'No, cancel',
        reverseButtons: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showCloseButton: false,
      });
      if (!proceed) {
        setIsSaving(false);
        return;
      }
    }

    if (expiry_date) {
      const expiryDateObj = new Date(expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDateObj < today) {
        toast.error("Expiry date must be today or in the future.");
        setIsSaving(false);
        return;
      }
    }

    if (scan_each) {
      if (barcodes.length === 0 || barcodes.some(b => !b.trim())) {
        toast.error("Please add valid barcodes for all items when scanning each.");
        setIsSaving(false);
        return;
      }
      if (barcodes.length !== quantity) {
        toast.error(`Number of barcodes (${barcodes.length}) must match quantity (${quantity}).`);
        setIsSaving(false);
        return;
      }
    }

    if (batch_no && batch_no.trim().length < 3) {
      toast.error("Batch number must be at least 3 characters long if provided.");
      setIsSaving(false);
      return;
    }

    const isDuplicate = stockCombinations.some(
      (row, i) =>
        i !== editingCombinationIndex &&
        Object.keys(variantMap).every((key) => row.combination[key] === combination[key])
    );
    if (isDuplicate && editingCombinationIndex === null) {
      toast.error("This variant combination already exists.");
      setIsSaving(false);
      return;
    }

    const defaultBarcode = barcodes[0] || selectProduct?.code || "";
    const parsedValue = parseFloat(selling_price);

    try {
      const response = await fetchInventoryCheck(accessToken, {
        product_id: selectProduct.id,
        combination: JSON.stringify(currentCombination.combination),
      });

      let shouldUpdatePrice = false;

      // Only show price conflict modal if price differs
      if (response.exists && parseFloat(response.price) !== parsedValue) {
        const result = await Swal.fire({
          title: 'Price Update Confirmation',
          text: `Existing selling price for ${selectProduct.name} is ${response.price}, new is ${selling_price}.`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Update Price',
          cancelButtonText: 'Create New Record',
          reverseButtons: true,
          showCloseButton: true,           // X button visible
          allowOutsideClick: true,
          allowEscapeKey: true,
          allowEnterKey: false,
        });

        // ONLY cancel the entire save if user clicks X, Esc, or outside
        if (result.dismiss === Swal.DismissReason.close ||
          result.dismiss === Swal.DismissReason.esc ||
          result.dismiss === Swal.DismissReason.backdrop) {
          setIsSaving(false);
          return;
        }

        // If user clicked "Create New Record" → do NOT update price
        // If user clicked "Update Price" → DO update price
        shouldUpdatePrice = result.isConfirmed;
      }

      // === Always proceed to add/update the combination ===
      const newCombination = {
        ...currentCombination,
        selling_price: selling_price,
        update_selling_price: shouldUpdatePrice,
        currentStock: response.exists ? response.quantity || 0 : 0,
        default_barcode: defaultBarcode,
        vat: vat,
        sales_channels: salesChannelEnabled
          ? normalizeSalesChannels(currentCombination.sales_channels)
          : {},
      };

      if (editingCombinationIndex !== null) {
        setStockCombinations((prev) =>
          prev.map((row, i) =>
            i === editingCombinationIndex
              ? { ...newCombination, id: row.id }
              : row
          )
        );
        setEditingCombinationIndex(null);
      } else {
        setStockCombinations((prev) => [
          ...prev,
          { ...newCombination, id: createId("purchase-combination") }
        ]);
      }

      handleClearForm();
      toast.success("Combination saved successfully!");

    } catch (error) {
      console.error("Error checking inventory:", error);
      toast.error("Failed to check inventory. Adding anyway...");

      // Fallback: still add the combination
      const fallbackCombination = {
        ...currentCombination,
        selling_price,
        update_selling_price: false,
        currentStock: 0,
        default_barcode: defaultBarcode,
        vat: vat,
        sales_channels: salesChannelEnabled
          ? normalizeSalesChannels(currentCombination.sales_channels)
          : {},
      };

      if (editingCombinationIndex !== null) {
        setStockCombinations((prev) =>
          prev.map((row, i) =>
            i === editingCombinationIndex
              ? { ...fallbackCombination, id: row.id }
              : row
          )
        );
        setEditingCombinationIndex(null);
      } else {
        setStockCombinations((prev) => [
          ...prev,
          { ...fallbackCombination, id: createId("purchase-combination") }
        ]);
      }
      handleClearForm();
    }

    setIsSaving(false);
  };

  const handleClearForm = () => {
    quantityManuallySetRef.current = false;
    setCurrentCombination({
      id: "",
      product: selectProduct?.name || "",
      combination: {},
      quantity: 0,
      purchase_price: "",
      selling_price: "",
      expiry_date: "",
      barcodes: [selectProduct?.code || ""],
      default_barcode: selectProduct?.code || "",
      scan_each: false,
      custom_barcodes: [""],
      use_custom_code: false,
      segmentations: [],
      batch_no: "",
      sales_channels: emptySalesChannels(),
      update_selling_price: false,
      currentStock: 0,
      vat: 0,
    });
    setEditingCombinationIndex(null);
    setSelectedExistingCombinationId(null);
  };

  const handleEditCombination = (index) => {
    quantityManuallySetRef.current = true;
    setEditingCombinationIndex(index);
    setCurrentCombination({
      ...stockCombinations[index],
      barcodes: [...(stockCombinations[index].barcodes || [selectProduct?.code || ""])],
      default_barcode: stockCombinations[index].default_barcode || selectProduct?.code || "",
      custom_barcodes: [...(stockCombinations[index].custom_barcodes || [""])],
      segmentations: stockCombinations[index].segmentations || [],
      batch_no: stockCombinations[index].batch_no || "",
      sales_channels: normalizeSalesChannels(stockCombinations[index].sales_channels),
      update_selling_price: stockCombinations[index].update_selling_price || false,
      currentStock: stockCombinations[index].currentStock || 0,
      vat: stockCombinations[index].vat || 0,
    });
  };

  const handleDeleteCombination = (index) => {
    setStockCombinations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (e) => {
    const value = e.target.value;
    quantityManuallySetRef.current = true;
    // Allow empty string for clearing the field
    if (value === '') {
      setCurrentCombination((prev) => ({
        ...prev,
        quantity: 0,
        sales_channels: normalizeSalesChannels(),
      }));
      return;
    }

    const qty = parseInt(value, 10);
    // Only allow positive integers
    if (!isNaN(qty) && qty >= 0) {
      setCurrentCombination((prev) => ({
        ...prev,
        quantity: qty,
        sales_channels: calculateSalesChannelsFromProduct(qty),
      }));
    }
  };

  const handlePriceChange = (field, value) => {
    // Allow empty string for clearing the field
    if (value === '') {
      setCurrentCombination((prev) => ({
        ...prev,
        [field]: '',
      }));
      return;
    }

    // Allow decimal values
    const price = parseFloat(value);
    if (!isNaN(price) && price >= 0) {
      setCurrentCombination((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSalesChannelQuantityChange = (code, value) => {
    if (value !== "" && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
      toast.error("Sales channel quantity must be zero or greater.");
      return;
    }

    setCurrentCombination((prev) => ({
      ...prev,
      sales_channels: {
        ...normalizeSalesChannels(prev.sales_channels),
        [code]: value,
      },
    }));
  };

  const handleBarcodeInput = (e) => {
  if (e.key === "Enter") {
    let input = e.target.value.trim();
    if (!input) {
      toast.error("Please enter at least one barcode.");
      return;
    }

    let barcodeArray = [];        // Only the barcodes we will actually add
    let detectedQuantity = null;

    // === 1. Semicolon separated format ===
    if (input.includes(';')) {
      const parts = input.split(';').map(p => p.trim()).filter(Boolean);

      if (parts.length >= 3) {
        const qty = parseInt(parts[2], 10);
        if (!isNaN(qty) && qty > 0) {
          detectedQuantity = qty;
        }
        barcodeArray = parts.slice(3);   // Serial numbers after quantity
        if (barcodeArray.length === 0) barcodeArray = [parts[1]]; // fallback
      }
    }

    // === 2. M-delimited format (TxxxxMGTINM20M35198...M35198...) ===
    else if (input.startsWith('T') && input.includes('M')) {
      const parts = input.split('M')
                        .map(p => p.trim())
                        .filter(Boolean);

      if (parts.length >= 3) {
        // parts[0] = T10060547
        // parts[1] = 8806095822334   ← Main GTIN (we don't add this)
        // parts[2] = 20               ← Quantity
        // parts[3], parts[4]... = serial numbers starting with 35...

        const qty = parseInt(parts[2], 10);
        if (!isNaN(qty) && qty > 0) {
          detectedQuantity = qty;
        }

        // Only take parts that start with 'M' or are the long serial numbers
        // But since we split by M, we add "M" back to make barcode like M35198...
        barcodeArray = parts.slice(3).map(serial => {
          // If the serial doesn't already start with M, prepend it
          return serial.startsWith('M') ? serial : `M${serial}`;
        });
      }
    }

    // === 3. Other formats (space, dot, old regex) ===
    else if (input.includes(' ')) {
      barcodeArray = input.split(/\s+/).map(b => b.trim()).filter(Boolean);
    } 
    else if (input.includes('.')) {
      barcodeArray = input.split('.').map(b => b.trim()).filter(Boolean);
    } 
    else {
      const matches = input.match(/([A-Z]\d+)/g);
      barcodeArray = matches && matches.length > 0 ? matches : [input];
    }

    // Validation and adding
    const barcodeRegex = /^[a-zA-Z0-9\-_.]+$/;

    setCurrentCombination((prev) => {
      let newBarcodes = [...prev.barcodes];
      let newCustomBarcodes = [...prev.custom_barcodes];

      const currentQty = Number(prev.quantity) || 0;
      const hasManualQty = quantityManuallySetRef.current && currentQty > 0;
      const hasDetectedQty = Number.isInteger(detectedQuantity) && detectedQuantity > 0;
      const accumulatedDetectedQty = hasDetectedQty ? currentQty + detectedQuantity : currentQty;
      const maxQty = hasManualQty
        ? currentQty
        : hasDetectedQty
          ? accumulatedDetectedQty
          : Number.POSITIVE_INFINITY;

      for (const barcode of barcodeArray) {
        if (!barcodeRegex.test(barcode)) {
          toast.error(`Invalid barcode format: "${barcode}".`);
          continue;
        }

        if (newBarcodes.includes(barcode)) {
          toast.warn(`Barcode "${barcode}" already exists.`);
          continue;
        }

        if (newBarcodes.length >= maxQty) {
          toast.warn(`Cannot add more barcodes than quantity (${maxQty}).`);
          break;
        }

        newBarcodes = [barcode, ...newBarcodes];

        if (prev.use_custom_code) {
          newCustomBarcodes = [generateCustomBarcode(), ...newCustomBarcodes];
        }
      }

      // Quantity behavior:
      // 1) Keep user-entered quantity if already set.
      // 2) If not set, use detected quantity from scanner payload.
      // 3) If neither exists, grow quantity from scanned barcode count.
      const nextQuantity = hasManualQty
        ? currentQty
        : hasDetectedQty
          ? accumulatedDetectedQty
          : newBarcodes.length;

      return {
        ...prev,
        quantity: nextQuantity,
        barcodes: newBarcodes,
        custom_barcodes: newCustomBarcodes,
        default_barcode: newBarcodes[0] || prev.default_barcode || "",
      };
    });

    e.target.value = "";
    barcodeInputRef.current?.focus();
  }
};

  const handleRemoveBarcode = (index) => {
    setCurrentCombination((prev) => {
      const updatedBarcodes = prev.barcodes.filter((_, i) => i !== index);
      const updatedCustomBarcodes = prev.use_custom_code
        ? prev.custom_barcodes.filter((_, i) => i !== index)
        : prev.custom_barcodes;

      return {
        ...prev,
        barcodes: updatedBarcodes,
        custom_barcodes: updatedCustomBarcodes,
        default_barcode: updatedBarcodes[0] || selectProduct?.code || "",
      };
    });
  };

  const handleSegmentationChange = (index, field, value) => {
    setCurrentCombination((prev) => {
      const newSegmentations = [...(prev.segmentations || [])];
      newSegmentations[index] = { ...newSegmentations[index], [field]: value };
      return { ...prev, segmentations: newSegmentations };
    });
  };

  const addSegmentation = () => {
    setCurrentCombination((prev) => ({
      ...prev,
      segmentations: [{ key: "", value: "" }, ...(prev.segmentations || [])],
    }));
  };

  const removeSegmentation = (index) => {
    setCurrentCombination((prev) => ({
      ...prev,
      segmentations: (prev.segmentations || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="drawer drawer-end">
      <input
        id="combination_drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={combinationDrawerOpen}
        onChange={(e) => setCombinationDrawerOpen(e.target.checked)}
      />
      <div className="drawer-content"></div>
      <div className="drawer-side z-50">
        <label htmlFor="combination_drawer" className="drawer-overlay"></label>
        <div className="menu bg-base-100 text-base-content min-h-full w-full p-4 flex flex-row relative">
          <button
            type="button"
            className="btn btn-circle btn-outline absolute top-4 right-4"
            onClick={() => setCombinationDrawerOpen(false)}
            aria-label="Close drawer"
          >
            <IoClose size={24} />
          </button>
          {/* Left Sidebar */}
          <div className="w-1/4 p-4 border-r border-gray-300 flex flex-col">
            <h3 className="text-xl font-semibold mb-3 text-gray-800">
              Stock Group Setup
            </h3>
            <div className="flex-grow overflow-y-auto pr-1 space-y-3">
              {existingCombinations.length > 0 && (
                <div className="card w-full bg-white shadow-md rounded-2xl border border-gray-200">
                  {/* Card Header */}
                  <div className="flex items-center justify-between bg-gray-100 px-4 py-2 rounded-t-2xl">
                    <h2 className="text-md font-semibold text-gray-700">Existing Combinations</h2>
                  </div>

                  {/* Card Body */}
                  <div className="card-body p-4">
                    {existingCombinations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="table table-sm w-full">
                          <tbody>
                            {existingCombinations.map((ec, index) => {
                              const isDisabled = isCombinationInStock(ec);
                              return (
                                <tr
                                  key={ec.id || `combination-${index}`}
                                  className={`hover:bg-gray-50 ${isDisabled ? 'opacity-50' : ''}`}
                                >
                                  <td className="w-[6px] pr-0">
                                    <input
                                      type="checkbox"
                                      name="existing-combination"
                                      className="checkbox checkbox-sm"
                                      checked={selectedExistingCombinationId === ec.id}
                                      onChange={() => !isDisabled && handleSelectExistingCombination(ec)}
                                      disabled={isDisabled}
                                    />
                                  </td>
                                  <td className="text-sm">
                                    <span className="text-capitalize">
                                      {Object.entries(ec.combination)
                                        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                                        .join(", ")}
                                    </span>
                                    <span className="text-xs text-gray-500 block">Purchase Price: {ec.inventory_items?.purchase_price}</span>
                                    <span className="text-xs text-gray-500 block">Selling Price: {ec.inventory_items?.price}</span>
                                    {isDisabled && (
                                      <span className="text-xs text-gray-500 block">Already in stock list</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm italic">No combinations found.</p>
                    )}
                  </div>
                </div>
              )}
              <div className="card w-full bg-white shadow-md rounded-2xl border border-gray-200">
                {/* Card Header */}
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
                  <h4 className="text-md font-semibold text-gray-800">Stock Combinations</h4>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  {stockCombinations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-gray-500 py-10 px-4">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-12 h-12 mb-3 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 17v-2a4 4 0 018 0v2M12 7h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
                        />
                      </svg>
                      <p className="text-base font-medium text-gray-600">
                        No Stock Combinations
                      </p>
                      <p className="text-sm text-gray-400">
                        Add combinations using the form on the right or select from existing combinations above
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {stockCombinations.map((row) => (
                        <div
                          key={row.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50 px-2 rounded-lg transition-colors duration-150"
                        >
                          {/* Info Section */}
                          <div className="text-sm text-gray-700 space-y-1 flex-1">
                            <p>
                              <span className="font-medium text-gray-900">Combination:</span>{" "}
                              {Object.entries(row.combination)
                                .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                                .join(", ")}
                            </p>
                            {row.segmentations?.length > 0 && (
                              <p>
                                <span className="font-medium text-gray-900">Segmentations:</span>{" "}
                                {row.segmentations
                                  .map((seg) => `${seg.key}: ${seg.value}`)
                                  .join(", ")}
                              </p>
                            )}
                            {row.batch_no && (
                              <p>
                                <span className="font-medium text-gray-900">Lot No:</span>{" "}
                                {row.batch_no}
                              </p>
                            )}
                            <p>
                              <span className="font-medium text-gray-900">Default Barcode:</span>{" "}
                              {row.default_barcode || "N/A"}
                            </p>
                            <p>
                              <span className="font-medium text-gray-900">Current Stock:</span>{" "}
                              {row.currentStock || 0}
                            </p>
                            <span className="text-xs text-gray-500 block">Selling Price: {row.selling_price}</span>
                            <span className="text-xs text-gray-500 block">Purchase Price: {row.purchase_price}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 mt-3 sm:mt-0">
                            <button
                              type="button"
                              className="btn btn-circle btn-sm btn-ghost bg-gray-200 hover:bg-gray-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCombination(
                                  stockCombinations.findIndex((r) => r.id === row.id)
                                );
                              }}
                              aria-label="Edit combination"
                            >
                              <IoPencil size={16} className="text-gray-600" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-circle btn-sm btn-ghost bg-red-100 hover:bg-red-300"
                              onClick={() =>
                                handleDeleteCombination(
                                  stockCombinations.findIndex((r) => r.id === row.id)
                                )
                              }
                              aria-label="Delete combination"
                            >
                              <IoTrash size={16} className="text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
            <button
              type="button"
              className="btn btn-primary w-3/4 mt-4 mx-auto"
              onClick={handleAddToList}
              aria-label="Confirm stock groups"
            >
              Confirm Stock Group(s)
            </button>
          </div>
          {/* Right Content */}
          <div className="w-3/4 p-4 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Product: {selectProduct?.name || "Product"}
              </h3>
            </div>
            <div className="flex justify-between items-center mb-4">
              <div className="form-control w-1/2">
                <label className="label">
                  <span className="label-text">Lot No</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={currentCombination.batch_no || ""}
                  placeholder="Enter Lot No (Optional)"
                  onChange={(e) =>
                    setCurrentCombination((prev) => ({
                      ...prev,
                      batch_no: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline md:w-36"
                  onClick={handleClearForm}
                  aria-label="Reset form"
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn btn-primary md:w-36"
                  onClick={handleSaveCombination}
                  disabled={isSaving}
                  aria-label={editingCombinationIndex !== null ? "Update combination in list" : "Add combination to list"}
                >
                  {isSaving
                    ? "Processing..."
                    : editingCombinationIndex !== null
                      ? "Update List"
                      : "Add to List"}
                </button>
              </div>
            </div>
            {/* Variant Card */}
            <div className="card bg-base-100 shadow-md p-4">
              <div className="flex flex-wrap items-end gap-4">
                {Object.keys(variantMap).map((variantKey) => (
                  <div key={variantKey} className="form-control flex-1 min-w-[150px]">
                    <label className="label">
                      <span className="label-text">
                        {variantKey.charAt(0).toUpperCase() + variantKey.slice(1)}
                      </span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={currentCombination.combination[variantKey] || ""}
                      onChange={(e) => {
                        setCurrentCombination((prev) => ({
                          ...prev,
                          combination: {
                            ...prev.combination,
                            [variantKey]: e.target.value,
                          },
                        }));
                      }}
                    >
                      <option value="">Select {variantKey.charAt(0).toUpperCase() + variantKey.slice(1)}</option>
                      {variantMap[variantKey].map((val) => (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="form-control flex-1 min-w-[100px]">
                  <label className="label">
                    <span className="label-text">Quantity <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="number"
                    placeholder="Qty"
                    min={1}
                    className="input input-bordered w-full"
                    value={currentCombination.quantity || ""}
                    onChange={handleQuantityChange}
                    onKeyPress={(e) => {
                      // Prevent decimal points
                      if (e.key === '.') {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <div className="form-control flex-1 min-w-[100px]">
                  <label className="label">
                    <span className="label-text">Purchase Price <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={1}
                    className="input input-bordered w-full"
                    value={currentCombination.purchase_price}
                    onChange={(e) => handlePriceChange('purchase_price', e.target.value)}
                  />
                </div>
                <div className="form-control flex-1 min-w-[100px]">
                  <label className="label">
                    <span className="label-text">Selling Price <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={1}
                    className="input input-bordered w-full"
                    value={currentCombination.selling_price}
                    onChange={(e) => handlePriceChange('selling_price', e.target.value)}
                  />
                </div>
                <div className="form-control flex-1 min-w-[100px]">
                  <label className="label">
                    <span className="label-text">VAT (%)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="input input-bordered w-full"
                    value={currentCombination.vat ?? ""}
                    onChange={(e) =>
                      setCurrentCombination((prev) => ({
                        ...prev,
                        vat: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
                <div className="form-control flex-1 min-w-[120px]">
                  <label className="label">
                    <span className="label-text">Expiry Date</span>
                  </label>
                  <DatePicker
                    selected={
                      currentCombination.expiry_date
                        ? new Date(currentCombination.expiry_date)
                        : null
                    }
                    onChange={(date) => {
                      setCurrentCombination((prev) => ({
                        ...prev,
                        expiry_date: date ? date.toISOString().split("T")[0] : "",
                      }));
                    }}
                    className="input input-bordered w-full"
                    dateFormat="yyyy-MM-dd"
                    minDate={new Date()}
                    placeholderText="Select Expiry Date"
                    isClearable
                    showYearDropdown
                    showMonthDropdown
                    dropdownMode="select"
                  />
                </div>
              </div>
              {salesChannelEnabled && salesChannels.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-3">
                  {salesChannels.map((channel) => (
                    <label key={channel.code} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="whitespace-nowrap">{channel.value}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input input-bordered input-sm h-8 w-24 px-2 text-sm"
                        value={currentCombination.sales_channels?.[channel.code] ?? ""}
                        onChange={(e) =>
                          handleSalesChannelQuantityChange(channel.code, e.target.value)
                        }
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            {/* Barcode Card */}
            <div className="card bg-base-100 shadow-md p-4">
              <h4 className="text-md font-semibold mb-4">Barcode Options</h4>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <label className="flex items-center gap-3 tooltip" data-tip="Enable to scan each item individually">
                  <span className="label-text">Scan Each Item</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={currentCombination.scan_each}
                    onChange={(e) => {
                      setCurrentCombination((prev) => ({
                        ...prev,
                        scan_each: e.target.checked,
                        barcodes: e.target.checked ? [] : [selectProduct?.code || ""],
                        custom_barcodes: e.target.checked ? [] : [""],
                        default_barcode: selectProduct?.code || "",
                      }));
                    }}
                  />
                </label>
                <label className="flex items-center gap-3 tooltip" data-tip="Enable to use custom barcodes">
                  <span className="label-text">Use Custom Barcode</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={currentCombination.use_custom_code}
                    onChange={(e) => {
                      const newCustomBarcodes = e.target.checked
                        ? currentCombination.barcodes.map(() => generateCustomBarcode())
                        : [""];
                      setCurrentCombination((prev) => ({
                        ...prev,
                        use_custom_code: e.target.checked,
                        custom_barcodes: newCustomBarcodes,
                      }));
                    }}
                  />
                </label>
              </div>
              <div className="max-h-76 overflow-y-auto space-y-2 p-2 border rounded-lg">
                {currentCombination.scan_each ? (
                  <>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="Scan or enter barcode and press Enter"
                      onKeyDown={handleBarcodeInput}
                      ref={barcodeInputRef}
                    />
                    {currentCombination.barcodes.map((barcode, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            className="input input-bordered w-full"
                            value={barcode}
                            readOnly
                          />
                        </div>
                        {currentCombination.use_custom_code && (
                          <div className="flex-1">
                            <input
                              type="text"
                              className="input input-bordered w-full"
                              value={currentCombination.custom_barcodes[index] || ""}
                              readOnly
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn btn-error btn-sm"
                          onClick={() => handleRemoveBarcode(index)}
                          aria-label="Remove barcode"
                        >
                          <IoRemove size={18} />
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Barcode</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={currentCombination.barcodes[0] || selectProduct?.code || ""}
                        placeholder="Enter Barcode"
                        onChange={(e) =>
                          setCurrentCombination((prev) => ({
                            ...prev,
                            barcodes: [e.target.value || selectProduct?.code || ""],
                            default_barcode: e.target.value || selectProduct?.code || "",
                          }))
                        }
                      />
                    </div>
                    {currentCombination.use_custom_code && (
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Custom Barcode</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          value={currentCombination.custom_barcodes[0] || ""}
                          readOnly
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Segmentation Card */}
            <div className="card bg-white shadow-md rounded-xl border border-gray-200">
              <details className="collapse collapse-arrow rounded-xl">
                {/* Header */}
                <summary className="collapse-title font-medium text-gray-800 px-4 py-3">
                  <div>
                    <p className="text-base font-semibold">Product Segmentations</p>
                    <p className="text-sm text-gray-500 font-normal">
                      Define custom specifications. <span className="italic">Key</span> will be used as label.
                    </p>
                  </div>
                </summary>

                {/* Body */}
                <div className="collapse-content px-4 pb-4">
                  <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="table table-sm w-full">
                      <thead className="bg-gray-50 text-gray-700 text-sm">
                        <tr>
                          <th className="w-1/2">Key</th>
                          <th className="w-1/2">Value</th>
                          <th className="w-1/3">
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              onClick={addSegmentation}
                              aria-label="Add segmentation"
                            >
                              <IoAdd size={14} />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(currentCombination.segmentations || []).length === 0 ? (
                          <tr>
                            <td>
                              <input
                                type="text"
                                className="input input-bordered  w-full"
                                placeholder="E.g Warranty"
                                value=""
                                onChange={(e) =>
                                  handleSegmentationChange(0, "key", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="input input-bordered  w-full"
                                placeholder="E.g 30 Days"
                                value=""
                                onChange={(e) =>
                                  handleSegmentationChange(0, "value", e.target.value)
                                }
                              />
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-error btn-xs"
                                onClick={() => removeSegmentation(0)}
                                aria-label="Remove segmentation"
                                disabled
                              >
                                <IoRemove size={14} />
                              </button>
                            </td>
                          </tr>
                        ) : (
                          currentCombination.segmentations.map((seg, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="text"
                                  className="input input-bordered  w-full"
                                  value={seg.key}
                                  placeholder="E.g Warranty"
                                  onChange={(e) =>
                                    handleSegmentationChange(index, "key", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="input input-bordered  w-full"
                                  value={seg.value}
                                  placeholder="30 Days"
                                  onChange={(e) =>
                                    handleSegmentationChange(index, "value", e.target.value)
                                  }
                                />
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn btn-error btn-xs"
                                  onClick={() => removeSegmentation(index)}
                                  aria-label="Remove segmentation"
                                >
                                  <IoRemove size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            </div>
            {/* segmentationsCard */}
          </div>
        </div>
      </div>
    </div>
  );
}

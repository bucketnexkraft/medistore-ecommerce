import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { CiSearch, CiSquarePlus } from "react-icons/ci";
import { FiPlus } from "react-icons/fi";
import { useSelector } from "react-redux";
import {
  createPurchaseOrder,
  fetchInventoryCheck,
  getInvoice,
  getProductCombinations,
  getSalesChannels,
} from "../../api/purchase";
import { fetchInventory, getAllProduct } from "../../api/products";
import { toast } from "react-toastify";
import { getWarehouse } from "../../api/warehouse";
import { getSuppliers, storeSuppliers } from "../../api/supplier";
import SupplierAddEditModal from "../suppliers/components/SupplierAddEditModal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import CombinationDrawer from "./components/CombinationDrawer";
import ProductAddForm from "../product-setup/products/components/ProductAddForm";
import Swal from "sweetalert2";
import { IoClose } from "react-icons/io5";
import { formatPrice } from "../../hooks/currency";
import { getPosSettings } from "../../api/companyPreferances";
import { hasPermission } from "../../utils/permissions";
import { getproductSettings } from "../../api/productSettings";
import { createId } from "../../utils/createId";

export default function PurchaseCreate() {
  // State declarations
  const [supplier, setSupplier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [stockItems, setStockItems] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [schedulePayments, setSchedulePayments] = useState([]);
  const [note, setNote] = useState("");
  const [card_last_digits, setCardLastDigits] = useState("");
  const [qr_provider, setQrProvider] = useState("");
  const [qr_transaction_id, setQrTransactionId] = useState("");
  const [paymentMethodsSettings, setPaymentMethodsSettings] = useState([]);

  const [card_type, setCardType] = useState("");
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productList, setProductList] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef();
  const dropdownListRef = useRef();
  const barcodeInputRef = useRef();
  const productSearchInputRef = useRef();
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [isSupplierAdd, setSupplierAdd] = useState(false);
  const [selectProduct, setSelectedProduct] = useState(null);
  const [variantMap, setVariantMap] = useState({});
  const [combinationDrawerOpen, setCombinationDrawerOpen] = useState(false);
  const [editingCombinationIndex, setEditingCombinationIndex] = useState(null);
  const [stockCombinations, setStockCombinations] = useState([]);
  const [existingCombinations, setExistingCombinations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCombination, setCurrentCombination] = useState({
    id: "",
    product: "",
    combination: {},
    quantity: 0,
    purchase_price: "",
    selling_price: "",
    expiry_date: "",
    barcodes: [""],
    default_barcode: "",
    scan_each: false,
    custom_barcodes: [""],
    use_custom_code: false,
    segmentations: [],
    batch_no: "",
    sales_channels: {},
  });
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceList, setInvoiceList] = useState([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [highlightedInvoiceIndex, setHighlightedInvoiceIndex] = useState(-1);
  const invoiceDropdownRef = useRef();
  const invoiceDropdownListRef = useRef();
  const invoiceBarcodeInputRef = useRef();
  const [isProductLoading, setIsProductLoading] = useState(true);
  const [isPriceConfirming, setIsPriceConfirming] = useState(false);
  const [salesChannelEnabled, setSalesChannelEnabled] = useState(false);
  const [salesChannels, setSalesChannels] = useState([]);

  // Utility function for Reward Points eligibility
  const canRedeemPoints = useCallback(() => {
    // Placeholder logic: Assuming Reward Points are available if supplier is selected
    // Replace with actual logic based on your requirements
    return !!selectedSupplierId;
  }, [selectedSupplierId]);

  // Utility functions
  const generateCustomBarcode = useCallback(() => {
    return `CUST-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const buildVariantMap = useCallback((variantsArray) => {
    const map = {};
    if (Array.isArray(variantsArray)) {
      variantsArray.forEach((v) => {
        const key = Object.keys(v)[0];
        const value = v[key];
        if (!map[key]) map[key] = [];
        if (!map[key].includes(value)) map[key].push(value);
      });
    }
    return map;
  }, []);

  const normalizeSalesChannelValues = useCallback((value = {}) => {
    return salesChannels.reduce((acc, channel) => {
      acc[channel.code] = value?.[channel.code] ?? "";
      return acc;
    }, {});
  }, [salesChannels]);

  const mergeSalesChannelValues = useCallback((current = {}, incoming = {}) => {
    return salesChannels.reduce((acc, channel) => {
      const currentQty = parseFloat(current?.[channel.code]) || 0;
      const incomingQty = parseFloat(incoming?.[channel.code]) || 0;
      const total = currentQty + incomingQty;
      acc[channel.code] = total > 0 ? String(total) : "";
      return acc;
    }, {});
  }, [salesChannels]);

  const calculateSalesChannelQuantities = useCallback((percentages = {}, quantity = 0) => {
    const activeChannels = salesChannels.filter((channel) => {
      const percentage = parseFloat(percentages?.[channel.code]) || 0;
      return percentage > 0;
    });

    if (activeChannels.length === 0 || Number(quantity) <= 0) {
      return normalizeSalesChannelValues();
    }

    let remainingQuantity = Number(quantity);
    const allocations = normalizeSalesChannelValues();

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
  }, [salesChannels, normalizeSalesChannelValues]);

  const updatePaymentDetails = useCallback((field, value) => {
    switch (field) {
      case "card_type":
        setCardType(value);
        break;
      case "card_last_digits":
        setCardLastDigits(value);
        break;
      case "qr_provider":
        setQrProvider(value);
        break;
      case "qr_transaction_id":
        setQrTransactionId(value);
        break;
      default:
        break;
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsProductLoading(true); // Start loading
      const productList = await getAllProduct(accessToken);
      setProductList(Array.isArray(productList.data) ? productList.data : []);
    } catch (error) {
      toast.error("Failed to fetch products");
      console.error("Failed to fetch products:", error);
      setProductList([]);
    } finally {
      setIsProductLoading(false); // Always stop loading
    }
  }, [accessToken]);

  const fetchExistingCombinations = useCallback(
    async (productId) => {
      try {
        setIsLoading(true);
        const response = await getProductCombinations(accessToken, productId);
        if (response.status) {
          setExistingCombinations(
            Array.isArray(response.data.data) ? response.data.data : []
          );
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        console.error("Error fetching existing combinations:", error);
        toast.error("Failed to fetch product combinations");
        setExistingCombinations([]);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken]
  );

  const fetchInvoiceList = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getInvoice(accessToken, invoiceQuery || "");
      setInvoiceList(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching invoice list:", error);
      toast.error("Failed to fetch invoice list");
      setInvoiceList([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, invoiceQuery]);

  // Main handlers
  const handleSelect = useCallback(
    async (product) => {
      if (!product) return;

      setSelectedProductId(product.id);
      setSelectedProduct(product);
      setOpen(false);
      setQuery("");

      try {
        setIsLoading(true);

        // Always check inventory (variant or not)
        const response = await fetchInventoryCheck(accessToken, {
          product_id: product.id,
          combination: {}, // Empty for both variant and non-variant
        });

        const currentStock = response.exists ? response.quantity || 0 : 0;
        const existingPrice = response.exists
          ? response.price || 0
          : product.selling_price || 0;
        const existingPurchasePrice = response.exists
          ? response.purchase_price || 0
          : product.purchase_price || 0;

        // Set variant map
        const variantsMap = product.has_variant
          ? buildVariantMap(product.variants)
          : {};

        setVariantMap(variantsMap);

        // Prepare current combination
        const defaultQuantity = 1;
        setCurrentCombination({
          id: "",
          product: product.name || "",
          combination: {}, // Always empty object (non-variant = no combination)
          quantity: defaultQuantity,
          purchase_price: existingPurchasePrice || product.purchase_price || "",
          selling_price: existingPrice || product.selling_price || "",
          expiry_date: "",
          barcodes: [product.code || ""],
          default_barcode: product.code || "",
          scan_each: false,
          custom_barcodes: [""],
          use_custom_code: false,
          segmentations: [],
          batch_no: "",
          sales_channels: salesChannelEnabled
            ? calculateSalesChannelQuantities(product.sales_channel, defaultQuantity)
            : normalizeSalesChannelValues(),
          update_selling_price: false,
          currentStock: currentStock,
          vat: product.vat || 0,
        });

        // Fetch existing combinations only for variant products
        if (product.has_variant) {
          await fetchExistingCombinations(product.id);
        } else {
          setExistingCombinations([]); // Clear for non-variant
        }

        // Always open the drawer
        setCombinationDrawerOpen(true);

      } catch (error) {
        console.error("Error checking inventory for product:", error);
        toast.error("Failed to check inventory for product");

        // Fallback: still open drawer
        setVariantMap(product.has_variant ? buildVariantMap(product.variants) : {});
        setExistingCombinations([]);
        const defaultQuantity = 1;
        setCurrentCombination({
          id: "",
          product: product.name || "",
          combination: {},
          quantity: defaultQuantity,
          purchase_price: product.purchase_price || 0,
          selling_price: product.selling_price || 0,
          expiry_date: "",
          barcodes: [product.code || ""],
          default_barcode: product.code || "",
          scan_each: false,
          custom_barcodes: [""],
          use_custom_code: false,
          segmentations: [],
          batch_no: "",
          sales_channels: salesChannelEnabled
            ? calculateSalesChannelQuantities(product.sales_channel, defaultQuantity)
            : normalizeSalesChannelValues(),
          update_selling_price: false,
          currentStock: 0,
          vat: product.vat || 0,
        });
        setCombinationDrawerOpen(true); // Always open even on error
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, buildVariantMap, fetchExistingCombinations, normalizeSalesChannelValues, salesChannelEnabled, calculateSalesChannelQuantities]
  );

  const handleBarcodeScan = useCallback(
    (barcode) => {
      const product = Array.isArray(productList)
        ? productList.find((p) => p.code === barcode)
        : null;
      if (product) {
        handleSelect(product);
      } else {
        toast.error("Product not found for barcode: " + barcode);
      }
      setQuery("");
    },
    [productList, handleSelect]
  );

  const handleCheckInvoice = useCallback(
    async (selectedInvoice) => {
      try {
        setIsLoading(true);
        const response = await getInvoice(
          accessToken,
          selectedInvoice.invoice_no
        );
        if (response.status) {
          const invoice = response.data;
          setSupplier(invoice.supplier_id || "");
          setInvoiceDate(invoice.invoice_date || "");
          setSelectedWarehouseId(invoice.warehouse || "");
          setSelectedSupplierId(invoice.supplier_id || "");
          setInvoiceNo(invoice.invoice_no || "");
          setPaymentMethod(invoice.payment_method || "");
          setPaidAmount(invoice.paid_amount || invoice.total_amount || "");
          setSchedulePayments(invoice.schedule_payments || []);
          setNote(invoice.note || "");
          setCardType(invoice.card_type || "");
          setCardLastDigits(invoice.card_last_digits || "");
          setQrProvider(invoice.qr_provider || "");
          setQrTransactionId(invoice.qr_transaction_id || "");
          const inventoryItems = Array.isArray(invoice.inventory)
            ? invoice.inventory
            : [];
          const mappedStockItems = await Promise.all(
            inventoryItems.map(async (item) => {
              let productName =
                item.product?.name +
                (item.stock_group?.group
                  ? `-${item.stock_group.group}`
                  : "") || "";
              return {
                id: createId("purchase-stock-item"),
                productId: item.productId || item.product_id || "",
                name: productName,
                quantity: item.quantity || 1,
                purchase_price: item.purchasePrice || item.purchase_price || 0,
                selling_price: item.price || 0,
                expiry_date: item.expiryDate || item.expiry_date || "",
                combination: item.combination || {},
                barcode: item.barcode || "",
                alert_quantity: 5,
                currentStock: item.quantity || 0,
                batch_no: item.batch_no || "",
                sales_channels: normalizeSalesChannelValues(item.sales_channels),
                update_selling_price: false,
              };
            })
          );
          setStockItems(mappedStockItems);
          setInvoiceOpen(false);
          setInvoiceQuery("");
        } else {
          toast.error("Invoice not found");
          setInvoiceNo(selectedInvoice.invoice_no);
          document.getElementById("invoice_drawer").checked = true;
        }
      } catch (error) {
        toast.error("Error checking invoice");
        console.error("Error checking invoice:", error);
        setInvoiceNo(selectedInvoice.invoice_no);
        document.getElementById("invoice_drawer").checked = true;
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, normalizeSalesChannelValues]
  );

  const handleInvoiceBarcodeScan = useCallback(
    (barcode) => {
      const invoice = Array.isArray(invoiceList)
        ? invoiceList.find((inv) => inv.invoice_no === barcode)
        : null;
      if (invoice) {
        handleCheckInvoice(invoice);
      } else {
        toast.error("Invoice not found for barcode: " + barcode);
      }
      setInvoiceQuery("");
    },
    [invoiceList, handleCheckInvoice]
  );

  const handleAddToList = useCallback(async () => {
    if (!selectProduct || !Array.isArray(stockCombinations)) {
      toast.error("No product selected or invalid combinations");
      return;
    }

    try {
      setIsLoading(true);
      const incomplete = stockCombinations.some((row) => {
        const variantsFilled = Object.values(row.combination || {}).every(
          (v) => v && v.trim() !== ""
        );
        const hasQuantity = row.quantity && Number(row.quantity) > 0;
        const hasPurchasePrice =
          row.purchase_price && Number(row.purchase_price) > 0;
        const hasSellingPrice =
          row.selling_price && Number(row.selling_price) > 0;
        const hasBarcodes = row.scan_each
          ? Array.isArray(row.barcodes) &&
          row.barcodes.length === Number(row.quantity) &&
          row.barcodes.every((b) => b && b.trim() !== "")
          : true;

        return !(
          variantsFilled &&
          hasQuantity &&
          hasPurchasePrice &&
          hasSellingPrice &&
          hasBarcodes
        );
      });

      if (incomplete) {
        toast.error(
          "Please complete all variant combinations with valid quantity (>0), purchase price (>0), selling price (>0), and barcodes (when scanning each item)"
        );
        return;
      }

      const updatedRows = await Promise.all(
        stockCombinations.map(async (row) => {
          try {
            const response = await fetchInventory(accessToken, {
              product_id: selectProduct.id,
              combination: row.combination,
              lot_number: row.batch_no,
            });

            const data = response?.data || {};

            return {
              ...row,
              id: createId("purchase-stock-item"),
              productId: selectProduct.id,
              name: selectProduct.name || "",
              barcode:
                row.default_barcode || data.barcode || selectProduct.code || "",
              default_barcode: selectProduct.code || "",
              custom_barcode: row.use_custom_code
                ? Array.isArray(row.custom_barcodes)
                  ? row.custom_barcodes[0] || ""
                  : ""
                : "",
              currentStock: data.quantity ?? 0,
              alert_quantity: 5,
              batch_no: row.batch_no || "",
              product_sales_channel: selectProduct.sales_channel || {},
              sales_channels: normalizeSalesChannelValues(row.sales_channels),
            };
          } catch (error) {
            return {
              ...row,
              id: createId("purchase-stock-item"),
              productId: selectProduct.id,
              name: selectProduct.name || "",
              barcode: row.default_barcode || selectProduct.code || "",
              default_barcode: selectProduct.code || "",
              custom_barcode: row.use_custom_code
                ? Array.isArray(row.custom_barcodes)
                  ? row.custom_barcodes[0] || ""
                  : ""
                : "",
              currentStock: 0,
              alert_quantity: 5,
              batch_no: row.batch_no || "",
              product_sales_channel: selectProduct.sales_channel || {},
              sales_channels: normalizeSalesChannelValues(row.sales_channels),
            };
          }
        })
      );

      setStockItems((prev) => {
        const items = Array.isArray(prev) ? [...prev] : [];
        const newItems = [];
        const updatedItems = [...items];

        updatedRows.forEach((newRow) => {
          const existingIndex = updatedItems.findIndex(
            (item) =>
              item.productId === newRow.productId &&
              JSON.stringify(item.combination) ===
              JSON.stringify(newRow.combination)
          );
          if (existingIndex !== -1) {
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity:
                (parseFloat(updatedItems[existingIndex].quantity) || 0) +
                (parseFloat(newRow.quantity) || 0),
              currentStock: newRow.currentStock,
              sales_channels: mergeSalesChannelValues(
                updatedItems[existingIndex].sales_channels,
                newRow.sales_channels
              ),
            };
            const [movedItem] = updatedItems.splice(existingIndex, 1);
            newItems.push(movedItem);
          } else {
            newItems.push(newRow);
          }
        });

        return [...newItems, ...updatedItems];
      });

      setStockCombinations([]);
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
        sales_channels: normalizeSalesChannelValues(),
      });
      setCombinationDrawerOpen(false);
      setQuery("");
    } catch (error) {
      toast.error("An error occurred while adding combinations to the list.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectProduct, stockCombinations, normalizeSalesChannelValues, mergeSalesChannelValues]);

  const handleAddSchedulePayment = useCallback(() => {
    setSchedulePayments((prev) => [
      ...prev,
      {
        id: createId("purchase-schedule-payment"),
        amount: "",
        due_date: "",
        reminder_date: "",
      },
    ]);
  }, []);

  const handleSchedulePaymentChange = useCallback((id, field, value) => {
    setSchedulePayments((prev) =>
      prev.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    );
  }, []);

  const handleRemoveSchedulePayment = useCallback((id) => {
    setSchedulePayments((prev) => prev.filter((payment) => payment.id !== id));
  }, []);

  const createPurchaseHandler = useCallback(
    async (e) => {
      e.preventDefault();

      // BLOCK SUBMIT IF PRICE CONFIRMATION IS IN PROGRESS
      if (isPriceConfirming) {
        toast.warn("Please complete the selling price confirmation first");
        return;
      }

      if (!stockItems || stockItems.length === 0) {
        toast.error("Please add at least one stock item");
        return;
      }

      // Basic validation
      const invalidItems = stockItems.filter((item) => {
        return (
          !item.quantity ||
          parseFloat(item.quantity) <= 0 ||
          !item.purchase_price ||
          parseFloat(item.purchase_price) <= 0 ||
          !item.selling_price ||
          parseFloat(item.selling_price) < 0
        );
      });

      if (invalidItems.length > 0) {
        toast.error("All items must have valid quantity (>0), purchase price (≥1), and selling price (≥1)");
        return;
      }

      const invalidSalesChannelItem = salesChannelEnabled
        ? stockItems.find((item) => {
            const channelTotal = Object.values(item.sales_channels || {}).reduce(
              (sum, value) => sum + (parseFloat(value) || 0),
              0
            );
            return channelTotal > (parseFloat(item.quantity) || 0);
          })
        : null;

      if (invalidSalesChannelItem) {
        toast.error("Sales channel quantities cannot exceed the stock quantity.");
        return;
      }

      // 1. Warning: Selling price < Purchase price
      const hasLowSellingPrice = stockItems.some(item => {
        const sell = parseFloat(item.selling_price) || 0;
        const buy = parseFloat(item.purchase_price) || 0;
        return sell < buy;
      });

      if (hasLowSellingPrice) {
        const result = await Swal.fire({
          title: "Warning: Low Selling Price",
          html: `
          <p>One or more items have <strong>selling price lower than purchase price</strong>.</p>
          <p>This will result in a <strong>loss on sale</strong>.</p>
          <p>Do you still want to proceed?</p>
        `,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes, Proceed Anyway",
          cancelButtonText: "No, Let Me Fix",
          reverseButtons: true,
          showCloseButton: true,
          allowOutsideClick: true,
          allowEscapeKey: true,
        });

        if (!result.isConfirmed) {
          toast.info("Purchase cancelled");
          return;
        }
      }

      // 2. Final Check: New price lower than current inventory price
      const itemsNeedingCheck = stockItems.filter(item =>
        item.currentStock > 0 && item.update_selling_price !== true
      );

      if (itemsNeedingCheck.length > 0) {
        setIsLoading(true);
        const mismatchedItems = [];

        try {
          for (const item of itemsNeedingCheck) {
            const response = await fetchInventoryCheck(accessToken, {
              product_id: item.productId,
              combination: item.combination ? JSON.stringify(item.combination) : {},
              lot_number: item.batch_no || undefined,
            });

            const currentPrice = parseFloat(response.price || 0);
            const newPrice = parseFloat(item.selling_price || 0);

            if (response.exists && currentPrice > newPrice) {
              mismatchedItems.push({
                name: item.name,
                currentPrice,
                newPrice,
                combination: Object.entries(item.combination || {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" | "),
              });
            }
          }
        } catch (error) {
          console.error("Inventory price check failed:", error);
          toast.warn("Could not verify current prices. Proceeding with caution...");
        } finally {
          setIsLoading(false);
        }

        if (mismatchedItems.length > 0) {
          const listHtml = mismatchedItems
            .map(i => `
            • <strong>${i.name}</strong>${i.combination ? ` (${i.combination})` : ""}
            <br>&nbsp;&nbsp;Current: <strong>${formatPrice(i.currentPrice)}</strong>
            → New: <strong>${formatPrice(i.newPrice)}</strong>
          `)
            .join("<br>");

          const result = await Swal.fire({
            title: "Update Selling Price Globally?",
            html: `
            <p>The following items have a <strong>lower selling price</strong> than current stock:</p>
            <div class="text-left text-sm max-h-60 overflow-y-auto p-3 bg-gray-50 rounded mt-4">
              ${listHtml}
            </div>
            <p class="mt-6 font-semibold">Do you want to update the price for all future sales?</p>
          `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Update Price",
            cancelButtonText: "No, Create New Record",
            reverseButtons: true,
            showCloseButton: true,
            allowOutsideClick: true,
            allowEscapeKey: true,
            width: "720px",
          });

          // BLOCK SUBMIT if user closes modal (X, Esc, outside) OR clicks "No"
          if (result.dismiss || !result.isConfirmed) {
            toast.info("Purchase cancelled — price update not confirmed");
            return;
          }

          const shouldUpdateGlobally = result.isConfirmed;

          setStockItems(prev =>
            prev.map(item => {
              const isMismatched = mismatchedItems.some(m =>
                m.name === item.name &&
                JSON.stringify(item.combination) ===
                JSON.stringify(
                  mismatchedItems.find(x => x.name === item.name)?.combination || {}
                )
              );

              return isMismatched
                ? { ...item, update_selling_price: shouldUpdateGlobally }
                : item;
            })
          );
        }
      }

      // FINAL SUBMIT — Only reaches here if ALL confirmations passed
      try {
        setIsLoading(true);

        const finalItems = stockItems.map(item => ({
          ...item,
          id: item.productId,
          vat: item.vat || 0,
          sales_channels: salesChannelEnabled
            ? Object.entries(item.sales_channels || {}).reduce((acc, [code, quantity]) => {
                const parsedQuantity = parseFloat(quantity) || 0;
                if (parsedQuantity > 0) {
                  acc[code] = parsedQuantity;
                }
                return acc;
              }, {})
            : {},
          update_selling_price: !!item.update_selling_price,
        }));

        const formData = new FormData();
        formData.append("type", "purchase");
        formData.append("invoice_no", invoiceNo);
        formData.append("warehouse_id", selectedWarehouseId);
        formData.append("supplier_id", selectedSupplierId);
        formData.append("date", invoiceDate);
        formData.append("grandTotal", amount);
        formData.append("note", note);
        formData.append("items", JSON.stringify(finalItems));

        const result = await createPurchaseOrder(accessToken, formData);

        if (result.status) {
          const successMessage = result.message || "Stock in created successfully";
          // Reset form
          setStockItems([]);
          setInvoiceNo("");
          setAmount("");
          setPaidAmount("");
          setPaymentMethod(paymentMethodsSettings[0]?.name || "");
          setSchedulePayments([]);
          setNote("");
          setCardLastDigits("");
          setQrProvider("");
          setQrTransactionId("");
          const invoiceDrawer = document.getElementById("invoice_drawer");
          if (invoiceDrawer) {
            invoiceDrawer.checked = false;
          }
          setTimeout(() => toast.success(successMessage), 0);
        } else {
          const errors = Array.isArray(result.error?.errors)
            ? result.error.errors
            : [result.error?.message || "Failed to create purchase"];
          errors.slice(0, 5).forEach(msg => toast.error(msg));
          if (errors.length > 5) toast.error(`${errors.length - 5} more error(s)...`);
        }
      } catch (err) {
        console.error("Purchase submit error:", err);
        toast.error("Failed to save purchase. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [
      accessToken,
      stockItems,
      amount,
      paidAmount,
      invoiceNo,
      selectedWarehouseId,
      selectedSupplierId,
      invoiceDate,
      paymentMethod,
      schedulePayments,
      note,
      card_last_digits,
      qr_provider,
      qr_transaction_id,
      paymentMethodsSettings,
      salesChannelEnabled,
      isPriceConfirming, // ← Don't forget to add this!
    ]
  );

  const handleSupplierAdd = useCallback(
    async (formData) => {
      try {
        setIsLoading(true);
        const response = await storeSuppliers(accessToken, formData);
        if (!response.status) {
          throw new Error(response.message || "Failed to create supplier");
        }
        toast.success("Supplier created successfully!");
        const updatedSuppliers = await getSuppliers(accessToken);
        setSuppliers(
          Array.isArray(updatedSuppliers.data) ? updatedSuppliers.data : []
        );
        setSupplierAdd(false);
      } catch (error) {
        toast.error(error.message || "Failed to create supplier");
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken]
  );

  const handleChange = useCallback((id, field, value) => {
    if (field === "remove") {
      setStockItems((prev) =>
        Array.isArray(prev) ? prev.filter((item) => item.id !== id) : []
      );
      return;
    }

    if (field === "quantity") {
      const qty = parseFloat(value);
      if (value !== "" && (isNaN(qty) || qty <= 0)) {
        toast.error("Quantity must be greater than 0");
        return;
      }
    }

    if (field === "purchase_price") {
      const price = parseFloat(value);
      if (value !== "" && (isNaN(price) || price < 0)) {
        toast.error("Purchase price cannot be negative");
        return;
      }
    }

    if (field === "selling_price") {
      const price = parseFloat(value);
      if (value !== "" && (isNaN(price) || price < 0)) {
        toast.error("Selling price cannot be negative");
        return;
      }
    }

    if (field === "alert_quantity") {
      const qty = parseFloat(value);
      if (value !== "" && (isNaN(qty) || qty < 0)) {
        toast.error("Alert quantity must be 0 or greater");
        return;
      }
    }

    if (field === "expiry_date" && value) {
      const expiryDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate < today) {
        toast.error("Expiry date must be today or in the future");
        return;
      }
    }

    if (field === "vat") {
      const v = parseFloat(value);
      if (value !== "" && (isNaN(v) || v < 0 || v > 100)) {
        toast.error("VAT must be between 0 and 100%");
        return;
      }
    }

    setStockItems((prev) =>
      Array.isArray(prev)
        ? prev.map((item) => {
          if (item.id !== id) return item;

          const nextItem = { ...item, [field]: value };
          if (field === "quantity" && salesChannelEnabled) {
            nextItem.sales_channels = calculateSalesChannelQuantities(
              item.product_sales_channel,
              value
            );
          }

          return nextItem;
        })
        : []
    );
  }, [salesChannelEnabled, calculateSalesChannelQuantities]);

  const handleSellingPriceBlur = useCallback(
    async (id, value) => {
      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue) || parsedValue < 1) {
        toast.error("Selling price must be at least 1");
        setStockItems(prev => prev.map(item =>
          item.id === id ? { ...item, selling_price: item.purchase_price || "" } : item
        ));
        return;
      }

      const item = stockItems.find(i => i.id === id);
      if (!item) return;

      const purchasePrice = parseFloat(item.purchase_price) || 0;

      // Low selling price warning
      if (parsedValue < purchasePrice) {
        const result = await Swal.fire({
          title: "Price Warning",
          text: `Selling price (${parsedValue}) is less than purchase price (${purchasePrice}). Proceed?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes",
          cancelButtonText: "No",
          showCloseButton: true,
          allowOutsideClick: true,
          allowEscapeKey: true,
        });

        if (!result.isConfirmed) {
          setStockItems(prev => prev.map(i =>
            i.id === id ? { ...i, selling_price: item.selling_price || purchasePrice } : i
          ));
          return;
        }
      }

      try {
        setIsPriceConfirming(true); // BLOCK SUBMIT

        const response = await fetchInventoryCheck(accessToken, {
          product_id: item.productId,
          combination: item.combination ? JSON.stringify(item.combination) : {},
          lot_number: item.batch_no || undefined,
        });

        if (!response.exists || parseFloat(response.price || 0) === parsedValue) {
          setStockItems(prev => prev.map(i =>
            i.id === id
              ? { ...i, selling_price: parsedValue, update_selling_price: false }
              : i
          ));
          return;
        }

        const result = await Swal.fire({
          title: "Price Update Confirmation",
          text: `Current price: ${response.price}, New: ${parsedValue}. Update globally?`,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Yes, Update Price",
          cancelButtonText: "No, Create New Record",
          reverseButtons: true,
          showCloseButton: true,
          allowOutsideClick: true,
          allowEscapeKey: true,
        });

        // If user cancels (X, Esc, outside, or "No")
        if (result.dismiss || !result.isConfirmed) {
          // toast.info("Price change cancelled");
          setStockItems(prev => prev.map(i =>
            i.id === id ? { ...i, selling_price: response.price || item.selling_price } : i
          ));
          return;
        }

        const shouldUpdate = result.isConfirmed;

        setStockItems(prev => prev.map(i =>
          i.id === id
            ? {
              ...i,
              selling_price: parsedValue,
              update_selling_price: shouldUpdate,
              currentStock: response.quantity || 0,
            }
            : i
        ));

        toast.success(shouldUpdate ? "Price updated globally" : "New record will be created");
      } catch (err) {
        console.error(err);
        toast.warn("Could not verify price. Saved locally.");
        setStockItems(prev => prev.map(i =>
          i.id === id ? { ...i, selling_price: parsedValue, update_selling_price: false } : i
        ));
      } finally {
        setIsPriceConfirming(false); // UNBLOCK SUBMIT
      }
    },
    [accessToken, stockItems]
  );

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setIsLoading(true);
        const result = await getSuppliers(accessToken);
        setSuppliers(Array.isArray(result.data) ? result.data : []);
      } catch (err) {
        toast.error("Failed to fetch suppliers");
        console.error("Failed to fetch suppliers:", err);
        setSuppliers([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSuppliers();
  }, [accessToken]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        setIsLoading(true);
        const response = await getWarehouse(accessToken);
        setWarehouses(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        toast.error("Failed to fetch warehouses");
        console.error("Error fetching warehouses:", error);
        setWarehouses([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWarehouses();
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
      if (
        invoiceDropdownRef.current &&
        !invoiceDropdownRef.current.contains(event.target)
      ) {
        setInvoiceOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Handle barcode input
      if (event.target === barcodeInputRef.current) {
        if (event.key === "Enter" && query) {
          event.preventDefault();
          handleBarcodeScan(query);
        }
      }
      if (event.target === invoiceBarcodeInputRef.current) {
        if (event.key === "Enter" && invoiceQuery) {
          event.preventDefault();
          handleInvoiceBarcodeScan(invoiceQuery);
        }
      }

      // Handle product search keyboard navigation
      const currentFiltered = Array.isArray(productList)
        ? productList.filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              (p.code && p.code.toLowerCase().includes(query.toLowerCase()))
          )
        : [];
      
      if (open && currentFiltered.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const newIndex = highlightedIndex < currentFiltered.length - 1 ? highlightedIndex + 1 : 0;
          setHighlightedIndex(newIndex);
          
          // Auto-scroll to highlighted item
          setTimeout(() => {
            const listElement = dropdownListRef.current;
            if (listElement) {
              const highlightedElement = listElement.children[newIndex];
              if (highlightedElement) {
                const listRect = listElement.getBoundingClientRect();
                const itemRect = highlightedElement.getBoundingClientRect();
                
                if (itemRect.bottom > listRect.bottom) {
                  listElement.scrollTop += itemRect.bottom - listRect.bottom;
                } else if (itemRect.top < listRect.top) {
                  listElement.scrollTop -= listRect.top - itemRect.top;
                }
              }
            }
          }, 0);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          const newIndex = highlightedIndex > 0 ? highlightedIndex - 1 : currentFiltered.length - 1;
          setHighlightedIndex(newIndex);
          
          // Auto-scroll to highlighted item
          setTimeout(() => {
            const listElement = dropdownListRef.current;
            if (listElement) {
              const highlightedElement = listElement.children[newIndex];
              if (highlightedElement) {
                const listRect = listElement.getBoundingClientRect();
                const itemRect = highlightedElement.getBoundingClientRect();
                
                if (itemRect.bottom > listRect.bottom) {
                  listElement.scrollTop += itemRect.bottom - listRect.bottom;
                } else if (itemRect.top < listRect.top) {
                  listElement.scrollTop -= listRect.top - itemRect.top;
                }
              }
            }
          }, 0);
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < currentFiltered.length) {
            handleSelect(currentFiltered[highlightedIndex]);
          }
        } else if (event.key === "Escape") {
          setOpen(false);
          setHighlightedIndex(-1);
        }
      }

      // Handle invoice search keyboard navigation
      const currentFilteredInvoices = Array.isArray(invoiceList)
        ? invoiceList.filter((inv) =>
            inv.invoice_no.toLowerCase().includes(invoiceQuery.toLowerCase())
          )
        : [];
      
      if (invoiceOpen && currentFilteredInvoices.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const newIndex = highlightedInvoiceIndex < currentFilteredInvoices.length - 1 ? highlightedInvoiceIndex + 1 : 0;
          setHighlightedInvoiceIndex(newIndex);
          
          // Auto-scroll to highlighted item
          setTimeout(() => {
            const listElement = invoiceDropdownListRef.current;
            if (listElement) {
              const highlightedElement = listElement.children[newIndex];
              if (highlightedElement) {
                const listRect = listElement.getBoundingClientRect();
                const itemRect = highlightedElement.getBoundingClientRect();
                
                if (itemRect.bottom > listRect.bottom) {
                  listElement.scrollTop += itemRect.bottom - listRect.bottom;
                } else if (itemRect.top < listRect.top) {
                  listElement.scrollTop -= listRect.top - itemRect.top;
                }
              }
            }
          }, 0);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          const newIndex = highlightedInvoiceIndex > 0 ? highlightedInvoiceIndex - 1 : currentFilteredInvoices.length - 1;
          setHighlightedInvoiceIndex(newIndex);
          
          // Auto-scroll to highlighted item
          setTimeout(() => {
            const listElement = invoiceDropdownListRef.current;
            if (listElement) {
              const highlightedElement = listElement.children[newIndex];
              if (highlightedElement) {
                const listRect = listElement.getBoundingClientRect();
                const itemRect = highlightedElement.getBoundingClientRect();
                
                if (itemRect.bottom > listRect.bottom) {
                  listElement.scrollTop += itemRect.bottom - listRect.bottom;
                } else if (itemRect.top < listRect.top) {
                  listElement.scrollTop -= listRect.top - itemRect.top;
                }
              }
            }
          }, 0);
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (highlightedInvoiceIndex >= 0 && highlightedInvoiceIndex < currentFilteredInvoices.length) {
            handleCheckInvoice(currentFilteredInvoices[highlightedInvoiceIndex]);
          }
        } else if (event.key === "Escape") {
          setInvoiceOpen(false);
          setHighlightedInvoiceIndex(-1);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [query, invoiceQuery, handleBarcodeScan, handleInvoiceBarcodeScan, open, highlightedIndex, handleSelect, productList, invoiceOpen, highlightedInvoiceIndex, handleCheckInvoice, invoiceList]);

  const filtered = useMemo(() => {
    return Array.isArray(productList)
      ? productList.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.code && p.code.toLowerCase().includes(query.toLowerCase()))
      )
      : [];
  }, [productList, query]);

  const filteredInvoices = useMemo(() => {
    return Array.isArray(invoiceList)
      ? invoiceList.filter((inv) =>
        inv.invoice_no.toLowerCase().includes(invoiceQuery.toLowerCase())
      )
      : [];
  }, [invoiceList, invoiceQuery]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, open]);

  useEffect(() => {
    setHighlightedInvoiceIndex(-1);
  }, [invoiceQuery, invoiceOpen]);

  useEffect(() => {
    // Set today as default invoice date (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];
    setInvoiceDate(today);
  }, []);

  const totalAmount = useMemo(() => {
    const items = Array.isArray(stockItems) ? stockItems : [];
    const total = items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.purchase_price) || 0;
      return sum + qty * price;
    }, 0);
    return total.toFixed(2);
  }, [stockItems]);

  useEffect(() => {
    setAmount(totalAmount);
    setPaidAmount(totalAmount);
  }, [totalAmount]);

  useEffect(() => {
    if (warehouses?.length > 0) {
      const defaultWh = warehouses.find((wh) => wh.is_default === 1);
      if (defaultWh) {
        setSelectedWarehouseId(defaultWh.id);
      }
    }
  }, [warehouses]);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        setIsLoading(true);
        const response = await getPosSettings(accessToken);
        const settings = Array.isArray(response.data) ? response.data : [];
        const enabledMethods = settings.filter(
          (method) =>
            method.enabled &&
            ![
              "Cash Refund",
              "Refund to Card",
              "Refund to MF",
              "Reward Points",
            ].includes(method.name)
        );

        setPaymentMethodsSettings(enabledMethods);
        setPaymentMethod((currentMethod) => {
          if (
            currentMethod &&
            enabledMethods.some((method) => method.name === currentMethod)
          ) {
            return currentMethod;
          }

          return enabledMethods[0]?.name || "";
        });
      } catch (error) {
        toast.error("Failed to fetch payment methods");
        console.error("Error fetching payment methods:", error);
        setPaymentMethodsSettings([]);
        setPaymentMethod("");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPaymentMethods();
  }, [accessToken]);

  useEffect(() => {
    const fetchSalesChannelSetup = async () => {
      try {
        const [preferencesResult, channelsResult] = await Promise.all([
          getproductSettings(accessToken),
          getSalesChannels(accessToken),
        ]);

        const assignedPreferences = preferencesResult?.data?.preferences || [];
        const salesChannelPreference = assignedPreferences.find(
          (preference) => preference.code === "ftr_sales_channel"
        );

        setSalesChannelEnabled(!!salesChannelPreference?.is_active);
        setSalesChannels(Array.isArray(channelsResult?.data) ? channelsResult.data : []);
      } catch (error) {
        console.error("Error fetching sales channel setup:", error);
        setSalesChannelEnabled(false);
        setSalesChannels([]);
      }
    };

    fetchSalesChannelSetup();
  }, [accessToken]);

  return (
    <>
      <form onSubmit={createPurchaseHandler} className="p-4 space-y-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Stock In</h2>
          <p className="text-sm text-gray-600">
            This is the new stock entry screen. Add your new stock here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div className="form-control w-full">
            <label className="label font-semibold" htmlFor="invoiceNo">
              Invoice No
            </label>
            <div className="relative w-full" ref={invoiceDropdownRef}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    id="invoiceNo"
                    onChange={(e) => {
                      setInvoiceQuery(e.target.value);
                      setInvoiceNo(e.target.value);
                      setInvoiceOpen(true);
                      fetchInvoiceList();
                    }}
                    onClick={() => {
                      setInvoiceOpen(true);
                      fetchInvoiceList();
                    }}
                    placeholder="Search by invoice number"
                    className="input input-bordered w-full pl-10"
                    value={invoiceNo}
                  />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    <CiSearch />
                  </span>
                </div>
                <input
                  type="text"
                  ref={invoiceBarcodeInputRef}
                  className="hidden"
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                />
                <label
                  onClick={() => {
                    document.getElementById("invoice_drawer").checked = true;
                    fetchInvoiceList();
                  }}
                  className="btn btn-outline"
                >
                  <CiSquarePlus />
                </label>
              </div>
              {invoiceOpen && (
                <ul ref={invoiceDropdownListRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded max-h-60 overflow-y-auto shadow-md">
                  {isLoading ? (
                    <li className="px-4 py-2 text-gray-500">Loading...</li>
                  ) : filteredInvoices.length > 0 ? (
                    filteredInvoices.map((invoice, index) => (
                      <li
                        key={invoice.invoice_no}
                        className={`px-4 py-2 cursor-pointer ${
                          index === highlightedInvoiceIndex 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          setInvoiceNo(invoice.invoice_no);
                          setSelectedSupplierId(invoice.supplier_id || "");
                          setInvoiceOpen(false);
                          setInvoiceQuery("");
                        }}
                        onMouseEnter={() => setHighlightedInvoiceIndex(index)}
                      >
                        {invoice.invoice_no}
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-2 text-gray-500">
                      No invoices found
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4 w-full">
          <div className="w-8/12">
            <label className="label font-semibold">Search Product</label>
            <div className="relative w-full" ref={dropdownRef}>
              <div className="flex gap-2">
                <input
                  type="text"
                  ref={productSearchInputRef}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onClick={() => setOpen(true)}
                  placeholder="Search by product name or code"
                  className="input input-bordered w-full"
                  value={query}
                />
                <input
                  type="text"
                  ref={barcodeInputRef}
                  className="hidden"
                  onChange={(e) => setQuery(e.target.value)}
                />
                <label
                  onClick={() => {
                    document.getElementById("product-drawer").checked = true;
                  }}
                  className="btn btn-outline"
                >
                  <CiSquarePlus />
                </label>
              </div>
              {open && (
                <ul ref={dropdownListRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded max-h-60 overflow-y-auto shadow-md">
                  {isProductLoading ? (
                    <li className="px-4 py-2 text-center text-gray-500">
                      <span className="loading loading-spinner loading-sm"></span> Loading products...
                    </li>
                  ) : filtered.length > 0 ? (
                    filtered.map((product, index) => (
                      <li
                        key={product.id}
                        className={`px-4 py-2 cursor-pointer flex justify-between ${
                          index === highlightedIndex 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => handleSelect(product)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        <span>{product.name}</span>
                        <span className="text-xs text-gray-500">#{product.code}</span>
                      </li>
                    ))
                  ) : query.length > 0 ? (
                    <li className="px-4 py-2 text-gray-500">No results found</li>
                  ) : (
                    <li className="px-4 py-2 text-gray-500">Type to search products...</li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <div className="w-4/12">
            <label className="label font-semibold">Select Warehouse </label>
            <select
              className="select select-bordered w-full"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              required
            >
              <option value="">-- Choose Warehouse --</option>
              {(Array.isArray(warehouses) ? warehouses : []).map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">New Stock Items</h2>
          {hasPermission("stock-in.create") && (
            <button
              type="submit"
              className="btn btn-info text-white"
              disabled={isLoading || stockItems.length === 0}
            >
              Save
            </button>
          )}
        </div>

        {stockItems.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              No stock items added yet. Please search and select products to
              add.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full border">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Combination</th>
                  <th>Lot No</th>
                  <th>
                    Qty <span className="text-red-500">*</span>
                  </th>
                  <th>
                    Purchase Price <span className="text-red-500">*</span>
                  </th>
                  <th>
                    Selling Price <span className="text-red-500">*</span>
                  </th>
                  <th>VAT (%)</th>
                  <th>Alert Quantity</th>
                  <th>Expiry</th>
                  <th>Barcode</th>
                  <th>Total Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(stockItems) ? stockItems : []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      {Object.entries(item.combination || {})
                        .map(
                          ([k, v]) =>
                            `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`
                        )
                        .join(", ")}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={item.batch_no || ""}
                        onChange={(e) =>
                          handleChange(item.id, "batch_no", e.target.value)
                        }
                        placeholder="Enter Lot No"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={item.quantity ?? ""}
                        onChange={(e) =>
                          handleChange(item.id, "quantity", e.target.value)
                        }
                        min={1}
                        step={1}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={item.purchase_price}
                        onChange={(e) =>
                          handleChange(
                            item.id,
                            "purchase_price",
                            e.target.value
                          )
                        }
                        step={0.001}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={item.selling_price}
                        onChange={(e) =>
                          handleChange(item.id, "selling_price", e.target.value)
                        }
                        onBlur={(e) =>
                          handleSellingPriceBlur(item.id, e.target.value)
                        }
                        step={0.001}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="input input-bordered w-full"
                        value={item.vat ?? ""}
                        onChange={(e) =>
                          handleChange(item.id, "vat", e.target.value)
                        }
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={item.alert_quantity ?? 5}
                        onChange={(e) =>
                          handleChange(
                            item.id,
                            "alert_quantity",
                            e.target.value
                          )
                        }
                        min={0}
                      />
                    </td>
                    <td>
                      <DatePicker
                        selected={
                          item.expiry_date ? new Date(item.expiry_date) : null
                        }
                        onChange={(date) =>
                          handleChange(
                            item.id,
                            "expiry_date",
                            date ? date.toISOString().split("T")[0] : ""
                          )
                        }
                        className="input input-bordered w-full"
                        placeholderText="Select a date"
                        dateFormat="yyyy-MM-dd"
                        minDate={new Date()}
                        isClearable
                        showYearDropdown
                        showMonthDropdown
                        dropdownMode="select"
                        withPortal
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={item.barcode || ""}
                        onChange={(e) =>
                          handleChange(item.id, "barcode", e.target.value)
                        }
                        placeholder="Barcode (Optional)"
                      />
                    </td>
                    <td className="text-right font-semibold">
                      {formatPrice(
                        (parseFloat(item.quantity) || 0) *
                        (parseFloat(item.purchase_price) || 0)
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-error text-white"
                        onClick={() => handleChange(item.id, "remove", null)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="9" className="text-right font-semibold">
                    Grand Total
                  </td>
                  <td className="text-right font-bold">
                    {formatPrice(totalAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <h3 className="text-lg font-bold mt-10 mb-2">📦 Stock Overview</h3>
        <div className="overflow-x-auto">
          <table className="table w-full border border-gray-300">
            <thead className="bg-base-200">
              <tr>
                <th>Product</th>
                <th>Combination</th>
                <th className="text-center">Current Stock</th>
                <th className="text-center text-success">Incoming Qty</th>
                <th className="text-center text-error">Updated Stock</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(stockItems) ? stockItems : []).map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    {Object.entries(item.combination || {})
                      .map(
                        ([k, v]) =>
                          `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`
                      )
                      .join(", ")}
                  </td>
                  <td className="text-center">{item.currentStock ?? 0}</td>
                  <td className="text-center text-success">
                    {item.quantity ?? 0}
                  </td>
                  <td className="text-center font-bold text-red-500">
                    {(parseFloat(item.currentStock) || 0) +
                      (parseFloat(item.quantity) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      <CombinationDrawer
        combinationDrawerOpen={combinationDrawerOpen}
        setCombinationDrawerOpen={setCombinationDrawerOpen}
        stockCombinations={stockCombinations}
        setStockCombinations={setStockCombinations}
        currentCombination={currentCombination}
        setCurrentCombination={setCurrentCombination}
        variantMap={variantMap}
        selectProduct={selectProduct}
        editingCombinationIndex={editingCombinationIndex}
        setEditingCombinationIndex={setEditingCombinationIndex}
        handleAddToList={handleAddToList}
        generateCustomBarcode={generateCustomBarcode}
        existingCombinations={existingCombinations}
        salesChannelEnabled={salesChannelEnabled}
        salesChannels={salesChannels}
      />

      <div className="drawer drawer-end">
        <input id="invoice_drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content"></div>
        <div className="drawer-side z-50">
          <label htmlFor="invoice_drawer" className="drawer-overlay"></label>
          <div className="menu bg-base-200 text-base-content min-h-full w-full sm:w-[48rem] p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                {isSupplierAdd ? (
                  <span>Add Supplier</span>
                ) : (
                  <span>Invoice Details</span>
                )}
              </h3>
              <button
                type="button"
                className="btn btn-circle btn-outline absolute top-4 right-4"
                onClick={
                  isSupplierAdd
                    ? () => setSupplierAdd(false)
                    : () =>
                    (document.getElementById(
                      "invoice_drawer"
                    ).checked = false)
                }
                aria-label="Close drawer"
              >
                <IoClose size={24} />
              </button>
            </div>

            {isSupplierAdd ? (
              <SupplierAddEditModal
                isDrawer={true}
                isEdit={false}
                onSubmit={handleSupplierAdd}
              />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  document.getElementById("invoice_drawer").checked = false;
                }}
                className="space-y-4"
              >
                <div>
                  <label className="label font-semibold">Invoice Number </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="e.g., INV-2024-001"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label font-semibold">Supplier Name </label>
                  <div className="flex gap-2 items-center">
                    <select
                      className="select select-bordered w-full"
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                    >
                      <option value="">-- Select Supplier --</option>
                      {(Array.isArray(suppliers) ? suppliers : []).map(
                        (supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        )
                      )}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline p-2 min-w-fit"
                      onClick={() => setSupplierAdd(true)}
                    >
                      <FiPlus size={18} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label font-semibold">Invoice Date </label>
                  <DatePicker
                    id="invoiceDate"
                    selected={invoiceDate ? new Date(invoiceDate) : new Date()}
                    onChange={(date) =>
                      setInvoiceDate(
                        date ? date.toISOString().split("T")[0] : ""
                      )
                    }
                    className="input input-bordered w-full"
                    placeholderText="Select a date"
                    dateFormat="yyyy-MM-dd"
                    maxDate={new Date()}
                    showYearDropdown
                    showMonthDropdown
                    dropdownMode="select"
                  />
                  {invoiceDate && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700">
                        Selected Invoice Date:{" "}
                        <span className="font-bold">{invoiceDate}</span>
                      </p>
                    </div>
                  )}
                </div>
                  <div>
                    <label className="label font-semibold">Subtotal Amount </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="e.g., 5,0000.00"
                      value={amount}
                      readOnly
                    />
                  </div>
                <div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Payment Method:
                    </span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        if (!["Card", "QR Payment"].includes(e.target.value)) {
                          setCardLastDigits("");
                          setQrProvider("");
                          setQrTransactionId("");
                        }
                      }}
                      className="w-28 p-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-right transition-colors duration-200"
                      tabIndex={105}
                    >
                      <option value="">Select Method</option>
                      {paymentMethodsSettings.map((method) => (
                        <option key={method.name} value={method.name}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {paymentMethodsSettings.find((m) => m.name === "Card")?.config
                    ?.require_last_digits && (
                      <div className="w-xs pt-3 pb-2 px-1 bg-base-200 !mt-0">
                        {paymentMethodsSettings.find((m) => m.name === "Card")
                          ?.config?.require_last_digits && (
                            <input
                              type="text"
                              placeholder="Last 5-6 Digits"
                              value={card_last_digits}
                              onChange={(e) =>
                                updatePaymentDetails(
                                  "card_last_digits",
                                  e.target.value
                                )
                              }
                              className="p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 text-right transition-colors duration-200 w-full"
                              tabIndex={106}
                            />
                          )}
                      </div>
                    )}
                  {paymentMethod === "QR Payment" && (
                    <fieldset className="fieldset rounded-box w-xs border py-2 px-1">
                      <legend className="fieldset-legend text-sm">
                        QR Payment Information
                      </legend>
                      <div className="flex justify-between items-center gap-2">
                        <select
                          value={qr_provider}
                          onChange={(e) =>
                            updatePaymentDetails("qr_provider", e.target.value)
                          }
                          className="p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 text-right transition-colors duration-200"
                          tabIndex={106}
                        >
                          <option value="">Select Provider</option>
                          {paymentMethodsSettings
                            .find((m) => m.name === "QR Payment")
                            ?.config?.providers?.map((provider) => (
                              <option key={provider} value={provider}>
                                {provider}
                              </option>
                            ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Transaction ID"
                          value={qr_transaction_id}
                          onChange={(e) =>
                            updatePaymentDetails(
                              "qr_transaction_id",
                              e.target.value
                            )
                          }
                          className="p-1.5 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 text-right transition-colors duration-200"
                          tabIndex={107}
                        />
                      </div>
                    </fieldset>
                  )}
                </div>
                {amount > 0 && (
                <div>
                  <label className="label font-semibold">Total Amount </label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="e.g., 1000.00"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                )}
                {parseFloat(paidAmount) < parseFloat(amount) && (
                  <div>
                    <label className="label font-semibold">
                      Schedule Payments{" "}
                    </label>
                    <div className="space-y-2">
                      {schedulePayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex gap-2 items-center"
                        >
                          <input
                            type="number"
                            className="input input-bordered w-1/3"
                            placeholder="Amount"
                            value={payment.amount}
                            onChange={(e) =>
                              handleSchedulePaymentChange(
                                payment.id,
                                "amount",
                                e.target.value
                              )
                            }
                            min="0"
                            step="0.01"
                          />
                          <DatePicker
                            selected={
                              payment.due_date
                                ? new Date(payment.due_date)
                                : null
                            }
                            onChange={(date) =>
                              handleSchedulePaymentChange(
                                payment.id,
                                "due_date",
                                date ? date.toISOString().split("T")[0] : ""
                              )
                            }
                            className="input input-bordered w-1/3"
                            placeholderText="Due Date"
                            dateFormat="yyyy-MM-dd"
                            minDate={new Date()}
                            showYearDropdown
                            showMonthDropdown
                            dropdownMode="select"
                          />
                          <DatePicker
                            selected={
                              payment.reminder_date
                                ? new Date(payment.reminder_date)
                                : null
                            }
                            onChange={(date) =>
                              handleSchedulePaymentChange(
                                payment.id,
                                "reminder_date",
                                date ? date.toISOString().split("T")[0] : ""
                              )
                            }
                            className="input input-bordered w-1/3"
                            placeholderText="Reminder Date (Optional)"
                            dateFormat="yyyy-MM-dd"
                            minDate={new Date()}
                            showYearDropdown
                            showMonthDropdown
                            dropdownMode="select"
                            isClearable
                          />
                          <button
                            type="button"
                            className="btn btn-error btn-sm"
                            onClick={() =>
                              handleRemoveSchedulePayment(payment.id)
                            }
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm mt-2"
                        onClick={handleAddSchedulePayment}
                      >
                        Add Schedule Payment
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="label font-semibold">Note </label>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    placeholder="Enter any additional notes"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="modal-action mt-6">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                    (document.getElementById(
                      "invoice_drawer"
                    ).checked = false)
                    }
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    Save Invoice
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="drawer drawer-end">
        <input id="product-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content"></div>
        <div className="drawer-side h-screen z-50">
          <label htmlFor="product-drawer" className="drawer-overlay"></label>
          <div className="w-1/2 h-full bg-base-100 text-base-content p-6 overflow-y-auto transition-all duration-300">
            <ProductAddForm
              fetchData={fetchData}
              onClose={() =>
                (document.getElementById("product-drawer").checked = false)
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}

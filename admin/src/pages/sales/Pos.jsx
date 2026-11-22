import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  createNewCustomer,
  deleteDraftSale,
  getDraftSales,
  getCustomers,
  getSearchProducts,
  getSaleReturnPreview,
  itemReturn,
  storeSale,
  getDefaultCustomer, // New API function
} from "../../api/sales";
import { fetchingStockOutList } from "../../api/stock";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { fetchCompanyPreferences } from "../../slice/companySlice";
import extractLaravelErrors from "../../hooks/handleError";
import defaultProfileAvater from "../../assets/img/user_default_image.webp";
import { getRewardsList } from "../../api/reward";
import { showModal } from "../../hooks/modalConfig";
import DiscountOrRewardModal from "./components/DiscountOrRewardModal";
import CustomerSection from "./components/CustomerSection";
import ProductSearchSection from "./components/ProductSearchSection";
import SalesTable from "./components/SalesTable";
import SalesSummary from "./components/SalesSummary";
import PosActions from "./components/PosActions";
import DraftsListDrawer from "./components/DraftsListDrawer";
import NewCustomerDrawer from "./components/NewCustomerDrawer";
import PaymentScheduleDrawer from "./components/PaymentScheduleDrawer";
import { getPosSettings } from "../../api/companyPreferances";
import { submitWaitlist as submitWaitlistRequest } from "../../api/waitlist";
import StockOut from "./StockOut";

// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const getLocalDateString = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

const normalizePaymentMethodName = (value) =>
  String(value ?? "").trim().toLowerCase();

const normalizeLineDiscountType = (value) => {
  const type = String(value || "percent").trim().toLowerCase();
  return ["fixed", "flat"].includes(type) ? "fixed" : "percent";
};

const calculateLineDiscountAmount = (basePrice, discountValue, discountType, quantity = 1) => {
  const amount =
    normalizeLineDiscountType(discountType) === "fixed"
      ? Math.abs(Number(quantity || 0)) * Number(discountValue || 0)
      : Number(basePrice || 0) * (Number(discountValue || 0) / 100);

  return Math.min(Math.max(Number(amount) || 0, 0), Math.max(Number(basePrice) || 0, 0));
};

const calculateLineTotal = (product) => {
  const quantity = Number(product?.quantity || 0);
  const unitPrice = Number(product?.unitPrice || 0);
  const basePrice = quantity * unitPrice;
  const discountAmount = calculateLineDiscountAmount(
    basePrice,
    product?.discount,
    product?.discount_type,
    quantity
  );
  const taxableAmount = basePrice - discountAmount;
  const taxAmount = quantity * unitPrice * (Number(product?.tax_rate) || 0);
  const vatAmount = quantity * unitPrice * (Number(product?.vat_rate) || 0);

  return taxableAmount + taxAmount + vatAmount;
};

const showApiErrors = (error, fallbackMessage) => {
  const validationErrors =
    error?.errors ||
    error?.data?.errors ||
    error?.response?.data?.errors ||
    null;

  if (validationErrors && typeof validationErrors === "object") {
    const messages = extractLaravelErrors(validationErrors);
    if (messages.length > 0) {
      messages.slice(0, 8).forEach((m) => toast.error(m));
      return;
    }
  }

  const message =
    error?.message ||
    error?.error?.message ||
    error?.data?.message ||
    error?.response?.data?.message ||
    fallbackMessage;

  toast.error(message);
};

const showWaitlistCreatedAlert = (error) => {
  const items =
    error?.waitlisted_items ||
    error?.data?.waitlisted_items ||
    error?.response?.data?.waitlisted_items ||
    [];

  const message =
    error?.message ||
    error?.data?.message ||
    "Out-of-stock items were added to customer waitlist.";

  const htmlRows = Array.isArray(items) && items.length > 0
    ? items
      .map((item) => {
        const name = item?.product_name || item?.product_id || "Product";
        const requested = Number(item?.requested_qty || 0);
        const available = Number(item?.available_qty || 0);
        return `<li style="text-align:left;margin:4px 0;"><strong>${name}</strong> (requested: ${requested}, available: ${available})</li>`;
      })
      .join("")
    : "";

  Swal.fire({
    icon: "info",
    title: "Added To Waitlist",
    html: `<p style="margin-bottom:8px;">${message}</p>${htmlRows ? `<ul style="padding-left:18px;">${htmlRows}</ul>` : ""}`,
    confirmButtonText: "OK",
  });
};

const showWaitlistSubmittedAlert = (result) => {
  const items = Array.isArray(result?.data) ? result.data : [];
  const message = result?.message || "Waitlist submitted successfully.";

  const htmlRows = items.length > 0
    ? items
      .map((item) => {
        const name = item?.product_name || item?.product_id || "Product";
        const requested = Number(item?.requested_qty || 0);
        return `<li style="text-align:left;margin:4px 0;"><strong>${name}</strong> (requested: ${requested})</li>`;
      })
      .join("")
    : "";

  Swal.fire({
    icon: "success",
    title: "Waitlist Submitted",
    html: `<p style="margin-bottom:8px;">${message}</p>${htmlRows ? `<ul style="padding-left:18px;">${htmlRows}</ul>` : ""}`,
    confirmButtonText: "OK",
  });
};

// Validate customer data
const validateCustomer = (customer) => {
  const errors = {};
  if (!customer.name.trim()) {
    errors.name = "Name is required";
  }
  if (!customer.phone.trim()) {
    errors.phone = "Phone number is required";
  } else if (!/^\+?\d{10,15}$/.test(customer.phone.replace(/\s/g, ""))) {
    errors.phone = "Invalid phone number";
  }
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    errors.email = "Invalid email format";
  }
  if (
    customer.nidTinTax &&
    !/^\d{10,15}$/.test(customer.nidTinTax.replace(/\s/g, ""))
  ) {
    errors.nidTinTax = "Invalid NID/TIN/TAX number";
  }
  return errors;
};

// Validate payment details
const validatePaymentDetails = (
  paymentMethod,
  saleSummary,
  selectedCustomer,
  selectedReward,
  isReturn,
  paymentMethodsSettings
) => {
  const errors = [];
  if (!isReturn) {
    const methodSettings = paymentMethodsSettings.find(
      (m) => normalizePaymentMethodName(m.name) === normalizePaymentMethodName(paymentMethod)
    );
    if (!methodSettings?.enabled) {
      errors.push('Selected payment method is not enabled');
      return errors;
    }

    if (paymentMethod === 'Card') {
      if (methodSettings.config.require_last_digits) {
        if (!saleSummary.card_last_digits) {
          errors.push('Card last digits are required');
        } else {
          const allowedLengths = methodSettings.config.last_digit_length || [5, 6];
          if (!allowedLengths.includes(saleSummary.card_last_digits.length)) {
            errors.push(
              `Card last digits must be ${allowedLengths.join(' or ')} digits`
            );
          }
        }
      }
    } else if (paymentMethod === 'QR Payment') {
      if (!saleSummary.qr_provider) {
        errors.push('QR provider is required');
      } else {
        const allowedProviders = methodSettings.config.providers || [];
        if (!allowedProviders.includes(saleSummary.qr_provider)) {
          errors.push('Invalid QR provider');
        }
      }
      if (!saleSummary.qr_transaction_id) {
        errors.push('QR transaction ID is required');
      }
    } else if (paymentMethod === 'Reward Points') {
      if (!saleSummary.points_used || saleSummary.points_used <= 0) {
        errors.push('Points to redeem are required');
      }
      if (saleSummary.points_used > selectedCustomer.reward_points) {
        errors.push('Insufficient reward points');
      }
      const pointsValue = saleSummary.points_used * (selectedReward?.reword_value || 1);
      if (
        pointsValue >
        saleSummary.subTotal -
        saleSummary.discount +
        saleSummary.tax +
        saleSummary.vat
      ) {
        errors.push('Points value exceeds the total amount due');
      }
    }
  } else {
    const methodSettings = paymentMethodsSettings.find(
      (m) => normalizePaymentMethodName(m.name) === normalizePaymentMethodName(paymentMethod)
    );
    if (!methodSettings?.enabled) {
      errors.push('Selected payment method is not enabled');
      return errors;
    }

    if (paymentMethod === 'Refund to Card') {
      if (methodSettings.config.require_last_digits) {
        if (!saleSummary.card_last_digits) {
          errors.push('Card last digits are required for refund');
        } else {
          const allowedLengths = methodSettings.config.last_digit_length || [5, 6];
          if (!allowedLengths.includes(saleSummary.card_last_digits.length)) {
            errors.push(
              `Card last digits must be ${allowedLengths.join(' or ')} digits`
            );
          }
        }
      }
    } else if (paymentMethod === 'Refund to MF') {
      if (!saleSummary.mf_type) {
        errors.push('Mobile financial service type is required for refund');
      } else {
        const allowedProviders = methodSettings.config.providers || [];
        if (!allowedProviders.includes(saleSummary.mf_type)) {
          errors.push('Invalid mobile financial service provider for refund');
        }
      }
      if (
        !saleSummary.mf_number ||
        !/^\+?\d{10,15}$/.test(saleSummary.mf_number.replace(/\s/g, ''))
      ) {
        errors.push(
          'Valid mobile financial service number is required for refund'
        );
      }
    }
  }
  return errors;
};

export default function Pos() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const userPrinterType = useSelector((state) => state.auth.printer_type);
  const { data: prefData } = useSelector((state) => state.preferences);
  const dispatch = useDispatch();

  const [rewards, setRewards] = useState([]);
  const [selectedReward, setSelectedReward] = useState(null);
  const [isRewardsLoading, setIsRewardsLoading] = useState(false);

  // State for customer selection
  const [customerInput, setCustomerInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null); // Initialize as null
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerDrawer, setShowCustomerDrawer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    phone: "",
    name: "",
    email: "",
    address: "",
    nidTinTax: "",
  });
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const customerInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(-1);
  const customerDropdownRef = useRef(null);
  const customerDropdownListRef = useRef(null);

  // State for products table
  const [products, setProducts] = useState([
    {
      id: Date.now(),
      product_id: "",
      inventory_id: "",
      inventory_item_id: "",
      lot_number: "",
      name: "",
      quantity: 1,
      unitPrice: "",
      discount: '',
      tax_rate: '',
      vat_rate: '',
      totalPrice: 0,
      stock: 0,
      alert_quantity: 5,
      max_quantity: 100,
      original_invoice_id: null,
      original_sale_item_id: null,
      is_return_product: false,
      is_returned: false,
      barcode: '',
      variant: ''
    },
  ]);
  const [productSearch, setProductSearch] = useState("");
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [tableProductSuggestions, setTableProductSuggestions] = useState({});
  const [isGlobalProductLoading, setIsGlobalProductLoading] = useState(false);
  const [tableProductLoading, setTableProductLoading] = useState({});
  const [tableProductErrors, setTableProductErrors] = useState({});
  const [isConfirmingSale, setIsConfirmingSale] = useState(false);
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const productInputRef = useRef(null);
  const lastGlobalQueryRef = useRef("");
  const lastTableQueriesRef = useRef({});
  const suggestionRefs = useRef({});
  const [productHighlightedIndex, setProductHighlightedIndex] = useState(-1);
  const productDropdownListRef = useRef(null);
  const [isReturn, setIsReturn] = useState(false);

  const [printInvoice, setPrintInvoice] = useState(null);
  const [printWithCustomerInfo, setPrintWithCustomerInfo] = useState(false);
  const [printerType, setPrinterType] = useState('normal'); // 'normal' or 'pos'

  const [showPaymentScheduleDrawer, setShowPaymentScheduleDrawer] = useState(false);
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [numberOfInstallments, setNumberOfInstallments] = useState(1);

  const companyInfo = {
    name: prefData?.application_name || "N/A",
    address: prefData?.application_address || "N/A",
    phone: prefData?.application_phone || "N/A",
    email: prefData?.application_email || "N/A",
    logo: prefData?.site_logo || "",
    footerNote: "Thank you for your business!",
  };

  const [saleSummary, setSaleSummary] = useState({
    subTotal: 0,
    discount: '',
    discountType: "flat",
    tax: '',
    vat: '',
    grandTotal: 0,
    paidAmount: '',
    dueAmount: 0,
    paymentMethod: "Cash",
    changeDue: 0,
    isFracture: false,
    card_type: "",
    card_last_digits: "",
    mf_type: "",
    mf_number: "",
    qr_provider: "",
    qr_transaction_id: "",
    points_used: 0,
    points_earned: 0,
    note: "",
  });

  const [payments, setPayments] = useState([{
    id: Date.now(),
    method: "Cash",
    amount: 0, // Will be updated when grandTotal changes
    card_type: "",
    card_last_digits: "",
    mf_type: "",
    mf_number: "",
    qr_provider: "",
    qr_transaction_id: "",
  }]);

  const [drafts, setDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [showDraftList, setShowDraftList] = useState(false);
  const [printDraftData, setPrintDraftData] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null); // Tracks { code, discount, discountType }
  const [paymentMethodsSettings, setPaymentMethodsSettings] = useState([]);
  const [showSellReturnCenter, setShowSellReturnCenter] = useState(false);

  const normalizePaymentMethods = (value) => {
    if (Array.isArray(value)) {
      return value.map((method) => ({
        ...method,
        name: String(method?.name ?? "").trim(),
        enabled: Boolean(method?.enabled),
        config: Array.isArray(method?.config) ? method.config : method?.config || {},
      }));
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
          ? parsed.map((method) => ({
              ...method,
              name: String(method?.name ?? "").trim(),
              enabled: Boolean(method?.enabled),
              config: Array.isArray(method?.config) ? method.config : method?.config || {},
            }))
          : [];
      } catch (_) {
        return [];
      }
    }
    if (Array.isArray(value?.data)) {
      return value.data.map((method) => ({
        ...method,
        name: String(method?.name ?? "").trim(),
        enabled: Boolean(method?.enabled),
        config: Array.isArray(method?.config) ? method.config : method?.config || {},
      }));
    }
    return [];
  };

  const latestQueryRef = useRef("");
  const [posSettings, setPosSettings] = useState({
    separate_row_per_barcode: false, // This controls the behavior
    return_policy: {
      allowed_return_modes: ["refund", "exchange"],
    },
  });

  const allowedReturnModes = Array.isArray(posSettings?.return_policy?.allowed_return_modes)
    ? posSettings.return_policy.allowed_return_modes
    : ["refund", "exchange"];

  const getDefaultReturnPaymentMethod = useCallback(() => {
    const refundMethods = ["Cash Refund", "Refund to Card", "Refund to MF"];
    const enabledRefundMethods = paymentMethodsSettings.filter(
      (m) =>
        m?.enabled &&
        refundMethods.some(
          (name) => normalizePaymentMethodName(name) === normalizePaymentMethodName(m?.name)
        )
    );
    const cashRefund = enabledRefundMethods.find(
      (m) => normalizePaymentMethodName(m.name) === normalizePaymentMethodName("Cash Refund")
    );
    if (cashRefund) {
      return "Cash Refund";
    }
    return enabledRefundMethods[0]?.name || "Cash Refund";
  }, [paymentMethodsSettings]);

  useEffect(() => {
    if (!isReturn) return;
    const defaultReturnMethod = getDefaultReturnPaymentMethod();
    setPayments((prevPayments) => {
      if (!Array.isArray(prevPayments) || prevPayments.length === 0) {
        return [{
          id: Date.now(),
          method: defaultReturnMethod,
          amount: 0,
          card_type: "",
          card_last_digits: "",
          mf_type: "",
          mf_number: "",
          qr_provider: "",
          qr_transaction_id: "",
        }];
      }

      return prevPayments.map((payment, idx) =>
        idx === 0 ? { ...payment, method: defaultReturnMethod } : payment
      );
    });
    setSaleSummary((prev) => ({ ...prev, paymentMethod: defaultReturnMethod }));
  }, [isReturn, getDefaultReturnPaymentMethod]);

  // Fetch POS settings
  const fetchPosSettings = async () => {
    try {
      const response = await getPosSettings(accessToken);
      setPaymentMethodsSettings(normalizePaymentMethods(response.data));
      setPosSettings(prev => ({
        ...prev,
        separate_row_per_barcode: response.separate_row_per_barcode === true,
        return_policy: response.return_policy || {
          allowed_return_modes: ["refund", "exchange"],
        },
      }));
    } catch (error) {
      toast.error('Failed to fetch POS settings');
    }
  };

  // Check if reward system is active
  const isRewardActive = () => {
    return !!selectedReward;
  };

  // Check if reward redemption is allowed
  const canRedeemPoints = () => {
    return (
      isRewardActive() &&
      ["sale", "both"].includes(selectedReward?.redeem_type) &&
      selectedCustomer?.is_default !== 1 &&
      !isReturn
    );
  };

  // Check if points can be earned
  const canEarnPoints = () => {
    return selectedCustomer?.is_default !== 1;
  };

  // Sound for barcode scan
  const playScanSound = () => {
    const audio = new Audio("beep.mp3");
    audio.play().catch((err) => console.error("Audio playback failed:", err));
  };

  // Fetch default customer
  const fetchDefaultCustomer = useCallback(async () => {
    try {
      setIsCustomerLoading(true);
      const response = await getDefaultCustomer(accessToken);
      setSelectedCustomer(response.data);
    } catch (error) {
      const res = error?.response;
      const data = res?.data;
      if (res?.status === 422 && data?.errors) {
        const messages = extractLaravelErrors(data.errors);
        messages.slice(0, 5).forEach((m) => toast.error(m));
        if (messages.length > 5) {
          toast.error(`${messages.length - 5} more error(s)...`);
        }
      } else {
        toast.error(data?.message || "Failed to fetch default customer");
      }
      setSelectedCustomer(null);
    } finally {
      setIsCustomerLoading(false);
    }
  }, [accessToken]);

  // Search customers
  const searchCustomer = useCallback(
    async (query) => {
      if (!query || query.length < 3) {
        setCustomerSearchResults([]);
        return [];
      }
      try {
        setIsCustomerLoading(true);
        const response = await getCustomers(accessToken, { params: query });
        setCustomerSearchResults(response.data);
        return response.data;
      } catch (error) {
        const res = error?.response;
        const data = res?.data;
        if (res?.status === 422 && data?.errors) {
          const messages = extractLaravelErrors(data.errors);
          messages.slice(0, 5).forEach((m) => toast.error(m));
          if (messages.length > 5) {
            toast.error(`${messages.length - 5} more error(s)...`);
          }
        } else {
          toast.error(data?.message || "Failed to fetch customers");
        }
        return [];
      } finally {
        setIsCustomerLoading(false);
      }
    },
    [accessToken]
  );

  // Search products
  const searchProduct = useCallback(
    async (query, index = null) => {
      const normalizedQuery = String(query || "").trim();
      const isTableSearch = index !== null && index !== products.length - 1;

      if (!normalizedQuery) {
        if (!isTableSearch) {
          setProductSuggestions([]);
        } else {
          setTableProductSuggestions(prev => ({ ...prev, [index]: [] }));
        }
        return [];
      }

      // --- 1. CLEAR old suggestions immediately ---
      if (!isTableSearch) {
        setProductSuggestions([]);          // ← Global search
        latestQueryRef.current = normalizedQuery;
      } else {
        setTableProductSuggestions(prev => ({ ...prev, [index]: [] }));
        lastTableQueriesRef.current[index] = normalizedQuery;
      }

      // --- 2. Show loading ---
      if (isTableSearch) {
        setTableProductLoading(prev => ({ ...prev, [index]: true }));
        setTableProductErrors(prev => ({ ...prev, [index]: null }));
      } else {
        setIsGlobalProductLoading(true);
      }

      try {
        const { data } = await getSearchProducts(accessToken, {
          query: normalizedQuery,
          for_return: isReturn ? 1 : 0,
          customer_id: isReturn ? selectedCustomer?.id : null,
        });

        // --- 3. Only update if this is the LATEST query ---
        const isLatest = !isTableSearch
          ? latestQueryRef.current === normalizedQuery
          : lastTableQueriesRef.current[index] === normalizedQuery;

        if (!isLatest) return [];

        const results = Array.isArray(data)
          ? data.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice ?? item.unit_price ?? item.bundle_price ?? 0),
            alert_quantity: item.alert_quantity ?? 5,
            max_quantity: item.available_quantity ?? 100,
            product_id: item.id,
            bundle_id: item.bundle_id || "",
            item_type: item.item_type || "product",
            discount_type: normalizeLineDiscountType(item.discount_type),
            inventory_id: item.inventory_id,
            inventory_item_id: item.inventory_item_id,
            lot_number: item.lot_number ?? "",
            is_return_product: !!item.is_return_product,
          }))
          : [];
        const selectableResults = results.filter(
          (item) => item.is_selectable !== false && item.item_type !== "notice"
        );

        // --- 4. SET new suggestions ---
        if (!isTableSearch) {
          setProductSuggestions(results);
        } else {
          setTableProductSuggestions(prev => ({ ...prev, [index]: results }));
        }

        return selectableResults;
      } catch (error) {
        if (error.name === "AbortError") return [];

        const message = error?.response?.data?.message || "Failed to fetch products";
        if (isTableSearch) {
          setTableProductErrors(prev => ({ ...prev, [index]: message }));
        } else {
          toast.error(message);
        }

        // setProductSearch("");
        setProductSuggestions([]);
        return [];
      } finally {
        if (isTableSearch) {
          setTableProductLoading(prev => ({ ...prev, [index]: false }));
        } else {
          setIsGlobalProductLoading(false);
        }
      }
    },
    [accessToken, isReturn, selectedCustomer, products.length]
  );

  useEffect(() => {
    if (!productSearch) {
      setProductSuggestions([]);
    }
  }, [productSearch]);

  // Fetch rewards from API
  const fetchRewards = useCallback(async () => {
    try {
      setIsRewardsLoading(true);
      const response = await getRewardsList(accessToken);
      setRewards(response.data || []);
    } catch (error) {
      const res = error?.response;
      const data = res?.data;
      if (res?.status === 422 && data?.errors) {
        const messages = extractLaravelErrors(data.errors);
        messages.slice(0, 5).forEach((m) => toast.error(m));
        if (messages.length > 5) {
          toast.error(`${messages.length - 5} more error(s)...`);
        }
      } else {
        toast.error(data?.message || "Failed to fetch rewards");
      }
      setRewards([]);
    } finally {
      setIsRewardsLoading(false);
    }
  }, [accessToken]);

  // Determine applicable reward
  const selectApplicableReward = useCallback(() => {
    const currentDate = new Date();
    const applicableReward = rewards.find((reward) => {
      if (!reward.form_date || !reward.to_date) return false;
      const fromDate = new Date(reward.form_date);
      const toDate = new Date(reward.to_date);
      if (isNaN(fromDate) || isNaN(toDate)) return false;
      return currentDate >= fromDate && currentDate <= toDate;
    });
    setSelectedReward(applicableReward || null);
  }, [rewards]);

  // Create new customer
  const createCustomer = async (customerData) => {
    try {
      setIsCustomerLoading(true);
      const response = await createNewCustomer(accessToken, customerData);
      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Customer created successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      return response.data;
    } catch (error) {
      const res = error?.response;
      const data = res?.data;
      if (res?.status === 422 && data?.errors) {
        const messages = extractLaravelErrors(data.errors);
        messages.slice(0, 5).forEach((m) => toast.error(m));
        if (messages.length > 5) {
          toast.error(`${messages.length - 5} more error(s)...`);
        }
      } else {
        toast.error(data?.message || "Failed to create customer");
      }
    } finally {
      setIsCustomerLoading(false);
    }
  };

  // Reset POS state
  const resetPos = () => {
    const defaultReturnMethod = getDefaultReturnPaymentMethod();
    setActiveDraftId(null);
    setProducts([
      {
        id: Date.now(),
        product_id: "",
        inventory_id: "",
        inventory_item_id: "",
        lot_number: "",
        name: "",
        quantity: 1,
        unitPrice: "",
        discount: 0,
        tax_rate: 0,
        vat_rate: "",
        totalPrice: 0,
        stock: 0,
        alert_quantity: 5,
        max_quantity: 100,
        original_invoice_id: null,
        original_sale_item_id: null,
        is_return_product: false,
        is_returned: false,
        barcode: '',
        variant: '',
      },
    ]);
    setSaleSummary({
      subTotal: 0,
      discount: 0,
      discountType: "flat",
      tax: 0,
      vat: "",
      grandTotal: 0,
      paidAmount: 0,
      paymentMethod: isReturn ? "Cash Refund" : "Cash",
      changeDue: 0,
      isFracture: false,
      card_type: "",
      card_last_digits: "",
      mf_type: "",
      mf_number: "",
      qr_provider: "",
      qr_transaction_id: "",
      points_used: 0,
      points_earned: 0,
      note: "",
    });
    setSelectedCustomer(null);
    setProductSearch("");
    setProductSuggestions([]);
    setTableProductSuggestions({});
    setTableProductErrors({});
    setTableProductLoading({});
    setAppliedCoupon(null); // Clear applied coupon
    setPayments([{
      id: Date.now(),
      method: isReturn ? defaultReturnMethod : "Cash",
      amount: 0, // Start with 0, will be auto-filled only if grand total changes
      card_type: "",
      card_last_digits: "",
      mf_type: "",
      mf_number: "",
      qr_provider: "",
      qr_transaction_id: "",
    }]);
    setPaymentSchedules([]);
    setNumberOfInstallments(1);
    fetchDefaultCustomer();
    productInputRef.current?.focus();
  };

  const handleCouponVerified = (couponData) => {
    setAppliedCoupon(couponData);
    setSaleSummary((prev) => ({
      ...prev,
      discount: couponData.discount,
      discountType: couponData.discountType,
    }));
  };

  // Payment management functions
  const addPayment = () => {
    const grandTotal = Number(saleSummary.grandTotal || 0);
    let updatedPayments = [...payments];

    if (updatedPayments.length === 1) {
      // Multiple payment default: first method takes full grand total.
      updatedPayments[0] = {
        ...updatedPayments[0],
        amount: grandTotal,
      };
    }

    const newPayment = {
      id: Date.now(),
      method: "Cash",
      amount: "",
      auto_split: updatedPayments.length === 1,
      card_type: "",
      card_last_digits: "",
      mf_type: "",
      mf_number: "",
      qr_provider: "",
      qr_transaction_id: "",
    };

    updatedPayments = [...updatedPayments, newPayment];
    setPayments(updatedPayments);
    recalculatePaymentSummary(updatedPayments);
  };

  const recalculatePaymentSummary = (updatedPayments) => {
    const totalPaid = updatedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const grandTotal = Number(saleSummary.grandTotal || 0);
    const dueAmount = Math.max(0, grandTotal - totalPaid);
    const changeDue = isReturn ? 0 : Math.max(0, totalPaid - grandTotal);

    setSaleSummary((prev) => ({
      ...prev,
      paidAmount: totalPaid,
      dueAmount,
      changeDue,
    }));
  };

  const updatePayment = (index, field, value) => {
    const updatedPayments = [...payments];
    let nextValue = value;

    if (field === "amount") {
      if (value === "") {
        nextValue = "";
      } else {
        const parsed = Number(value);
        nextValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      }
    }

    updatedPayments[index] = {
      ...updatedPayments[index],
      [field]: nextValue,
    };

    // Stop auto split when user manually edits any secondary payment.
    if (field === "amount" && index > 0) {
      updatedPayments[index].auto_split = false;
    }

    // Auto split only for 2 methods while second one is still auto-managed.
    const grandTotal = Number(saleSummary.grandTotal || 0);
    if (
      field === "amount" &&
      index === 0 &&
      updatedPayments.length === 2 &&
      updatedPayments[1]?.auto_split
    ) {
      const firstAmount = Number(updatedPayments[0].amount || 0);
      const remaining = Math.max(0, grandTotal - firstAmount);
      updatedPayments[1] = {
        ...updatedPayments[1],
        amount: remaining,
      };
    }

    setPayments(updatedPayments);
    if (field === "method" && index === 0) {
      setSaleSummary((prev) => ({
        ...prev,
        paymentMethod: String(nextValue || prev.paymentMethod || ""),
      }));
    }
    recalculatePaymentSummary(updatedPayments);
  };

  const removePayment = (index) => {
    let updatedPayments = payments.filter((_, i) => i !== index);

    // If only one method remains, reset to grand total (default behavior)
    if (updatedPayments.length === 1) {
      updatedPayments = [
        {
          ...updatedPayments[0],
          amount: Number(saleSummary.grandTotal || 0),
          auto_split: false,
        },
      ];
    }

    setPayments(updatedPayments);
    recalculatePaymentSummary(updatedPayments);
  };

  // Keep schedule amounts aligned with current due amount when opening drawer.
  useEffect(() => {
    if (!showPaymentScheduleDrawer) {
      return;
    }

    const dueAmount = Number(saleSummary.dueAmount || 0);
    if (dueAmount <= 0) {
      setPaymentSchedules([]);
      return;
    }

    const totalScheduled = paymentSchedules.reduce(
      (sum, s) => sum + Number(s.amount || 0),
      0
    );

    if (paymentSchedules.length === 0 || Math.abs(totalScheduled - dueAmount) > 0.01) {
      setNumberOfInstallments(1);
      setPaymentSchedules([{
        id: Date.now(),
        amount: Number(dueAmount.toFixed(2)),
        due_date: getLocalDateString(),
        remainder_date: null,
      }]);
    }
  }, [showPaymentScheduleDrawer, saleSummary.dueAmount]);

  // Keep default total paid synced with grand total for single payment mode.
  useEffect(() => {
    if (payments.length === 1) {
      const grandTotal = Number(saleSummary.grandTotal || 0);
      const currentAmount = Number(payments[0].amount || 0);

      if (currentAmount !== grandTotal) {
        const syncedPayments = [
          {
            ...payments[0],
            amount: grandTotal,
            auto_split: false,
          },
        ];
        setPayments(syncedPayments);
        recalculatePaymentSummary(syncedPayments);
      }
    }
  }, [saleSummary.grandTotal, payments.length]);

  const hasDraftProductData = (product) =>
    Boolean(
      product?.bundle_id ||
      product?.product_id ||
      product?.inventory_id ||
      (typeof product?.name === "string" && product.name.trim() !== "")
    );

  const isValidInvoiceProduct = (product) =>
    Boolean(
      !product?.is_return_source &&
      (
        (product?.item_type === "bundle" && product?.bundle_id) ||
        (product?.product_id && (isReturn ? product?.inventory_id : true))
      ) &&
      Number(product?.quantity || 0) !== 0
    );

  const buildSalePayload = useCallback((invoiceType, options = {}) => {
    const skipPayments = Boolean(options?.skipPayments);
    let original_invoice_id = null;
    const payloadProducts = products.filter(isValidInvoiceProduct);

    if (payloadProducts.length === 0) {
      throw new Error("At least one valid product is required");
    }

    if (isReturn) {
      const returnProducts = payloadProducts.filter(
        (p) =>
          p.is_return_product &&
          Math.abs(Number(p.quantity || 0)) > 0 &&
          p.original_invoice_id
      );
      if (returnProducts.length === 0) {
        throw new Error("At least one valid return item is required");
      }

      const firstProduct = returnProducts[0];
      const allSame = returnProducts.every(
        (p) => p.original_invoice_id === firstProduct.original_invoice_id
      );
      if (!allSame) {
        throw new Error("All return products must come from the same invoice");
      }
      original_invoice_id = firstProduct.original_invoice_id;
    }

    const normalizedItems = payloadProducts.map((p) => ({
        item_type: p.item_type || (p.bundle_id ? "bundle" : "product"),
        product_id: p.bundle_id ? null : p.product_id,
        bundle_id: p.bundle_id || null,
        inventory_id: p.bundle_id ? null : (p.inventory_id || null),
        inventory_item_id: p.bundle_id ? null : (p.inventory_item_id || null),
        barcode: p.barcode,
        lot_number: p.bundle_id ? null : p.lot_number,
        qty:
          isReturn && p.is_return_product
            ? -Math.abs(Number(p.quantity || 0))
            : Number(p.quantity),
        unit_price: Number(p.unitPrice),
        discount: isReturn ? 0 : Number(p.discount),
        discount_type: isReturn ? "percent" : normalizeLineDiscountType(p.discount_type),
        tax_rate: Number(p.tax_rate) * 100,
        vat_rate: Number(p.vat_rate) * 100,
        is_return: p.is_return_product,
        ...(p.is_return_product
          ? { original_sale_item_id: p.original_sale_item_id }
          : {}),
      }));

    return {
      type: invoiceType,
      ...(invoiceType === "draft" && activeDraftId ? { draft_id: activeDraftId } : {}),
      company_id: null,
      warehouse_id: null,
      date: getLocalDateString(),
      customer_id: selectedCustomer?.id,
      paid_amount: skipPayments
        ? 0
        : (isReturn
        ? Math.abs(saleSummary.grandTotal)
        : saleSummary.paidAmount),
      payments: skipPayments ? [] : payments.filter((p) => Math.abs(Number(p.amount || 0)) > 0).map((p) => ({
        payment_method: p.method,
        amount: isReturn ? Math.abs(Number(p.amount || 0)) : Number(p.amount || 0),
        card_type: p.card_type || null,
        card_last_digits: p.card_last_digits || null,
        mf_type: p.mf_type || null,
        mf_number: p.mf_number || null,
        qr_provider: p.qr_provider || null,
        qr_transaction_id: p.qr_transaction_id || null,
      })),
      change_due: skipPayments ? 0 : (isReturn ? 0 : saleSummary.changeDue),
      discount: isReturn ? 0 : saleSummary.discount,
      discount_type: isReturn ? "flat" : saleSummary.discountType,
      global_tax_percentage: saleSummary.tax,
      global_vat_percentage: saleSummary.vat,
      is_fracture: saleSummary.isFracture,
      note: saleSummary.note,
      grandTotal: Math.abs(saleSummary.grandTotal),
      points_used: isReturn ? 0 : saleSummary.points_used,
      points_earned: isReturn ? 0 : saleSummary.points_earned,
      coupon_code: appliedCoupon ? appliedCoupon.code : null,
      ...(isReturn ? { original_invoice_id } : {}),
      ...(!skipPayments && saleSummary.dueAmount > 0
        ? {
          payment_schedule: paymentSchedules.map((s) => ({
            amount: Number(s.amount),
            due_date: s.due_date,
            remainder_date: s.remainder_date,
          })),
        }
        : {}),
      items: normalizedItems,
      draft_payload: {
        products: payloadProducts,
        selectedCustomer,
        saleSummary,
        payments,
        isReturn,
        appliedCoupon,
      },
    };
  }, [
    activeDraftId,
    appliedCoupon,
    isReturn,
    paymentSchedules,
    payments,
    products,
    saleSummary,
    selectedCustomer,
  ]);

  const mapDraftFromApi = useCallback((draft) => {
    const payload = draft?.draft_payload || {};
    const restoredProducts = Array.isArray(payload.products)
      ? payload.products
      : (draft.items || []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        bundle_id: item.bundle_id || "",
        item_type: item.item_type || (item.bundle_id ? "bundle" : "product"),
        inventory_id: item.inventory_id,
        inventory_item_id: "",
        lot_number: item.lot_number || "",
        name: item?.product?.name || item?.bundle_name || item?.bundle?.name || "",
        quantity: Number(item.qty || 0),
        unitPrice: Number(item.unit_price || 0),
        totalPrice: Number(item.total || 0),
        tax: Number(item.tax || 0),
        vat: Number(item.vat || 0),
        stock: 0,
        alert_quantity: 0,
        max_quantity: 0,
        original_invoice_id: null,
        original_sale_item_id: item.original_sale_item_id || null,
        is_return_product: false,
        is_returned: false,
        barcode: item.bundle_id ? "BUNDLE" : "",
        variant: item.bundle_id ? "Bundle" : (item.variant_id || ""),
      }));

    return {
      id: draft.id,
      timestamp: draft.updated_at || draft.created_at,
      customerId: draft.customer_id || payload?.selectedCustomer?.id || null,
      customerName:
        draft.customer_name ||
        payload?.selectedCustomer?.name ||
        "Walk-in",
      products: restoredProducts,
      selectedCustomer: payload.selectedCustomer || draft.customer || null,
      saleSummary: payload.saleSummary || {
        subTotal: Number(draft?.sub_total || 0),
        discount: Number(draft?.discount || 0),
        discountType: "flat",
        tax: 0,
        vat: Number(draft?.vat || 0),
        grandTotal: Number(draft?.total || 0),
        paidAmount: Number(draft?.paid_amount || 0),
        dueAmount: Number(draft?.due_amount || 0),
        paymentMethod: "Cash",
        changeDue: Number(draft?.change_due || 0),
        isFracture: false,
        card_type: "",
        card_last_digits: "",
        mf_type: "",
        mf_number: "",
        qr_provider: "",
        qr_transaction_id: "",
        points_used: 0,
        points_earned: 0,
        note: draft?.note || "",
      },
      payments: Array.isArray(payload.payments) && payload.payments.length > 0
        ? payload.payments
        : [{
          id: Date.now(),
          method: "Cash",
          amount: Number(draft?.paid_amount || 0),
          card_type: "",
          card_last_digits: "",
          mf_type: "",
          mf_number: "",
          qr_provider: "",
          qr_transaction_id: "",
        }],
      paymentSchedules: Array.isArray(payload.paymentSchedules)
        ? payload.paymentSchedules
        : [],
      isReturn: payload.isReturn || false,
      appliedCoupon: payload.appliedCoupon || null,
    };
  }, []);

  const fetchDrafts = useCallback(async () => {
    try {
      const response = await getDraftSales(accessToken);
      const mappedDrafts = (response?.data || []).map(mapDraftFromApi);
      setDrafts(mappedDrafts);
    } catch (error) {
      const message = error?.error?.message || "Failed to fetch drafts";
      toast.error(message);
    }
  }, [accessToken, mapDraftFromApi]);

  // Confirm sale or return/exchange
  const confirmSale = async () => {
    if (isReturn && !allowedReturnModes.includes("refund")) {
      toast.error("Refund return is disabled by policy. Please use Exchange return flow.");
      return;
    }

    if (isReturn) {
      const enabledRefundMethods = paymentMethodsSettings.filter(
        (m) =>
          m?.enabled &&
          ["Cash Refund", "Refund to Card", "Refund to MF"].some(
            (name) => normalizePaymentMethodName(name) === normalizePaymentMethodName(m?.name)
          )
      );
      if (enabledRefundMethods.length === 0) {
        toast.error("No refund payment method is enabled. Please enable one in POS Setup.");
        return;
      }

      const currentMethod = payments?.[0]?.method;
      const isCurrentValid = enabledRefundMethods.some((m) => m.name === currentMethod);
      if (!isCurrentValid) {
        const fallbackMethod = enabledRefundMethods[0].name;
        setPayments((prevPayments) =>
          prevPayments.map((payment, idx) =>
            idx === 0 ? { ...payment, method: fallbackMethod } : payment
          )
        );
        setSaleSummary((prev) => ({ ...prev, paymentMethod: fallbackMethod }));
      }
    }

    if (!selectedCustomer) {
      toast.error("Please select a customer before proceeding with the sale");
      return;
    }

    const validProducts = products.filter(isValidInvoiceProduct);
    const hasAnyProductData = products.some(hasDraftProductData);

    if (!hasAnyProductData || validProducts.length === 0) {
      toast.error("At least one product is required");
      return;
    }

    if (isReturn) {
      const returnProducts = validProducts.filter((p) => p.is_return_product);
      if (returnProducts.length === 0) {
        toast.error("Add at least one returned sale item");
        return;
      }

      const invalidReturnProducts = returnProducts.filter(
        (p) =>
          Number(p.quantity) >= 0 ||
          !p.original_invoice_id ||
          !p.original_sale_item_id
      );
      if (invalidReturnProducts.length > 0) {
        toast.error("Returned sale items must have negative quantity and original invoice link");
        return;
      }
    }

    const activePayment = payments?.[0] || {};
    const activePaymentMethod = activePayment?.method || saleSummary.paymentMethod;
    const paymentErrors = validatePaymentDetails(
      activePaymentMethod,
      { ...saleSummary, ...activePayment },
      selectedCustomer,
      selectedReward,
      isReturn,
      paymentMethodsSettings
    );
    if (paymentErrors.length > 0) {
      paymentErrors.forEach((error) => toast.error(error));
      return;
    }

    if (saleSummary.dueAmount > 0) {
      const todayLocal = getLocalDateString();
      const totalScheduled = paymentSchedules.reduce(
        (sum, s) => sum + Number(s.amount || 0),
        0
      );

      if (paymentSchedules.length === 0) {
        toast.error("Please add a payment schedule for due amount");
        return;
      }

      if (paymentSchedules.some((s) => !s.due_date || Number(s.amount || 0) <= 0)) {
        toast.error("Each payment schedule row needs valid amount and due date");
        return;
      }

      if (paymentSchedules.some((s) => s.due_date < todayLocal)) {
        toast.error("Due date cannot be earlier than today");
        return;
      }

      if (Math.abs(totalScheduled - Number(saleSummary.dueAmount || 0)) > 0.01) {
        toast.error("Payment schedule total must equal current due amount");
        return;
      }
    }

    try {
      setIsConfirmingSale(true);
      const payload = buildSalePayload(isReturn ? "return" : "sale");
      const response = await storeSale(accessToken, payload);

      // Manually construct invoice data for printing to ensure it has items
      // const invoiceToPrint = {
      //   ...response.data,
      //   items: products
      //     .filter((p) => p.name !== "")
      //     .map((p) => {
      //       let variantObj = {};
      //       if (typeof p.variant === "string" && p.variant.includes(":")) {
      //         variantObj = Object.fromEntries(
      //           p.variant.split(",").map((pair) => {
      //             const [key, value] = pair.split(":").map((s) => s.trim());
      //             return [key, value];
      //           })
      //         );
      //       } else if (typeof p.variant === "object" && p.variant !== null) {
      //         variantObj = p.variant;
      //       }
      //       return {
      //         name: p.name,
      //         qty: p.quantity,
      //         unit_price: p.unitPrice,
      //         discount: p.discount || 0,
      //         discount_amount: p.discount_amount || 0,
      //         tax_rate: (p.tax_rate || 0) * 100,
      //         vat_rate: (p.vat_rate || 0) * 100,
      //         total: p.totalPrice,
      //         is_return: p.is_return_product,
      //         product: {
      //           code: p.barcode,
      //         },
      //         variant_id: variantObj,
      //       };
      //     }),
      //   customer: selectedCustomer,
      // };

      if (activeDraftId) {
        try {
          await deleteDraftSale(accessToken, activeDraftId);
        } catch (deleteError) {
          console.error(deleteError);
        }
      }
      await fetchDrafts();
      setActiveDraftId(null);
      setPaymentSchedules([]);
      resetPos();
      // Use user's preferred printer type instead of showing dialog
      setPrinterType(userPrinterType || 'normal');
      setPrintInvoice(response.data?.data || response.data);
      setPrintWithCustomerInfo(selectedCustomer);
    } catch (error) {
      if (
        Number(error?.httpStatus) === 409 &&
        Array.isArray(
          error?.waitlisted_items ||
          error?.data?.waitlisted_items ||
          error?.response?.data?.waitlisted_items
        )
      ) {
        showWaitlistCreatedAlert(error);
        return;
      }

      showApiErrors(error, "Failed to confirm transaction");
    } finally {
      setIsConfirmingSale(false);
    }
  };

  const handleSubmitWaitlistForProduct = async (productIndex) => {
    if (!selectedCustomer?.id) {
      toast.error("Please select a customer before submitting the waitlist");
      return;
    }

    const product = products[productIndex];
    if (!product || !isValidInvoiceProduct(product)) {
      toast.error("Select a valid product before submitting the waitlist");
      return;
    }

    if (!product?.product_id || product?.is_return_product || product?.is_return_source) {
      toast.error("This product cannot be submitted to waitlist");
      return;
    }

    const requestedQty = Math.abs(Number(product.quantity || 0));
    if (requestedQty <= 0) {
      toast.error("Waitlist quantity must be greater than zero");
      return;
    }

    try {
      setIsSubmittingWaitlist(true);
      const result = await submitWaitlistRequest(accessToken, {
        customer_id: selectedCustomer.id,
        items: [
          {
            product_id: product.product_id,
            requested_qty: Number(requestedQty.toFixed(2)),
            notes: `Created from POS dedicated waitlist button for ${product.name || "product"}.`,
          },
        ],
      });

      if (!result?.status) {
        throw new Error(result?.message || "Failed to submit waitlist");
      }

      showWaitlistSubmittedAlert(result);
      removeProduct(productIndex);
    } catch (error) {
      showApiErrors(error, "Failed to submit waitlist");
    } finally {
      setIsSubmittingWaitlist(false);
    }
  };

  // Save draft to API
  const saveDraft = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer to save the draft");
      return;
    }
    const validProducts = products.filter(isValidInvoiceProduct);
    const hasAnyProductData = products.some(hasDraftProductData);

    if (!hasAnyProductData || validProducts.length === 0) {
      toast.error("Cannot save empty draft");
      return;
    }

    try {
      setIsConfirmingSale(true);
      const payload = buildSalePayload("draft");
      await storeSale(accessToken, payload);
      await fetchDrafts();

      Swal.fire({
        icon: "success",
        title: "Draft Saved",
        text: "Draft saved successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      setActiveDraftId(null);
      resetPos();
    } catch (error) {
      showApiErrors(error, "Failed to save draft");
    } finally {
      setIsConfirmingSale(false);
    }
  };

  // Restore draft from API list
  const restoreDraft = (draftId) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (draft) {
      const normalizedPayments = (draft.payments || []).map((payment, index) => ({
        id: payment.id || Date.now() + index,
        method: payment.method || payment.payment_method || "Cash",
        amount: Number(payment.amount || 0),
        card_type: payment.card_type || "",
        card_last_digits: payment.card_last_digits || "",
        mf_type: payment.mf_type || "",
        mf_number: payment.mf_number || "",
        qr_provider: payment.qr_provider || "",
        qr_transaction_id: payment.qr_transaction_id || "",
      }));

      setProducts(
        draft.products || [
          {
            id: Date.now(),
            product_id: "",
            inventory_id: "",
            inventory_item_id: "",
            lot_number: "",
            name: "",
            quantity: 1,
            unitPrice: "",
            totalPrice: 0,
            tax: 0,
            vat: "",
            stock: 0,
            alert_quantity: 5,
            max_quantity: 100,
            original_invoice_id: null,
            original_sale_item_id: null,
            is_return_product: false,
            is_returned: false,
            barcode: '',
            variant: '',
          },
        ]
      );
      setSelectedCustomer(draft.selectedCustomer || null);
      setPayments(normalizedPayments.length > 0 ? normalizedPayments : [{
        id: Date.now(),
        method: "Cash",
        amount: 0,
        card_type: "",
        card_last_digits: "",
        mf_type: "",
        mf_number: "",
        qr_provider: "",
        qr_transaction_id: "",
      }]);
      setPaymentSchedules(
        Array.isArray(draft.paymentSchedules) ? draft.paymentSchedules : []
      );
      setNumberOfInstallments(
        Array.isArray(draft.paymentSchedules) && draft.paymentSchedules.length > 0
          ? draft.paymentSchedules.length
          : 1
      );
      setSaleSummary(
        draft.saleSummary || {
          subTotal: 0,
          discount: 0,
          discountType: "flat",
          tax: 0,
          vat: "",
          grandTotal: 0,
          paidAmount: 0,
          paymentMethod: isReturn ? "Cash Refund" : "Cash",
          changeDue: 0,
          isFracture: false,
          card_type: "",
          card_last_digits: "",
          mf_type: "",
          mf_number: "",
          qr_provider: "",
          qr_transaction_id: "",
          points_used: 0,
          points_earned: 0,
          note: "",
        }
      );
      setProductSearch(draft.productSearch || "");
      setProductSuggestions(draft.productSuggestions || []);
      setTableProductSuggestions(draft.tableProductSuggestions || {});
      setTableProductErrors(draft.tableProductErrors || {});
      setTableProductLoading(draft.tableProductLoading || {});
      setIsReturn(draft.isReturn || false);
      setAppliedCoupon(draft.appliedCoupon || null); // Restore coupon
      setActiveDraftId(draft.id);
      setShowDraftList(false);
      Swal.fire({
        icon: "success",
        title: "Draft Restored",
        text: "Draft restored successfully",
        timer: 1500,
        showConfirmButton: false,
      });
      productInputRef.current?.focus();
    } else {
      toast.error("No draft found");
    }
  };

  // Delete draft
  const deleteDraft = (draftId) => {
    Swal.fire({
      title: "Are you sure?",
      text: "Do you want to delete this draft?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "No",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDraftSale(accessToken, draftId);
          await fetchDrafts();
          if (activeDraftId === draftId) {
            setActiveDraftId(null);
          }
          Swal.fire({
            icon: "success",
            title: "Draft Deleted",
            text: "Draft deleted successfully",
            timer: 1500,
            showConfirmButton: false,
          });
        } catch (error) {
          toast.error(error?.error?.message || "Failed to delete draft");
        }
      }
    });
  };

  // Cancel sale or return
  const cancelSale = () => {
    Swal.fire({
      title: "Are you sure?",
      text: `Do you want to cancel the ${isReturn ? "return" : "sale"}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, cancel",
      cancelButtonText: "No",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          if (activeDraftId) {
            await deleteDraftSale(accessToken, activeDraftId);
            await fetchDrafts();
          }

          resetPos();
          Swal.fire({
            icon: "success",
            title: "Cancelled",
            text: activeDraftId
              ? "Draft cancelled and removed"
              : `${isReturn ? "Return" : "Sale"} cancelled`,
            timer: 1500,
            showConfirmButton: false,
          });
        } catch (error) {
          toast.error(error?.error?.message || "Failed to cancel draft");
        }
      }
    });
  };

  // Handle return product
  const handleReturnProduct = (index) => {
    const product = products[index];
    if (!product?.is_return_source) {
      toast.error("Load an invoice item before adding a return row");
      return;
    }

    const returnableQty = Math.abs(
      Number(product.returnable_qty || product.max_quantity || 0)
    );
    if (returnableQty <= 0) {
      toast.error("No returnable quantity available for this item");
      return;
    }

    const sourceKey =
      product.return_source_key ||
      String(
        product.original_sale_item_id ||
        `${product.product_id || ""}-${product.inventory_item_id || ""}-${product.lot_number || ""}`
      );
    const existingReturnIndex = products.findIndex(
      (row) => row.is_return_product && row.return_source_key === sourceKey
    );
    if (existingReturnIndex !== -1) {
      toast.info("Return row already added for this product");
      return;
    }

    const returnQty = Math.min(1, returnableQty);
    const returnProduct = {
      ...product,
      id: Date.now() + Math.random(),
      quantity: -returnQty,
      discount: 0,
      totalPrice: -Math.abs(returnQty * Number(product.unitPrice || 0)),
      stock: returnableQty,
      max_quantity: returnableQty,
      returnable_qty: returnableQty,
      is_return_product: true,
      is_return_source: false,
      is_returned: false,
      linked_return_source_id: product.id,
      return_source_key: sourceKey,
    };

    setProducts((prevProducts) => {
      const currentIndex = prevProducts.findIndex((row) => row.id === product.id);
      const insertIndex = currentIndex === -1 ? index : currentIndex;
      const nextProducts = [...prevProducts];
      nextProducts.splice(insertIndex + 1, 0, returnProduct);
      return nextProducts;
    });
    setIsReturn(true);
    toast.success("Return row added under the sold item");
  };

  const processReturnProductImmediately = async (index) => {
    const product = products[index];
    if (product.is_returned) {
      toast.error("This item has already been returned");
      return;
    }

    Swal.fire({
      title: "Return Item",
      text: "Returning this item will update the stock. Are you sure you want to proceed?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, Return",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const payload = {
            invoice_id: product.original_invoice_id,
            product_id: product.product_id,
            inventory_id: product.inventory_id,
            inventory_item_id: product.inventory_item_id,
            lot_number: product.lot_number,
            qty: -product.quantity,
            unit_price: product.unitPrice,
            total: -product.totalPrice,
            tax_rate: (product?.tax ?? 0) * 100,
            vat_rate: (product?.vat ?? 0) * 100,
            original_sale_item_id: product.original_sale_item_id,
            type: "return",
          };

          const response = await itemReturn(accessToken, payload);

          const returnProduct = {
            ...product,
            id: Date.now() + Math.random(),
            quantity: -product.quantity,
            totalPrice: -product.totalPrice,
            is_returned: true,
            is_return_product: true,
            original_sale_item_id: response.data.id,
          };

          const updatedProducts = [...products];
          updatedProducts[index] = { ...product, is_returned: true };
          const emptyRecordIndex = updatedProducts.findIndex(
            (p) => p.name === ""
          );
          if (emptyRecordIndex !== -1) {
            updatedProducts.splice(emptyRecordIndex, 0, returnProduct);
          } else {
            updatedProducts.push(returnProduct);
          }

          setProducts(updatedProducts);

          Swal.fire({
            icon: "success",
            title: "Return Processed",
            text: "Item has been returned successfully",
            timer: 1500,
            showConfirmButton: false,
          });
        } catch (error) {
          const res = error?.response;
          const data = res?.data;
          if (res?.status === 422 && data?.errors) {
            const messages = extractLaravelErrors(data.errors);
            messages.slice(0, 5).forEach((m) => toast.error(m));
            if (messages.length > 5) {
              toast.error(`${messages.length - 5} more error(s)...`);
            }
          } else {
            toast.error(data?.message || "Failed to process return");
          }
        }
      }
    });
  };

  // Debounced customer search
  const debouncedCustomerSearch = useCallback(
    debounce((query) => searchCustomer(query), 300),
    [searchCustomer]
  );

  // Debounced product search for main input
  const debouncedProductSearch = useCallback(
    debounce((query) => {
      const normalizedQuery = String(query || "").trim();
      if (normalizedQuery.length < 2) {
        setProductSuggestions([]);
        return;
      }
      searchProduct(normalizedQuery, null);
    }, 300),
    [searchProduct]
  );

  const debouncedTableProductSearch = useCallback(
    debounce((rowIndex, value) => {
      const normalizedQuery = String(value || "").trim();
      if (normalizedQuery.length < 2) {
        setTableProductSuggestions(prev => ({ ...prev, [rowIndex]: [] }));
        return;
      }
      searchProduct(normalizedQuery, rowIndex);
    }, 300),
    [searchProduct]
  );

  // Handle customer search
  const handleCustomerSearch = (e) => {
    const value = e.target.value;
    setCustomerInput(value);
    debouncedCustomerSearch(value);
  };

  // Handle customer search keyboard navigation
  const handleCustomerSearchKeyDown = async (e) => {
    // Handle keyboard navigation when customer search results are visible
    if (customerSearchResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const newIndex = customerHighlightedIndex < customerSearchResults.length - 1 ? customerHighlightedIndex + 1 : 0;
        setCustomerHighlightedIndex(newIndex);

        // Auto-scroll to highlighted item
        setTimeout(() => {
          if (customerDropdownListRef.current) {
            const highlightedElement = customerDropdownListRef.current.children[newIndex];
            if (highlightedElement) {
              highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const newIndex = customerHighlightedIndex > 0 ? customerHighlightedIndex - 1 : customerSearchResults.length - 1;
        setCustomerHighlightedIndex(newIndex);

        // Auto-scroll to highlighted item
        setTimeout(() => {
          if (customerDropdownListRef.current) {
            const highlightedElement = customerDropdownListRef.current.children[newIndex];
            if (highlightedElement) {
              highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }, 0);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (customerHighlightedIndex >= 0 && customerHighlightedIndex < customerSearchResults.length) {
          setSelectedCustomer(customerSearchResults[customerHighlightedIndex]);
          setCustomerInput("");
          setCustomerSearchResults([]);
          setCustomerHighlightedIndex(-1);
          productInputRef.current?.focus();
        }
      } else if (e.key === "Escape") {
        setCustomerSearchResults([]);
        setCustomerHighlightedIndex(-1);
      }
    } else if (e.key === "Enter" && customerInput.length >= 3) {
      // Original behavior for direct search when no results are shown
      const results = await searchCustomer(customerInput);
      if (results.length > 0) {
        setSelectedCustomer(results[0]);
        setCustomerInput("");
        setCustomerSearchResults([]);
        productInputRef.current?.focus();
      } else {
        toast.error("No customer found");
      }
    }
  };

  // Save new customer
  const saveCustomer = async () => {
    const errors = validateCustomer(newCustomer);
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach((error) => toast.error(error));
      return;
    }

    try {
      const savedCustomer = await createCustomer(newCustomer);
      setSelectedCustomer(savedCustomer);
      setShowCustomerDrawer(false);
      setCustomerSearchResults([]);
      setCustomerInput("");
      setNewCustomer({
        phone: "",
        name: "",
        email: "",
        address: "",
        nidTinTax: "",
      });
      productInputRef.current?.focus();
    } catch (error) {
      // Do not set a default customer on error
      toast.error("Failed to create customer");
    }
  };

  // Unselect customer
  const unselectCustomer = () => {
    fetchDefaultCustomer();
    setCustomerInput("");
    setCustomerSearchResults([]);
    setCustomerHighlightedIndex(-1);
    productInputRef.current?.focus();
  };

  const createQuotation = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer before creating quotation");
      return;
    }

    const validProducts = products.filter(isValidInvoiceProduct);
    const hasAnyProductData = products.some(hasDraftProductData);
    if (!hasAnyProductData || validProducts.length === 0) {
      toast.error("At least one product is required");
      return;
    }

    if (isReturn) {
      toast.error("Quotation is not allowed in return mode");
      return;
    }

    try {
      setIsConfirmingSale(true);
      const payload = buildSalePayload("quotation", { skipPayments: true });
      const response = await storeSale(accessToken, payload);

      if (activeDraftId) {
        try {
          await deleteDraftSale(accessToken, activeDraftId);
        } catch (deleteError) {
          console.error(deleteError);
        }
      }

      await fetchDrafts();
      setActiveDraftId(null);
      resetPos();
      setPrinterType(userPrinterType || "normal");
      setPrintInvoice(response.data?.data || response.data);
      setPrintWithCustomerInfo(selectedCustomer);
      toast.success("Quotation created successfully");
    } catch (error) {
      showApiErrors(error, "Failed to create quotation");
    } finally {
      setIsConfirmingSale(false);
    }
  };

  // Toggle return mode
  const toggleReturnMode = () => {
    if (!isReturn && !allowedReturnModes.includes("refund")) {
      toast.error("POS return mode is disabled by policy (exchange-only).");
      return;
    }

    const nextIsReturn = !isReturn;
    const defaultReturnMethod = getDefaultReturnPaymentMethod();

    if (!selectedCustomer) {
      toast.error("Please select a customer before enabling return mode");
      return;
    }
    setIsReturn(nextIsReturn);
    setSaleSummary((prev) => ({
      ...prev,
      paymentMethod: !isReturn ? "Cash Refund" : "Cash",
      discount: 0,
      discountType: "flat",
      points_used: 0,
      points_earned: 0,
      changeDue: 0,
    }));
    setPayments((prevPayments) => {
      if (!Array.isArray(prevPayments) || prevPayments.length === 0) {
        return [{
          id: Date.now(),
          method: nextIsReturn ? defaultReturnMethod : "Cash",
          amount: 0,
          card_type: "",
          card_last_digits: "",
          mf_type: "",
          mf_number: "",
          qr_provider: "",
          qr_transaction_id: "",
        }];
      }

      return prevPayments.map((payment, idx) => ({
        ...payment,
        method: idx === 0 ? (nextIsReturn ? defaultReturnMethod : "Cash") : payment.method,
      }));
    });
    setProducts([
      {
        id: Date.now(),
        product_id: "",
        inventory_id: "",
        inventory_item_id: "",
        lot_number: "",
        name: "",
        quantity: 1,
        unitPrice: "",
        totalPrice: 0,
        tax: 0,
        vat: "",
        stock: 0,
        alert_quantity: 5,
        max_quantity: 100,
        original_invoice_id: null,
        original_sale_item_id: null,
        is_return_product: false,
        is_returned: false,
      },
    ]);
    productInputRef.current?.focus();
  };

  // Add or update product
  const addOrUpdateProduct = (index, selectedProduct) => {
    if (!selectedCustomer) {
      toast.error("Please select a customer before adding products");
      return;
    }

    const hasValidReturnSelection = Boolean(
      selectedProduct?.is_return &&
      selectedProduct?.invoice?.id &&
      Array.isArray(selectedProduct?.products) &&
      selectedProduct.products.length > 0
    );

    const hasValidRegularSelection = Boolean(
      selectedProduct &&
      (
        selectedProduct.bundle_id ||
        selectedProduct.product_id ||
        selectedProduct.id
      ) &&
      String(selectedProduct?.name || "").trim() !== ""
    );

    const hasValidSelection = hasValidReturnSelection || hasValidRegularSelection;

    if (!hasValidSelection) {
      toast.error("No valid product found");
      return;
    }

    playScanSound();

    // Handle return products (keep your existing logic here if any)
    if (selectedProduct.is_return) {
      const addedProducts = selectedProduct.products.map((prod) => ({
        ...(() => {
          const returnQty = Math.max(
            1,
            Math.abs(Number(prod.selected_qty ?? prod.quantity ?? 1))
          );
          const unitPrice = Number(prod.unitPrice ?? prod.unit_price ?? 0);
          return {
            quantity: -returnQty,
            totalPrice: -Math.abs(returnQty * unitPrice),
          };
        })(),
        id: Date.now() + Math.random(),
        product_id: prod.id,
        bundle_id: "",
        item_type: "product",
        inventory_id: prod.inventory_id || "",
        inventory_item_id: prod.inventory_item_id || "",
        lot_number: prod.lot_number || "",
        name: prod.name,
        unitPrice: Number(prod.unitPrice),
        tax_rate: Number(prod.tax_rate) / 100,
        vat_rate: Number(prod.vat_rate) / 100,
        stock: Number(prod.stock),
        alert_quantity: prod.alert_quantity ? Number(prod.alert_quantity) : 5,
        max_quantity: Number(prod.max_quantity ?? prod.quantity ?? 0),
        original_invoice_id: selectedProduct.invoice.id,
        original_sale_item_id: prod.sale_item_id,
        is_return_product: true,
        is_returned: prod.is_returned || false,
        barcode: prod?.barcode || selectedProduct?.barcode || '',
        variant: prod?.variant || selectedProduct?.variant || '',
      }));

      const filledProducts = products.filter((p) => p.name !== "");
      const getReturnKey = (item) =>
        String(
          item?.original_sale_item_id ||
          `${item?.product_id || ""}-${item?.inventory_item_id || ""}-${item?.lot_number || ""}`
        );

      const existingReturnKeys = new Set(
        filledProducts
          .filter((p) => p.is_return_product)
          .map((p) => getReturnKey(p))
      );

      const uniqueReturnProducts = addedProducts.filter((item) => {
        const key = getReturnKey(item);
        const alreadyInCart = existingReturnKeys.has(key);
        const returnableQty = Math.abs(Number(item.max_quantity || 0));
        return !alreadyInCart && returnableQty > 0;
      });

      if (uniqueReturnProducts.length === 0) {
        toast.info("Return items from this invoice are already added.");
        return;
      }

      const newProducts = [...filledProducts, ...uniqueReturnProducts];

      newProducts.push({
        id: Date.now(),
        product_id: "",
        bundle_id: "",
        item_type: "product",
        inventory_id: "",
        inventory_item_id: "",
        lot_number: "",
        name: "",
        quantity: 1,
        unitPrice: "",
        discount: 0,
        tax_rate: 0,
        vat_rate: "",
        totalPrice: 0,
        stock: 0,
        alert_quantity: 5,
        max_quantity: 100,
        original_invoice_id: null,
        original_sale_item_id: null,
        is_return_product: false,
        is_returned: false,
      });

      setProducts(newProducts);
      setSelectedCustomer(selectedProduct.customer);
      setIsReturn(true);
      // ← Your existing return product code (don't change)
      return;
    }

    const barcode = selectedProduct.barcode || selectedProduct.code || "";
    const inventoryItemId = selectedProduct.inventory_item_id;
    const shouldSeparateByBarcode = posSettings.separate_row_per_barcode;
    const isBundleProduct =
      selectedProduct.item_type === "bundle" || !!selectedProduct.bundle_id;

    if (isBundleProduct) {
      const availableBundleStock = getAvailableBundleQuantity(selectedProduct);
      const resolvedBundleUnitPrice = Number(
        selectedProduct.unitPrice ??
          selectedProduct.unit_price ??
          selectedProduct.bundle_price ??
          0
      );

      if (availableBundleStock <= 0) {
        toast.error(`Out of stock! Bundle "${selectedProduct.name}" is not available.`);
        return;
      }

      let newProducts = [...products];
      const existingBundleIndex = shouldSeparateByBarcode
        ? -1
        : products.findIndex((p) =>
          p.bundle_id === selectedProduct.bundle_id &&
          p.name !== "" &&
          p.is_return_product === false &&
          p.id !== products[index]?.id
        );

      if (existingBundleIndex !== -1) {
        const existing = newProducts[existingBundleIndex];
        const newQty = Number(existing.quantity || 0) + 1;

        if (newQty > availableBundleStock) {
          toast.error(
            `Insufficient bundle stock! Only ${availableBundleStock} bundle(s) available for ${existing.name}.`
          );
          return;
        }

        existing.quantity = newQty;
        existing.totalPrice = newQty * Number(existing.unitPrice || 0);

        newProducts[index] = {
          id: Date.now(),
          product_id: "",
          bundle_id: "",
          item_type: "product",
          inventory_id: "",
          inventory_item_id: "",
          lot_number: "",
          name: "",
          quantity: 1,
          unitPrice: "",
          discount: 0,
          tax_rate: 0,
          vat_rate: "",
          totalPrice: 0,
          stock: 0,
          alert_quantity: 5,
          max_quantity: 100,
          barcode: "",
          variant: "",
          is_return_product: false,
          is_returned: false,
        };

        setProductSearch("");
        setProductSuggestions([]);
        toast.success(`Quantity updated: ${existing.name} - ${newQty} unit(s)`);
      } else {
        const newBundle = {
          id: Date.now() + Math.random(),
          product_id: "",
          bundle_id: selectedProduct.bundle_id,
          item_type: "bundle",
          inventory_id: "",
          inventory_item_id: "",
          lot_number: "",
          name: selectedProduct.name,
          barcode: "BUNDLE",
          variant: "Bundle",
          bundle_components: selectedProduct.components || [],
          unitPrice: resolvedBundleUnitPrice,
          discount: 0,
          tax_rate: 0,
          vat_rate: "",
          stock: availableBundleStock,
          alert_quantity: 0,
          max_quantity: availableBundleStock,
          quantity: 1,
          totalPrice: resolvedBundleUnitPrice,
          bundle_qty: Number(selectedProduct.bundle_qty ?? 0),
          is_return_product: false,
          is_returned: false,
        };

        const filledProducts = newProducts.filter((p) => p.name !== "");
        const emptyRows = newProducts.filter((p) => p.name === "");
        newProducts = [newBundle, ...filledProducts, ...emptyRows];

        if (!newProducts.some((p) => p.name === "")) {
          newProducts.push({
            id: Date.now(),
            product_id: "",
            bundle_id: "",
            item_type: "product",
            name: "",
            quantity: 1,
            unitPrice: "",
            barcode: "",
            variant: "",
            discount: 0,
            tax_rate: 0,
            vat_rate: "",
            totalPrice: 0,
            stock: 0,
            alert_quantity: 5,
            max_quantity: 100,
            inventory_item_id: "",
            inventory_id: "",
            lot_number: "",
            is_return_product: false,
            is_returned: false,
          });
        }

        setProductSearch("");
        setProductSuggestions([]);
        setTableProductSuggestions((prev) => ({ ...prev, [index]: [] }));
      }

      setProducts(newProducts);
      setTimeout(() => productInputRef.current?.focus(), 0);
      return;
    }

    // Calculate current total quantity selected for this inventory item
    const currentTotalQuantity = inventoryItemId
      ? getTotalQuantityForInventoryItem(inventoryItemId, index)
      : 0;
    const reservedByBundles = getReservedQuantityForProduct(
      selectedProduct.product_id,
      index
    );

    const availableStock = selectedProduct.stock || selectedProduct.available_quantity || 0;
    const remainingStock = availableStock - currentTotalQuantity - reservedByBundles;

    const isOutOfStockSelection = remainingStock <= 0;
    if (isOutOfStockSelection) {
      toast.info(
        `${selectedProduct.name}${selectedProduct.variant && selectedProduct.variant !== 'N/A'
          ? ` (${selectedProduct.variant})`
          : ''
        } is out of stock. It will be submitted for waitlist.`
      );
    }

    playScanSound();

    // Find if same product (same barcode AND same inventory_item_id) already exists
    const existingProductIndex = shouldSeparateByBarcode
      ? -1 // Force new row
      : products.findIndex(p =>
        p.barcode === barcode &&
        p.inventory_item_id === inventoryItemId &&
        p.barcode !== "" &&
        p.name !== "" &&
        p.is_return_product === false &&
        p.id !== products[index]?.id
      );

    let newProducts = [...products];

    if (existingProductIndex !== -1) {
      // SAME BARCODE + SAME VARIANT → increase quantity
      const existing = newProducts[existingProductIndex];
      const newQty = Number(existing.quantity) + 1;

      // Check if new quantity exceeds available stock
      if (!isOutOfStockSelection && newQty > remainingStock) {
        toast.error(
          `Insufficient stock! Only ${remainingStock} unit(s) available for ${existing.name}${existing.variant && existing.variant !== 'N/A'
            ? ` (${existing.variant})`
            : ''
          }`
        );
        return;
      }

      existing.quantity = newQty;
      existing.totalPrice = calculateLineTotal(existing);

      // Clear the current row being edited
      newProducts[index] = {
        id: Date.now(),
        product_id: "",
        bundle_id: "",
        item_type: "product",
        inventory_id: "",
        inventory_item_id: "",
        lot_number: "",
        name: "",
        quantity: 1,
        unitPrice: "",
        discount: 0,
        tax_rate: 0,
        vat_rate: "",
        totalPrice: 0,
        stock: 0,
        alert_quantity: 5,
        max_quantity: 100,
        barcode: "",
        variant: "",
        is_return_product: false,
        is_returned: false,
      };

      setProductSearch("");
      setProductSuggestions([]);
      toast.success(
        `Quantity updated: ${existing.name}${existing.variant && existing.variant !== 'N/A'
          ? ` (${existing.variant})`
          : ''
        } - ${newQty} unit(s)`
      );
    } else {
      // DIFFERENT VARIANT OR setting enabled → always add new row
      const newProduct = {
        id: Date.now() + Math.random(),
        product_id: selectedProduct.product_id,
        bundle_id: "",
        item_type: "product",
        inventory_id: selectedProduct.inventory_id || "",
        inventory_item_id: selectedProduct.inventory_item_id || "",
        lot_number: selectedProduct.lot_number || "",
        name: selectedProduct.name,
        barcode: barcode,
        variant: selectedProduct.variant || "",
        bundle_components: [],
        unitPrice: Number(selectedProduct.unitPrice),
        discount: selectedProduct.discount || 0,
        discount_type: normalizeLineDiscountType(selectedProduct.discount_type),
        tax_rate: selectedProduct.tax_rate ? selectedProduct.tax_rate / 100 : 0,
        vat_rate: selectedProduct.vat_rate ? selectedProduct.vat_rate / 100 : "",
        stock: availableStock,
        alert_quantity: selectedProduct.alert_quantity || 5,
        max_quantity: availableStock > 0 ? availableStock : 100000,
        quantity: 1,
        totalPrice: calculateLineTotal({
          quantity: 1,
          unitPrice: Number(selectedProduct.unitPrice),
          discount: selectedProduct.discount || 0,
          discount_type: normalizeLineDiscountType(selectedProduct.discount_type),
          tax_rate: selectedProduct.tax_rate ? selectedProduct.tax_rate / 100 : 0,
          vat_rate: selectedProduct.vat_rate ? selectedProduct.vat_rate / 100 : 0,
        }),
        is_return_product: false,
        is_returned: false,
      };

      // Insert new product at the top
      const filledProducts = newProducts.filter(p => p.name !== "");
      const emptyRows = newProducts.filter(p => p.name === "");
      newProducts = [newProduct, ...filledProducts, ...emptyRows];

      // Always keep one empty row at bottom
      if (!newProducts.some(p => p.name === "")) {
        newProducts.push({
          id: Date.now(),
          product_id: "",
          bundle_id: "",
          item_type: "product",
          name: "",
          quantity: 1,
          unitPrice: "",
          barcode: "",
          variant: "",
          discount: 0,
          tax_rate: 0,
          vat_rate: "",
          totalPrice: 0,
          stock: 0,
          alert_quantity: 5,
          max_quantity: 100,
          inventory_item_id: "",
          inventory_id: "",
          lot_number: "",
          is_return_product: false,
          is_returned: false,
        });
      }

      setProductSearch("");
      setProductSuggestions([]);
      setTableProductSuggestions(prev => ({ ...prev, [index]: [] }));
    }

    setProducts(newProducts);
    setTimeout(() => productInputRef.current?.focus(), 0);
  };

  const handleReturnItemsFromStockOut = useCallback(({ invoice, items, autoCreateReturnRows = true }) => {
    const invoiceItems = Array.isArray(items)
      ? items.filter((item) => !item.blocked_reason && Number(item.returnable_qty || 0) > 0)
      : [];
    const selectedItems = autoCreateReturnRows
      ? invoiceItems.filter((item) => Number(item.selected_qty || 0) > 0)
      : invoiceItems;

    if (!invoice?.id || selectedItems.length === 0) {
      toast.error("No returnable products found for this invoice");
      return;
    }

    const customerName = String(invoice.customer_name || "").trim() || "Walk-in Customer";
    const invoiceCustomer = {
      id: invoice.customer_id || null,
      name: customerName,
      phone: invoice.customer_phone || "",
      email: invoice.customer_email || "",
      address: invoice.customer_address || "",
      nidTinTax: "",
      reward_points: 0,
    };

    const filledProducts = products.filter((p) => p.name !== "");
    const getReturnKey = (item) =>
      String(
        item?.original_sale_item_id ||
        item?.invoice_item_id ||
        `${item?.product_id || ""}-${item?.inventory_item_id || ""}-${item?.lot_number || ""}`
      );

    const existingSourceKeys = new Set(
      filledProducts
        .filter((p) => p.is_return_product || p.is_return_source)
        .map((p) => getReturnKey(p))
    );

    const sourceProducts = selectedItems
      .map((item) => {
        const unitPrice = Number(item.unit_price || 0);
        const soldQty = Math.abs(Number(item.sold_qty || item.returnable_qty || 0));
        const returnableQty = Math.abs(Number(item.returnable_qty || 0));
        const sourceKey = getReturnKey(item);

        return {
          id: Date.now() + Math.random(),
          product_id: item.product_id,
          bundle_id: "",
          item_type: "product",
          inventory_id: item.inventory_id || "",
          inventory_item_id: item.inventory_item_id || "",
          lot_number: item.lot_number || "",
          name: item.product_name,
          quantity: soldQty,
          unitPrice,
          discount: 0,
          tax_rate: Number(item.tax_rate || 0) / 100,
          vat_rate: Number(item.vat_rate || 0) / 100,
          totalPrice: Math.abs(soldQty * unitPrice),
          stock: returnableQty,
          alert_quantity: 0,
          max_quantity: returnableQty,
          returnable_qty: returnableQty,
          returned_qty: Number(item.returned_qty || 0),
          original_invoice_id: invoice.id,
          original_sale_item_id: item.invoice_item_id,
          is_return_product: false,
          is_return_source: true,
          is_returned: false,
          barcode: item.code || "",
          variant: item.variant || "",
          return_reason_code: item.reason_code || "changed_mind",
          is_damaged: !!item.is_damaged,
          return_invoice_no: invoice.invoice_no || "",
          return_source_key: sourceKey,
          selected_return_qty: Number(item.selected_qty || 0),
        };
      })
      .filter((item) => {
        const returnableQty = Math.abs(Number(item.returnable_qty || 0));
        return item.product_id && item.original_sale_item_id && returnableQty > 0;
      })
      .filter((item) => !existingSourceKeys.has(getReturnKey(item)));

    if (sourceProducts.length === 0) {
      toast.info("Products from this invoice are already loaded.");
      return;
    }

    const productsToAdd = sourceProducts.flatMap((source) => {
      if (!autoCreateReturnRows || Number(source.selected_return_qty || 0) <= 0) {
        return [source];
      }

      const returnQty = Math.min(
        Math.abs(Number(source.selected_return_qty || 0)),
        Math.abs(Number(source.returnable_qty || 0))
      );

      const returnRow = {
        ...source,
        id: Date.now() + Math.random(),
        quantity: -returnQty,
        totalPrice: -Math.abs(returnQty * Number(source.unitPrice || 0)),
        stock: Number(source.returnable_qty || 0),
        max_quantity: Number(source.returnable_qty || returnQty),
        is_return_product: true,
        is_return_source: false,
        linked_return_source_id: source.id,
      };

      return [source, returnRow];
    });

    const emptyRow = {
      id: Date.now(),
      product_id: "",
      bundle_id: "",
      item_type: "product",
      inventory_id: "",
      inventory_item_id: "",
      lot_number: "",
      name: "",
      quantity: 1,
      unitPrice: "",
      discount: 0,
      tax_rate: 0,
      vat_rate: "",
      totalPrice: 0,
      stock: 0,
      alert_quantity: 5,
      max_quantity: 100,
      original_invoice_id: null,
      original_sale_item_id: null,
      is_return_product: false,
      is_returned: false,
      barcode: "",
      variant: "",
    };

    const defaultReturnMethod = getDefaultReturnPaymentMethod();
    setSelectedCustomer(invoiceCustomer);
    setCustomerInput("");
    setCustomerSearchResults([]);
    setIsReturn(true);
    setProducts([...filledProducts, ...productsToAdd, emptyRow]);
    setSaleSummary((prev) => ({
      ...prev,
      paymentMethod: defaultReturnMethod,
      discount: 0,
      discountType: "flat",
      points_used: 0,
      points_earned: 0,
      changeDue: 0,
    }));
    setPayments((prevPayments) => {
      const basePayments = Array.isArray(prevPayments) && prevPayments.length > 0
        ? prevPayments
        : [{
          id: Date.now(),
          method: defaultReturnMethod,
          amount: 0,
          card_type: "",
          card_last_digits: "",
          mf_type: "",
          mf_number: "",
          qr_provider: "",
          qr_transaction_id: "",
        }];

      return basePayments.map((payment, idx) => ({
        ...payment,
        method: idx === 0 ? defaultReturnMethod : payment.method,
      }));
    });
    setShowSellReturnCenter(false);
    toast.success(
      autoCreateReturnRows
        ? `${productsToAdd.filter((p) => p.is_return_product).length} return item(s) added to POS`
        : `${sourceProducts.length} invoice item(s) loaded. Click Return beside an item to add the minus row.`
    );
    setTimeout(() => productInputRef.current?.focus(), 0);
  }, [getDefaultReturnPaymentMethod, products]);

  const loadReturnInvoiceFromSearch = useCallback(async (invoiceSearchText) => {
    const term = String(invoiceSearchText || "").trim();
    if (!term) {
      return false;
    }

    try {
      setIsGlobalProductLoading(true);
      setProductSuggestions([]);

      const result = await fetchingStockOutList(accessToken, {
        perPage: 10,
        page: 1,
        filterText: term,
        filterCategory: "",
        filterBrand: "",
        returnableOnly: false,
        sortField: "created_at",
        sortOrder: "desc",
      });

      const rows = Array.isArray(result?.data) ? result.data : [];
      const invoiceRows = rows.filter(
        (row) =>
          row?.invoice_id &&
          row?.invoice_number &&
          String(row.invoice_number).toLowerCase() === term.toLowerCase()
      );
      const matchedInvoice = invoiceRows.find(
        (row) => Number(row.returnable_qty || 0) > 0 && !row.is_fully_returned
      ) || invoiceRows[0];

      if (!matchedInvoice) {
        toast.error("No matching sold invoice found");
        return true;
      }

      const invoiceHasReturn = invoiceRows.some(
        (row) => row.is_fully_returned || Number(row.returned_qty || 0) > 0
      );
      if (invoiceHasReturn) {
        toast.error("This invoice has already been used for a return");
        return true;
      }

      const preview = await getSaleReturnPreview(accessToken, matchedInvoice.invoice_id);
      if (!preview?.status) {
        throw new Error(preview?.message || "Failed to load return invoice");
      }

      const returnableItems = Array.isArray(preview?.data?.items)
        ? preview.data.items
          .filter((item) => !item.blocked_reason && Number(item.returnable_qty || 0) > 0)
          .map((item) => ({
            ...item,
            selected_qty: 0,
            reason_code: "changed_mind",
            is_damaged: false,
          }))
        : [];

      if (returnableItems.length === 0) {
        toast.error("No returnable products found for this invoice");
        return true;
      }

      handleReturnItemsFromStockOut({
        invoice: preview?.data?.invoice || {
          id: matchedInvoice.invoice_id,
          invoice_no: matchedInvoice.invoice_number,
        },
        items: returnableItems,
        autoCreateReturnRows: false,
      });

      setProductSearch("");
      setProductSuggestions([]);
      return true;
    } catch (error) {
      toast.error(error?.message || "Failed to load invoice return items");
      return true;
    } finally {
      setIsGlobalProductLoading(false);
    }
  }, [accessToken, handleReturnItemsFromStockOut]);

  // Handle product search
  const handleProductSearch = async (index, query) => {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) return;

    const looksLikeInvoice = /^inv[-\w]*\d/i.test(normalizedQuery);
    if (index === products.length - 1 && looksLikeInvoice) {
      const loadedInvoice = await loadReturnInvoiceFromSearch(normalizedQuery);
      if (loadedInvoice) {
        return;
      }
    }

    if (!selectedCustomer) {
      toast.error("Please select a customer first");
      return;
    }

    const results = await searchProduct(normalizedQuery, index);
    if (results.length === 0) {
      toast.error("No product found");
      setProductSuggestions([]);
      return;
    }

    playScanSound();
    addOrUpdateProduct(index, results[0]);

    // Clear the global search field and suggestions when adding from global search
    if (index === products.length - 1) {
      setProductSearch("");
      setProductSuggestions([]);
    }
  };

  // Handle product input change in table
  const handleTableProductInput = async (index, value) => {
    const newProducts = [...products];
    newProducts[index].name = value;
    setProducts(newProducts);
    debouncedTableProductSearch(index, value);
  };

  // Update product fields
  const updateProduct = (index, field, value) => {
    const newProducts = [...products];
    let parsedValue = [
      "quantity",
      "unitPrice",
      "discount",
      "tax_rate",
      "vat_rate",
    ].includes(field)
      ? value === ""
        ? ""
        : Number(value)
      : value;

    if (field === "quantity" && parsedValue !== "") {
      if (!isReturn && parsedValue <= 0) {
        toast.error("Quantity must be positive for sales");
        return;
      }

      const currentProduct = newProducts[index];
      const isReturnLine = isReturn && currentProduct?.is_return_product;
      if (isReturnLine) {
        parsedValue = -Math.abs(Number(parsedValue));
        const maxReturnQty = Math.abs(
          Number(currentProduct.max_quantity || currentProduct.returnable_qty || currentProduct.stock || 0)
        );
        if (maxReturnQty > 0 && Math.abs(parsedValue) > maxReturnQty) {
          toast.error(`Return quantity cannot exceed ${maxReturnQty}`);
          return;
        }
      }

      if (!isReturnLine && currentProduct.item_type === "bundle") {
        const availableBundleStock = getAvailableBundleQuantity(
          {
            ...currentProduct,
            components: currentProduct.bundle_components || [],
          },
          index
        );

        if (Math.abs(parsedValue) > availableBundleStock) {
          toast.error(
            `Insufficient bundle stock! Only ${availableBundleStock} bundle(s) available.`
          );
          return;
        }

        newProducts[index].stock = availableBundleStock;
        newProducts[index].max_quantity = availableBundleStock;
      }

      // Calculate total quantity for this inventory item across all rows
      if (!isReturnLine) {
        const totalQuantityForItem = getTotalQuantityForInventoryItem(
          currentProduct.inventory_item_id,
          index
        );
        const reservedByBundles = getReservedQuantityForProduct(
          currentProduct.product_id,
          index
        );

        // Subtract current row's quantity to get quantity from other rows
        const otherRowsQuantity = totalQuantityForItem - Number(currentProduct.quantity || 0);

        // Calculate remaining stock available
        const availableStock = currentProduct.stock;
        const remainingStock = availableStock - otherRowsQuantity - reservedByBundles;

        const isOutOfStockRow = (Number(availableStock) || 0) <= 0;

        // Check if new quantity exceeds remaining stock for in-stock rows only
        if (!isOutOfStockRow && Math.abs(parsedValue) > remainingStock) {
          toast.error(
            `Insufficient stock! Only ${remainingStock} unit(s) available for this variant. (${otherRowsQuantity} already selected in other rows)`
          );
          return;
        }

        if (!isOutOfStockRow && Math.abs(parsedValue) > newProducts[index].max_quantity) {
          toast.error(
            `Quantity cannot exceed ${newProducts[index].max_quantity}`
          );
          return;
        }
      }
    }

    if (
      ["discount", "tax_rate", "vat_rate"].includes(field) &&
      parsedValue < 0
    ) {
      toast.error(
        `${field.replace("_", " ").toUpperCase()} cannot be negative`
      );
      return;
    }

    newProducts[index][field] = parsedValue;

    newProducts[index].totalPrice = calculateLineTotal(newProducts[index]);

    setProducts(newProducts);
  };

  // Remove product
  const removeProduct = (index) => {
    const removedProduct = products[index];
    const newProducts = products.filter((product, i) => {
      if (i === index) {
        return false;
      }
      if (
        removedProduct?.is_return_source &&
        product.linked_return_source_id === removedProduct.id
      ) {
        return false;
      }
      return true;
    });
    if (newProducts.length === 0 || !newProducts.some((p) => p.name === "")) {
      newProducts.push({
        id: Date.now(),
        product_id: "",
        inventory_id: "",
        inventory_item_id: "",
        lot_number: "",
        name: "",
        quantity: 1,
        unitPrice: "",
        totalPrice: 0,
        tax: saleSummary.tax,
        vat: saleSummary.vat,
        stock: 0,
        alert_quantity: 5,
        max_quantity: 100,
        original_invoice_id: null,
        original_sale_item_id: null,
        is_return_product: false,
        is_returned: false,
      });
    }
    setProducts(newProducts);
    setTableProductSuggestions((prev) => {
      const newSuggestions = { ...prev };
      delete newSuggestions[index];
      return newSuggestions;
    });
    setTableProductErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
    setTableProductLoading((prev) => {
      const newLoading = { ...prev };
      delete newLoading[index];
      return newLoading;
    });
    delete lastTableQueriesRef.current[index];
    productInputRef.current?.focus();
  };

  // Add manual row
  const addManualRow = () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer before adding a new row");
      return;
    }
    setProducts([
      ...products,
      {
        id: Date.now(),
        product_id: "",
        inventory_id: "",
        inventory_item_id: "",
        lot_number: "",
        name: "",
        quantity: 1,
        unitPrice: "",
        totalPrice: 0,
        tax: saleSummary.tax,
        vat: saleSummary.vat,
        stock: 0,
        alert_quantity: 5,
        max_quantity: 100,
        original_invoice_id: null,
        original_sale_item_id: null,
        is_return_product: false,
        is_returned: false,
      },
    ]);
    productInputRef.current?.focus();
  };

  // Handle overall discount change
  const handleOverallDiscountChange = (value) => {
    if (isReturn) {
      toast.error("Discounts are not applicable for returns");
      return;
    }
    const disc = Number(value) || 0;
    if (disc < 0) {
      toast.error("Discount cannot be negative");
      return;
    }

    const netSubTotal = products.reduce((sum, p) => {
      if (p.name === "") return sum;
      const basePrice = (p.quantity || 0) * (p.unitPrice || 0);
      const itemDiscAmount = calculateLineDiscountAmount(
        basePrice,
        p.discount,
        p.discount_type,
        p.quantity
      );
      return sum + basePrice - itemDiscAmount;
    }, 0);

    const maxDisc = saleSummary.discountType === "percent" ? 100 : netSubTotal;
    if (disc > maxDisc) {
      toast.error(
        `Discount cannot exceed ${maxDisc}${saleSummary.discountType === "percent" ? "%" : ""}`
      );
      return;
    }

    setSaleSummary((prev) => ({ ...prev, discount: disc }));
  };

  // Handle overall discount type change
  const handleOverallDiscountTypeChange = (type) => {
    if (isReturn) {
      toast.error("Discounts are not applicable for returns");
      return;
    }
    setSaleSummary((prev) => ({ ...prev, discountType: type, discount: 0 }));
  };

  // Update tax
  const updateTax = (taxPercent) => {
    if (isReturn) {
      toast.error("Tax adjustments are not applicable for returns");
      return;
    }
    const tax = Number(taxPercent) || 0;
    if (tax < 0 || tax > 100) {
      toast.error("Tax percentage must be between 0 and 100");
      return;
    }
    setSaleSummary((prev) => ({
      ...prev,
      tax,
    }));
  };

  // Update VAT
  const updateVat = (vatPercent) => {
    if (isReturn) {
      toast.error("VAT adjustments are not applicable for returns");
      return;
    }
    const vat = Number(vatPercent) || '';
    if (vat < 0 || vat > 100) {
      toast.error("VAT percentage must be between 0 and 100");
      return;
    }
    setSaleSummary((prev) => ({
      ...prev,
      vat,
    }));
  };

  // Calculate total quantity selected for a product across all rows
  const getTotalQuantityForInventoryItem = useCallback((inventoryItemId, currentIndex) => {
    if (!inventoryItemId) return 0;

    return products.reduce((total, product, index) => {
      // Include all rows with the same inventory_item_id, excluding return products
      if (
        product.inventory_item_id === inventoryItemId &&
        product.name !== "" &&
        !product.is_return_product &&
        !product.is_return_source
      ) {
        return total + Number(product.quantity || 0);
      }
      return total;
    }, 0);
  }, [products]);

  const getReservedQuantityForProduct = useCallback((productId, excludeIndex = null) => {
    if (!productId) return 0;

    return products.reduce((total, product, index) => {
      if (excludeIndex !== null && index === excludeIndex) {
        return total;
      }

      if (product.name === "" || product.is_return_product || product.is_return_source) {
        return total;
      }

      if (product.item_type === "bundle" && Array.isArray(product.bundle_components)) {
        const configuredBundleQty = Number(product.bundle_qty ?? 0);
        const reservedByBundle = product.bundle_components.reduce((bundleTotal, component) => {
          if (component.product_id !== productId) {
            return bundleTotal;
          }

          const rawQtyPerConfiguredBundle = Number(component.quantity_per_bundle || 0);
          const qtyPerSaleBundle =
            configuredBundleQty > 0
              ? rawQtyPerConfiguredBundle / configuredBundleQty
              : 0;

          return (
            bundleTotal +
            Math.max(qtyPerSaleBundle, 0) * Number(product.quantity || 0)
          );
        }, 0);

        return total + reservedByBundle;
      }

      if (product.product_id === productId) {
        return total + Number(product.quantity || 0);
      }

      return total;
    }, 0);
  }, [products]);

  const getAvailableBundleQuantity = useCallback((bundleProduct, excludeIndex = null) => {
    const configuredBundleQty = Number(bundleProduct?.bundle_qty ?? 0);
    if (configuredBundleQty <= 0) {
      return 0;
    }

    if (!Array.isArray(bundleProduct?.components) || bundleProduct.components.length === 0) {
      return Number(bundleProduct?.stock ?? bundleProduct?.available_quantity ?? 0);
    }

    const bundleLimits = bundleProduct.components.map((component) => {
      const componentStock = Number(component.available_quantity || 0);
      const reservedQty = getReservedQuantityForProduct(component.product_id, excludeIndex);
      const remainingQty = Math.max(componentStock - reservedQty, 0);
      const rawQtyPerConfiguredBundle = Number(component.quantity_per_bundle || 0);
      const qtyPerBundle = rawQtyPerConfiguredBundle / configuredBundleQty;

      if (qtyPerBundle <= 0) {
        return 0;
      }

      return Math.floor(remainingQty / qtyPerBundle);
    });

    return bundleLimits.length > 0 ? Math.max(Math.min(...bundleLimits), 0) : 0;
  }, [getReservedQuantityForProduct]);

  useEffect(() => {
    setProducts((prevProducts) => {
      let hasChanges = false;

      const nextProducts = prevProducts.map((product, index) => {
        if (product.item_type !== "bundle" || !Array.isArray(product.bundle_components)) {
          return product;
        }

        const availableBundleStock = getAvailableBundleQuantity(
          {
            ...product,
            components: product.bundle_components,
          },
          index
        );

        if (
          Number(product.stock || 0) === availableBundleStock &&
          Number(product.max_quantity || 0) === availableBundleStock
        ) {
          return product;
        }

        hasChanges = true;

        return {
          ...product,
          stock: availableBundleStock,
          max_quantity: availableBundleStock,
        };
      });

      return hasChanges ? nextProducts : prevProducts;
    });
  }, [getAvailableBundleQuantity, products]);

  // Update paid amount
  const updatePaidAmount = (paidAmount) => {
    if (isReturn) {
      toast.error("Paid amount is set to grand total for returns");
      return;
    }
    const paid = Number(paidAmount) || 0;
    if (paid < 0) {
      toast.error("Paid amount cannot be negative");
      return;
    }
    const updatedPayments =
      payments.length > 0
        ? payments.map((payment, index) =>
            index === 0
              ? { ...payment, amount: paid, auto_split: false }
              : payment
          )
        : [
            {
              id: Date.now(),
              method: "Cash",
              amount: paid,
              auto_split: false,
              card_type: "",
              card_last_digits: "",
              mf_type: "",
              mf_number: "",
              qr_provider: "",
              qr_transaction_id: "",
            },
          ];

    setPayments(updatedPayments);
    recalculatePaymentSummary(updatedPayments);
  };

  // Update points used
  const updatePointsUsed = (points) => {
    if (isReturn) {
      toast.error("Points cannot be used for returns");
      return;
    }
    const pointsUsed = Number(points) || 0;
    if (pointsUsed < 0) {
      toast.error("Points used cannot be negative");
      return;
    }
    if (pointsUsed > selectedCustomer?.reward_points) {
      toast.error("Cannot use more points than available");
      return;
    }
    const pointsValue = pointsUsed * (selectedReward?.reword_value || 1);
    const potentialGrandTotal =
      saleSummary.subTotal -
      saleSummary.discount +
      saleSummary.tax +
      saleSummary.vat -
      pointsValue;
    if (potentialGrandTotal < 0) {
      toast.error("Points used cannot result in a negative total");
      return;
    }
    setSaleSummary((prev) => ({
      ...prev,
      points_used: pointsUsed,
      grandTotal: potentialGrandTotal,
      paidAmount: potentialGrandTotal,
      changeDue:
        prev.paidAmount > 0
          ? Math.max(0, prev.paidAmount - potentialGrandTotal)
          : 0,
    }));
  };

  // Update fracture sale
  const updateFractureSale = (isChecked) => {
    setSaleSummary((prev) => ({
      ...prev,
      isFracture: isChecked,
    }));
  };

  // Update payment details
  const updatePaymentDetails = (field, value) => {
    setSaleSummary((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Generate payment schedules
  const generatePaymentSchedules = (numInstallments) => {
    const dueAmount = saleSummary.dueAmount;
    if (dueAmount <= 0) {
      toast.error("No due amount to schedule");
      return;
    }
    if (numInstallments < 1) {
      toast.error("Number of installments must be at least 1");
      return;
    }
    if (paymentSchedules.length >= numInstallments) {
      toast.error(`Cannot generate more than ${numInstallments} installments`);
      return;
    }

    const remainingSlots = numInstallments - paymentSchedules.length;
    if (remainingSlots <= 0) {
      toast.error("Installment limit already reached");
      return;
    }

    const currentScheduledAmount = paymentSchedules.reduce(
      (sum, s) => sum + Number(s.amount || 0),
      0
    );
    const remainingDueAmount = dueAmount - currentScheduledAmount;
    const installmentAmount = Number((remainingDueAmount / remainingSlots).toFixed(2));

    const schedules = [...paymentSchedules];
    const today = new Date();

    for (let i = 0; i < remainingSlots; i++) {
      // Calculate due date (next month from current base)
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + schedules.length + i + 1);

      // Reminder date = 1 day before due date
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(dueDate.getDate() - 1);

      // Format dates as YYYY-MM-DD
      const dueDateStr = getLocalDateString(dueDate);
      const reminderDateStr = getLocalDateString(reminderDate);

      schedules.push({
        id: Date.now() + schedules.length + i,
        amount:
          i === remainingSlots - 1
            ? Number((remainingDueAmount - installmentAmount * (remainingSlots - 1)).toFixed(2))
            : installmentAmount,
        due_date: dueDateStr,
        remainder_date: reminderDateStr, // 1 day before due date
      });
    }

    setPaymentSchedules(schedules);
  };

  // Add a new manual schedule entry
  const addScheduleEntry = () => {
    if (paymentSchedules.length >= numberOfInstallments) {
      toast.error(`Cannot add more than ${numberOfInstallments} installments`);
      return;
    }
    
    // Calculate remaining due amount that hasn't been scheduled yet
    const totalScheduledAmount = paymentSchedules.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const remainingDueAmount = Math.max(0, saleSummary.dueAmount - totalScheduledAmount);
    
    setPaymentSchedules([
      ...paymentSchedules,
      {
        id: Date.now(),
        amount: remainingDueAmount, // Default to remaining due amount
        due_date: getLocalDateString(),
        remainder_date: null,
      },
    ]);
  };

  // Update schedule entry
  const updateScheduleEntry = (id, field, value) => {
    const newSchedules = paymentSchedules.map((schedule) =>
      schedule.id === id ? { ...schedule, [field]: value } : schedule
    );
    setPaymentSchedules(newSchedules);
  };

  // Remove schedule entry
  const removeScheduleEntry = (id) => {
    setPaymentSchedules(
      paymentSchedules.filter((schedule) => schedule.id !== id)
    );
  };

  // Validate and save payment schedules
  const savePaymentSchedules = () => {
    const todayLocal = getLocalDateString();
    const totalScheduled = paymentSchedules.reduce(
      (sum, s) => sum + Number(s.amount),
      0
    );
    if (Math.abs(totalScheduled - saleSummary.dueAmount) > 0.01) {
      toast.error("Total scheduled amount must equal the due amount");
      return;
    }
    if (paymentSchedules.some((s) => !s.due_date || Number(s.amount) <= 0)) {
      toast.error("All schedules must have a valid due date and amount");
      return;
    }
    if (paymentSchedules.some((s) => s.due_date < todayLocal)) {
      toast.error("Due date cannot be earlier than today");
      return;
    }
    setShowPaymentScheduleDrawer(false);
    toast.success("Payment schedule saved successfully");
  };

  // Print draft
  const printDraft = (draft) => {
    if (!draft) {
      toast.error("No draft found to print");
      return;
    }

    // Prepare invoice data from draft
    const invoiceData = {
      id: draft.id,
      invoice_no: `DRAFT-${draft.id}`,
      date: getLocalDateString(new Date(draft.timestamp)),
      customer: draft.selectedCustomer,
      customer_id: draft.selectedCustomer?.id,
      paid_amount: draft.saleSummary.paidAmount || 0,
      payment_method: draft.saleSummary.paymentMethod || "Cash",
      change_due: draft.saleSummary.changeDue || 0,
      discount: draft.saleSummary.discount || 0,
      discount_type: draft.saleSummary.discountType || "flat",
      tax: draft.saleSummary.tax || 0,
      global_vat_percentage: draft.saleSummary.vat || 0,
      is_fracture: draft.saleSummary.isFracture || false,
      note: draft.saleSummary.note || "",
      total: draft.saleSummary.grandTotal || 0,
      sub_total: draft.saleSummary.subTotal || 0,
      points_used: draft.saleSummary.points_used || 0,
      points_earned: draft.saleSummary.points_earned || 0,
      due_amount: draft.saleSummary.dueAmount || 0,
      type: draft.isReturn ? "return" : "sale",
      items: draft.products
        .filter((p) => p.name !== "")
        .map((p) => {
          let variantObj = {};

          // If p.variant is in format "Color: white, Size: L"
          if (typeof p.variant === "string" && p.variant.includes(":")) {
            variantObj = Object.fromEntries(
              p.variant.split(",").map((pair) => {
                const [key, value] = pair.split(":").map((s) => s.trim());
                return [key, value];
              })
            );
          } else if (typeof p.variant === "object" && p.variant !== null) {
            // Already an object
            variantObj = p.variant;
          }

          return {
            name: p.name,
            qty: p.quantity,
            unit_price: p.unitPrice,
            discount: p.discount || 0,
            tax_rate: (p.tax_rate || 0) * 100,
            vat_rate: (p.vat_rate || 0) * 100,
            total: p.totalPrice,
            is_return: p.is_return_product,
            product: {
              code: p.barcode,
            },
            variant_id: variantObj,
          };
        }),

      created_at: draft.timestamp,
      isDraft: true, // Flag to indicate this is a draft
    };

    setPrintDraftData(invoiceData);
  };

  // Calculate sale summary
  useEffect(() => {
    const filledProducts = products.filter((p) => p.name !== "" && !p.is_return_source);
    const itemTotals = filledProducts.map((p) => {
      const basePrice = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
      const discountAmount = calculateLineDiscountAmount(
        basePrice,
        p.discount,
        p.discount_type,
        p.quantity
      );
      const taxableAmount = basePrice - discountAmount;
      const taxAmount = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0) * (Number(p.tax_rate) || 0);
      const vatAmount = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0) * (Number(p.vat_rate) || 0);
      return {
        basePrice,
        discountAmount,
        taxableAmount,
        taxAmount,
        vatAmount,
        total: taxableAmount + taxAmount + vatAmount,
      };
    });

    const subTotal = itemTotals.reduce((sum, item) => sum + item.total, 0);
    const invoiceDiscount = isReturn
      ? 0
      : saleSummary.discountType === "percent"
        ? subTotal * (saleSummary.discount / 100)
        : saleSummary.discount;
    const globalTaxAmount = subTotal * (Number(saleSummary.tax) / 100 || 0);
    const globalVatAmount = subTotal * (Number(saleSummary.vat) / 100 || 0);
    const pointsDiscount = isReturn
      ? 0
      : saleSummary.points_used * (selectedReward?.reword_value || 1);

    let grandTotal = subTotal - invoiceDiscount + globalTaxAmount + globalVatAmount - pointsDiscount;

    if (!isReturn && grandTotal < 0) {
      toast.error(
        "Grand total cannot be negative. Adjust discounts or points used."
      );
      grandTotal = 0;
    }

    const pointsEarned =
      isReturn || !canEarnPoints()
        ? 0
        : isRewardActive() && selectedReward
          ? Math.floor(subTotal / selectedReward.amount) * selectedReward.reword_unit
          : 0;

    setSaleSummary((prev) => ({
      ...prev,
      subTotal,
      tax: prev.tax,
      vat: prev.vat,
      points_earned: pointsEarned,
      grandTotal,
    }));
  }, [
    products,
    saleSummary.discount,
    saleSummary.discountType,
    saleSummary.points_used,
    saleSummary.tax,
    saleSummary.vat,
    selectedReward,
    isReturn,
    selectedCustomer,

  ]);

  useEffect(() => {
    recalculatePaymentSummary(payments);
  }, [saleSummary.grandTotal, payments, isReturn]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        confirmSale();
      }
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        removeProduct(products.length - 1);
      }
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        saveDraft();
      }
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        cancelSale();
      }
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        addManualRow();
      }
      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        setShowDraftList(true);
      }
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleReturnMode();
      }
      if (e.ctrlKey && e.key === "g") {
        e.preventDefault();
        if (!isReturn) {
          showModal("verify_coupon_or_gift_card_modal");
        } else {
          toast.error("Coupons and gift cards cannot be applied in return mode");
        }
      }
      // Handle product search keyboard navigation when product input is focused
      if (document.activeElement === productInputRef.current && productSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          // If no item is highlighted, start with the first one
          const newIndex = productHighlightedIndex < productSuggestions.length - 1 ? productHighlightedIndex + 1 : 0;
          setProductHighlightedIndex(newIndex);

          // Auto-scroll to highlighted item
          setTimeout(() => {
            if (productDropdownListRef.current) {
              const highlightedElement = productDropdownListRef.current.children[newIndex];
              if (highlightedElement) {
                highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }, 0);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const newIndex = productHighlightedIndex > 0 ? productHighlightedIndex - 1 : productSuggestions.length - 1;
          setProductHighlightedIndex(newIndex);

          // Auto-scroll to highlighted item
          setTimeout(() => {
            if (productDropdownListRef.current) {
              const highlightedElement = productDropdownListRef.current.children[newIndex];
              if (highlightedElement) {
                highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }, 0);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (productHighlightedIndex >= 0 && productHighlightedIndex < productSuggestions.length) {
            const selectedProduct = productSuggestions[productHighlightedIndex];
            if (selectedProduct?.is_selectable === false || selectedProduct?.item_type === "notice") {
              toast.error("No product found");
              return;
            }
            addOrUpdateProduct(products.length - 1, selectedProduct);
            setProductHighlightedIndex(-1);
          } else {
            // Original behavior: add product with current search text
            handleProductSearch(
              products.length - 1,
              productInputRef.current?.value ?? productSearch
            );
          }
        } else if (e.key === "Escape") {
          setProductSuggestions([]);
          setProductHighlightedIndex(-1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    products,
    confirmSale,
    saveDraft,
    cancelSale,
    selectedCustomer,
    saleSummary,
    isReturn,
    productSuggestions,
    productHighlightedIndex,
    productSearch,
    addOrUpdateProduct,
    handleProductSearch,
    getTotalQuantityForInventoryItem,
    getReservedQuantityForProduct,
    getAvailableBundleQuantity,
    addManualRow,
    removeProduct,
    toggleReturnMode,
    showModal,
  ]);

  // Product suggestions for main search
  useEffect(() => {
    debouncedProductSearch(productSearch);
  }, [productSearch, debouncedProductSearch]);

  // Reset customer highlighted index when input or search results change
  useEffect(() => {
    setCustomerHighlightedIndex(-1);
  }, [customerInput, customerSearchResults]);

  // Reset product highlighted index only when search input changes (not when results change)
  useEffect(() => {
    setProductHighlightedIndex(-1);
  }, [productSearch]);

  // Fetch default customer and company preferences on mount
  useEffect(() => {
    fetchDefaultCustomer();
  }, [dispatch, fetchDefaultCustomer]);

  // Fetch rewards and select applicable reward
  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  useEffect(() => {
    selectApplicableReward();
  }, [rewards, selectApplicableReward]);

  const updateNote = (note) => {
    setSaleSummary((prev) => ({
      ...prev,
      note: note,
    }));
  };

  useEffect(() => {
    fetchPosSettings();
    if (accessToken) {
      dispatch(fetchCompanyPreferences(accessToken));
    }
  }, [accessToken, dispatch]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useEffect(() => {
    if (showDraftList) {
      fetchDrafts();
    }
  }, [showDraftList, fetchDrafts]);

  return (
    <div className="h-100 flex flex-col">
      <DraftsListDrawer
        showDraftList={showDraftList}
        setShowDraftList={setShowDraftList}
        drafts={drafts}
        printDraft={printDraft}
        restoreDraft={restoreDraft}
        deleteDraft={deleteDraft}
      />

      <NewCustomerDrawer
        showCustomerDrawer={showCustomerDrawer}
        setShowCustomerDrawer={setShowCustomerDrawer}
        newCustomer={newCustomer}
        setNewCustomer={setNewCustomer}
        nameInputRef={nameInputRef}
        saveCustomer={saveCustomer}
        isCustomerLoading={isCustomerLoading}
      />

      <PaymentScheduleDrawer
        showPaymentScheduleDrawer={showPaymentScheduleDrawer}
        setShowPaymentScheduleDrawer={setShowPaymentScheduleDrawer}
        numberOfInstallments={numberOfInstallments}
        setNumberOfInstallments={setNumberOfInstallments}
        addScheduleEntry={addScheduleEntry}
        paymentSchedules={paymentSchedules}
        updateScheduleEntry={updateScheduleEntry}
        removeScheduleEntry={removeScheduleEntry}
        savePaymentSchedules={savePaymentSchedules}
      />

      {/* Single Card for Products and Summary */}
      <div className="flex-1 bg-white rounded-xl h-full min-h-[calc(100vh-96px)] max-h-[calc(100vh-96px)] overflow-y-auto scrollbar-hidden">
        <div className="flex h-full">
          {/* Products Section - Scrollable */}
          <div className="w-3/4 pr-4 overflow-y-auto">
            <CustomerSection
              customerInput={customerInput}
              handleCustomerSearch={handleCustomerSearch}
              handleCustomerSearchKeyDown={handleCustomerSearchKeyDown}
              customerInputRef={customerInputRef}
              isCustomerLoading={isCustomerLoading}
              customerSearchResults={customerSearchResults}
              suggestionRefs={suggestionRefs}
              setSelectedCustomer={setSelectedCustomer}
              setCustomerInput={setCustomerInput}
              setCustomerSearchResults={setCustomerSearchResults}
              productInputRef={productInputRef}
              setNewCustomer={setNewCustomer}
              setShowCustomerDrawer={setShowCustomerDrawer}
              nameInputRef={nameInputRef}
              selectedCustomer={selectedCustomer}
              unselectCustomer={unselectCustomer}
              defaultProfileAvater={defaultProfileAvater}
              customerHighlightedIndex={customerHighlightedIndex}
              setCustomerHighlightedIndex={setCustomerHighlightedIndex}
              customerDropdownRef={customerDropdownRef}
              customerDropdownListRef={customerDropdownListRef}
            />
            <ProductSearchSection
              productSearch={productSearch}
              setProductSearch={setProductSearch}
              handleProductSearch={handleProductSearch}
              products={products}
              productInputRef={productInputRef}
              isGlobalProductLoading={isGlobalProductLoading}
              productSuggestions={productSuggestions}
              suggestionRefs={suggestionRefs}
              addOrUpdateProduct={addOrUpdateProduct}
              isReturn={isReturn}
              showModal={showModal}
              getTotalQuantityForInventoryItem={getTotalQuantityForInventoryItem}
              getReservedQuantityForProduct={getReservedQuantityForProduct}
              getAvailableBundleQuantity={getAvailableBundleQuantity}
              productHighlightedIndex={productHighlightedIndex}
              setProductHighlightedIndex={setProductHighlightedIndex}
              productDropdownListRef={productDropdownListRef}
              isConfirmingSale={isConfirmingSale}
              canCreateQuotation={!isReturn}
              toggleReturnMode={toggleReturnMode}
              createQuotation={createQuotation}
              onOpenSellReturn={() => setShowSellReturnCenter(true)}
            />

            <SalesTable
              products={products}
              updateProduct={updateProduct}
              isReturn={isReturn}
              handleReturnProduct={handleReturnProduct}
              removeProduct={removeProduct}
              addManualRow={addManualRow}
              getTotalQuantityForInventoryItem={getTotalQuantityForInventoryItem}
              getReservedQuantityForProduct={getReservedQuantityForProduct}
              getAvailableBundleQuantity={getAvailableBundleQuantity}
              submitWaitlistForProduct={handleSubmitWaitlistForProduct}
              isSubmittingWaitlist={isSubmittingWaitlist}
            />
          </div>
          <div className="w-1/4 p-4 border-l border-gray-200 h-full min-h-[calc(100vh-96px)] max-h-[calc(100vh-96px)] flex flex-col justify-between">
            <SalesSummary
              saleSummary={saleSummary}
              handleOverallDiscountChange={handleOverallDiscountChange}
              handleOverallDiscountTypeChange={handleOverallDiscountTypeChange}
              updateTax={updateTax}
              updateVat={updateVat}
              isRewardActive={isRewardActive}
              canRedeemPoints={canRedeemPoints}
              selectedCustomer={selectedCustomer}
              updatePointsUsed={updatePointsUsed}
              selectedReward={selectedReward}
              appliedCoupon={appliedCoupon}
              updatePaidAmount={updatePaidAmount}
              setShowPaymentScheduleDrawer={setShowPaymentScheduleDrawer}
              generatePaymentSchedules={generatePaymentSchedules}
              numberOfInstallments={numberOfInstallments}
              setSaleSummary={setSaleSummary}
              paymentMethodsSettings={paymentMethodsSettings}
              updatePaymentDetails={updatePaymentDetails}
              updateNote={updateNote}
              isReturn={isReturn}
              payments={payments}
              addPayment={addPayment}
              updatePayment={updatePayment}
              removePayment={removePayment}
            />
            {/* Fixed Action Buttons Footer */}
            <PosActions
              isReturn={isReturn}
              toggleReturnMode={toggleReturnMode}
              confirmSale={confirmSale}
              createQuotation={createQuotation}
              isConfirmingSale={isConfirmingSale}
              saveDraft={saveDraft}
              cancelSale={cancelSale}
              setShowDraftList={setShowDraftList}
              printInvoice={printInvoice}
              printWithCustomerInfo={printWithCustomerInfo}
              setPrintInvoice={setPrintInvoice}
              printerType={printerType}
              setPrinterType={setPrinterType}
              companyInfo={companyInfo}
              printDraftData={printDraftData}
              setPrintDraftData={setPrintDraftData}
            />
          </div>
        </div>
      </div>
      <DiscountOrRewardModal
        onCouponVerified={handleCouponVerified}
        isReturn={isReturn}
      />
      {showSellReturnCenter && (
        <div className="fixed inset-0 z-[80] bg-black/45 p-4">
          <div className="h-full w-full rounded-2xl bg-white shadow-2xl overflow-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
              <h3 className="text-lg font-semibold">Sell Return Center</h3>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowSellReturnCenter(false)}
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <StockOut
                returnOnlyMode
                onExitReturnOnly={() => setShowSellReturnCenter(false)}
                onReturnItemsConfirmed={handleReturnItemsFromStockOut}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

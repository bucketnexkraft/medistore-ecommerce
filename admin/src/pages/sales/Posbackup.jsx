import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  createNewCustomer,
  getCustomers,
  getSearchProducts,
  itemReturn,
  storeSale,
  getDefaultCustomer, // New API function
} from "../../api/sales";
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

// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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
      (m) => m.name === paymentMethod
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
      (m) => m.name === paymentMethod
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
  const productInputRef = useRef(null);
  const lastGlobalQueryRef = useRef("");
  const lastTableQueriesRef = useRef({});
  const suggestionRefs = useRef({});
  const [isReturn, setIsReturn] = useState(false);

  const [printInvoice, setPrintInvoice] = useState(null);
  const [printWithCustomerInfo, setPrintWithCustomerInfo] = useState(false);

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

  const [drafts, setDrafts] = useState(() => {
    const savedDrafts = localStorage.getItem("posDrafts");
    return savedDrafts ? JSON.parse(savedDrafts) : [];
  });
  const [showDraftList, setShowDraftList] = useState(false);
  const [printDraftData, setPrintDraftData] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null); // Tracks { code, discount, discountType }
  const [paymentMethodsSettings, setPaymentMethodsSettings] = useState([]);

  const latestQueryRef = useRef("");

  // Fetch POS settings
  const fetchPosSettings = async () => {
    try {
      const response = await getPosSettings(accessToken);
      setPaymentMethodsSettings(response.data || []);
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
      const isTableSearch = index !== null;

      // --- 1. CLEAR old suggestions immediately ---
      if (!isTableSearch) {
        setProductSuggestions([]);          // ← Global search
        latestQueryRef.current = query;
      } else {
        setTableProductSuggestions(prev => ({ ...prev, [index]: [] }));
        lastTableQueriesRef.current[index] = query;
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
          query,
          for_return: isReturn ? 1 : 0,
          customer_id: isReturn ? selectedCustomer?.id : null,
        });

        // --- 3. Only update if this is the LATEST query ---
        const isLatest = !isTableSearch
          ? latestQueryRef.current === query
          : lastTableQueriesRef.current[index] === query;

        if (!isLatest) return [];

        const results = Array.isArray(data)
          ? data.map(item => ({
            ...item,
            alert_quantity: item.alert_quantity ?? 5,
            max_quantity: item.available_quantity ?? 100,
            product_id: item.id,
            inventory_id: item.inventory_id,
            inventory_item_id: item.inventory_item_id,
            lot_number: item.lot_number ?? "",
            is_return_product: !!item.is_return_product,
          }))
          : [];

        // --- 4. SET new suggestions ---
        if (!isTableSearch) {
          setProductSuggestions(results);
        } else {
          setTableProductSuggestions(prev => ({ ...prev, [index]: results }));
        }

        return results;
      } catch (error) {
        if (error.name === "AbortError") return [];

        const message = error?.response?.data?.message || "Failed to fetch products";

        if (isTableSearch) {
          setTableProductErrors(prev => ({ ...prev, [index]: message }));
        } else {
          toast.error(message);
        }

        return [];
      } finally {
        if (isTableSearch) {
          setTableProductLoading(prev => ({ ...prev, [index]: false }));
        } else {
          setIsGlobalProductLoading(false);
        }
      }
    },
    [accessToken, isReturn, selectedCustomer]
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

  // Confirm sale or return/exchange
  const confirmSale = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer before proceeding with the sale");
      return;
    }

    if (!products.some((p) => p.name !== "")) {
      toast.error("At least one product is required");
      return;
    }

    if (isReturn) {
      const invalidProducts = products.filter(
        (p) => p.name !== "" && !p.is_return_product && p.quantity > 0
      );
      if (invalidProducts.length > 0) {
        toast.error("New items in return mode must have negative quantities");
        return;
      }
    }

    const paymentErrors = validatePaymentDetails(
      saleSummary.paymentMethod,
      saleSummary,
      selectedCustomer,
      selectedReward,
      isReturn,
      paymentMethodsSettings
    );
    if (paymentErrors.length > 0) {
      paymentErrors.forEach((error) => toast.error(error));
      return;
    }

    if (saleSummary.dueAmount > 0 && paymentSchedules.length === 0) {
      toast.error("Please set up a payment schedule for the due amount");
      return;
    }

    let original_invoice_id = null;
    if (isReturn) {
      const returnProducts = products.filter(
        (p) => p.name !== "" && p.is_return_product && p.quantity < 0
      );
      if (returnProducts.length > 0) {
        const firstProduct = returnProducts[0];
        const allSame = returnProducts.every(
          (p) => p.original_invoice_id === firstProduct.original_invoice_id
        );
        if (!allSame) {
          toast.error("All return products must come from the same invoice");
          return;
        }
        original_invoice_id = firstProduct.original_invoice_id;
      }
    }

    const payload = {
      type: isReturn ? "return" : "sale",
      company_id: null,
      warehouse_id: null,
      date: new Date().toISOString().split("T")[0],
      customer_id: selectedCustomer?.id,
      paid_amount: isReturn
        ? Math.abs(saleSummary.grandTotal)
        : saleSummary.paidAmount,
      payment_method: saleSummary.paymentMethod,
      change_due: isReturn ? 0 : saleSummary.changeDue,
      discount: isReturn ? 0 : saleSummary.discount,
      discount_type: isReturn ? "flat" : saleSummary.discountType,
      global_tax_percentage: saleSummary.tax,
      global_vat_percentage: saleSummary.vat,
      is_fracture: saleSummary.isFracture,
      note: saleSummary.note,
      grandTotal: Math.abs(saleSummary.grandTotal),
      points_used: isReturn ? 0 : saleSummary.points_used,
      points_earned: isReturn ? 0 : saleSummary.points_earned,
      coupon_code: appliedCoupon ? appliedCoupon.code : null, // Add coupon code
      ...(isReturn ? { original_invoice_id } : {}),
      ...(saleSummary.paymentMethod === "Debit Card" ||
        saleSummary.paymentMethod === "Credit Card" ||
        saleSummary.paymentMethod === "Refund to Card"
        ? {
          card_type: saleSummary.card_type,
          card_last_digits: saleSummary.card_last_digits,
        }
        : {}),
      ...(saleSummary.paymentMethod === "MF Payment" ||
        saleSummary.paymentMethod === "Refund to MF"
        ? {
          mf_type: saleSummary.mf_type,
          mf_number: saleSummary.mf_number,
        }
        : {}),
      ...(saleSummary.paymentMethod === "QR Payment"
        ? {
          qr_provider: saleSummary.qr_provider,
          qr_transaction_id: saleSummary.qr_transaction_id,
        }
        : {}),
      ...(saleSummary.dueAmount > 0
        ? {
          payment_schedule: paymentSchedules.map((s) => ({
            amount: Number(s.amount),
            due_date: s.due_date,
            remainder_date: s.remainder_date,
          })),
        }
        : {}),
      items: products
        .filter((p) => p.name !== "")
        .map((p) => ({
          product_id: p.product_id,
          inventory_id: p.inventory_id,
          inventory_item_id: p.inventory_item_id,
          barcode: p.barcode,
          lot_number: p.lot_number,
          qty: Number(p.quantity),
          unit_price: Number(p.unitPrice),
          discount: isReturn ? 0 : Number(p.discount),
          tax_rate: Number(p.tax_rate) * 100,
          vat_rate: Number(p.vat_rate) * 100,
          is_return: p.is_return_product,
          ...(p.is_return_product && p.quantity < 0
            ? { original_sale_item_id: p.original_sale_item_id }
            : {}),
        })),
    };

    try {
      setIsConfirmingSale(true);
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

      setDrafts((prev) => {
        const newDrafts = prev.filter(
          (draft) => draft.customerId !== selectedCustomer.id
        );
        localStorage.setItem("posDrafts", JSON.stringify(newDrafts));
        return newDrafts;
      });
      setPaymentSchedules([]);
      resetPos();
      setPrintInvoice(response.data);
      setPrintWithCustomerInfo(selectedCustomer);
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
        toast.error(data?.message || "Failed to confirm transaction");
      }
    } finally {
      setIsConfirmingSale(false);
    }
  };

  // Save draft to localStorage
  const saveDraft = () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer to save the draft");
      return;
    }
    if (!products.some((p) => p.name !== "")) {
      toast.error("Cannot save empty draft");
      return;
    }

    const draft = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      products,
      selectedCustomer,
      saleSummary,
      productSearch,
      productSuggestions,
      tableProductSuggestions,
      tableProductErrors,
      tableProductLoading,
      isReturn,
      appliedCoupon, // Save coupon data
    };

    setDrafts((prev) => {
      const newDrafts = [
        ...prev.filter((d) => d.customerId !== selectedCustomer.id),
        draft,
      ];
      localStorage.setItem("posDrafts", JSON.stringify(newDrafts));
      return newDrafts;
    });

    Swal.fire({
      icon: "success",
      title: "Draft Saved",
      text: "Draft saved successfully",
      timer: 1500,
      showConfirmButton: false,
    });
    resetPos();
  };

  // Restore draft from localStorage
  const restoreDraft = (draftId) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (draft) {
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
    }).then((result) => {
      if (result.isConfirmed) {
        setDrafts((prev) => {
          const newDrafts = prev.filter((draft) => draft.id !== draftId);
          localStorage.setItem("posDrafts", JSON.stringify(newDrafts));
          return newDrafts;
        });
        Swal.fire({
          icon: "success",
          title: "Draft Deleted",
          text: "Draft deleted successfully",
          timer: 1500,
          showConfirmButton: false,
        });
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
    }).then((result) => {
      if (result.isConfirmed) {
        resetPos();
        Swal.fire({
          icon: "success",
          title: "Cancelled",
          text: `${isReturn ? "Return" : "Sale"} cancelled`,
          timer: 1500,
          showConfirmButton: false,
        });
      }
    });
  };

  // Handle return product
  const handleReturnProduct = async (index) => {
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
      if (query.length < 3) {
        setProductSuggestions([]);
        return;
      }
      searchProduct(query, null);
    }, 300),
    [searchProduct]
  );

  const debouncedTableProductSearch = useCallback(
    debounce((rowIndex, value) => {
      if (value.length < 3) {
        setTableProductSuggestions(prev => ({ ...prev, [rowIndex]: [] }));
        return;
      }
      searchProduct(value, rowIndex);
    }, 300),
    [searchProduct]
  );

  // Handle customer search
  const handleCustomerSearch = (e) => {
    const value = e.target.value;
    setCustomerInput(value);
    debouncedCustomerSearch(value);
  };

  // Handle customer select on Enter
  const handleCustomerSearchKeyDown = async (e) => {
    if (e.key === "Enter" && customerInput.length >= 3) {
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
    productInputRef.current?.focus();
  };

  // Toggle return mode
  const toggleReturnMode = () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer before enabling return mode");
      return;
    }
    setIsReturn((prev) => !prev);
    setSaleSummary((prev) => ({
      ...prev,
      paymentMethod: !isReturn ? "Cash Refund" : "Cash",
      discount: 0,
      discountType: "flat",
      points_used: 0,
      points_earned: 0,
      changeDue: 0,
    }));
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
    playScanSound();

    if (selectedProduct.is_return) {
      // Handle return product logic (unchanged)
      const addedProducts = selectedProduct.products.map((prod) => ({
        id: Date.now() + Math.random(),
        product_id: prod.id,
        inventory_id: prod.inventory_id || "",
        lot_number: prod.lot_number || "",
        name: prod.name,
        unitPrice: Number(prod.unitPrice),
        tax_rate: Number(prod.tax_rate) / 100,
        vat_rate: Number(prod.vat_rate) / 100,
        stock: Number(prod.stock),
        alert_quantity: prod.alert_quantity ? Number(prod.alert_quantity) : 5,
        max_quantity: Number(prod.max_quantity),
        quantity: Number(prod.quantity),
        totalPrice: Number(prod.totalPrice),
        original_invoice_id: selectedProduct.invoice.id,
        original_sale_item_id: prod.sale_item_id,
        is_return_product: true,
        is_returned: prod.is_returned || false,
        barcode: selectedProduct?.barcode || '',
        variant: selectedProduct?.variant || '',
      }));

      const filledProducts = products.filter((p) => p.name !== "");
      const newProducts = [...addedProducts, ...filledProducts];

      newProducts.push({
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
      });

      setProducts(newProducts);
      setSelectedCustomer(selectedProduct.customer);
      setIsReturn(true);
    } else {
      // Handle regular product
      const existingProductIndex = products.findIndex(
        (p) =>
          p.inventory_id === selectedProduct.inventory_id &&
          p.lot_number === selectedProduct.lot_number &&
          p.name !== "" &&
          p.is_return_product === false &&
          p !== products[index] // Don't match the current row being edited
      );

      let newProducts = [...products];

      if (existingProductIndex !== -1 && !isReturn) {
        // Update existing product quantity (not the current row)
        newProducts[existingProductIndex].quantity =
          Number(newProducts[existingProductIndex].quantity) + 1;
        const basePrice =
          newProducts[existingProductIndex].quantity *
          newProducts[existingProductIndex].unitPrice;
        const discountAmount =
          basePrice * (newProducts[existingProductIndex].discount / 100 || 0);
        const taxAmount =
          newProducts[existingProductIndex].quantity *
          newProducts[existingProductIndex].unitPrice *
          (newProducts[existingProductIndex].tax_rate || 0);
        const vatAmount =
          newProducts[existingProductIndex].quantity *
          newProducts[existingProductIndex].unitPrice *
          (newProducts[existingProductIndex].vat_rate || 0);
        newProducts[existingProductIndex].totalPrice =
          (basePrice - discountAmount) + taxAmount + vatAmount;

        // Clear the current row being edited
        newProducts[index] = {
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
        };
      } else {
        // Create new product and add it to the TOP of the filled products list
        const newProduct = {
          id: Date.now() + Math.random(),
          product_id: selectedProduct.product_id,
          inventory_id: selectedProduct.inventory_id,
          inventory_item_id: selectedProduct.inventory_item_id,
          lot_number: selectedProduct.lot_number,
          name: selectedProduct.name,
          unitPrice: selectedProduct.unitPrice,
          discount: selectedProduct.discount || 0,
          tax_rate: selectedProduct.tax_rate ? selectedProduct.tax_rate / 100 : 0,
          vat_rate: selectedProduct.vat_rate ? selectedProduct.vat_rate / 100 : "",
          stock: selectedProduct.stock,
          alert_quantity: selectedProduct.alert_quantity || 5,
          max_quantity: selectedProduct.available_quantity,
          quantity: 1,
          totalPrice:
            (1 * selectedProduct.unitPrice * (1 - (selectedProduct.discount || 0) / 100)) +
            (1 * selectedProduct.unitPrice * (selectedProduct.tax_rate ? selectedProduct.tax_rate / 100 : 0)) +
            (1 * selectedProduct.unitPrice * (selectedProduct.vat_rate ? selectedProduct.vat_rate / 100 : 0)),
          original_invoice_id: isReturn ? selectedProduct.invoice?.id : null,
          original_sale_item_id: isReturn ? selectedProduct.sale_item_id : null,
          is_return_product: false,
          is_returned: false,
          barcode: selectedProduct?.barcode || '',
          variant: selectedProduct?.variant || '',
        };

        // Get all filled products (excluding empty rows)
        const filledProducts = newProducts.filter((p) => p.name !== "");
        const emptyRows = newProducts.filter((p) => p.name === "");

        // Add new product to the TOP of filled products
        const updatedProducts = [newProduct, ...filledProducts];

        // Ensure there's always one empty row at the end
        if (emptyRows.length === 0) {
          updatedProducts.push({
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
          });
        }

        setProducts(updatedProducts);
        setProductSearch("");
        setProductSuggestions([]);
        setTableProductSuggestions((prev) => ({ ...prev, [index]: [] }));
        setTableProductErrors((prev) => ({ ...prev, [index]: null }));
        productInputRef.current?.focus();
        return; // Exit early since we already set the products
      }
    }
  };

  // Handle product search
  const handleProductSearch = async (index, query) => {
    if (!selectedCustomer) {
      toast.error("Please select a customer first");
      return;
    }
    if (!query || query.length < 3) return;

    const results = await searchProduct(query, index);
    if (results.length === 0) {
      toast.error("No product found");
      return;
    }

    playScanSound();
    addOrUpdateProduct(index, results[0]);
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
    const parsedValue = [
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
      if (Math.abs(parsedValue) > newProducts[index].max_quantity) {
        toast.error(
          `Quantity cannot exceed ${newProducts[index].max_quantity}`
        );
        return;
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

    const basePrice =
      (Number(newProducts[index].quantity) || 0) *
      (Number(newProducts[index].unitPrice) || 0);
    const discountAmount =
      basePrice * (Number(newProducts[index].discount) / 100 || 0);
    const taxableAmount = basePrice - discountAmount;
    const taxAmount =
      (Number(newProducts[index].quantity) || 0) *
      (Number(newProducts[index].unitPrice) || 0) *
      (Number(newProducts[index].tax_rate) || 0);
    const vatAmount =
      (Number(newProducts[index].quantity) || 0) *
      (Number(newProducts[index].unitPrice) || 0) *
      (Number(newProducts[index].vat_rate) || 0);
    newProducts[index].totalPrice = taxableAmount + taxAmount + vatAmount;

    setProducts(newProducts);
  };

  // Remove product
  const removeProduct = (index) => {
    const newProducts = products.filter((_, i) => i !== index);
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
        quantity: isReturn ? -1 : 1,
        unitPrice: "",
        totalPrice: 0,
        tax: saleSummary.tax,
        vat: saleSummary.vat,
        stock: 0,
        alert_quantity: 5,
        max_quantity: 100,
        original_invoice_id: null,
        original_sale_item_id: null,
        is_return_product: isReturn,
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
      const itemDiscAmount = basePrice * (p.discount / 100 || 0);
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
    setSaleSummary((prev) => ({
      ...prev,
      paidAmount: paid,
      changeDue: paid > 0 ? Math.max(0, paid - prev.grandTotal) : 0,
      dueAmount: paid > 0 ? Math.max(0, prev.grandTotal - paid) : 0,
    }));
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
      const dueDateStr = dueDate.toISOString().split("T")[0];
      const reminderDateStr = reminderDate.toISOString().split("T")[0];

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
    setPaymentSchedules([
      ...paymentSchedules,
      {
        id: Date.now(),
        amount: 0,
        due_date: new Date().toISOString().split("T")[0],
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
      date: new Date(draft.timestamp).toISOString().split("T")[0],
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
    const filledProducts = products.filter((p) => p.name !== "");
    const itemTotals = filledProducts.map((p) => {
      const basePrice = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
      const discountAmount = basePrice * (Number(p.discount) / 100 || 0);
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

    if (grandTotal < 0) {
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
      paidAmount: isReturn ? Math.abs(grandTotal) : grandTotal,
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
    const dueAmount = saleSummary.grandTotal - saleSummary.paidAmount;
    const changeDue = isReturn
      ? 0
      : saleSummary.paidAmount > saleSummary.grandTotal
        ? saleSummary.paidAmount - saleSummary.grandTotal
        : 0;

    setSaleSummary((prev) => ({
      ...prev,
      dueAmount: dueAmount > 0 ? dueAmount : 0,
      changeDue,
    }));
  }, [saleSummary.grandTotal, saleSummary.paidAmount, isReturn]);

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
      if (e.ctrlKey && e.key === "t") {
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
      if (e.key === "ArrowDown" && productSuggestions.length > 0) {
        e.preventDefault();
        suggestionRefs.current[0]?.focus();
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
    isReturn, // Add isReturn to dependencies
  ]);

  // Product suggestions for main search
  useEffect(() => {
    debouncedProductSearch(productSearch);
  }, [productSearch, debouncedProductSearch]);

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
            />

            <SalesTable
              products={products}
              handleTableProductInput={handleTableProductInput}
              handleProductSearch={handleProductSearch}
              suggestionRefs={suggestionRefs}
              addOrUpdateProduct={addOrUpdateProduct}
              tableProductSuggestions={tableProductSuggestions}
              tableProductLoading={tableProductLoading}
              tableProductErrors={tableProductErrors}
              updateProduct={updateProduct}
              isReturn={isReturn}
              handleReturnProduct={handleReturnProduct}
              removeProduct={removeProduct}
              addManualRow={addManualRow}
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
            />
            {/* Fixed Action Buttons Footer */}
            <PosActions
              confirmSale={confirmSale}
              isConfirmingSale={isConfirmingSale}
              saveDraft={saveDraft}
              cancelSale={cancelSale}
              drafts={drafts}
              setShowDraftList={setShowDraftList}
              printInvoice={printInvoice}
              printWithCustomerInfo={printWithCustomerInfo}
              setPrintInvoice={setPrintInvoice}
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
    </div>
  );
}

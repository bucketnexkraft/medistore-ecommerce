import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { fetchPreferences } from "./../../slice/preferencesSlice";
import {
  PiArrowCounterClockwise,
  PiBank,
  PiBowlSteam,
  PiCaretRight,
  PiCashRegister,
  PiChartBar,
  PiChartLine,
  PiChartLineDown,
  PiChartLineUp,
  PiChartPie,
  PiClock,
  PiCoins,
  PiEnvelopeSimple,
  PiFileText,
  PiGear,
  PiGearFine,
  PiInvoice,
  PiLightbulb,
  PiSparkle,
  PiLockKey,
  PiMapPin,
  PiNetwork,
  PiReceipt,
  PiSealPercent,
  PiShapes,
  PiSliders,
  PiSlidersHorizontal,
  PiSpeedometer,
  PiStackMinus,
  PiStackPlus,
  PiStamp,
  PiStorefront,
  PiTrademarkRegistered,
  PiTruck,
  PiUserCheck,
  PiUserCircleGear,
  PiUsersThree,
  PiWarehouse,
  PiList,
  PiX,
} from "react-icons/pi";
import { RiStockFill } from "react-icons/ri";
import { BiSolidCategoryAlt } from "react-icons/bi";
import { hasPermission } from "../../utils/permissions";
import { getproductSettings, clearProductSettingsCache } from "../../api/productSettings";
import axiosInstance from "../../config/axiosInstance";
import defaultProfileAvater from "../../assets/img/user_default_image.webp";
import { isFeatureIncludedInPlan } from "../../utils/planFeatures";


export default function Sidebar({ isSidebarOpen }) {
  const { t } = useTranslation();
  const DEFAULT_ROUTE_GUARD_ENDPOINT =
    import.meta.env.VITE_ROUTE_GUARD_ENDPOINT || "/verify-route-access";
  const ROUTE_GUARD_TTL_MINUTES = Number(import.meta.env.VITE_ROUTE_GUARD_TTL_MINUTES || 30);
  const ROUTE_GUARD_CACHE_KEY = "nexstock_route_guard_unlocks";
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState([]);
  const [isRouteGuardModalOpen, setIsRouteGuardModalOpen] = useState(false);
  const [routeGuardValue, setRouteGuardValue] = useState("");
  const [routeGuardError, setRouteGuardError] = useState("");
  const [isVerifyingRouteGuard, setIsVerifyingRouteGuard] = useState(false);
  const [pendingSecureMenu, setPendingSecureMenu] = useState(null);
  const [featureAccessMap, setFeatureAccessMap] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { data } = useSelector((state) => state.preferences);
  const rights = useSelector((state) => state.right.rights || []);
  const company_id = useSelector((state) => state.auth.company_id);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const role = useSelector((state) => state.auth.role);
  const accessToken = useSelector((state) => state.auth.accessToken);
  const authName = useSelector((state) => state.auth.name);
  const profileImagePath = useSelector((state) => state.auth.profile_image_path);
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  const needsPlanSelection =
    useSelector((state) => state.auth.needs_plan_selection) === true && !isSuperAdmin;
  const isInBackoffice = location.pathname.startsWith("/backoffice");
  const sidebarProfileImage = profileImagePath || defaultProfileAvater;
  const sidebarDisplayName = authName || data?.application_name || "User";
  const sidebarCompanyName =
    isInBackoffice
      ? data?.basic?.sitename || data?.sitename || data?.application_name || "stoqio"
      : data?.application_name || data?.basic?.sitename || data?.sitename || "stoqio";
  const planFeatureSet = Array.isArray(selectedPlanFeatures) ? selectedPlanFeatures : [];
  const canAccess = (rightKey) =>
    Array.isArray(rights) && hasPermission(rightKey);
  const stockTrackingEnabled = ![false, 0, "0", "false"].includes(data?.stock_tracking_enabled);
  const formatPlanExpiry = (value) => {
    if (!value) return t("N/A");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("N/A");
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getUnlockCache = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(ROUTE_GUARD_CACHE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const setUnlockCache = (cache) => {
    localStorage.setItem(ROUTE_GUARD_CACHE_KEY, JSON.stringify(cache));
  };

  const isRouteAlreadyUnlocked = (path) => {
    if (!path) return false;
    const cache = getUnlockCache();
    const expiresAt = Number(cache[path] || 0);
    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
      delete cache[path];
      setUnlockCache(cache);
      return false;
    }

    return true;
  };

  const setRouteUnlocked = (path) => {
    if (!path) return;
    const cache = getUnlockCache();
    cache[path] = Date.now() + ROUTE_GUARD_TTL_MINUTES * 60 * 1000;
    setUnlockCache(cache);
  };
  const allMenuItems = [
    {
      path: '/user-journey',
      moduleFeatureRequired: "ftr_getting_started",
      icon: <PiSparkle className='flex-shrink-0' size={20} />,
      label: 'Getting Started',
      exact: true,
    },
    {
      path: "/dashboard",
      moduleFeatureRequired: "ftr_dashboard",
      icon: <PiSpeedometer className="flex-shrink-0" size={20} />,
      label: "Dashboard",
      exact: true,
      permissionRequired: "dashboard.view",
    },
    {
      label: "Company Preference",
      icon: <PiUserCircleGear className="flex-shrink-0" size={20} />,
      children: [
        {
          path: "/company-preference/shop-setup",
          moduleFeatureRequired: "ftr_shop_setup",
          icon: <PiStorefront className="flex-shrink-0" size={18} />,
          label: "Shop Setup",
          permissionRequired: "general-preferences.view",
          featureRequired: [
            "ftr_general_preference",
            "ftr_shop_domain_setup",
            "ftr_storefront_home",
            "ftr_shop_delivery_support",
            "ftr_payment_gateway",
            "ftr_social_auth",
            "ftr_shop_seo_marketing",
            "ftr_shop_chat_support",
            "ftr_shop_sms_support",
          ],
        },
        {
          path: "/onboarding/ecommerce-template",
          moduleFeatureRequired: "ftr_store_template",
          icon: <PiStorefront className="flex-shrink-0" size={18} />,
          label: "Store Template",
          permissionRequired: "general-preferences.view",
          featureRequired: "ftr_storefront_home",
        },
        {
          path: "/company-preference/general-preference",
          icon: <PiSlidersHorizontal className="flex-shrink-0" size={18} />,
          label: "General Preference",
          permissionRequired: "general-preferences.view",
          featureRequired: "ftr_general_preference",
        },
        {
          path: "/company-preference/storefront-home",
          icon: <PiGear className="flex-shrink-0" size={18} />,
          label: "Storefront Home",
          permissionRequired: "general-preferences.view",
          featureRequired: "ftr_storefront_home",
        },
        {
          path: "/company-preference/feature-preference",
          moduleFeatureRequired: "ftr_feature_preferences",
          icon: <PiGear className="flex-shrink-0" size={18} />,
          label: "Feature Preference",
          permissionRequired: "product-setup.view",
        },
        {
          path: "/company-preference/pos-setup",
          icon: <PiSlidersHorizontal className="flex-shrink-0" size={18} />,
          label: "Pos Setup",
          permissionRequired: "pos-setup.view",
          featureRequired: "ftr_pos_setup",
        },
        {
          path: "/company-preference/rewards",
          icon: <PiCoins className="flex-shrink-0" size={18} />,
          label: "Rewards",
          permissionRequired: "rewards.view",
          featureRequired: "ftr_rewards",
        },
        {
          path: "/company-preference/referrals",
          icon: <PiNetwork className="flex-shrink-0" size={18} />,
          label: "Referrals",
          permissionRequired: "general-preferences.view",
          featureRequired: "ftr_referral_system",
        },
        {
          path: "/company-preference/discount",
          icon: <PiSealPercent className="flex-shrink-0" size={18} />,
          label: "Discount",
          permissionRequired: "discount.view",
          featureRequired: "ftr_warehouse_base_discount",
        },
        {
          path: "/company-preference/work-slots",
          icon: <PiClock className="flex-shrink-0" size={18} />,
          label: "Work Slots",
          permissionRequired: "work-slots.view",
          featureRequired: "ftr_work_slots",
        },
        {
          path: "/company-preference/demand-tags",
          icon: <PiTrademarkRegistered className="flex-shrink-0" size={18} />,
          label: "Demand Tags",
          permissionRequired: "product-setup.view",
          featureRequired: "ftr_demand_tags",
        },
        {
          path: "/company-preference/newsletters",
          icon: <PiEnvelopeSimple className="flex-shrink-0" size={18} />,
          label: "Newsletters",
          permissionRequired: "general-preferences.view",
          featureRequired: "ftr_email",
        },
        {
          path: "/company-preference/roles",
          icon: <PiUserCheck className="flex-shrink-0" size={18} />,
          label: "Roles",
          permissionRequired: "role.view",
          featureRequired: "ftr_roles",
          requiresPrivateCode: true,
        },
        {
          path: "/stock/inventory-copilot",
          icon: <PiLightbulb className="flex-shrink-0" size={18} />,
          label: "Inventory Copilot",
          permissionRequired: "reports.stock-overview",
          featureRequired: "ftr_inventory_copilot",
        },
      ],
    },
    {
      label: "Subscription",
      icon: <PiCoins className="flex-shrink-0" size={20} />,
      children: [
        {
          path: "/subscription/overview",
          moduleFeatureRequired: "ftr_subscription_overview",
          icon: <PiCoins className="flex-shrink-0" size={18} />,
          label: "Overview",
          permissionRequired: "general-preferences.view",
        },
        {
          path: "/subscription/plans",
          moduleFeatureRequired: "ftr_subscription_plans",
          icon: <PiReceipt className="flex-shrink-0" size={18} />,
          label: "Plans",
          permissionRequired: "general-preferences.view",
        },
        {
          path: "/subscription/billing-history",
          moduleFeatureRequired: "ftr_subscription_billing_history",
          icon: <PiReceipt className="flex-shrink-0" size={18} />,
          label: "Billing History",
          permissionRequired: ["plan-payment.view", "general-preferences.view"],
        },
      ],
    },
    {
      path: "/warehouses",
      moduleFeatureRequired: "ftr_warehouses",
      icon: <PiWarehouse className="flex-shrink-0" size={20} />,
      label: "Warehouses",
      permissionRequired: "warehouse.view",
    },
    {
      label: "Product Setup",
      icon: <PiGearFine className="flex-shrink-0" size={20} />,
      children: [
        {
          path: "/product-setup/category",
          icon: <PiShapes className="flex-shrink-0" size={18} />,
          label: "Category",
          permissionRequired: "category.view",
          featureRequired: "ftr_product_categories",
        },
        {
          path: "/product-setup/units",
          icon: <PiSliders className="flex-shrink-0" size={18} />,
          label: "Units",
          permissionRequired: "product-setup.view",
          featureRequired: "ftr_unit_setup",
        },
        {
          path: "/product-setup/bundles",
          icon: <PiStackPlus className="flex-shrink-0" size={18} />,
          label: "Bundles",
          permissionRequired: "product-setup.view",
          featureRequired: "ftr_bundle_product",
        },
        {
          path: "/product-setup/brands",
          icon: <PiStamp className="flex-shrink-0" size={18} />,
          label: "Brands",
          permissionRequired: "brand.view",
          featureRequired: "ftr_product_brands",
        },
        {
          path: "/product-setup/variants",
          icon: <PiNetwork className="flex-shrink-0" size={18} />,
          label: "Variants",
          permissionRequired: "variant.view",
          featureRequired: "ftr_product_variants",
        },
        {
          path: "/product-setup/products",
          moduleFeatureRequired: "ftr_products",
          icon: <PiBowlSteam className="flex-shrink-0" size={18} />,
          label: "Products",
          permissionRequired: "product.view",
        },
        {
          path: "/stock/barcodes",
          icon: <PiSliders className="flex-shrink-0" size={18} />,
          label: "Barcode List",
          permissionRequired: "product.barcode.list",
          featureRequired: "ftr_product_barcode",
          requiresPrivateCode: true,
        },
      ],
    },
    {
      path: "/users",
      moduleFeatureRequired: "ftr_users",
      icon: <PiUsersThree className="flex-shrink-0" size={20} />,
      label: "Users",
      permissionRequired: "user.view",
    },
    {
      path: "/suppliers",
      moduleFeatureRequired: "ftr_suppliers",
      icon: <PiUserCheck className="flex-shrink-0" size={20} />,
      label: "Suppliers",
      permissionRequired: "supplier.view",
    },
    {
      label: "Stock",
      icon: <PiChartBar className="flex-shrink-0" size={20} />,
      children: [
        {
          path: "/stock/overview",
          moduleFeatureRequired: "ftr_stock_overview",
          icon: <PiChartLine className="flex-shrink-0" size={18} />,
          label: "Stock Overview",
          permissionRequired: "reports.stock-overview",
        },
        {
          path: "/stock/history",
          moduleFeatureRequired: "ftr_stock_history",
          icon: <PiChartLine className="flex-shrink-0" size={18} />,
          label: "Stock History",
          permissionRequired: "reports.stock-overview",
        },
        {
          path: "/stock/in",
          moduleFeatureRequired: "ftr_stock_in",
          icon: <PiStackPlus className="flex-shrink-0" size={18} />,
          label: "Stock In",
          permissionRequired: ["stock-in.view", "purchase.view"],
          stockTrackingRequired: true,
        },
        {
          path: "/stock/purchase-return",
          icon: <PiStackMinus className="flex-shrink-0" size={18} />,
          label: "Purchase Return",
          permissionRequired: ["stock-in.view", "purchase.view"],
          featureRequired: "ftr_purchase_return",
        },
        {
          path: "/stock/out",
          moduleFeatureRequired: "ftr_stock_out",
          icon: <PiStackMinus className="flex-shrink-0" size={18} />,
          label: "Stock Out",
          permissionRequired: "stock-out.view",
        },
        {
          path: "/stock/transfers",
          icon: <PiNetwork className="flex-shrink-0" size={18} />,
          label: "Stock Transfer",
          permissionRequired: "stock-in.view",
          featureRequired: "ftr_warehouse_stock_transfer",
        },
        {
          path: "/stock/timeline",
          icon: <PiClock className="flex-shrink-0" size={18} />,
          label: "Stock Timeline",
          permissionRequired: "reports.stock-overview",
          featureRequired: "ftr_stock_movement_timeline",
        },
        {
          path: "/stock/stockguard",
          icon: <PiSliders className="flex-shrink-0" size={18} />,
          label: "StockGuard",
          permissionRequired: "reports.stock-overview",
          featureRequired: "ftr_stockguard",
        },
        {
          path: "/stock/waitlists",
          icon: <PiClock className="flex-shrink-0" size={18} />,
          label: "Waitlists",
          permissionRequired: "stock-out.view",
          featureRequired: "ftr_customer_waitlist",
        },
      ],
    },
    {
      label: "Invoices",
      icon: <PiInvoice className="flex-shrink-0" size={20} />,
      children: [
        {
          path: "/invoices/orders",
          icon: <PiReceipt className="flex-shrink-0" size={18} />,
          label: "Order Management",
          permissionRequired: "invoice.view",
          featureRequired: "ftr_order_management",
        },
        {
          path: "/invoices/courier-ops",
          moduleFeatureRequired: "ftr_courier_ops",
          icon: <PiTruck className="flex-shrink-0" size={18} />,
          label: "Courier Ops",
          permissionRequired: "invoice.view",
          featureRequired: "ftr_order_management",
        },
        {
          path: "/invoices/order-tracking",
          icon: <PiTruck className="flex-shrink-0" size={18} />,
          label: "Order Tracking",
          permissionRequired: "invoice.view",
          featureRequired: "ftr_order_tracking",
        },
        {
          path: "/invoices/returns",
          icon: <PiArrowCounterClockwise className="flex-shrink-0" size={18} />,
          label: "Customer Returns",
          permissionRequired: "invoice.view",
          featureRequired: "ftr_customer_returns",
        },
        {
          path: "/invoices/refunds",
          icon: <PiFileText className="flex-shrink-0" size={18} />,
          label: "Refund Log",
          permissionRequired: "invoice.view",
          featureRequired: "ftr_refund_log",
        },
        {
          path: "/invoices/payouts",
          icon: <PiCoins className="flex-shrink-0" size={18} />,
          label: "Payout Requests",
          permissionRequired: "invoice.view",
          featureRequired: "ftr_payout_request",
        },
        {
          path: "/invoices/sales",
          moduleFeatureRequired: "ftr_sale_invoices",
          icon: <PiCashRegister className="flex-shrink-0" size={18} />,
          label: "Sale Invoices",
          permissionRequired: "invoice.view",
        },
        {
          path: "/invoices/purchases",
          moduleFeatureRequired: "ftr_purchase_invoices",
          icon: <PiBank className="flex-shrink-0" size={18} />,
          label: "Purchase Invoices",
          permissionRequired: "invoice.view",
        },
        {
          path: "/invoices/quotations",
          moduleFeatureRequired: "ftr_quotation",
          icon: <PiFileText className="flex-shrink-0" size={18} />,
          label: "Quotations",
          permissionRequired: "invoice.view",
        },
      ],
      // Optional route guard settings:
      // requiresPrivateCode: true,
      // verifyApiEndpoint: "/verify-route-access",
      // verifyField: "private_code",
    },
    {
      label: "Reports",
      icon: <PiChartPie className="flex-shrink-0" size={20} />,
      children: [
        {
          path: "/report/stock-summary",
          moduleFeatureRequired: "ftr_report_stock_summary",
          icon: <RiStockFill className="flex-shrink-0" size={18} />,
          label: "Stock Summary",
          permissionRequired: "reports.report.stock-summary",
        },
        {
          path: "/report/daily-monthly-sales",
          moduleFeatureRequired: "ftr_report_daily_monthly_sales",
          icon: <PiChartLineDown className="flex-shrink-0" size={18} />,
          label: "Daily / Monthly Sales",
          permissionRequired: "reports.daily-sale",
        },
        {
          path: "/report/daily-monthly-purchase",
          moduleFeatureRequired: "ftr_report_daily_monthly_purchase",
          icon: <PiChartLineUp className="flex-shrink-0" size={18} />,
          label: "Daily / Monthly Purchase",
          permissionRequired: "reports.daily-purchase",
        },
        {
          path: "/report/supplier-report",
          moduleFeatureRequired: "ftr_report_supplier",
          icon: <PiUserCheck className="flex-shrink-0" size={18} />,
          label: "Supplier Report",
          permissionRequired: "reports.report.stock-summary",
          requiresPrivateCode: true,
        },
        {
          path: "/report/stock-by-category",
          moduleFeatureRequired: "ftr_report_stock_by_category",
          icon: <BiSolidCategoryAlt className="flex-shrink-0" size={18} />,
          label: "Stock By Category",
          permissionRequired: "reports.stock-by-category",
        },
        {
          path: "/report/sale-by-category",
          moduleFeatureRequired: "ftr_report_sale_by_category",
          icon: <BiSolidCategoryAlt className="flex-shrink-0" size={18} />,
          label: "Sale By Category",
          permissionRequired: "reports.sale-by-category",
        },
        {
          path: "/report/due-payments",
          moduleFeatureRequired: "ftr_report_due_payments",
          icon: <BiSolidCategoryAlt className="flex-shrink-0" size={18} />,
          label: "Due Payments",
          permissionRequired: "reports.sale-by-category",
        },
        {
          path: "/report/product-ledger",
          moduleFeatureRequired: "ftr_report_product_ledger",
          icon: <BiSolidCategoryAlt className="flex-shrink-0" size={18} />,
          label: "Product Ledger",
          permissionRequired: "reports.sale-by-category",
          requiresPrivateCode: true,
        },
        {
          path: "/report/timesheet",
          moduleFeatureRequired: "ftr_report_timesheet",
          icon: <BiSolidCategoryAlt className="flex-shrink-0" size={18} />,
          label: "Timesheet & Cash Handover",
          permissionRequired: "reports.sale-by-category",
          featureRequired: "ftr_shift_and_cash_handover",
        },
        {
          path: "/report/product-return-verification",
          moduleFeatureRequired: "ftr_report_return_verification",
          icon: <BiSolidCategoryAlt className="flex-shrink-0" size={18} />,
          label: "Return Verification",
          permissionRequired: "reports.sale-by-category",
        },
        {
          path: "/report/profit-margin",
          moduleFeatureRequired: "ftr_report_profit_margin",
          icon: <PiChartLineUp className="flex-shrink-0" size={18} />,
          label: "Profit Margin Report",
          permissionRequired: "reports.sale-by-category",
        },
        {
          path: "/report/stock-transfer",
          moduleFeatureRequired: "ftr_report_stock_transfer",
          icon: <PiNetwork className="flex-shrink-0" size={18} />,
          label: "Stock Transfer Report",
          permissionRequired: "stock-in.view",
          featureRequired: "ftr_warehouse_stock_transfer",
        },
        {
          path: "/report/sell-return-log",
          moduleFeatureRequired: "ftr_report_sell_return_log",
          icon: <PiFileText className="flex-shrink-0" size={18} />,
          label: "Refund & Return Log",
          permissionRequired: "reports.sale-by-category",
        },
        {
          path: "/report/expire-product",
          moduleFeatureRequired: "ftr_report_expire_product",
          icon: <PiFileText className="flex-shrink-0" size={18} />,
          label: "Expire Product Report",
          permissionRequired: "reports.stock-overview",
        },
        {
          path: "/report/accounting",
          moduleFeatureRequired: "ftr_report_accounting",
          icon: <PiFileText className="flex-shrink-0" size={18} />,
          label: "Accounting Report",
          permissionRequired: "reports.accounting",
        },

        {
          path: "/report/top-selling-products",
          icon: <PiChartLineUp className="flex-shrink-0" size={18} />,
          label: "Top Selling Product Report",
          permissionRequired: ["reports.sale-by-category", "dashboard.view"],
          featureRequired: "ftr_top_selling_product_report",
        },
        {
          path: "/report/lowest-selling-products",
          icon: <PiChartLineDown className="flex-shrink-0" size={18} />,
          label: "Lowest Selling Product Report",
          permissionRequired: ["reports.sale-by-category", "dashboard.view"],
          featureRequired: "ftr_lowest_selling_product_report",
        },
        {
          path: "/report/audit-logs",
          moduleFeatureRequired: "ftr_report_audit_logs",
          icon: <PiFileText className="flex-shrink-0" size={18} />,
          label: "Audit Logs",
          permissionRequired: "reports.sale-by-category",
        },
      ],
    },
  ];

  // Filter menu items based on role
  // const menuItems = allMenuItems.filter((item) => {
  //   // If no roleRequired property, show to everyone
  //   if (!item.roleRequired) return true;
  //   // If roleRequired exists, check if user's role matches
  //   return role === item.roleRequired;
  // });

  const hasFeatureAccess = (menuItem) => {
    if (isSuperAdmin) return true;
    const code = menuItem.moduleFeatureRequired || menuItem.featureRequired;
    return (
      typeof code === 'string' &&
      isFeatureIncludedInPlan(planFeatureSet, code) &&
      featureAccessMap[code] === true
    );
  };

  const menuItems = allMenuItems
    .map((item) => {
      const permissionRequired = item.permissionRequired;
      const roleRequired = item.roleRequired;

      // Check permission
      if (
        permissionRequired &&
        !(
          (Array.isArray(permissionRequired) &&
            permissionRequired.some((permission) => canAccess(permission))) ||
          (!Array.isArray(permissionRequired) && canAccess(permissionRequired))
        )
      ) return null;

      // Check role
      if (roleRequired && role !== roleRequired) return null;
      if (!item.children && !hasFeatureAccess(item)) return null;

      // Recursively filter children
      if (item.children) {
        const filteredChildren = item.children.filter((child) => {
          if (child.stockTrackingRequired && !stockTrackingEnabled) return false;

          if (!hasFeatureAccess(child)) return false;

          const childPermission = child.permissionRequired;
          const childRole = child.roleRequired;

          if (
            childPermission &&
            !(
              (Array.isArray(childPermission) &&
                childPermission.some((permission) => canAccess(permission))) ||
              (!Array.isArray(childPermission) && canAccess(childPermission))
            )
          ) return false;
          if (childRole && role !== childRole) return false;
          return true;
        });

        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }

      return item;
    })
    .filter(Boolean);

  useEffect(() => {
    dispatch(fetchPreferences(company_id));
  }, [dispatch, company_id]);

  useEffect(() => {
    if (!accessToken) return;

    let isMounted = true;

    const loadFeatureAccess = async () => {
      if (!accessToken) return;

      try {
        const response = await getproductSettings(accessToken);
        const assignedPreferences = response?.data?.preferences || [];
        const map = {};

        assignedPreferences.forEach((item) => {
          if (item?.code) {
            map[item.code] = !!item.is_active;
          }
        });

        if (isMounted) {
          setFeatureAccessMap(map);
        }
      } catch {
        if (isMounted) {
          setFeatureAccessMap({});
        }
      }
    };

    clearProductSettingsCache();
    loadFeatureAccess();

    return () => {
      isMounted = false;
    };
  }, [accessToken, company_id, selectedPlanFeatures]);

  useEffect(() => {
    const handleFeaturePreferenceUpdate = (event) => {
      const { code, is_active } = event?.detail || {};
      if (!code) return;

      setFeatureAccessMap((prev) => ({
        ...prev,
        [code]: Boolean(is_active),
      }));
    };

    window.addEventListener(
      "stoqio:feature-preferences-updated",
      handleFeaturePreferenceUpdate
    );

    return () => {
      window.removeEventListener(
        "stoqio:feature-preferences-updated",
        handleFeaturePreferenceUpdate
      );
    };
  }, []);

  const isActive = (path, exact = false) => {
    const targetPath = String(path || "").split("?")[0];
    return exact
      ? location.pathname === targetPath
      : location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
  };

  useEffect(() => {
    const currentlyOpenMenus = [];
    menuItems.forEach((item, index) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) =>
          isActive(child.path)
        );
        if (hasActiveChild) {
          currentlyOpenMenus.push(index);
        }
      }
    });
    setOpenMenus(currentlyOpenMenus);
  }, [location.pathname]);

  const toggleMenu = (index) => {
    setOpenMenus((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const openRouteGuardModal = (menuItem) => {
    setPendingSecureMenu(menuItem);
    setRouteGuardValue("");
    setRouteGuardError("");
    setIsRouteGuardModalOpen(true);
  };

  const closeRouteGuardModal = () => {
    if (isVerifyingRouteGuard) return;
    setIsRouteGuardModalOpen(false);
    setRouteGuardValue("");
    setRouteGuardError("");
    setPendingSecureMenu(null);
  };

  const handleMenuNavigation = (event, menuItem) => {
    if (!menuItem?.path) return;

    const passwordProtectedRoutesEnabled = Boolean(
      featureAccessMap.ftr_password_protected_routes
    );

    if (menuItem.requiresPrivateCode && passwordProtectedRoutesEnabled) {
      if (isRouteAlreadyUnlocked(menuItem.path)) {
        setIsMobileSidebarOpen(false);
        return;
      }
      event.preventDefault();
      openRouteGuardModal(menuItem);
      return;
    }

    setIsMobileSidebarOpen(false);
  };

  const isPlanLocked = (menuItem) => {
    if (isSuperAdmin) return false;
    const code = menuItem?.moduleFeatureRequired || menuItem?.featureRequired;
    return typeof code === 'string' && !isFeatureIncludedInPlan(planFeatureSet, code);
  };

  const handleSecureRouteSubmit = async (event) => {
    event.preventDefault();

    const secureValue = routeGuardValue.trim();
    if (!secureValue) {
      setRouteGuardError(t("Please enter your password or private code."));
      return;
    }

    if (!pendingSecureMenu?.path) {
      setRouteGuardError(t("No destination selected."));
      return;
    }

    const endpoint =
      pendingSecureMenu.verifyApiEndpoint || DEFAULT_ROUTE_GUARD_ENDPOINT;
    const codeField = pendingSecureMenu.verifyField || "private_code";
    const api = axiosInstance(accessToken);

    setIsVerifyingRouteGuard(true);
    setRouteGuardError("");

    try {
      const response = await api.post(endpoint, {
        [codeField]: secureValue,
        route: pendingSecureMenu.path,
        permission: pendingSecureMenu.permissionRequired || null,
      });

      const result = response?.data || {};
      const isMatched =
        result.status === 1 ||
        result.status === true ||
        result.success === true ||
        result.matched === true;

      if (isMatched) {
        const targetPath = pendingSecureMenu.path;
        setRouteUnlocked(targetPath);
        closeRouteGuardModal();
        setIsMobileSidebarOpen(false);
        navigate(targetPath);
        return;
      }

      const message =
        (Array.isArray(result.errors) && result.errors[0]) ||
        result.message ||
        t("Invalid code. Please try again.");
      setRouteGuardError(message);
    } catch (error) {
      const responseData = error?.response?.data;
      const message =
        (Array.isArray(responseData?.errors) && responseData.errors[0]) ||
        responseData?.message ||
        error?.message ||
        t("Verification failed. Please try again.");
      setRouteGuardError(message);
      // toast.error(message);
    } finally {
      setIsVerifyingRouteGuard(false);
    }
  };

  const renderMenuItem = (item, index, forceExpanded = false) => {
    const showLabel = isSidebarOpen || forceExpanded;

    if (item.children) {
      const isOpen = openMenus.includes(index);
      const hasActiveChild = item.children.some((child) =>
        isActive(child.path)
      );

      return (
        <li key={index} className="mb-1.5">
          <details open={isOpen}>
            <summary
              title={!showLabel ? t(item.label) : undefined}
              className={`group relative flex h-12 items-center gap-3 rounded-lg px-2.5 text-sm transition-all cursor-pointer ${
                hasActiveChild
                  ? "bg-white text-blue-700 shadow-[0_10px_28px_rgba(37,99,235,0.13),inset_0_0_0_1px_rgba(37,99,235,0.14)]"
                  : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-[0_8px_22px_rgba(15,23,42,0.07),inset_0_0_0_1px_rgba(148,163,184,0.18)]"
              }`}
              onClick={(e) => {
                e.preventDefault();
                toggleMenu(index);
              }}
            >
              {hasActiveChild && (
                <span className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-blue-600" />
              )}
              <span
                className={`grid h-8 w-8 place-items-center rounded-lg transition-all ${
                  hasActiveChild
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                    : "bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700"
                }`}
              >
                {item.icon}
              </span>
              {showLabel && (
                <span className="min-w-0 flex-1 truncate font-medium">{t(item.label)}</span>
              )}
              {showLabel && (
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      hasActiveChild ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.children.length}
                  </span>
                  <PiCaretRight
                    size={14}
                    className={`text-slate-400 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </span>
              )}
            </summary>
            <ul className={`${showLabel ? "ml-6 border-l border-slate-200/80 pl-3" : "ml-0"} mt-2 space-y-1.5`}>
              {item.children.map((child, childIndex) => {
                const childActive = isActive(child.path);
                const childLocked = isPlanLocked(child);

                return (
                  <li key={childIndex}>
                    <Link
                      to={child.path}
                      title={!showLabel ? t(child.label) : undefined}
                      className={`group/child relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-all ${
                        childActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                          : "text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                      }`}
                      onClick={(event) => handleMenuNavigation(event, child)}
                    >
                      {showLabel && childActive && (
                        <span className="absolute -left-[17px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-600 ring-4 ring-white" />
                      )}
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
                          childActive
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-400 group-hover/child:bg-blue-50 group-hover/child:text-blue-700"
                        }`}
                      >
                        {child.icon}
                      </span>
                      {showLabel && (
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {t(child.label)}
                        </span>
                      )}
                      {showLabel && childLocked && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          childActive
                            ? "bg-white/20 text-white"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          Upgrade
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </li>
      );
    } else {
      const itemActive = isActive(item.path, item.exact);
      const itemLocked = isPlanLocked(item);

      return (
        <li key={index} className="mb-1.5">
          <Link
            to={item.path}
            title={!showLabel ? t(item.label) : undefined}
            className={`group relative flex h-12 items-center gap-3 rounded-lg px-2.5 text-sm transition-all ${
              itemActive
                ? "bg-blue-600 text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)]"
                : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-[0_8px_22px_rgba(15,23,42,0.07),inset_0_0_0_1px_rgba(148,163,184,0.18)]"
            }`}
            onClick={(event) => handleMenuNavigation(event, item)}
          >
            {itemActive && (
              <span className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-white/90" />
            )}
            <span
              className={`grid h-8 w-8 place-items-center rounded-lg transition-all ${
                itemActive
                  ? "bg-white/15 text-white"
                  : "bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700"
              }`}
            >
              {item.icon}
            </span>
            {showLabel && (
              <span className="min-w-0 flex-1 truncate font-semibold">{t(item.label)}</span>
            )}
            {showLabel && itemLocked && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                itemActive ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700"
              }`}>
                <PiLockKey size={12} />
              </span>
            )}
          </Link>
        </li>
      );
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`${
          isSidebarOpen ? "w-72" : "w-[5.25rem]"
        } max-lg:hidden border-r border-slate-200 bg-slate-50/95 text-slate-700 flex flex-col transition-all duration-300 ease-in-out fixed lg:sticky top-16 h-[calc(100vh-4rem)] overflow-hidden shadow-[8px_0_30px_rgba(15,23,42,0.04)]`}
      >
        <nav className="sidebar-nav-custom">
          {isSidebarOpen && (
            <div className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t("Navigation")}
            </div>
          )}
          <ul className="sidebar-ul-custom">
            {menuItems.map((item, index) => renderMenuItem(item, index))}
          </ul>
          <div className={`sidebar-bottom ${isSidebarOpen ? "block" : "hidden"}`}>
            <div className="collapse collapse-arrow border border-slate-200 sidebar-bottom-accordion">
              <input type="checkbox" className="accordion-custom" />
              <div className="collapse-title font-medium accordion-custom">
                <div className="flex items-center gap-3">
                  <div className="avatar">
                    <div className="w-10 rounded-lg ring-2 ring-white shadow-sm overflow-hidden">
                      <img
                        src={sidebarProfileImage}
                        alt="Profile"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = defaultProfileAvater;
                        }}
                      />
                    </div>
                  </div>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {sidebarDisplayName}
                    </span>
                  </span>
                </div>
              </div>
              <div className="collapse-content border-t border-slate-200">
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <PiTrademarkRegistered className="mt-1 text-indigo-600 min-w-4" />
                    <div>
                      <p className="text-gray-500 text-xs">{t("Reg No.")}</p>
                      <p className="text-xs">{data?.reg_number || t("N/A")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PiBank className="mt-1 text-indigo-600 min-w-4" />
                    <div>
                      <p className="text-gray-500 text-xs">{t("TIN")}</p>
                      <p className="text-xs">{data?.tin_number || t("N/A")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PiCoins className="mt-1 text-indigo-600 min-w-4" />
                    <div>
                      <p className="text-gray-500 text-xs">{t("BIN")}</p>
                      <p className="text-xs">{data?.bin_number || t("N/A")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PiMapPin className="mt-1 text-indigo-600 min-w-4" />
                    <div>
                      <p className="text-gray-500 text-xs">{t("Address")}</p>
                      <p className="text-xs">
                        {data?.application_address || t("N/A")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PiStackPlus className="mt-1 text-indigo-600 min-w-4" />
                    <div>
                      <p className="text-gray-500 text-xs">{t("Active Plan")}</p>
                      <p className="text-xs">{data?.active_plan || t("N/A")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PiShapes className="mt-1 text-indigo-600 min-w-4" />
                    <div>
                      <p className="text-gray-500 text-xs">{t("Active Template")}</p>
                      <p className="text-xs">{data?.active_template || t("N/A")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PiClock className="mt-1 text-indigo-600 min-w-4" />
                    <div>
                      <p className="text-gray-500 text-xs">{t("Plan Expires")}</p>
                      <p className="text-xs">{formatPlanExpiry(data?.plan_expires_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-72 max-w-[86vw] bg-slate-50 text-slate-700 transform transition-transform duration-300 ease-in-out z-50 lg:hidden flex flex-col shadow-2xl ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between gap-3 border-b border-slate-200 px-4">
          <Link
            to={needsPlanSelection ? "/subscription/plans" : "/dashboard"}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="flex min-w-0 flex-1 flex-col items-start rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-950">
                {sidebarCompanyName}
              </span>
              <span className="block text-xs font-medium text-slate-500">
                {t("Workspace")}
              </span>
            </span>
          </Link>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="btn btn-ghost btn-square h-10 min-h-10 w-10 rounded-lg bg-white text-[0px] shadow-sm ring-1 ring-slate-200"
            aria-label="Close sidebar"
          >
            <PiX className="h-5 w-5 text-slate-700" />
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hidden">
          <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {t("Navigation")}
          </div>
          <ul className="space-y-1">
            {menuItems.map((item, index) => renderMenuItem(item, index, true))}
          </ul>
        </nav>
      </div>

      {/* Mobile Sidebar Toggle */}
      <button
        className={`fixed top-3.5 left-4 btn btn-primary btn-square h-10 min-h-10 w-10 rounded-lg z-50 lg:hidden transition-opacity duration-300 text-[0px] ${
          isMobileSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={() => setIsMobileSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <PiList className="h-5 w-5 text-white" />
        ☰
      </button>

      {/* Overlay for Mobile Sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
      )}

      {isRouteGuardModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-md">
            <h3 className="font-bold text-lg">{t("Protected Menu")}</h3>
            <p className="py-2 text-sm text-gray-600">
              {t("Enter password/private code to open")}{" "}
              <span className="font-medium">{pendingSecureMenu?.label ? t(pendingSecureMenu.label) : ""}</span>.
            </p>
            <p className="pb-2 text-xs text-gray-500">
              {t("Access will stay unlocked for {{minutes}} minutes.", { minutes: ROUTE_GUARD_TTL_MINUTES })}
            </p>

            {routeGuardError && (
              <div className="alert alert-error py-2 text-sm mb-3">
                <span>{routeGuardError}</span>
              </div>
            )}

            <form onSubmit={handleSecureRouteSubmit}>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder={t("Enter password or private code")}
                value={routeGuardValue}
                onChange={(e) => setRouteGuardValue(e.target.value)}
                disabled={isVerifyingRouteGuard}
                autoFocus
              />

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeRouteGuardModal}
                  disabled={isVerifyingRouteGuard}
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isVerifyingRouteGuard}
                >
                  {isVerifyingRouteGuard ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    t("Verify & Continue")
                  )}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={closeRouteGuardModal} />
        </div>
      )}
    </>
  );
}

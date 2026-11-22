import { lazy } from "react";
import { createBrowserRouter, Navigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import PrivateRoute from "./PrivateRoute";
import RouteCheck from "./RouteCheck";

const AuthLayout = lazy(() => import("../layout/AuthLayout"));
const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const Logout = lazy(() => import("../pages/auth/Logout"));
const User = lazy(() => import("../pages/users/User"));
const Dashboard = lazy(() => import("../pages/dashboard/Dashboard"));
const Category = lazy(() => import("../pages/product-setup/category/Category"));
const Brands = lazy(() => import("../pages/product-setup/brand/Brands"));
const Unit = lazy(() => import("../pages/product-setup/unit/Unit"));
const Bundles = lazy(() => import("../pages/product-setup/bundle/Bundles"));
const Products = lazy(() => import("../pages/product-setup/products/Products"));
const Sales = lazy(() => import("../pages/sales/Sales"));
const CustomerOrders = lazy(() => import("../pages/orders/CustomerOrders"));
const CourierOperations = lazy(() => import("../pages/orders/CourierOperations"));
const OrderTracking = lazy(() => import("../pages/orders/OrderTracking"));
const CustomerPayouts = lazy(() => import("../pages/orders/CustomerPayouts"));
const CustomerReturns = lazy(() => import("../pages/orders/CustomerReturns"));
const CustomerOrderPaymentCallback = lazy(() => import("../pages/orders/CustomerOrderPaymentCallback"));
const CustomerOrderPaymentResult = lazy(() => import("../pages/orders/CustomerOrderPaymentResult"));
const NewSale = lazy(() => import("../pages/sales/NewSale"));
const Purchase = lazy(() => import("../pages/purchase/Purchase"));
const StockReport = lazy(() => import("../pages/reports/stock-report/StockReport"));
const Suppliers = lazy(() => import("../pages/suppliers/Suppliers"));
const Profile = lazy(() => import("../pages/profile/Profile"));
const PasswordUpdate = lazy(() => import("../pages/profile/PasswordUpdate"));
const ProductSettings = lazy(() => import("../pages/product-setup/settings/ProductSettings"));
const Variant = lazy(() => import("../pages/product-setup/variants/Variants"));
const ProductCreate = lazy(() => import("../pages/product-setup/products/ProductCreate"));
const Warehouse = lazy(() => import("../pages/warehouse/Warehouse"));
const PurchaseCreate = lazy(() => import("../pages/purchase/PurchaseCreate"));
const PurchaseReturn = lazy(() => import("../pages/purchase/PurchaseReturn"));
const Pos = lazy(() => import("../pages/sales/Pos"));
const StockOut = lazy(() => import("../pages/sales/StockOut"));
const Invoices = lazy(() => import("../pages/invoice/Invoices"));
const SaleInvoices = lazy(() => import("../pages/invoice/SaleInvoices"));
const PurchaseInvoices = lazy(() => import("../pages/invoice/PurchaseInvoices"));
const QuotationInvoices = lazy(() => import("../pages/invoice/QuotationInvoices"));
const Stock = lazy(() => import("../pages/stock/Stock"));
const Waitlists = lazy(() => import("../pages/stock/Waitlists"));
const DailyMonthlySales = lazy(() => import("../pages/reports/DailyMonthlySales"));
const DailyMonthlyPurchase = lazy(() => import("../pages/reports/DailyMonthlyPurchase"));
const SupplierReport = lazy(() => import("../pages/reports/SupplierReport"));
const AccountingReport = lazy(() => import("../pages/reports/AccountingReport"));
const Discount = lazy(() => import("../pages/company-preference/discount/Discount"));
const GeneralPreference = lazy(() => import("../pages/preference/GeneralPreference"));
const ShopSetup = lazy(() => import("../pages/preference/ShopSetup"));
const ShopChatSupport = lazy(() => import("../pages/preference/ShopChatSupport"));
const ShopDomainSetup = lazy(() => import("../pages/preference/ShopDomainSetup"));
const ShopSeoMarketing = lazy(() => import("../pages/preference/ShopSeoMarketing"));
const ShopDeliverySupport = lazy(() => import("../pages/preference/ShopDeliverySupport"));
const ShopSmsSupport = lazy(() => import("../pages/preference/ShopSmsSupport"));
const ShopPaymentGateway = lazy(() => import("../pages/preference/ShopPaymentGateway"));
const ShopSocialAuth = lazy(() => import("../pages/preference/ShopSocialAuth"));
const StockSummaryReport = lazy(() => import("../pages/reports/StockSummaryReport"));
const CategorywiseStock = lazy(() => import("../pages/reports/CategorywiseStock"));
const Rewards = lazy(() => import("../pages/company-preference/reward/Rewards"));
const Referrals = lazy(() => import("../pages/company-preference/referrals/ReferralSystem"));
const Role = lazy(() => import("../pages/company-preference/role/Role"));
const Right = lazy(() => import("../pages/company-preference/right/Right"));
const PosSetup = lazy(() => import("../pages/preference/PosSetup"));
const CategorywiseSales = lazy(() => import("../pages/reports/CategorywiseSales"));
const NotFound = lazy(() => import("../components/common/NotFound"));
const StockHistory = lazy(() => import("../pages/stock/StockHistory"));
const StockTimeline = lazy(() => import("../pages/stock/StockTimeline"));
const StockTransfers = lazy(() => import("../pages/stock/StockTransfers"));
const StockGuard = lazy(() => import("../pages/stock/StockGuard"));
const InventoryCopilotSetup = lazy(() => import("../pages/stock/InventoryCopilotSetup"));
const BarcodeList = lazy(() => import("../pages/stock/BarcodeList"));
const DueInvoiceReport = lazy(() => import("../pages/reports/payments-reports/DueInvoiceReport"));
const ProductLadger = lazy(() => import("../pages/reports/products/ProductLadger"));
const TimesheetReport = lazy(() => import("../pages/reports/shifting/TimesheetReport"));
const WorkSlotList = lazy(() => import("../pages/company-preference/work-slots/WorkSlotList"));
const DemandTags = lazy(() => import("../pages/company-preference/demand-tags/DemandTags"));
const StorefrontHomeBuilder = lazy(() => import("../pages/company-preference/storefront-home/StorefrontHomeBuilder"));
const ProductReturnVerification = lazy(() => import("../pages/reports/ProductReturnVerification"));
const ProfitMarginReport = lazy(() => import("../pages/reports/ProfitMarginReport"));
const StockTransferReport = lazy(() => import("../pages/reports/StockTransferReport"));
const SellReturnLog = lazy(() => import("../pages/reports/SellReturnLog"));
const ExpireProductReport = lazy(() => import("../pages/reports/ExpireProductReport"));
const LogViewer = lazy(() => import("../pages/system-logs/LogViewer"));
const AuditLogs = lazy(() => import("../pages/system-logs/AuditLogs"));
const Companies = lazy(() => import("../pages/backoffice/companies/Companies"));
const CompanyDetails = lazy(() => import("../pages/backoffice/companies/CompanyDetails"));
const BackofficeLayout = lazy(() => import("../pages/backoffice/BackofficeLayout"));
const FeaturePreferences = lazy(() => import("../pages/backoffice/feature-preferences/FeaturePreferences"));
const AdminSettings = lazy(() => import("../pages/backoffice/admin-settings/AdminSettings"));
const Configurations = lazy(() => import("../pages/backoffice/configurations/Configurations"));
const Gateways = lazy(() => import("../pages/backoffice/gateway/Gateways"));
const PlanPaymentLogs = lazy(() => import("../pages/backoffice/plan-payment-logs/PlanPaymentLogs"));
const Currencies = lazy(() => import("../pages/backoffice/currencies/Currencies"));
const Locations = lazy(() => import("../pages/backoffice/locations/Locations"));
const ContentPages = lazy(() => import("../pages/backoffice/content/ContentPages"));
const ContentPageForm = lazy(() => import("../pages/backoffice/content/ContentPageForm"));
const ContentSections = lazy(() => import("../pages/backoffice/content/ContentSections"));
const ContentSectionBuilder = lazy(() => import("../pages/backoffice/content/ContentSectionBuilder"));
const ContentMenuBuilder = lazy(() => import("../pages/backoffice/content/ContentMenuBuilder"));
const BlogCategories = lazy(() => import("../pages/backoffice/content/BlogCategories"));
const Blogs = lazy(() => import("../pages/backoffice/content/Blogs"));
const BlogForm = lazy(() => import("../pages/backoffice/content/BlogForm"));
const ContactMessages = lazy(() => import("../pages/backoffice/content/ContactMessages"));
const Newsletters = lazy(() => import("../pages/backoffice/content/Newsletters"));
const EmailTemplates = lazy(() => import("../pages/backoffice/email-templates/EmailTemplates"));
const Languages = lazy(() => import("../pages/backoffice/languages/Languages"));
const BackofficeDashboard = lazy(() => import("../pages/backoffice/dashboard/BackofficeDashboard"));
const ECategories = lazy(() => import("../pages/backoffice/ecommerce/ECategories"));
const ETemplates = lazy(() => import("../pages/backoffice/ecommerce/ETemplates"));
const ETemplateBuilder = lazy(() => import("../pages/backoffice/ecommerce/ETemplateBuilder"));
const SaasPlans = lazy(() => import("../pages/saas-plans/SaasPlans"));
const PlanCheckout = lazy(() => import("../pages/saas-plans/PlanCheckout"));
const PlanPaymentCheckout = lazy(() => import("../pages/saas-plans/PlanPaymentCheckout"));
const UserPlans = lazy(() => import("../pages/saas-plans/UserPlans"));
const SubscriptionOverview = lazy(() => import("../pages/saas-plans/SubscriptionOverview"));
const SubscriptionBillingPage = lazy(() => import("../pages/saas-plans/SubscriptionBillingPage"));
const CommissionPaymentLogs = lazy(() => import("../pages/backoffice/commission-payment-logs/CommissionPaymentLogs"));
const EcommerceSetup = lazy(() => import("../pages/onboarding/EcommerceSetup"));
const TemplateSelection = lazy(() => import("../pages/onboarding/TemplateSelection"));
const TemplateCheckout = lazy(() => import("../pages/onboarding/TemplateCheckout"));
const SectionSetup = lazy(() => import("../pages/onboarding/SectionSetup"));
const ConditionalLayout = lazy(() => import("../components/layout/ConditionalLayout"));
const Layout = lazy(() => import("../layout/Layout"));
const FlowLayout = lazy(() => import("../components/layout/FlowLayout"));
const PublicPage = lazy(() => import("../pages/PublicPage"));
const TemplateLandingPreview = lazy(() => import("../pages/TemplateLandingPreview"));
const BlogDetails = lazy(() => import("../pages/BlogDetails"));
const BlogCategory = lazy(() => import("../pages/BlogCategory"));
const UnAuthorized = lazy(() => import("../components/common/UnAuthorized"));

const PlanJourney = lazy(() => import('../pages/onboarding/PlanJourney'));

const ProductSalesRankingReport = lazy(() =>
  import('../pages/reports/ProductSalesRankingReport')
);

function EcommerceSetupRoute() {
  const [searchParams] = useSearchParams();

  if (searchParams.get("step") === "template") {
    return <Navigate to="/onboarding/ecommerce-template" replace />;
  }

  return <EcommerceSetup />;
}

const DashboardEntry = () => {
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  return isSuperAdmin ? <Navigate to="/backoffice/dashboard" replace /> : <Dashboard />;
};

const SuperAdminRoute = ({ children }) => {
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  return isSuperAdmin ? children : <Navigate to="/unauthorized" replace />;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/blog/category/:slug",
    element: <BlogCategory />,
  },
  {
    path: "/blog/:slug",
    element: <BlogDetails />,
  },
  {
    path: "/store-setup",
    element: <Navigate to="/subscription/overview" replace />,
  },
  {
    path: "/store-setup/preview/:templateId",
    element: <TemplateLandingPreview />,
  },
  {
    path: "/order-payment-success/:trx",
    element: <CustomerOrderPaymentCallback mode="success" />,
  },
  {
    path: "/order-payment-cancel/:trx",
    element: <CustomerOrderPaymentCallback mode="cancel" />,
  },
  {
    path: "/order-success",
    element: <CustomerOrderPaymentResult mode="success" />,
  },
  {
    path: "/payment-cancel",
    element: <CustomerOrderPaymentResult mode="cancel" />,
  },
  {
    path: "/payment-failed",
    element: <CustomerOrderPaymentResult mode="failed" />,
  },
  {
    path: "/unauthorized",
    element: <UnAuthorized />,
  },
  {
    path: "/:slug",
    element: <PublicPage />,
  },
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "forgot-password",
        element: <ForgotPassword />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <Layout />
      </PrivateRoute>
    ),
    children: [
      {
        path: '/user-journey',
        element: <PlanJourney />,
      },
      {
        path: "/dashboard",
        element: (
          <RouteCheck requiredRight="dashboard.view" requiredModuleFeature="ftr_dashboard">
            <DashboardEntry />
          </RouteCheck>
        ),
      },
      {
        path: "/products/create",
        element: (
          <RouteCheck requiredRight="product.create">
            <ProductCreate />
          </RouteCheck>
        ),
      },
      {
        path: "/warehouses",
        element: (
          <RouteCheck requiredRight="warehouse.view" requiredModuleFeature="ftr_warehouses">
            <Warehouse />
          </RouteCheck>
        ),
      },
      {
        path: "purchases/create",
        element: (
          <RouteCheck requiredRight="stock-in.create" requiredCompanySetting="stock_tracking_enabled">
            <PurchaseCreate />
          </RouteCheck>
        ),
      },
      {
        path: "company-preference",
        children: [
          {
            path: "shop-setup",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredModuleFeature="ftr_shop_setup">
                <ShopSetup />
              </RouteCheck>
            ),
          },
          {
            path: "shop-setup/domain",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_shop_domain_setup">
                <ShopDomainSetup />
              </RouteCheck>
            ),
          },
          {
            path: "shop-setup/chat-support",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_shop_chat_support">
                <ShopChatSupport />
              </RouteCheck>
            ),
          },
          {
            path: "shop-setup/seo-marketing",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_shop_seo_marketing">
                <ShopSeoMarketing />
              </RouteCheck>
            ),
          },
          {
            path: "shop-setup/delivery-support",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_shop_delivery_support">
                <ShopDeliverySupport />
              </RouteCheck>
            ),
          },
          {
            path: "shop-setup/sms-support",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_shop_sms_support">
                <ShopSmsSupport />
              </RouteCheck>
            ),
          },
          {
            path: "shop-setup/payment-gateway",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_payment_gateway">
                <ShopPaymentGateway />
              </RouteCheck>
            ),
          },
          {
            path: "shop-setup/social-auth",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_social_auth">
                <ShopSocialAuth />
              </RouteCheck>
            ),
          },
          {
            path: "general-preference",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_general_preference">
                <GeneralPreference />
              </RouteCheck>
            ),
          },
          {
            path: "rewards",
            element: (
              <RouteCheck requiredRight="rewards.view" requiredFeature="ftr_rewards">
                <Rewards />
              </RouteCheck>
            ),
          },
          {
            path: "referrals",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_referral_system">
                <Referrals />
              </RouteCheck>
            ),
          },
          {
            path: "discount",
            element: (
              <RouteCheck requiredRight="discount.view" requiredFeature="ftr_warehouse_base_discount">
                <Discount />
              </RouteCheck>
            ),
          },
          {
            path: "roles",
            element: (
              <RouteCheck requiredRight="role.view" requiredFeature="ftr_roles">
                <Role />
              </RouteCheck>
            ),
          },
          {
            path: "pos-setup",
            element: (
              <RouteCheck requiredRight="pos-setup.view" requiredFeature="ftr_pos_setup">
                <PosSetup />
              </RouteCheck>
            ),
          },
          {
            path: "storefront-home",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_storefront_home">
                <StorefrontHomeBuilder />
              </RouteCheck>
            ),
          },
          {
            path: "feature-preference",
            element: (
              <RouteCheck requiredRight="product-setup.view">
                <ProductSettings />
              </RouteCheck>
            ),
          },
          {
            path: "work-slots",
            element: (
              <RouteCheck requiredRight="pos-setup.view" requiredFeature="ftr_work_slots">
                <WorkSlotList />
              </RouteCheck>
            ),
          },
          {
            path: "demand-tags",
            element: (
              <RouteCheck requiredRight="product-setup.view" requiredFeature="ftr_demand_tags">
                <DemandTags />
              </RouteCheck>
            ),
          },
          {
            path: "newsletters",
            element: (
              <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_email">
                <Newsletters />
              </RouteCheck>
            ),
          },
        ],
      },
      {
        path: "product-setup",
        children: [
          {
            path: "feature-preference",
            element: (
              <RouteCheck requiredRight="product-setup.view">
                <ProductSettings />
              </RouteCheck>
            ),
          },
          {
            path: "settings",
            element: (
              <RouteCheck requiredRight="product-setup.view">
                <ProductSettings />
              </RouteCheck>
            ),
          },
          {
            path: "category",
            element: (
              <RouteCheck requiredRight="category.view" requiredFeature="ftr_product_categories">
                <Category />
              </RouteCheck>
            ),
          },
          {
            path: "units",
            element: (
              <RouteCheck requiredRight="product-setup.view" requiredFeature="ftr_unit_setup">
                <Unit />
              </RouteCheck>
            ),
          },
          {
            path: "bundles",
            element: (
              <RouteCheck requiredRight="product-setup.view" requiredFeature="ftr_bundle_product">
                <Bundles />
              </RouteCheck>
            ),
          },
          {
            path: "brands",
            element: (
              <RouteCheck requiredRight="brand.view" requiredFeature="ftr_product_brands">
                <Brands />
              </RouteCheck>
            ),
          },
          {
            path: "variants",
            element: (
              <RouteCheck requiredRight="variant.view" requiredFeature="ftr_product_variants">
                <Variant />
              </RouteCheck>
            ),
          },
          {
            path: "products",
            element: (
              <RouteCheck requiredRight="product.view" requiredModuleFeature="ftr_products">
                <Products />
              </RouteCheck>
            ),
          },
        ],
      },
      {
        path: "/users",
        element: (
          <RouteCheck requiredRight="user.view" requiredModuleFeature="ftr_users">
            <User />
          </RouteCheck>
        ),
      },
      {
        path: "/companies",
        element: (
            <Companies />
        ),
      },
      {
        path: "logout",
        element: <Logout />,
      },
      {
        path: "sales",
        element: (
          <RouteCheck requiredRight="sales.view">
            <Sales />
          </RouteCheck>
        ),
      },
      {
        path: "sales/orders",
        element: (
          <RouteCheck requiredRight="invoice.view">
            <CustomerOrders />
          </RouteCheck>
        ),
      },
      {
        path: "new-sale",
        element: (
          <RouteCheck requiredRight="sales.create">
            <NewSale />
          </RouteCheck>
        ),
      },
      {
        path: "pos",
        element: (
          <RouteCheck requiredRight="stock-out.create">
            <Pos />
          </RouteCheck>
        ),
      },
      {
        path: "product/in",
        element: (
          <RouteCheck requiredRight="purchase.view">
            <Purchase />
          </RouteCheck>
        ),
      },
      {
        path: "report",
        children: [
          {
            path: "stock-summary",
            element: (
              <RouteCheck requiredRight="reports.report.stock-summary" requiredModuleFeature="ftr_report_stock_summary">
                <StockSummaryReport />
              </RouteCheck>
            ),
          },
          {
            path: "daily-monthly-sales",
            element: (
              <RouteCheck requiredRight="reports.daily-sale" requiredModuleFeature="ftr_report_daily_monthly_sales">
                <DailyMonthlySales />
              </RouteCheck>
            ),
          },
          {
            path: "daily-monthly-purchase",
            element: (
              <RouteCheck requiredRight="reports.daily-purchase" requiredModuleFeature="ftr_report_daily_monthly_purchase">
                <DailyMonthlyPurchase />
              </RouteCheck>
            ),
          },
          {
            path: "supplier-report",
            element: (
              <RouteCheck requiredRight="reports.report.stock-summary" requiredModuleFeature="ftr_report_supplier">
                <SupplierReport />
              </RouteCheck>
            ),
          },
          {
            path: "accounting",
            element: (
              <RouteCheck requiredRight="reports.accounting" requiredModuleFeature="ftr_report_accounting">
                <AccountingReport />
              </RouteCheck>
            ),
          },
          {
            path: "stock-report",
            element: (
              <RouteCheck requiredRight="reports.stock-report">
                <StockReport />
              </RouteCheck>
            ),
          },
          {
            path: "stock-by-category",
            element: (
              <RouteCheck requiredRight="reports.stock-by-category" requiredModuleFeature="ftr_report_stock_by_category">
                <CategorywiseStock />
              </RouteCheck>
            ),
          },
          {
            path: "sale-by-category",
            element: (
              <RouteCheck requiredRight="reports.sale-by-category" requiredModuleFeature="ftr_report_sale_by_category">
                <CategorywiseSales />
              </RouteCheck>
            ),
          },
          {
            path: "due-payments",
            element: (
              <RouteCheck requiredRight="reports.report.stock-summary" requiredModuleFeature="ftr_report_due_payments">
                <DueInvoiceReport />
              </RouteCheck>
            ),
          },
          {
            path: "product-ledger",
            element: (
              <RouteCheck requiredRight="reports.report.stock-summary" requiredModuleFeature="ftr_report_product_ledger">
                <ProductLadger />
              </RouteCheck>
            ),
          },
          {
            path: "timesheet",
            element: (
              <RouteCheck requiredRight="reports.report.stock-summary" requiredFeature="ftr_shift_and_cash_handover" requiredModuleFeature="ftr_report_timesheet">
                <TimesheetReport />
              </RouteCheck>
            ),
          },
          {
            path: "product-return-verification",
            element: (
              <RouteCheck requiredRight="reports.sale-by-category" requiredModuleFeature="ftr_report_return_verification">
                <ProductReturnVerification />
              </RouteCheck>
            ),
          },
          {
            path: "profit-margin",
            element: (
              <RouteCheck requiredRight="reports.sale-by-category" requiredModuleFeature="ftr_report_profit_margin">
                <ProfitMarginReport />
              </RouteCheck>
            ),
          },
          {
            path: "stock-transfer",
            element: (
              <RouteCheck requiredRight="stock-in.view" requiredFeature="ftr_warehouse_stock_transfer" requiredModuleFeature="ftr_report_stock_transfer">
                <StockTransferReport />
              </RouteCheck>
            ),
          },
          {
            path: "sell-return-log",
            element: (
              <RouteCheck requiredRight="reports.sale-by-category" requiredModuleFeature="ftr_report_sell_return_log">
                <SellReturnLog />
              </RouteCheck>
            ),
          },
          {
            path: "expire-product",
            element: (
              <RouteCheck requiredRight="reports.stock-overview" requiredModuleFeature="ftr_report_expire_product">
                <ExpireProductReport />
              </RouteCheck>
            ),
          },
          {
            path: "top-selling-products",
            element: (
              <RouteCheck requiredRight={['reports.sale-by-category', 'dashboard.view']} requiredFeature='ftr_top_selling_product_report'>
                <ProductSalesRankingReport direction='top' />
              </RouteCheck>
            ),
          },
          {
            path: "lowest-selling-products",
            element: (
              <RouteCheck requiredRight={['reports.sale-by-category', 'dashboard.view']} requiredFeature='ftr_lowest_selling_product_report'>
                <ProductSalesRankingReport direction='lowest' />
              </RouteCheck>
            ),
          },
          {
            path: "audit-logs",
            element: (
              <RouteCheck requiredRight="reports.sale-by-category" requiredModuleFeature="ftr_report_audit_logs">
                <AuditLogs />
              </RouteCheck>
            ),
          },
        ],
      },
      {
        path: "suppliers",
        element: (
          <RouteCheck requiredRight="supplier.view" requiredModuleFeature="ftr_suppliers">
            <Suppliers />
          </RouteCheck>
        ),
      },
      {
        path: "stock",
        children: [
          {
            path: "overview",
            element: (
              <RouteCheck requiredRight="reports.stock-overview" requiredModuleFeature="ftr_stock_overview">
                <Stock />
              </RouteCheck>
            ),
          },
          {
            path: "history",
            element: (
              <RouteCheck requiredRight="reports.stock-overview" requiredModuleFeature="ftr_stock_history">
                <StockHistory />
              </RouteCheck>
            ),
          },
          {
            path: "timeline",
            element: (
              <RouteCheck requiredRight="reports.stock-overview" requiredFeature="ftr_stock_movement_timeline">
                <StockTimeline />
              </RouteCheck>
            ),
          },
          {
            path: "stockguard",
            element: (
              <RouteCheck requiredRight="reports.stock-overview" requiredFeature="ftr_stockguard">
                <StockGuard />
              </RouteCheck>
            ),
          },
          {
            path: "inventory-copilot",
            element: (
              <RouteCheck requiredRight="reports.stock-overview" requiredFeature="ftr_inventory_copilot">
                <InventoryCopilotSetup />
              </RouteCheck>
            ),
          },
          {
            path: "in",
            element: (
              <RouteCheck requiredRight="stock-in.view" requiredCompanySetting="stock_tracking_enabled" requiredModuleFeature="ftr_stock_in">
                <Purchase />
              </RouteCheck>
            ),
          },
          {
            path: "purchase-return",
            element: (
              <RouteCheck requiredRight="stock-in.view" requiredFeature="ftr_purchase_return">
                <PurchaseReturn />
              </RouteCheck>
            ),
          },
          {
            path: "out",
            element: (
              <RouteCheck requiredRight="stock-out.view" requiredModuleFeature="ftr_stock_out">
                <StockOut />
              </RouteCheck>
            ),
          },
          {
            path: "waitlists",
            element: (
              <RouteCheck requiredRight="stock-out.view" requiredFeature="ftr_customer_waitlist">
                <Waitlists />
              </RouteCheck>
            ),
          },
          {
            path: "transfers",
            element: (
              <RouteCheck requiredRight="stock-in.view" requiredFeature="ftr_warehouse_stock_transfer">
                <StockTransfers />
              </RouteCheck>
            ),
          },
          {
            path: "barcodes",
            element: (
              <RouteCheck requiredRight="product.barcode.list" requiredFeature="ftr_product_barcode">
                <BarcodeList />
              </RouteCheck>
            ),
          },
        ],
      },
      {
        path: "invoices",
        element: (
          <RouteCheck requiredRight="invoice.view">
            <Invoices />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/sales",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredModuleFeature="ftr_sale_invoices">
            <SaleInvoices />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/orders",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredFeature="ftr_order_management">
            <CustomerOrders />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/courier-ops",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredFeature="ftr_order_management" requiredModuleFeature="ftr_courier_ops">
            <CourierOperations />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/order-tracking",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredFeature="ftr_order_tracking">
            <OrderTracking />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/returns",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredFeature="ftr_customer_returns">
            <CustomerReturns />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/refunds",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredFeature="ftr_refund_log">
            <SellReturnLog />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/payouts",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredFeature="ftr_payout_request">
            <CustomerPayouts />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/purchases",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredModuleFeature="ftr_purchase_invoices">
            <PurchaseInvoices />
          </RouteCheck>
        ),
      },
      {
        path: "invoices/quotations",
        element: (
          <RouteCheck requiredRight="invoice.view" requiredModuleFeature="ftr_quotation">
            <QuotationInvoices />
          </RouteCheck>
        ),
      },
      {
        path: "subscription/overview",
        element: (
          <RouteCheck requiredRight="general-preferences.view" requiredModuleFeature="ftr_subscription_overview">
            <SubscriptionOverview />
          </RouteCheck>
        ),
      },
      {
        path: "subscription/plans",
        element: (
          <RouteCheck requiredRight="general-preferences.view">
            <UserPlans />
          </RouteCheck>
        ),
      },
      {
        path: "subscription/manage-plan",
        element: <Navigate to="/subscription/plans" replace />,
      },
      {
        path: "subscription/billing-history",
        element: (
          <RouteCheck requiredRight={["plan-payment.view", "general-preferences.view"]} requiredModuleFeature="ftr_subscription_billing_history">
            <SubscriptionBillingPage />
          </RouteCheck>
        ),
      },
      {
        path: "plans/checkout/:planId",
        element: <PlanCheckout />,
      },
      {
        path: "plans/free/:planId",
        element: <PlanCheckout />,
      },
      {
        path: "plans/commission/:planId",
        element: <PlanCheckout />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <FlowLayout />
      </PrivateRoute>
    ),
    children: [
      {
        path: "/plans",
        element: <Navigate to="/subscription/plans" replace />,
      },
      {
        path: "/plan-payments",
        element: <Navigate to="/subscription/billing-history" replace />,
      },
      {
        path: "/plans/payment-checkout/:paymentLogId",
        element: <PlanPaymentCheckout />,
      },
      {
        path: "/templates/checkout/:templateId",
        element: <TemplateCheckout />,
      },
      {
        path: "/onboarding/storefront-builder",
        element: (
          <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_storefront_home">
            <StorefrontHomeBuilder />
          </RouteCheck>
        ),
      },
      {
        path: "/onboarding/section-setup",
        element: (
          <RouteCheck requiredRight="general-preferences.view">
            <SectionSetup />
          </RouteCheck>
        ),
      },
    ],
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <ConditionalLayout />
      </PrivateRoute>
    ),
    children: [
      {
        path: "profile",
        element: <Profile />,
      },
      {
        path: "password-update",
        element: <PasswordUpdate />,
      },
      {
        path: "onboarding/ecommerce-setup",
        element: <EcommerceSetupRoute />,
      },
      {
        path: "onboarding/ecommerce-template",
        element: (
          <RouteCheck requiredRight="general-preferences.view" requiredFeature="ftr_storefront_home" requiredModuleFeature="ftr_store_template">
            <TemplateSelection />
          </RouteCheck>
        ),
      },
    ],
  },
  {
    path: "/backoffice",
    element: (
      <PrivateRoute>
        <SuperAdminRoute>
          <BackofficeLayout />
        </SuperAdminRoute>
      </PrivateRoute>
    ),
    children: [
      {
        index: true,
        element: <BackofficeDashboard />,
      },
      {
        path: "dashboard",
        element: <BackofficeDashboard />,
      },
      {
        path: "companies",
        element: <Companies />,
      },
      {
        path: "company-details",
        element: <CompanyDetails />,
      },
      {
        path: "rights",
        element: (
            <Right />
        ),
      },
      {
        path: "cofigurations",
        element: <Configurations />,
      },
      {
        path: "configurations",
        element: <Configurations />,
      },
      {
        path: "email-templates",
        element: <EmailTemplates />,
      },
      {
        path: "languages",
        element: <Languages />,
      },
      {
        path: "admin-settings",
        element: <AdminSettings />,
      },
      {
        path: "preference",
        element: <AdminSettings />,
      },
      {
        path: "feature-preferences",
        element: <FeaturePreferences />,
      },
      {
        path: "plans",
        element: <SaasPlans />,
      },
      {
        path: "gateways",
        element: <Gateways />,
      },
      {
        path: "plan-payment-logs",
        element: <PlanPaymentLogs />,
      },
      {
        path: "commission-payment-logs",
        element: <CommissionPaymentLogs />,
      },
      {
        path: "currencies",
        element: <Currencies />,
      },
      {
        path: "locations",
        element: <Locations />,
      },
      {
        path: "e-categories",
        element: <ECategories />,
      },
      {
        path: "e-templates",
        element: <ETemplates />,
      },
      {
        path: "e-templates/:templateId/builder",
        element: <ETemplateBuilder />,
      },
      { path: "content/pages", element: <ContentPages /> },
      { path: "content/pages/create", element: <ContentPageForm /> },
      { path: "content/pages/:pageId/edit", element: <ContentPageForm /> },
      { path: "content/sections", element: <ContentSections /> },
      { path: "content/sections/:sectionName", element: <ContentSectionBuilder /> },
      { path: "content/menus", element: <ContentMenuBuilder /> },
      { path: "content/blog-categories", element: <BlogCategories /> },
      { path: "content/blogs", element: <Blogs /> },
      { path: "content/blogs/create", element: <BlogForm /> },
      { path: "content/blogs/:blogId/edit", element: <BlogForm /> },
      { path: "content/contact-messages", element: <ContactMessages /> },
      { path: "content/newsletters", element: <Newsletters /> },
      {
        path: "logs",
        element: (
            <LogViewer />
        ),
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

export default router;

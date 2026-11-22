<?php

namespace App\Data;

enum FeaturePreference: string
{
    case EMAIL = 'ftr_email';
    case PRODUCT_CATEGORIES = 'ftr_product_categories';
    case PRODUCT_BRANDS = 'ftr_product_brands';
    case PRODUCT_VARIANTS = 'ftr_product_variants';
    case PRODUCT_SEGMENTATION = 'ftr_product_segmentation';
    case PRODUCT_BARCODE = 'ftr_product_barcode';
    case GENERAL_PREFERENCE = 'ftr_general_preference';
    case FEATURE_PREFERENCES = 'ftr_feature_preferences';
    case POS_SETUP = 'ftr_pos_setup';
    case REWARDS = 'ftr_rewards';
    case DISCOUNT_SETUP = 'ftr_discount_setup';
    case WORK_SLOTS = 'ftr_work_slots';
    case DEMAND_TAGS = 'ftr_demand_tags';
    case ROLES = 'ftr_roles';
    case STOREFRONT_HOME = 'ftr_storefront_home';
    case SHOP_DOMAIN_SETUP = 'ftr_shop_domain_setup';
    case SHOP_CHAT_SUPPORT = 'ftr_shop_chat_support';
    case SHOP_SEO_MARKETING = 'ftr_shop_seo_marketing';
    case SHOP_DELIVERY_SUPPORT = 'ftr_shop_delivery_support';
    case SHOP_SMS_SUPPORT = 'ftr_shop_sms_support';
    case SOCIAL_AUTH = 'ftr_social_auth';
    case PAYMENT_GATEWAY = 'ftr_payment_gateway';
    case AI = 'ftr_ai';
    case ORDER_MANAGEMENT = 'ftr_order_management';
    case ORDER_TRACKING = 'ftr_order_tracking';
    case CUSTOMER_RETURNS = 'ftr_customer_returns';
    case REFUND_LOG = 'ftr_refund_log';
    case PAYOUT_REQUEST = 'ftr_payout_request';
    case SALES_CHANNEL = 'ftr_sales_channel';
    case REFERRAL_SYSTEM = 'ftr_referral_system';
    case IN_STEP_PRODUCT_MODAL = 'ftr_in_step_product_modal';
    case ALLOW_INVOICE_DELETE = 'ftr_allow_invoice_delete';
    case AUTO_DELETE_EMPTY_PURCHASE_INVOICE = 'ftr_auto_delete_empty_purchase_invoice';
    case STOCK_MOVEMENT_TIMELINE = 'ftr_stock_movement_timeline';
    case STOCK_VISIBILITY_CONTROL = 'ftr_stock_visibility_control';
    case INVENTORY_COPILOT = 'ftr_inventory_copilot';
    case STOCKGUARD = 'ftr_stockguard';
    case WAREHOUSE_BASE_DISCOUNT = 'ftr_warehouse_base_discount';
    case UNIT_SETUP = 'ftr_unit_setup';
    case PURCHASE_RETURN = 'ftr_purchase_return';
    case SELL_RETURN = 'ftr_sell_return';
    case CUSTOMER_WAITLIST = 'ftr_customer_waitlist';
    case QUOTATION = 'ftr_quotation';
    case BUNDLE_PRODUCT = 'ftr_bundle_product';
    case TOP_SELLING_PRODUCT_REPORT = 'ftr_top_selling_product_report';
    case LOWEST_SELLING_PRODUCT_REPORT = 'ftr_lowest_selling_product_report';
    case WAREHOUSE_STOCK_TRANSFER = 'ftr_warehouse_stock_transfer';
    case SHIFT_AND_CASH_HANDOVER = 'ftr_shift_and_cash_handover';
    case PASSWORD_PROTECTED_ROUTES = 'ftr_password_protected_routes';
    case PRODUCTS = 'ftr_products';
    case SHOP_SETUP = 'ftr_shop_setup';
    case STORE_TEMPLATE = 'ftr_store_template';
    case STOCK_OVERVIEW = 'ftr_stock_overview';
    case STOCK_HISTORY = 'ftr_stock_history';
    case STOCK_IN = 'ftr_stock_in';
    case STOCK_OUT = 'ftr_stock_out';
    case COURIER_OPS = 'ftr_courier_ops';
    case SALE_INVOICES = 'ftr_sale_invoices';
    case PURCHASE_INVOICES = 'ftr_purchase_invoices';
    case REPORT_STOCK_SUMMARY = 'ftr_report_stock_summary';
    case REPORT_DAILY_MONTHLY_SALES = 'ftr_report_daily_monthly_sales';
    case REPORT_DAILY_MONTHLY_PURCHASE = 'ftr_report_daily_monthly_purchase';
    case REPORT_SUPPLIER = 'ftr_report_supplier';
    case REPORT_STOCK_BY_CATEGORY = 'ftr_report_stock_by_category';
    case REPORT_SALE_BY_CATEGORY = 'ftr_report_sale_by_category';
    case REPORT_DUE_PAYMENTS = 'ftr_report_due_payments';
    case REPORT_PRODUCT_LEDGER = 'ftr_report_product_ledger';
    case REPORT_TIMESHEET = 'ftr_report_timesheet';
    case REPORT_RETURN_VERIFICATION = 'ftr_report_return_verification';
    case REPORT_PROFIT_MARGIN = 'ftr_report_profit_margin';
    case REPORT_STOCK_TRANSFER = 'ftr_report_stock_transfer';
    case REPORT_SELL_RETURN_LOG = 'ftr_report_sell_return_log';
    case REPORT_EXPIRE_PRODUCT = 'ftr_report_expire_product';
    case REPORT_ACCOUNTING = 'ftr_report_accounting';
    case REPORT_AUDIT_LOGS = 'ftr_report_audit_logs';
    case GETTING_STARTED = 'ftr_getting_started';
    case DASHBOARD = 'ftr_dashboard';
    case WAREHOUSES = 'ftr_warehouses';
    case USERS = 'ftr_users';
    case SUPPLIERS = 'ftr_suppliers';
    case SUBSCRIPTION_OVERVIEW = 'ftr_subscription_overview';
    case SUBSCRIPTION_PLANS = 'ftr_subscription_plans';
    case SUBSCRIPTION_BILLING_HISTORY = 'ftr_subscription_billing_history';
    

    public function isCore(): bool
    {
        return in_array($this, [
            self::GETTING_STARTED,
            self::DASHBOARD,
            self::GENERAL_PREFERENCE,
            self::FEATURE_PREFERENCES,
            self::SUBSCRIPTION_OVERVIEW,
            self::SUBSCRIPTION_PLANS,
            self::SUBSCRIPTION_BILLING_HISTORY,
        ], true);
    }

    public static function coreValues(): array
    {
        return array_map(
            static fn (self $feature) => $feature->value,
            array_filter(self::cases(), static fn (self $feature) => $feature->isCore())
        );
    }

    public function label(): string
    {
        return match ($this) {
            self::EMAIL => 'Email',
            self::PRODUCT_CATEGORIES => 'Product Categories',
            self::PRODUCT_BRANDS => 'Product Brands',
            self::PRODUCT_VARIANTS => 'Product Variants',
            self::PRODUCT_SEGMENTATION => 'Product Segmentation',
            self::PRODUCT_BARCODE => 'Product Barcode',
            self::GENERAL_PREFERENCE => 'General Preference',
            self::FEATURE_PREFERENCES => 'Feature Preferences',
            self::POS_SETUP => 'Pos Setup',
            self::REWARDS => 'Rewards',
            self::DISCOUNT_SETUP => 'Discount Setup',
            self::WORK_SLOTS => 'Work Slots',
            self::DEMAND_TAGS => 'Demand Tags',
            self::ROLES => 'Roles',
            self::STOREFRONT_HOME => 'Storefront Home',
            self::SHOP_DOMAIN_SETUP => 'Shop Domain',
            self::SHOP_CHAT_SUPPORT => 'Chat Support',
            self::SHOP_SEO_MARKETING => 'SEO Marketing',
            self::SHOP_DELIVERY_SUPPORT => 'Delivery Support',
            self::SHOP_SMS_SUPPORT => 'SMS Support',
            self::SOCIAL_AUTH => 'Social Authentication',
            self::PAYMENT_GATEWAY => 'Payment Gateway',
            self::AI => 'AI Features',
            self::ORDER_MANAGEMENT => 'Order Management',
            self::ORDER_TRACKING => 'Order Tracking',
            self::CUSTOMER_RETURNS => 'Customer Returns',
            self::REFUND_LOG => 'Refund Log',
            self::PAYOUT_REQUEST => 'Payout Request',
            self::SALES_CHANNEL => 'Sales Channel',
            self::REFERRAL_SYSTEM => 'Referral System',
            self::IN_STEP_PRODUCT_MODAL => 'Enable In-Step Product Modal',
            self::ALLOW_INVOICE_DELETE => 'Allow Invoice Delete',
            self::AUTO_DELETE_EMPTY_PURCHASE_INVOICE => 'Auto Delete Empty Purchase Invoice',
            self::STOCK_MOVEMENT_TIMELINE => 'Stock Movement Timeline',
            self::STOCK_VISIBILITY_CONTROL => 'Stock Visibility Control',
            self::INVENTORY_COPILOT => 'Inventory Copilot',
            self::STOCKGUARD => 'StockGuard',
            self::PRODUCT_BARCODE => 'Barcode Generation',
            self::IN_STEP_PRODUCT_MODAL => 'Enable In-Step Product Modal',
            self::ALLOW_INVOICE_DELETE => 'Allow Invoice Delete',
            self::AUTO_DELETE_EMPTY_PURCHASE_INVOICE => 'Auto Delete Empty Purchase Invoice',
            self::WAREHOUSE_BASE_DISCOUNT => 'Warehouse Based Discount',
            self::UNIT_SETUP => 'Unit Setup',
            self::PURCHASE_RETURN => 'Purchase Return',
            self::SELL_RETURN => 'Sell Return',
            self::CUSTOMER_WAITLIST => 'Customer Waitlist',
            self::QUOTATION => 'Quotation',
            self::BUNDLE_PRODUCT => 'Bundle Product',
            self::TOP_SELLING_PRODUCT_REPORT => 'Top Selling Product Report',
            self::LOWEST_SELLING_PRODUCT_REPORT => 'Lowest Selling Product Report',
            self::WAREHOUSE_STOCK_TRANSFER => 'Warehouse to Warehouse Stock Transfer',
            self::SHIFT_AND_CASH_HANDOVER => 'Shift and Cash Handover',
            self::PASSWORD_PROTECTED_ROUTES => 'Password Protected Routes',
            self::PRODUCTS => 'Products',
            self::SHOP_SETUP => 'Shop Setup',
            self::STORE_TEMPLATE => 'Store Template',
            self::STOCK_OVERVIEW => 'Stock Overview',
            self::STOCK_HISTORY => 'Stock History',
            self::STOCK_IN => 'Stock In',
            self::STOCK_OUT => 'Stock Out',
            self::COURIER_OPS => 'Courier Ops',
            self::SALE_INVOICES => 'Sale Invoices',
            self::PURCHASE_INVOICES => 'Purchase Invoices',
            self::REPORT_STOCK_SUMMARY => 'Stock Summary',
            self::REPORT_DAILY_MONTHLY_SALES => 'Daily / Monthly Sales',
            self::REPORT_DAILY_MONTHLY_PURCHASE => 'Daily / Monthly Purchase',
            self::REPORT_SUPPLIER => 'Supplier Report',
            self::REPORT_STOCK_BY_CATEGORY => 'Stock By Category',
            self::REPORT_SALE_BY_CATEGORY => 'Sale By Category',
            self::REPORT_DUE_PAYMENTS => 'Due Payments',
            self::REPORT_PRODUCT_LEDGER => 'Product Ledger',
            self::REPORT_TIMESHEET => 'Timesheet & Cash Handover',
            self::REPORT_RETURN_VERIFICATION => 'Return Verification',
            self::REPORT_PROFIT_MARGIN => 'Profit Margin Report',
            self::REPORT_STOCK_TRANSFER => 'Stock Transfer Report',
            self::REPORT_SELL_RETURN_LOG => 'Refund & Return Log',
            self::REPORT_EXPIRE_PRODUCT => 'Expire Product Report',
            self::REPORT_ACCOUNTING => 'Accounting Report',
            self::REPORT_AUDIT_LOGS => 'Audit Logs',
            self::GETTING_STARTED => 'Getting Started',
            self::DASHBOARD => 'Dashboard',
            self::WAREHOUSES => 'Warehouses',
            self::USERS => 'Users',
            self::SUPPLIERS => 'Suppliers',
            self::SUBSCRIPTION_OVERVIEW => 'Subscription Overview',
            self::SUBSCRIPTION_PLANS => 'Subscription Plans',
            self::SUBSCRIPTION_BILLING_HISTORY => 'Subscription Billing History',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::EMAIL => 'Enable email-related company feature access',
            self::PRODUCT_CATEGORIES => 'Enable categorization of products',
            self::PRODUCT_BRANDS => 'Enable brand management for products',
            self::PRODUCT_VARIANTS => 'Enable variant options for products',
            self::PRODUCT_SEGMENTATION => 'Enable segmentation for products',
            self::PRODUCT_BARCODE => 'Enable barcode for products',
            self::GENERAL_PREFERENCE => 'Enable general company preference settings.',
            self::FEATURE_PREFERENCES => 'Enable feature preference management for the workspace.',
            self::POS_SETUP => 'Enable POS setup and terminal configuration.',
            self::REWARDS => 'Enable reward program configuration.',
            self::DISCOUNT_SETUP => 'Enable discount setup management.',
            self::WORK_SLOTS => 'Enable work slot and shift scheduling settings.',
            self::DEMAND_TAGS => 'Enable demand tag management.',
            self::ROLES => 'Enable role management for the workspace.',
            self::STOREFRONT_HOME => 'Enable storefront home page builder and section management.',
            self::SHOP_DOMAIN_SETUP => 'Enable custom shop domain setup and management.',
            self::SHOP_CHAT_SUPPORT => 'Enable storefront chat support configuration.',
            self::SHOP_SEO_MARKETING => 'Enable SEO and marketing integration settings.',
            self::SHOP_DELIVERY_SUPPORT => 'Enable delivery support and fulfillment configuration.',
            self::SHOP_SMS_SUPPORT => 'Enable SMS notification and support settings.',
            self::SOCIAL_AUTH => 'Enable social authentication login for customers.',
            self::PAYMENT_GATEWAY => 'Enable payment gateway settings and checkout gateway management.',
            self::AI => 'Enable AI-powered product content and productivity tools.',
            self::ORDER_MANAGEMENT => 'Enable customer order management workflows.',
            self::ORDER_TRACKING => 'Enable order tracking management and monitoring.',
            self::CUSTOMER_RETURNS => 'Enable customer return request management.',
            self::REFUND_LOG => 'Enable refund log access and refund auditing.',
            self::PAYOUT_REQUEST => 'Enable payout request review and management.',
            self::SALES_CHANNEL => 'Enable independent sales channels for stock allocation',
            self::REFERRAL_SYSTEM => 'Enable referral network, chain rewards, and MLM-style company commissions.',
            self::IN_STEP_PRODUCT_MODAL => 'Displays the product modal during this step, allowing inline product creation or editing without leaving the current flow.',
            self::ALLOW_INVOICE_DELETE => 'Allow companies to delete sale and purchase invoices when invoice deletion is otherwise permitted by rights.',
            self::AUTO_DELETE_EMPTY_PURCHASE_INVOICE => 'Automatically delete linked purchase invoices after sale deletion when all purchase item quantities become zero or negative.',
            self::STOCK_MOVEMENT_TIMELINE => 'Enable visual stock movement timeline for products.',
            self::STOCK_VISIBILITY_CONTROL => 'Control whether buyers see exact stock quantity or a custom stock label.',
            self::INVENTORY_COPILOT => 'Enable guided inventory insights in the top bar.',
            self::STOCKGUARD => 'Enable approval workflow and audit protection for manual stock adjustments.',
            self::PRODUCT_BARCODE => 'Enable barcode generation for products',
            self::IN_STEP_PRODUCT_MODAL => 'Displays the product modal during this step, allowing inline product creation or editing without leaving the current flow.',
            self::ALLOW_INVOICE_DELETE => 'Allow companies to delete sale and purchase invoices when invoice deletion is otherwise permitted by rights.',
            self::AUTO_DELETE_EMPTY_PURCHASE_INVOICE => 'Automatically delete linked purchase invoices after sale deletion when all purchase item quantities become zero or negative.',
            self::WAREHOUSE_BASE_DISCOUNT => 'Enable warehouse-specific discount rules in the discount module.',
            self::UNIT_SETUP => 'Enable company-level unit setup and management for products.',
            self::PURCHASE_RETURN => 'Allow purchase return workflows for company purchases.',
            self::SELL_RETURN => 'Allow sell return workflows for company sales.',
            self::CUSTOMER_WAITLIST => 'Enable customer waitlist management features.',
            self::QUOTATION => 'Enable quotation creation and management.',
            self::BUNDLE_PRODUCT => 'Enable creating and selling bundle products.',
            self::TOP_SELLING_PRODUCT_REPORT => 'Enable top selling product insights and reporting.',
            self::LOWEST_SELLING_PRODUCT_REPORT => 'Enable lowest selling product insights and reporting.',
            self::WAREHOUSE_STOCK_TRANSFER => 'Enable stock transfer from one warehouse to another.',
            self::SHIFT_AND_CASH_HANDOVER => 'Enable shift management and cash handover workflows.',
            self::PASSWORD_PROTECTED_ROUTES => 'Enable password confirmation for protected routes such as roles.',
            self::PRODUCTS => 'Enable the product list and product management page.',
            self::SHOP_SETUP => 'Enable the shop setup entry page.',
            self::STORE_TEMPLATE => 'Enable storefront template selection.',
            self::STOCK_OVERVIEW => 'Enable the stock overview page.',
            self::STOCK_HISTORY => 'Enable stock history and activity review.',
            self::STOCK_IN => 'Enable stock-in and purchasing workflows.',
            self::STOCK_OUT => 'Enable stock-out workflows.',
            self::COURIER_OPS => 'Enable courier operations for customer orders.',
            self::SALE_INVOICES => 'Enable sale invoice management.',
            self::PURCHASE_INVOICES => 'Enable purchase invoice management.',
            self::REPORT_STOCK_SUMMARY => 'Enable the stock summary report.',
            self::REPORT_DAILY_MONTHLY_SALES => 'Enable daily and monthly sales reports.',
            self::REPORT_DAILY_MONTHLY_PURCHASE => 'Enable daily and monthly purchase reports.',
            self::REPORT_SUPPLIER => 'Enable the supplier report.',
            self::REPORT_STOCK_BY_CATEGORY => 'Enable stock by category reporting.',
            self::REPORT_SALE_BY_CATEGORY => 'Enable sale by category reporting.',
            self::REPORT_DUE_PAYMENTS => 'Enable due payment reporting.',
            self::REPORT_PRODUCT_LEDGER => 'Enable the product ledger report.',
            self::REPORT_TIMESHEET => 'Enable timesheet and cash handover reporting.',
            self::REPORT_RETURN_VERIFICATION => 'Enable product return verification reporting.',
            self::REPORT_PROFIT_MARGIN => 'Enable profit margin reporting.',
            self::REPORT_STOCK_TRANSFER => 'Enable stock transfer reporting.',
            self::REPORT_SELL_RETURN_LOG => 'Enable refund and return log reporting.',
            self::REPORT_EXPIRE_PRODUCT => 'Enable expiring product reporting.',
            self::REPORT_ACCOUNTING => 'Enable accounting reporting.',
            self::REPORT_AUDIT_LOGS => 'Enable audit log reporting.',
            self::GETTING_STARTED => 'Show the Getting Started journey in the workspace navigation.',
            self::DASHBOARD => 'Show the company dashboard in the workspace navigation.',
            self::WAREHOUSES => 'Enable warehouse management navigation.',
            self::USERS => 'Enable user management navigation.',
            self::SUPPLIERS => 'Enable supplier management navigation.',
            self::SUBSCRIPTION_OVERVIEW => 'Show the subscription overview in navigation.',
            self::SUBSCRIPTION_PLANS => 'Show available subscription plans in navigation.',
            self::SUBSCRIPTION_BILLING_HISTORY => 'Show subscription billing history in navigation.',
        };
    }

    public function legacyField(): ?string
    {
        return match ($this) {
            self::EMAIL => null,
            self::PRODUCT_CATEGORIES => 'has_category',
            self::PRODUCT_BRANDS => 'has_brand',
            self::PRODUCT_VARIANTS => 'has_variant',
            self::PRODUCT_SEGMENTATION => 'has_segmentation',
            self::PRODUCT_BARCODE => 'has_barcode',
            self::GENERAL_PREFERENCE => null,
            self::FEATURE_PREFERENCES => null,
            self::POS_SETUP => null,
            self::REWARDS => null,
            self::DISCOUNT_SETUP => null,
            self::WORK_SLOTS => null,
            self::DEMAND_TAGS => null,
            self::ROLES => null,
            self::STOREFRONT_HOME => null,
            self::SHOP_DOMAIN_SETUP => null,
            self::SHOP_CHAT_SUPPORT => null,
            self::SHOP_SEO_MARKETING => null,
            self::SHOP_DELIVERY_SUPPORT => null,
            self::SHOP_SMS_SUPPORT => null,
            self::SOCIAL_AUTH => null,
            self::PAYMENT_GATEWAY => null,
            self::AI => null,
            self::ORDER_MANAGEMENT => null,
            self::ORDER_TRACKING => null,
            self::CUSTOMER_RETURNS => null,
            self::REFUND_LOG => null,
            self::PAYOUT_REQUEST => null,
            self::SALES_CHANNEL => null,
            self::REFERRAL_SYSTEM => null,
            self::IN_STEP_PRODUCT_MODAL => 'is_product_modal_in_step',
            self::ALLOW_INVOICE_DELETE => 'allow_invoice_delete',
            self::AUTO_DELETE_EMPTY_PURCHASE_INVOICE => 'auto_delete_empty_purchase_invoice',
            self::STOCK_MOVEMENT_TIMELINE => null,
            self::STOCK_VISIBILITY_CONTROL => null,
            self::INVENTORY_COPILOT => null,
            self::STOCKGUARD => null,
            self::WAREHOUSE_BASE_DISCOUNT => null,
            self::UNIT_SETUP => null,
            self::PURCHASE_RETURN => null,
            self::SELL_RETURN => null,
            self::CUSTOMER_WAITLIST => null,
            self::QUOTATION => null,
            self::BUNDLE_PRODUCT => null,
            self::TOP_SELLING_PRODUCT_REPORT => null,
            self::LOWEST_SELLING_PRODUCT_REPORT => null,
            self::WAREHOUSE_STOCK_TRANSFER => null,
            self::SHIFT_AND_CASH_HANDOVER => null,
            self::PASSWORD_PROTECTED_ROUTES => null,
            default => null,
        };
    }

    public function defaultActive(): bool
    {
        if ($this->isCore()) {
            return true;
        }

        if ($this->isNewMenuFeature()) {
            return false;
        }

        return match ($this) {
            self::EMAIL => false,
            self::PRODUCT_BARCODE => false,
            self::GENERAL_PREFERENCE => false,
            self::FEATURE_PREFERENCES => false,
            self::POS_SETUP => false,
            self::REWARDS => false,
            self::DISCOUNT_SETUP => false,
            self::WORK_SLOTS => false,
            self::DEMAND_TAGS => false,
            self::ROLES => false,
            self::STOREFRONT_HOME => false,
            self::SHOP_DOMAIN_SETUP => false,
            self::SHOP_CHAT_SUPPORT => false,
            self::SHOP_SEO_MARKETING => false,
            self::SHOP_DELIVERY_SUPPORT => false,
            self::SHOP_SMS_SUPPORT => false,
            self::SOCIAL_AUTH => false,
            self::PAYMENT_GATEWAY => false,
            self::AI => false,
            self::ORDER_MANAGEMENT => false,
            self::ORDER_TRACKING => false,
            self::CUSTOMER_RETURNS => false,
            self::REFUND_LOG => false,
            self::PAYOUT_REQUEST => false,
            self::ALLOW_INVOICE_DELETE => false,
            self::REFERRAL_SYSTEM => false,
            self::AUTO_DELETE_EMPTY_PURCHASE_INVOICE => false,
            self::WAREHOUSE_BASE_DISCOUNT => false,
            self::UNIT_SETUP => false,
            self::PURCHASE_RETURN => false,
            self::SELL_RETURN => false,
            self::CUSTOMER_WAITLIST => false,
            self::QUOTATION => false,
            self::BUNDLE_PRODUCT => false,
            self::TOP_SELLING_PRODUCT_REPORT => false,
            self::LOWEST_SELLING_PRODUCT_REPORT => false,
            self::WAREHOUSE_STOCK_TRANSFER => false,
            self::SHIFT_AND_CASH_HANDOVER => false,
            self::PASSWORD_PROTECTED_ROUTES => false,
            default => true,
        };
    }

    public function isNewMenuFeature(): bool
    {
        return in_array($this, [
            self::PRODUCTS, self::SHOP_SETUP, self::STORE_TEMPLATE,
            self::GETTING_STARTED, self::DASHBOARD,
            self::WAREHOUSES, self::USERS, self::SUPPLIERS,
            self::SUBSCRIPTION_OVERVIEW, self::SUBSCRIPTION_PLANS,
            self::SUBSCRIPTION_BILLING_HISTORY,
            self::STOCK_OVERVIEW, self::STOCK_HISTORY,
            self::STOCK_IN, self::STOCK_OUT, self::COURIER_OPS,
            self::SALE_INVOICES, self::PURCHASE_INVOICES,
            self::REPORT_STOCK_SUMMARY, self::REPORT_DAILY_MONTHLY_SALES,
            self::REPORT_DAILY_MONTHLY_PURCHASE, self::REPORT_SUPPLIER,
            self::REPORT_STOCK_BY_CATEGORY, self::REPORT_SALE_BY_CATEGORY,
            self::REPORT_DUE_PAYMENTS, self::REPORT_PRODUCT_LEDGER,
            self::REPORT_TIMESHEET, self::REPORT_RETURN_VERIFICATION,
            self::REPORT_PROFIT_MARGIN, self::REPORT_STOCK_TRANSFER,
            self::REPORT_SELL_RETURN_LOG, self::REPORT_EXPIRE_PRODUCT,
            self::REPORT_ACCOUNTING, self::REPORT_AUDIT_LOGS,
        ], true);
    }

    public function group(): FeaturePreferenceGroup
    {
        return match ($this) {
            self::GENERAL_PREFERENCE,
            self::FEATURE_PREFERENCES,
            self::GETTING_STARTED,
            self::DASHBOARD,
            self::USERS,
            self::SUBSCRIPTION_OVERVIEW,
            self::SUBSCRIPTION_PLANS,
            self::SUBSCRIPTION_BILLING_HISTORY,
            self::ROLES,
            self::PASSWORD_PROTECTED_ROUTES => FeaturePreferenceGroup::WORKSPACE_ACCESS,

            self::PRODUCT_CATEGORIES,
            self::PRODUCT_BRANDS,
            self::PRODUCT_VARIANTS,
            self::PRODUCT_SEGMENTATION,
            self::PRODUCT_BARCODE,
            self::UNIT_SETUP,
            self::BUNDLE_PRODUCT,
            self::PRODUCTS,
            self::AI => FeaturePreferenceGroup::PRODUCT_CATALOG,

            self::STOCK_MOVEMENT_TIMELINE,
            self::STOCK_VISIBILITY_CONTROL,
            self::INVENTORY_COPILOT,
            self::STOCKGUARD,
            self::WAREHOUSE_STOCK_TRANSFER,
            self::PURCHASE_RETURN,
            self::WAREHOUSES,
            self::SUPPLIERS,
            self::STOCK_OVERVIEW,
            self::STOCK_HISTORY,
            self::STOCK_IN,
            self::STOCK_OUT => FeaturePreferenceGroup::INVENTORY_WAREHOUSE,

            self::POS_SETUP,
            self::SALES_CHANNEL,
            self::IN_STEP_PRODUCT_MODAL,
            self::ALLOW_INVOICE_DELETE,
            self::AUTO_DELETE_EMPTY_PURCHASE_INVOICE,
            self::SELL_RETURN,
            self::QUOTATION,
            self::SHIFT_AND_CASH_HANDOVER,
            self::WORK_SLOTS,
            self::WAREHOUSE_BASE_DISCOUNT => FeaturePreferenceGroup::POS_SALES,

            self::SHOP_SETUP,
            self::STORE_TEMPLATE,
            self::STOREFRONT_HOME,
            self::SHOP_DOMAIN_SETUP,
            self::SHOP_CHAT_SUPPORT,
            self::SHOP_SEO_MARKETING,
            self::SHOP_DELIVERY_SUPPORT,
            self::SHOP_SMS_SUPPORT,
            self::SOCIAL_AUTH,
            self::PAYMENT_GATEWAY => FeaturePreferenceGroup::STOREFRONT_CHECKOUT,

            self::ORDER_MANAGEMENT,
            self::ORDER_TRACKING,
            self::CUSTOMER_RETURNS,
            self::REFUND_LOG,
            self::PAYOUT_REQUEST,
            self::CUSTOMER_WAITLIST,
            self::COURIER_OPS,
            self::SALE_INVOICES,
            self::PURCHASE_INVOICES => FeaturePreferenceGroup::ORDERS_CUSTOMER_SERVICE,

            self::EMAIL,
            self::REWARDS,
            self::DISCOUNT_SETUP,
            self::REFERRAL_SYSTEM,
            self::DEMAND_TAGS => FeaturePreferenceGroup::MARKETING_LOYALTY,

            self::TOP_SELLING_PRODUCT_REPORT,
            self::LOWEST_SELLING_PRODUCT_REPORT,
            self::REPORT_STOCK_SUMMARY,
            self::REPORT_DAILY_MONTHLY_SALES,
            self::REPORT_DAILY_MONTHLY_PURCHASE,
            self::REPORT_SUPPLIER,
            self::REPORT_STOCK_BY_CATEGORY,
            self::REPORT_SALE_BY_CATEGORY,
            self::REPORT_DUE_PAYMENTS,
            self::REPORT_PRODUCT_LEDGER,
            self::REPORT_TIMESHEET,
            self::REPORT_RETURN_VERIFICATION,
            self::REPORT_PROFIT_MARGIN,
            self::REPORT_STOCK_TRANSFER,
            self::REPORT_SELL_RETURN_LOG,
            self::REPORT_EXPIRE_PRODUCT,
            self::REPORT_ACCOUNTING,
            self::REPORT_AUDIT_LOGS => FeaturePreferenceGroup::REPORTS_INSIGHTS,
        };
    }

    public function toArray(): array
    {
        $group = $this->group();

        return [
            'is_core' => $this->isCore(),
            'code' => $this->value,
            'name' => $this->label(),
            'description' => $this->description(),
            'legacy_field' => $this->legacyField(),
            'default_active' => $this->defaultActive(),
            'group' => $group->value,
            'group_name' => $group->label(),
            'group_description' => $group->description(),
            'group_order' => $group->order(),
        ];
    }

    public static function options(): array
    {
        return array_map(
            static fn (self $preference) => $preference->toArray(),
            self::cases()
        );
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $preference) => $preference->value,
            self::cases()
        );
    }

    public function storedValues(): array
    {
        return match ($this) {
            self::EMAIL => ['ftr_email', 'EMAIL'],
            default => [$this->value],
        };
    }

    public static function normalizeStoredValue(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        foreach (self::cases() as $preference) {
            if (in_array($value, $preference->storedValues(), true)) {
                return $preference->value;
            }
        }

        return $value;
    }

    public static function storedValuesFor(string $code): array
    {
        foreach (self::cases() as $preference) {
            if ($preference->value === $code) {
                return $preference->storedValues();
            }
        }

        return [$code];
    }

    public static function defaultsForInsert(string $companyId): array
    {
        return array_map(function (self $preference) use ($companyId) {
            return [
                'company_id' => $companyId,
                'feature' => $preference->value,
                'active' => $preference->defaultActive(),
            ];
        }, self::cases());
    }
}

export interface NavRoute {
	id: string;
	label: string;
	icon: string;
	href: string;
}

export const navigationRoutes: NavRoute[] = [
	{ id: "dashboard", label: "Dashboard", icon: "/icons/user-dashboard/dashboard.svg", href: "/seller-dashboard" },
	{ id: "orders", label: "Orders", icon: "/icons/user-dashboard/order.svg", href: "/seller-dashboard/orders" },
	{ id: "products", label: "Products", icon: "/icons/seller-dashboard/products.svg", href: "/seller-dashboard/products" },
	{ id: "inventory", label: "Inventory", icon: "/icons/seller-dashboard/inventory.svg", href: "/seller-dashboard/inventory" },
	{ id: "customer", label: "Customer", icon: "/icons/seller-dashboard/customer.svg", href: "/seller-dashboard/customer" },
	{ id: "returns", label: "Returns", icon: "/icons/user-dashboard/order.svg", href: "/seller-dashboard/returns" },
	{ id: "reviews", label: "Reviews", icon: "/icons/seller-dashboard/reviews.svg", href: "/seller-dashboard/reviews" },
	{ id: "marketing", label: "Marketing", icon: "/icons/seller-dashboard/marketing.svg", href: "/seller-dashboard/marketing" },
	{ id: "newsletters", label: "Newsletters", icon: "/icons/seller-dashboard/message.svg", href: "/seller-dashboard/newsletters" },
	{ id: "message", label: "message", icon: "/icons/seller-dashboard/message2.svg", href: "/seller-dashboard/message" },
	{ id: "analytics", label: "Analytics", icon: "/icons/seller-dashboard/analytics.svg", href: "/seller-dashboard/analytics" },
	{ id: "finance", label: "Finance", icon: "/icons/seller-dashboard/finance.svg", href: "/seller-dashboard/finance" },
	{ id: "payouts", label: "Payouts", icon: "/icons/seller-dashboard/payouts.svg", href: "/seller-dashboard/payouts" },
	{ id: "referrals", label: "Referrals", icon: "/icons/seller-dashboard/customer.svg", href: "/seller-dashboard/referrals" },
	{ id: "setting", label: "Setting", icon: "/icons/seller-dashboard/setting.svg", href: "/seller-dashboard/setting" },
];

// ************ Dashboard page data ************ //
export interface StatCard {
	id: string;
	title: string;
	value: string;
	percentage: number;
	isPositive: boolean;
	icon: string;
	bgColor: string;
	iconColor: string;
}

export interface ChartData {
	[key: string]: {
		categories: string[];
		series: number[];
	};
}

export interface PerformanceMetric {
	label: string;
	value: string;
	color: string;
}

export const statCards: StatCard[] = [
	{
		id: "sales",
		title: "Today's Sales",
		value: "$8,234",
		percentage: 12.3,
		isPositive: true,
		icon: "/icons/seller-dashboard/dashboard/dollar.svg",
		bgColor: "bg-green-50",
		iconColor: "bg-green-100",
	},
	{
		id: "orders",
		title: "Orders Today",
		value: "28",
		percentage: 12.3,
		isPositive: true,
		icon: "/icons/seller-dashboard/dashboard/cart.svg",
		bgColor: "bg-blue-50",
		iconColor: "bg-blue-100",
	},
	{
		id: "pending",
		title: "Pending Orders",
		value: "17",
		percentage: -0.3,
		isPositive: false,
		icon: "/icons/seller-dashboard/dashboard/clock.svg",
		bgColor: "bg-orange-50",
		iconColor: "bg-orange-100",
	},
	{
		id: "wallet",
		title: "Wallet Balance",
		value: "$45,680",
		percentage: 12.3,
		isPositive: true,
		icon: "/icons/seller-dashboard/dashboard/wallet.svg",
		bgColor: "bg-purple-50",
		iconColor: "bg-purple-100",
	},
];

export const revenueTrendData: ChartData = {
	"last-1-day": {
		categories: ["00:00", "06:00", "12:00", "18:00", "24:00"],
		series: [4000, 5200, 6800, 7500, 8500],
	},
	"last-3-days": {
		categories: ["Day 1", "Day 2", "Day 3"],
		series: [5000, 7500, 8900],
	},
	"last-7-days": {
		categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
		series: [5000, 6000, 7200, 7800, 8500, 9200, 8800],
	},
};

export const orderTrendData: ChartData = {
	"last-1-day": {
		categories: ["Morning", "Afternoon", "Evening", "Night"],
		series: [8, 12, 15, 10],
	},
	"last-3-days": {
		categories: ["Day 1", "Day 2", "Day 3"],
		series: [12, 18, 22],
	},
	"last-7-days": {
		categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
		series: [12, 18, 15, 22, 20, 32, 28],
	},
};

export const performanceMetrics: PerformanceMetric[] = [
	{ label: "Order fulfillment", value: "98%", color: "#10B981" },
	{ label: "Response time", value: "2.3h", color: "#10B981" },
	{ label: "Customer rating", value: "4.8/5", color: "#10B981" },
];

export const timeframeOptions = [
	{ label: "Last 1 day", value: "last-1-day" },
	{ label: "Last 3 days", value: "last-3-days" },
	{ label: "Last 7 days", value: "last-7-days" },
];

export interface TopProduct {
	id: string;
	name: string;
	image: string;
	sales: number;
	revenue: number;
	stock: number;
}

export interface LowStockAlert {
	id: string;
	name: string;
	sku: string;
	stock: number;
	threshold: number;
}

export interface PendingReturn {
	id: string;
	orderId: string;
	customerName: string;
	productName: string;
	reason: string;
	timestamp: string;
	status: "pending";
}

export interface PendingMessage {
	id: string;
	customerId: string;
	customerName: string;
	customerInitials: string;
	message: string;
	timestamp: string;
	avatarColor: string;
}

export interface QuickAction {
	id: string;
	label: string;
	icon: string;
	bgColor: string;
	hoverColor: string;
}

export const topSellingProducts: TopProduct[] = [
	{
		id: "1",
		name: "Wireless Headphones Pro",
		image: "/images/seller-dashboard/dashboard/headphone.png",
		sales: 156,
		revenue: 23400,
		stock: 45,
	},
	{
		id: "2",
		name: "Smart Watch Series 5",
		image: "/images/seller-dashboard/dashboard/watch.png",
		sales: 143,
		revenue: 42900,
		stock: 23,
	},
	{
		id: "3",
		name: "Laptop Stand Aluminum",
		image: "/images/seller-dashboard/dashboard/laptop.png",
		sales: 128,
		revenue: 6400,
		stock: 67,
	},
	{
		id: "4",
		name: "USB-C Hub 7-in-1",
		image: "/images/seller-dashboard/dashboard/plug.png",
		sales: 98,
		revenue: 4900,
		stock: 12,
	},
	{
		id: "5",
		name: "Bluetooth Speaker Mini",
		image: "/images/seller-dashboard/dashboard/speaker.png",
		sales: 87,
		revenue: 2610,
		stock: 89,
	},
	{
		id: "6",
		name: "Mechanical Keyboard",
		image: "/images/seller-dashboard/dashboard/headphone.png",
		sales: 76,
		revenue: 3800,
		stock: 34,
	},
];

export const lowStockAlerts: LowStockAlert[] = [
	{
		id: "1",
		name: "Smart Watch Series 5",
		sku: "SW-5-BLK",
		stock: 23,
		threshold: 50,
	},
	{
		id: "2",
		name: "USB-C Hub 7-in-1",
		sku: "HUB-7-GRY",
		stock: 12,
		threshold: 30,
	},
	{
		id: "3",
		name: "Wireless Mouse Pro",
		sku: "MS-PRO-WHT",
		stock: 8,
		threshold: 25,
	},
	{
		id: "4",
		name: "Phone Charger Fast",
		sku: "CHRG-30W-BK",
		stock: 5,
		threshold: 20,
	},
	{
		id: "5",
		name: "Laptop Cooling Pad",
		sku: "COOL-PAD-SL",
		stock: 15,
		threshold: 40,
	},
];

export const pendingReturnRequests: PendingReturn[] = [
	{
		id: "1",
		orderId: "#12456",
		customerName: "Sarah Miller",
		productName: "Laptop Stand",
		reason: "Defective",
		timestamp: "2 hours ago",
		status: "pending",
	},
	{
		id: "2",
		orderId: "#12443",
		customerName: "Mike Johnson",
		productName: "Smart Watch",
		reason: "Wrong size",
		timestamp: "5 hours ago",
		status: "pending",
	},
	{
		id: "3",
		orderId: "#12398",
		customerName: "Emma Davis",
		productName: "Wireless Headphones",
		reason: "Not as described",
		timestamp: "1 day ago",
		status: "pending",
	},
	{
		id: "4",
		orderId: "#12287",
		customerName: "John Smith",
		productName: "USB Hub",
		reason: "Damaged during shipping",
		timestamp: "2 days ago",
		status: "pending",
	},
	{
		id: "5",
		orderId: "#12156",
		customerName: "Lisa Wang",
		productName: "Keyboard",
		reason: "Defective keys",
		timestamp: "3 days ago",
		status: "pending",
	},
];

export const pendingMessages: PendingMessage[] = [
	{
		id: "1",
		customerId: "cust-001",
		customerName: "Alex Martinez",
		customerInitials: "AM",
		message: "Is the Smart Watch waterproof?",
		timestamp: "15 minutes ago",
		avatarColor: "bg-blue-500",
	},
	{
		id: "2",
		customerId: "cust-002",
		customerName: "Lisa Chen",
		customerInitials: "LC",
		message: "When will my order ship?",
		timestamp: "1 hour ago",
		avatarColor: "bg-green-500",
	},
	{
		id: "3",
		customerId: "cust-003",
		customerName: "Robert Brown",
		customerInitials: "RB",
		message: "Can I get a bulk discount?",
		timestamp: "3 hours ago",
		avatarColor: "bg-orange-500",
	},
	{
		id: "4",
		customerId: "cust-004",
		customerName: "Sarah Johnson",
		customerInitials: "SJ",
		message: "Do you have this in black color?",
		timestamp: "5 hours ago",
		avatarColor: "bg-purple-500",
	},
	{
		id: "5",
		customerId: "cust-005",
		customerName: "Michael Park",
		customerInitials: "MP",
		message: "What is the return policy?",
		timestamp: "8 hours ago",
		avatarColor: "bg-pink-500",
	},
];

export const quickActions: QuickAction[] = [
	{
		id: "add-product",
		label: "Add Product",
		icon: "/icons/seller-dashboard/dashboard/plus.svg",
		bgColor: "bg-blue-50",
		hoverColor: "hover:bg-blue-100",
	},
	{
		id: "create-coupon",
		label: "Create Coupon",
		icon: "/icons/seller-dashboard/dashboard/coupon.svg",
		bgColor: "bg-purple-50",
		hoverColor: "hover:bg-purple-100",
	},
	{
		id: "go-live",
		label: "Go Live",
		icon: "/icons/seller-dashboard/dashboard/video.svg",
		bgColor: "bg-red-50",
		hoverColor: "hover:bg-red-100",
	},
	{
		id: "withdraw",
		label: "Withdraw",
		icon: "/icons/seller-dashboard/dashboard/wallet2.svg",
		bgColor: "bg-green-50",
		hoverColor: "hover:bg-green-100",
	},
];

// ********** Orders Page data *********** //
export type OrderStatus = "all" | "new" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";

export interface OrderData {
	id: string;
	trackingId: string;
	productName: string;
	productImage: string;
	type: string;
	addedDate: string;
	price: number;
	category: string;
	brand: string;
	stock: number;
	paymentMethod: string;
	paymentChannel: "cod" | "gateway";
	paymentStatus: "pending" | "paid" | "failed" | "refunded";
	couponCode?: string | null;
	couponDiscountAmount?: number;
	status: "new" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
}

export interface OrderStatusTab {
	id: OrderStatus;
	label: string;
	count: number;
}

export const ordersData: OrderData[] = [
	{
		id: "1",
		trackingId: "#20462",
		productName: "Hat",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "13/05/2022",
		price: 4.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Cash on Delivery",
		paymentChannel: "cod",
		paymentStatus: "pending",
		couponCode: "SAVE5",
		couponDiscountAmount: 5,
		status: "delivered",
	},
	{
		id: "2",
		trackingId: "#18933",
		productName: "Laptop",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "22/05/2022",
		price: 8.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Stripe",
		paymentChannel: "gateway",
		paymentStatus: "paid",
		couponCode: null,
		couponDiscountAmount: 0,
		status: "delivered",
	},
	{
		id: "3",
		trackingId: "#45169",
		productName: "Phone",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "15/06/2022",
		price: 1149.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Cash on Delivery",
		paymentChannel: "cod",
		paymentStatus: "pending",
		couponCode: "NIKE20",
		couponDiscountAmount: 20,
		status: "processing",
	},
	{
		id: "4",
		trackingId: "#34304",
		productName: "Bag",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "06/09/2022",
		price: 899.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "PayPal",
		paymentChannel: "gateway",
		paymentStatus: "paid",
		couponCode: null,
		couponDiscountAmount: 0,
		status: "processing",
	},
	{
		id: "5",
		trackingId: "#17188",
		productName: "Headset",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "25/09/2022",
		price: 22.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Cash on Delivery",
		paymentChannel: "cod",
		paymentStatus: "failed",
		couponCode: "WELCOME10",
		couponDiscountAmount: 10,
		status: "cancelled",
	},
	{
		id: "6",
		trackingId: "#73003",
		productName: "Mouse",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "04/10/2022",
		price: 54.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Stripe",
		paymentChannel: "gateway",
		paymentStatus: "paid",
		couponCode: null,
		couponDiscountAmount: 0,
		status: "delivered",
	},
	{
		id: "7",
		trackingId: "#58825",
		productName: "Clock",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "17/10/2022",
		price: 174.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Cash on Delivery",
		paymentChannel: "cod",
		paymentStatus: "pending",
		couponCode: null,
		couponDiscountAmount: 0,
		status: "delivered",
	},
	{
		id: "8",
		trackingId: "#44122",
		productName: "T-shirt",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "24/10/2022",
		price: 249.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "SSLCommerz",
		paymentChannel: "gateway",
		paymentStatus: "paid",
		couponCode: "STYLE15",
		couponDiscountAmount: 15,
		status: "delivered",
	},
	{
		id: "9",
		trackingId: "#92847",
		productName: "Shoes",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "05/11/2022",
		price: 99.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Cash on Delivery",
		paymentChannel: "cod",
		paymentStatus: "pending",
		couponCode: null,
		couponDiscountAmount: 0,
		status: "shipped",
	},
	{
		id: "10",
		trackingId: "#65412",
		productName: "Watch",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "10/11/2022",
		price: 199.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Stripe",
		paymentChannel: "gateway",
		paymentStatus: "paid",
		couponCode: "WATCH25",
		couponDiscountAmount: 25,
		status: "new",
	},
	{
		id: "11",
		trackingId: "#38756",
		productName: "Wallet",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "15/11/2022",
		price: 39.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "PayPal",
		paymentChannel: "gateway",
		paymentStatus: "refunded",
		couponCode: null,
		couponDiscountAmount: 0,
		status: "returned",
	},
	{
		id: "12",
		trackingId: "#21594",
		productName: "Belt",
		productImage: "/images/seller-dashboard/orders/1.webp",
		type: "Simple",
		addedDate: "20/11/2022",
		price: 29.95,
		category: "N/A",
		brand: "Nokia",
		stock: 10,
		paymentMethod: "Cash on Delivery",
		paymentChannel: "cod",
		paymentStatus: "pending",
		couponCode: "BELT8",
		couponDiscountAmount: 8,
		status: "shipped",
	},
];

export const orderStatusTabs: OrderStatusTab[] = [
	{ id: "all", label: "All", count: 12 },
	{ id: "new", label: "New", count: 1 },
	{ id: "processing", label: "Processing", count: 2 },
	{ id: "shipped", label: "Shipped", count: 2 },
	{ id: "delivered", label: "Delivered", count: 4 },
	{ id: "cancelled", label: "Cancelled", count: 1 },
	{ id: "returned", label: "Returned", count: 1 },
];

export const resultsPerPageOptions = [5, 10, 15, 20];

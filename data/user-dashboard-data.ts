export interface NavRoute {
	id: string;
	label: string;
	icon: string;
	href: string;
}

export interface DashboardCard {
	id: string;
	title: string;
	value: string | number;
	description: string;
	iconColor: string;
	icon: string;
}

export interface OrderTrackingStep {
	id: number;
	label: string;
	completed: boolean;
}

export interface CurrentOrder {
	orderId: string;
	estimatedDelivery: string;
	steps: OrderTrackingStep[];
}

export const userInfo = {
	name: "Harmione Granger",
	image: "/images/user-dashboard/user.png",
};

export const navigationRoutes: NavRoute[] = [
	{ id: "dashboard", label: "Dashboard", icon: "/icons/user-dashboard/dashboard.svg", href: "/user-dashboard" },
	{ id: "orders", label: "Orders", icon: "/icons/user-dashboard/order.svg", href: "/user-dashboard/orders" },
	{ id: "wishlist", label: "Wishlist", icon: "/icons/user-dashboard/wishlist.svg", href: "/user-dashboard/wishlist" },
	{ id: "compare", label: "Compare", icon: "/icons/user-dashboard/compare.svg", href: "/user-dashboard/compare" },
	{ id: "rewards", label: "Rewards", icon: "/icons/user-dashboard/award.svg", href: "/user-dashboard/rewards" },
	{ id: "payouts", label: "Payouts", icon: "/icons/user-dashboard/award.svg", href: "/user-dashboard/payouts" },
	{ id: "group", label: "Group Purchase", icon: "/icons/user-dashboard/group.svg", href: "/user-dashboard/group" },
	{ id: "tracking", label: "Tracking", icon: "/icons/user-dashboard/tracking.svg", href: "/user-dashboard/tracking" },
	{ id: "settings", label: "Profile & Settings", icon: "/icons/user-dashboard/profile.svg", href: "/user-dashboard/settings/personal" },
];

export const dashboardCards: DashboardCard[] = [
	{
		id: "active-orders",
		title: "Active Orders",
		value: 8,
		description: "Currently processing",
		iconColor: "bg-blue-100",
		icon: "/icons/user-dashboard/dashboard/box.svg",
	},
	{
		id: "wishlist",
		title: "Wishlist",
		value: 12,
		description: "In your wishlist",
		iconColor: "bg-red-100",
		icon: "/icons/user-dashboard/dashboard/heart.svg",
	},
	{
		id: "reward-points",
		title: "Reward Points",
		value: "2,450",
		description: "Gold tier member",
		iconColor: "bg-orange-100",
		icon: "/icons/user-dashboard/dashboard/award.svg",
	},
	{
		id: "coupons",
		title: "Available Coupons",
		value: 5,
		description: "Ready to use",
		iconColor: "bg-green-100",
		icon: "/icons/user-dashboard/dashboard/tag.svg",
	},
];

export const currentOrder: CurrentOrder = {
	orderId: "ORD-2024-001",
	estimatedDelivery: "Feb 15, 2024",
	steps: [
		{ id: 1, label: "Order Placed", completed: true },
		{ id: 2, label: "Processing", completed: true },
		{ id: 3, label: "Shipped", completed: true },
		{ id: 4, label: "Out for Delivery", completed: false },
		{ id: 5, label: "Delivered", completed: false },
	],
};

// Orders tab data
export interface OrderItem {
	id: string;
	name: string;
	image: string;
	quantity: number;
	price: number;
	taxRate?: number;
	taxAmount?: number;
	lineTotal?: number;
	brandName?: string;
	categoryName?: string;
	slug?: string;
	productId?: string;
	review?: {
		id: string;
		rating: number;
		comment?: string | null;
		createdAt?: string | null;
	} | null;
	return_info?: {
		return_enabled: boolean;
		return_day?: number | null;
		return_condition?: string[];
		can_request_return: boolean;
		message?: string;
		expires_at?: string | null;
		request?: {
			id: string;
			status: string;
			reason: string;
			refund_amount: number;
			rejection_reason?: string | null;
			requested_at?: string | null;
			resolved_at?: string | null;
		} | null;
	};
}

export interface OrderTrackingData {
	id: number;
	label: string;
	completed: boolean;
	current?: boolean;
}

export interface OrderShippingData {
	id?: string;
	fullName: string;
	email?: string | null;
	phone: string;
	address: string;
	divisionName?: string | null;
	districtName?: string | null;
	upazilaName?: string | null;
	city: string;
	country: string;
	postalCode?: string | null;
}

export interface OrderSellerData {
	name: string;
	contactName: string;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
}

export interface OrderGroupPurchaseData {
	id: string;
	status: string;
	purchaseStatus: string;
	discountedPrice: number;
	purchaseDeadlineAt?: string | null;
	discountUnlockedAt?: string | null;
}

export interface Order {
	id: string;
	orderId: string;
	date: string;
	total: number;
	status: string;
	statusLabel?: string;
	paymentMethod?: string;
	paymentStatus?: string;
	subtotal?: number;
	taxAmount?: number;
	shippingAmount?: number;
	couponCode?: string | null;
	couponDiscountAmount?: number;
	placedAt?: string;
	estimatedDelivery?: string | null;
	trackingNote?: string;
	trackingSteps?: OrderTrackingData[];
	shipping?: OrderShippingData | null;
	seller?: OrderSellerData | null;
	groupDiscountAmount?: number;
	groupPurchaseDiscountStatus?: string;
	groupPurchase?: OrderGroupPurchaseData | null;
	items: OrderItem[];
}

export const orders: Order[] = [
	{
		id: "1",
		orderId: "ORD-2024-001",
		date: "Feb 10, 2024",
		total: 249.99,
		status: "shipped",
		items: [
			{
				id: "item-1",
				name: "Premium Wireless Headphones",
				image: "/images/home/bestsell/1.png",
				quantity: 1,
				price: 249.99,
			},
		],
	},
	{
		id: "2",
		orderId: "ORD-2024-001",
		date: "Feb 10, 2024",
		total: 499.98,
		status: "delivered",
		items: [
			{
				id: "item-1",
				name: 'Professional Laptop 15.6"',
				image: "/images/home/bestsell/1.png",
				quantity: 1,
				price: 249.99,
			},
			{
				id: "item-2",
				name: "Travel Backpack 40L",
				image: "/images/home/bestsell/1.png",
				quantity: 1,
				price: 249.99,
			},
		],
	},
	{
		id: "3",
		orderId: "ORD-2024-002",
		date: "Feb 08, 2024",
		total: 149.99,
		status: "active",
		items: [
			{
				id: "item-1",
				name: "Wireless Mouse Pro",
				image: "/images/home/bestsell/1.png",
				quantity: 1,
				price: 149.99,
			},
		],
	},
	{
		id: "4",
		orderId: "ORD-2024-003",
		date: "Feb 05, 2024",
		total: 99.99,
		status: "cancelled",
		items: [
			{
				id: "item-1",
				name: "USB-C Cable (2m)",
				image: "/images/home/bestsell/1.png",
				quantity: 1,
				price: 99.99,
			},
		],
	},
	{
		id: "5",
		orderId: "ORD-2024-004",
		date: "Jan 28, 2024",
		total: 199.99,
		status: "returned",
		items: [
			{
				id: "item-1",
				name: "Portable SSD 1TB",
				image: "/images/home/bestsell/1.png",
				quantity: 1,
				price: 199.99,
			},
		],
	},
];

export const orderFilters = [
	{ id: "all", label: "All Orders", count: 5 },
	{ id: "active", label: "Active", count: 1 },
	{ id: "delivered", label: "Delivered", count: 1 },
	{ id: "cancelled", label: "Cancelled", count: 1 },
	{ id: "returned", label: "Returned", count: 1 },
];

// settings tab data
export interface SettingsMenuItem {
	id: string;
	label: string;
	icon: string;
	route: string;
}

export interface PersonalInfoData {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	language: string;
	avatar: string;
}

export const settingsMenuItems: SettingsMenuItem[] = [
	{ id: "personal", label: "Personal Info", icon: "/icons/user-dashboard/profile.svg", route: "personal" },
	{ id: "addresses", label: "Shipping Address", icon: "/icons/user-dashboard/address.svg", route: "addresses" },
	{ id: "privacy", label: "Change Password", icon: "/icons/user-dashboard/shield.svg", route: "privacy" },
];

export const personalInfoData: PersonalInfoData = {
	firstName: "John",
	lastName: "Doe",
	email: "johndoe@gmail.com",
	phone: "+880123456789",
	language: "English",
	avatar: "",
};

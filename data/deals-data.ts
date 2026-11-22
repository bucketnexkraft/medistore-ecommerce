export interface DealFilter {
	id: string;
	label: string;
	category: "conditionType" | "expiryWindow" | "discountRange" | "category";
}

export interface DealsProduct {
	id: number;
	title: string;
	image: string;
	conditionType: string;
	discount: number;
	bestBefore: string;
	daysLeft: number;
	price: number;
	originalPrice: number;
	stockLeft: number;
	storeName: string;
	category: string;
}

export const filterOptions: DealFilter[] = [
	// Condition Type
	{ id: "near-expiry", label: "Near Expiry", category: "conditionType" },
	{ id: "damaged-package", label: "Damaged Package", category: "conditionType" },
	{ id: "open-box", label: "Open Box", category: "conditionType" },
	{ id: "overstock", label: "Overstock", category: "conditionType" },
	{ id: "last-pieces", label: "Last Pieces", category: "conditionType" },

	// Expiry Window
	{ id: "expiry-7days", label: "7 days", category: "expiryWindow" },
	{ id: "expiry-15days", label: "15 days", category: "expiryWindow" },
	{ id: "expiry-30days", label: "30 days", category: "expiryWindow" },
	{ id: "expiry-60days", label: "60+ days", category: "expiryWindow" },

	// Discount Range
	{ id: "discount-10-25", label: "10-25%", category: "discountRange" },
	{ id: "discount-25-50", label: "25-50%", category: "discountRange" },
	{ id: "discount-50-70", label: "50-70%", category: "discountRange" },
	{ id: "discount-70", label: "70%+", category: "discountRange" },

	// Category
	{ id: "cat-food", label: "Food & Beverage", category: "category" },
	{ id: "cat-electronics", label: "Electronics", category: "category" },
	{ id: "cat-beauty", label: "Beauty & Personal Care", category: "category" },
	{ id: "cat-sports", label: "Sports & Outdoors", category: "category" },
	{ id: "cat-health", label: "Health & Wellness", category: "category" },
	{ id: "cat-home", label: "Home & Kitchen", category: "category" },
	{ id: "cat-travel", label: "Travel & Luggage", category: "category" },
];

export const dealsProducts: DealsProduct[] = [
	{
		id: 1,
		title: "Organic Granola Cereal Mix",
		image: "/images/deals/cardImg.webp",
		conditionType: "near-expiry",
		discount: 48,
		bestBefore: "Feb 28, 2026",
		daysLeft: 12,
		price: 12.99,
		originalPrice: 24.99,
		stockLeft: 23,
		storeName: "Organic Valley Store",
		category: "cat-food",
	},
	{
		id: 2,
		title: "Organic Granola Cereal Mix",
		image: "/images/deals/cardImg.webp",
		conditionType: "open-box",
		discount: 38,
		bestBefore: "Feb 28, 2026",
		daysLeft: 14,
		price: 12.99,
		originalPrice: 24.99,
		stockLeft: 23,
		storeName: "Organic Valley Store",
		category: "cat-food",
	},
	{
		id: 3,
		title: "Organic Granola Cereal Mix",
		image: "/images/deals/cardImg.webp",
		conditionType: "overstock",
		discount: 28,
		bestBefore: "Feb 28, 2026",
		daysLeft: 10,
		price: 12.99,
		originalPrice: 24.99,
		stockLeft: 23,
		storeName: "Organic Valley Store",
		category: "cat-food",
	},
	{
		id: 4,
		title: "Organic Granola Cereal Mix",
		image: "/images/deals/cardImg.webp",
		conditionType: "last-pieces",
		discount: 18,
		bestBefore: "Feb 28, 2026",
		daysLeft: 18,
		price: 12.99,
		originalPrice: 24.99,
		stockLeft: 23,
		storeName: "Organic Valley Store",
		category: "cat-food",
	},
	{
		id: 5,
		title: "Organic Granola Cereal Mix",
		image: "/images/deals/cardImg.webp",
		conditionType: "near-expiry",
		discount: 24,
		bestBefore: "Feb 28, 2026",
		daysLeft: 22,
		price: 12.99,
		originalPrice: 24.99,
		stockLeft: 23,
		storeName: "Organic Valley Store",
		category: "cat-food",
	},
	{
		id: 6,
		title: "Organic Granola Cereal Mix",
		image: "/images/deals/cardImg.webp",
		conditionType: "overstock",
		discount: 48,
		bestBefore: "Feb 28, 2026",
		daysLeft: 12,
		price: 12.99,
		originalPrice: 24.99,
		stockLeft: 23,
		storeName: "Organic Valley Store",
		category: "cat-food",
	},
];

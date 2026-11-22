// ********* checkout one data *********** //

export interface CheckoutProduct {
	id: string;
	name: string;
	sku: string;
	image: string;
	variants: string[];
	price: number;
	quantity: number;
}

export interface ShippingFormData {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	address: string;
	city: string;
	country: string;
	postalCode: string;
}

export interface CheckoutDeliverySelection {
	divisionId: string;
	divisionName: string;
	districtId: string;
	districtName: string;
	upazilaId: string;
	upazilaName: string;
	label: string;
	charge: number | null;
	codAvailable: boolean;
}

export interface CreditCardData {
	cardNumber: string;
	nameOnCard: string;
	expiryDate: string;
	securityCode: string;
}

export interface CheckoutGateway {
	id: string;
	name: string;
	gateway_type: string;
	image_url: string | null;
	currency_code: string;
	description?: string | null;
	status?: string | number | null;
	is_active?: boolean | number | null;
	active?: boolean | number | null;
	enabled?: boolean | number | null;
}

export interface BillingData {
	paymentMethod: "cod" | "gateway";
	gatewayId?: string | null;
	creditCard?: CreditCardData;
}

export interface SavedShippingAddress {
	id: string;
	full_name: string;
	email?: string | null;
	phone: string;
	address: string;
	city: string;
	country: string;
	postal_code?: string | null;
	is_default: boolean;
}

export const checkoutProducts: CheckoutProduct[] = [
	{
		id: "1",
		name: "Rockerz 425 spatial audio headphone",
		sku: "1546546514",
		image: "/images/checkout/1.png",
		variants: ["Standard Edition", "Wireless", "Black & Red"],
		price: 2500,
		quantity: 1,
	},
	{
		id: "2",
		name: "Maurice Lasroix Automatic TM15",
		sku: "1516514",
		image: "/images/checkout/2.jpg",
		variants: ["Standard Edition", "Leather", "White & Brown"],
		price: 3700,
		quantity: 1,
	},
];

export const shippingCost = 100;
export const vatPercentage = 0;
export const discountCoupon = "Save20";
export const discountPercentage = 20;

// ************ checkout two data ************ //
export interface SavedAddress {
	id: string;
	label: string;
	street: string;
	city: string;
	country: string;
}

export interface SavedBillingMethod {
	id: string;
	label: string;
	cardNumber: string;
	expiryDate: string;
	type: "credit-card" | "paypal" | "debit-card";
}

export const savedAddresses: SavedAddress[] = [
	{
		id: "1",
		label: "Shipping Address 1",
		street: "Aflabnagar, Block A, Road 1, House 37",
		city: "Dhaka, Bangladesh",
		country: "Bangladesh",
	},
	{
		id: "2",
		label: "Shipping Address 2",
		street: "Aflabnagar, Block A, Road 1, House 37",
		city: "Dhaka, Bangladesh",
		country: "Bangladesh",
	},
	{
		id: "3",
		label: "Shipping Address 3",
		street: "Aflabnagar, Block A, Road 1, House 37",
		city: "Dhaka, Bangladesh",
		country: "Bangladesh",
	},
];

export const savedBillingMethods: SavedBillingMethod[] = [
	{
		id: "1",
		label: "Billing Address 1",
		cardNumber: "Acc 18**********14",
		expiryDate: "8/30",
		type: "credit-card",
	},
	{
		id: "2",
		label: "Billing Address 1",
		cardNumber: "Acc 18**********14",
		expiryDate: "8/30",
		type: "credit-card",
	},
];

export type ShippingAddressRecord = {
	id: string;
	full_name: string;
	email?: string | null;
	phone: string;
	address: string;
	city: string;
	country: string;
	postal_code?: string | null;
	is_default: boolean;
};

export type ShippingAddressFormState = {
	fullName: string;
	email: string;
	phone: string;
	address: string;
	city: string;
	country: string;
	postalCode: string;
	isDefault: boolean;
};

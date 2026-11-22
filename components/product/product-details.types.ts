export type RelatedProduct = {
	id: string;
	name: string;
	slug: string;
	thumbnail: string;
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	quantity: number;
	brand: string;
	category: {
		name: string;
		slug: string;
	} | null;
	url: string;
};

export type ProductReviewItem = {
	id: string;
	rating: number;
	comment: string;
	created_at: string | null;
	reviewer: string;
};

export type ProductDetailsData = {
	id: string;
	name: string;
	slug: string;
	code: string | null;
	thumbnail: string;
	featured_image: string;
	images: string[];
	gallery: string[];
	category: {
		id: string;
		name: string;
		slug: string;
	} | null;
	brand: {
		id: string;
		name: string;
		slug: string;
	} | null;
	unit: {
		id: string;
		name: string;
		code: string;
	} | null;
	price: number;
	original_price?: number | null;
	discount_percent?: number;
	description: string;
	return_enabled: boolean;
	return_day: number | null;
	return_condition: string[];
	is_featured: boolean;
	demand_tags: string[];
	sales_channel: Record<string, number>;
	vat: number;
	has_variant: boolean;
	variants: Array<Record<string, string>>;
	variants_display: string[];
	available_quantity: number;
	raw_total_quantity: number;
	combinations?: Array<{
		id: string | number;
		combination: Record<string, string>;
		quantity?: number;
		price?: number | null;
	}>;
	stock_visibility: boolean;
	stock_visibility_label: string | null;
	stock_display: {
		stock_visibility: boolean;
		stock_visibility_label: string | null;
		stock_quantity: number | null;
		stock_display: string | null;
	};
	is_group_purchase_available: boolean;
	group_purchase_discount_type: "fixed" | "percent" | null;
	group_purchase_minimum_user: number | null;
	group_purchase_discount_amount: number | null;
	reviews_count: number;
	average_rating: number;
	reviews: ProductReviewItem[];
	related_products: RelatedProduct[];
};

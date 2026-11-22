export interface LuminexProduct {
	id: string;
	title: string;
	price: number;
	originalPrice: number;
	discount: number;
	image: string;
	rating: number;
	reviewCount: number;
	features: string[];
	description: string;
	link: string;
}

export const luminexProducts: LuminexProduct[] = [
	{
		id: "1",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro1.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
	{
		id: "2",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro2.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
	{
		id: "3",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro3.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
	{
		id: "4",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro4.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
	{
		id: "5",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro5.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
	{
		id: "6",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro6.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
	{
		id: "7",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro1.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
	{
		id: "8",
		title: "Premium Wireless Noise-Cancelling Headphones",
		price: 249.99,
		originalPrice: 349.99,
		discount: 70,
		image: "/images/luminex/pro1.jpg",
		rating: 4,
		reviewCount: 21,
		features: ["40hr Battery", "ANC", "Hi-Res Audio"],
		description: "Perfect for your daily commute with excellent noise cancellation",
		link: "/product/rockerz-425",
	},
];

export const bagItems = [
	{
		id: "1",
		title: "Rockerz 425 spatial audio",
		price: 59.4,
		image: "/images/luminex/pro1.jpg",
	},
	{
		id: "2",
		title: "Nikon D750 FX",
		price: 59.4,
		image: "/images/luminex/pro1.jpg",
	},
];

export const categoryTags = ["Electronics", "Fashion", "Home & Living", "Jewelry & Watches", "Kids & Toys"];

export const aiQuestions = ["What are the best headphones?", "Show me wireless speakers", "Budget phone options", "Latest smartwatches"];

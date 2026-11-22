export interface ProductDetail {
	description: string;
	quality: string;
}

export interface Product {
	id: number;
	name: string;
	category: string;
	slug: string;
	price: number;
	originalPrice: number;
	image: string;
	bgImage: string;
	badge: string;
	rating: number;
	reviews: number;
	details: ProductDetail;
}

export const products: Product[] = [
	{
		id: 1,
		name: "Rockerz 425",
		category: "True wireless earbuds",
		slug: "rockerz-425",
		price: 59.4,
		originalPrice: 99.0,
		image: "/images/home/bestsell/1.png",
		bgImage: "/images/home/bestsell/p-bg.webp",
		badge: "60 hours playback",
		rating: 4.8,
		reviews: 21,
		details: {
			description: "Premium wireless headphones with active noise cancellation and immersive sound quality. Perfect for music lovers and professionals.",
			quality: "Premium Quality - IPX4 Water Resistant",
		},
	},
	{
		id: 2,
		name: "SoundMax Pro",
		category: "Speakers",
		slug: "soundmax-pro",
		price: 89.99,
		originalPrice: 149.99,
		image: "/images/home/bestsell/1.png",
		bgImage: "/images/home/bestsell/p-bg.webp",
		badge: "40W Power",
		rating: 4.6,
		reviews: 24,
		details: {
			description: "High-performance wireless speaker with 360-degree sound and deep bass. Great for parties and outdoor events.",
			quality: "Premium Quality - Bluetooth 5.0",
		},
	},
	{
		id: 3,
		name: "SmartWatch Elite",
		category: "Smartwatches",
		slug: "smartwatch-elite",
		price: 199.99,
		originalPrice: 299.99,
		image: "/images/home/bestsell/1.png",
		bgImage: "/images/home/bestsell/p-bg.webp",
		badge: "14 days battery",
		rating: 4.7,
		reviews: 31,
		details: {
			description: "Advanced fitness tracking smartwatch with heart rate monitor and sleep tracking. Stay connected all day.",
			quality: "Premium Quality - AMOLED Display",
		},
	},
	{
		id: 4,
		name: "NeckBand Wireless",
		category: "Neckbands",
		slug: "neckband-wireless",
		price: 45.5,
		originalPrice: 79.99,
		image: "/images/home/bestsell/1.png",
		bgImage: "/images/home/bestsell/p-bg.webp",
		badge: "25 hours battery",
		rating: 4.5,
		reviews: 55,
		details: {
			description: "Lightweight neckband earphones with flexible design for all-day comfort and crystal clear sound.",
			quality: "Standard Quality - Sweat Resistant",
		},
	},
	{
		id: 5,
		name: "Watch Classic",
		category: "Watch",
		slug: "watch-classic",
		price: 129.99,
		originalPrice: 199.99,
		image: "/images/home/bestsell/1.png",
		bgImage: "/images/home/bestsell/p-bg.webp",
		badge: "7 days battery",
		rating: 4.4,
		reviews: 18,
		details: {
			description: "Elegant analog-digital hybrid watch with health monitoring features and premium materials.",
			quality: "Premium Quality - Stainless Steel",
		},
	},
	{
		id: 6,
		name: "BassXL Earbuds",
		category: "True wireless earbuds",
		slug: "bassxl-earbuds",
		price: 74.99,
		originalPrice: 129.99,
		image: "/images/home/bestsell/1.png",
		bgImage: "/images/home/bestsell/p-bg.webp",
		badge: "36 hours battery",
		rating: 4.9,
		reviews: 33,
		details: {
			description: "Premium true wireless earbuds with enhanced bass and noise isolation technology.",
			quality: "Premium Quality - Active Noise Cancellation",
		},
	},
];

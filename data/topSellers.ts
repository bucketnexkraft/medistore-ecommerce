export interface TopSeller {
	id: number;
	name: string;
	slug: string;
	logo: string;
	rating: number;
	reviews: number;
	description: string;
	location: string;
	isVerified: boolean;
	isTopSeller: boolean;
	responseTime: string;
	fulfillmentRate: string;
	totalReviews: number;
}

export const topSellers: TopSeller[] = [
	{
		id: 1,
		name: "Compact Disk",
		slug: "compact-disk",
		logo: "/images/home/topseller/1.png",
		rating: 5,
		reviews: 21,
		description: "Curated sound solutions designed for clear audio, deep bass and comfort.",
		location: "Dhaka, Bangladesh",
		isVerified: true,
		isTopSeller: true,
		responseTime: "Typically responds within 2 hours",
		fulfillmentRate: "98% order fulfillment rate",
		totalReviews: 1240,
	},
	{
		id: 2,
		name: "LM",
		slug: "lm",
		logo: "/images/home/topseller/2.png",
		rating: 5,
		reviews: 21,
		description: "Premium audio equipment and accessories for music enthusiasts.",
		location: "New York, USA",
		isVerified: true,
		isTopSeller: true,
		responseTime: "Typically responds within 4 hours",
		fulfillmentRate: "97% order fulfillment rate",
		totalReviews: 1180,
	},
	{
		id: 3,
		name: "LADSPA",
		slug: "ladspa",
		logo: "/images/home/topseller/3.png",
		rating: 5,
		reviews: 21,
		description: "Electronics and gadgets with the best prices and quality assurance.",
		location: "London, UK",
		isVerified: true,
		isTopSeller: true,
		responseTime: "Typically responds within 3 hours",
		fulfillmentRate: "99% order fulfillment rate",
		totalReviews: 1560,
	},
	{
		id: 4,
		name: "VST Electronics",
		slug: "vst-electronics",
		logo: "/images/home/topseller/4.png",
		rating: 5,
		reviews: 21,
		description: "Your trusted partner for quality electronics and tech gadgets.",
		location: "Tokyo, Japan",
		isVerified: true,
		isTopSeller: true,
		responseTime: "Typically responds within 1 hour",
		fulfillmentRate: "100% order fulfillment rate",
		totalReviews: 2340,
	},
	{
		id: 5,
		name: "Sass Fashion",
		slug: "sass-fashion",
		logo: "/images/home/topseller/5.png",
		rating: 5,
		reviews: 21,
		description: "Fashion-forward electronics and accessories for the modern lifestyle.",
		location: "Paris, France",
		isVerified: true,
		isTopSeller: true,
		responseTime: "Typically responds within 6 hours",
		fulfillmentRate: "96% order fulfillment rate",
		totalReviews: 890,
	},
];

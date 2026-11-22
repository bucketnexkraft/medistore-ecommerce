export interface OnSaleProduct {
	id: number;
	name: string;
	mainImage: string;
	secondaryImage: string;
	price: number;
	savings: number;
}

export const onSaleProducts: OnSaleProduct[] = [
	{
		id: 1,
		name: "Fantech WH01 Stereo Bluetooth Wireless Gaming Headphone",
		mainImage: "/images/home/onsale/1.webp",
		secondaryImage: "/images/home/onsale/22.png",
		price: 59.4,
		savings: 60,
	},
	{
		id: 2,
		name: "Fantech WH01 Stereo Bluetooth Wireless Gaming Headphone",
		mainImage: "/images/home/onsale/2.webp",
		secondaryImage: "/images/home/onsale/22.png",
		price: 59.4,
		savings: 40,
	},
	{
		id: 3,
		name: "Fantech WH01 Stereo Bluetooth Wireless Gaming Headphone",
		mainImage: "/images/home/onsale/3.webp",
		secondaryImage: "/images/home/onsale/22.png",
		price: 59.4,
		savings: 20,
	},
];

type NavMenuItem = {
	label: string;
	href: string;
	icon?: string;
	isButton?: boolean;
	isHighlighted?: boolean;
};

type Currency = {
	label: string;
	value: string;
};

type Language = {
	label: string;
	value: string;
	flag: string;
};

type SocialLink = {
	label: string;
	href: string;
	icon: string;
};

type HeaderAction = {
	label: string;
	href: string;
	icon: string;
	icon2?: string;
	showLabel?: boolean;
};

export const navMenuItems: NavMenuItem[] = [
	{
		label: "All categories",
		href: "",
		icon: "/images/header/ham.png",
		isButton: true,
	},
	{
		label: "Products",
		href: "/products",
	},
	{
		label: "Limited Sale",
		href: "/limited-sale",
	},
	{
		label: "Best Seller",
		href: "/best-seller",
	},
	{
		label: "New Arrival",
		href: "/new-arrival",
	},
	{
		label: "Group Purchase",
		href: "/group-purchase",
	},
	{
		label: "Limited Time Offers",
		href: "/deals",
		icon: "/images/header/fire.svg",
		isHighlighted: true,
	},
];

export const currencies: Currency[] = [
	{ label: "BDT (৳)", value: "bdt" },
	{ label: "USD ($)", value: "usd" },
	{ label: "EUR (€)", value: "eur" },
	{ label: "GBP (£)", value: "gbp" },
];

export const languages: Language[] = [
	{ label: "Eng", value: "en", flag: "/images/header/en.svg" },
	{ label: "বাং", value: "bn", flag: "/images/header/flag-bd.svg" },
];

export const socialLinks: SocialLink[] = [
	{
		label: "Facebook",
		href: "https://facebook.com",
		icon: "/icons/social/fb.svg",
	},
	{
		label: "Instagram",
		href: "https://instagram.com",
		icon: "/icons/social/ins.svg",
	},
	{
		label: "X (Twitter)",
		href: "https://x.com",
		icon: "/icons/social/x.svg",
	},
	{
		label: "LinkedIn",
		href: "https://linkedin.com",
		icon: "/icons/social/linkedin.svg",
	},
	{
		label: "YouTube",
		href: "https://youtube.com",
		icon: "/icons/social/youtube.svg",
	},
];

export const headerActions: HeaderAction[] = [
	{
		label: "Wishlist",
		href: "/wishlist",
		icon: "/images/header/heart-rounded.svg",
		icon2: "/images/header/heart-rounded-fill.svg",
	},
	{
		label: "Cart",
		href: "/cart",
		icon: "/images/header/shopping-bag.svg",
	},
	{
		label: "Account",
		href: "/signin",
		icon: "/images/header/profile.svg",
		showLabel: true,
	},
];

// ********* Mega menu data ********* //
export interface MegaMenuProduct {
	id: string;
	name: string;
	image: string;
	link: string;
}

export interface Category {
	id: string;
	label: string;
	icon: string;
	products: MegaMenuProduct[];
}

const productImage = "/images/header/floral-purse.png";
const productLink = "/product/rockerz-425";

export const megaMenuCategories: Category[] = [
	{
		id: "women-clothing",
		label: "Women Clothing and Fashion",
		icon: "/images/header/all-categories/dress.svg",
		products: Array.from({ length: 10 }, (_, i) => ({
			id: `women-${i + 1}`,
			name: "Floral Purse",
			image: productImage,
			link: productLink,
		})),
	},
	{
		id: "men-clothing",
		label: "Men Clothing and Fashion",
		icon: "/images/header/all-categories/tie.svg",
		products: [
			{ id: "men-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "men-2", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "men-3", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "computer-accessories",
		label: "Computer & Accessories",
		icon: "/images/header/all-categories/laptop.svg",
		products: [
			{ id: "comp-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "comp-2", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "automobile-motor",
		label: "Automobile & Motor",
		icon: "/images/header/all-categories/wheel.svg",
		products: [
			{ id: "auto-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "auto-2", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "auto-3", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "auto-4", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "kids-toys",
		label: "Kids & Toys",
		icon: "/images/header/all-categories/bear.svg",
		products: [
			{ id: "kids-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "kids-2", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "sports-outdoor",
		label: "Sports & outdoor",
		icon: "/images/header/all-categories/sport.svg",
		products: [
			{ id: "sports-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "sports-2", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "sports-3", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "jewelry-watches",
		label: "Jewelry & Watches",
		icon: "/images/header/all-categories/watch.svg",
		products: [
			{ id: "jewelry-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "jewelry-2", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "jewelry-3", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "jewelry-4", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "cellphone-tabs",
		label: "Cellphone & Tabs",
		icon: "/images/header/all-categories/mobile.svg",
		products: [
			{ id: "cell-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "cell-2", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "cell-3", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "beauty-health-hair",
		label: "Beauty, Health & hair",
		icon: "/images/header/all-categories/beauty.svg",
		products: [
			{ id: "beauty-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "beauty-2", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
	{
		id: "home-tools",
		label: "Home Tools",
		icon: "/images/header/all-categories/tools.svg",
		products: [
			{ id: "home-1", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "home-2", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "home-3", name: "Floral Purse", image: productImage, link: productLink },
			{ id: "home-4", name: "Floral Purse", image: productImage, link: productLink },
		],
	},
];

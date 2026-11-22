// data/categories.ts
export interface Category {
	id: number;
	name: string;
	image: string;
}

export const categories: Category[] = [
	{
		id: 1,
		name: "Women Fashion & Lifestyle",
		image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=300&h=300&fit=crop",
	},
	{
		id: 2,
		name: "Mobile & Tabs",
		image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=300&fit=crop",
	},
	{
		id: 3,
		name: "Computer & Accessories",
		image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=300&h=300&fit=crop",
	},
	{
		id: 4,
		name: "Kids & Toys",
		image: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=300&h=300&fit=crop",
	},
	{
		id: 5,
		name: "Jewelry & Watches",
		image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop",
	},
	{
		id: 6,
		name: "Sports & Outdoors",
		image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop",
	},
	{
		id: 7,
		name: "Home & Kitchen",
		image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop",
	},
	{
		id: 8,
		name: "Beauty & Health",
		image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=300&fit=crop",
	},
];

import { serverApiFetch } from "@/lib/api-client";
import { resolveApiAssetUrl } from "@/lib/config";

type HotCategory = {
	id: string;
	name: string;
	slug: string;
	image: string;
};

type HotCategoriesSection = {
	heading: string;
	subheading: string;
	button_text: string;
	button_link: string;
	categories: HotCategory[];
};

const fallbackSection: HotCategoriesSection = {
	heading: "Hot categories",
	subheading: "Categories that catching eyes and winning hearts across our marketplace.",
	button_text: "All Categories",
	button_link: "/categories",
	categories: [],
};

export async function fetchHotCategoriesSectionServer(host: string | null): Promise<HotCategoriesSection> {
	try {
		const response = await serverApiFetch("/landing/sections/hot-categories", host, {
			next: { revalidate: 120 },
		});

		if (!response.ok) {
			return fallbackSection;
		}

		const result = await response.json();
		const data = result?.data;

		return {
			heading: String(data?.heading || fallbackSection.heading),
			subheading: String(data?.subheading || fallbackSection.subheading),
			button_text: String(data?.button_text || fallbackSection.button_text),
			button_link: String(data?.button_link || fallbackSection.button_link),
			categories: Array.isArray(data?.categories)
				? data.categories.map((category: HotCategory) => ({
						...category,
						image: resolveApiAssetUrl(category.image, host),
					}))
				: [],
		};
	} catch {
		return fallbackSection;
	}
}

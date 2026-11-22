import { useEffect, useState } from "react";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";

export type CategoryItem = {
	id: string;
	name: string;
	slug: string;
	image: string;
};

export type CategorySectionProps = {
	section: {
		title?: string;
		subtitle?: string;
		config?: unknown;
		[key: string]: unknown;
	};
	host: string | null;
	demoOnly?: boolean;
};

const fallbackContent = {
	heading: "Shop by category",
	subheading: "Find your next favourite piece, curated by category.",
	buttonText: "View all categories",
	buttonLink: "/categories",
};

export const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const textValue = (value: unknown, fallback: string) => {
	const normalized = String(value || "").trim();
	return normalized || fallback;
};

const normalizeCategory = (value: unknown): CategoryItem | null => {
	const category = asRecord(value);
	const id = String(category.id || category.slug || "").trim();
	const name = String(category.name || category.title || category.label || "Category").trim();
	const slug = String(category.slug || "").trim();

	if (!id) return null;

	return {
		id,
		name,
		slug,
		image: String(category.image || category.thumbnail || category.icon || "/images/placeholder.jpg"),
	};
};

export function useCategorySection({ section, host, demoOnly }: CategorySectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const [categories, setCategories] = useState<CategoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [remoteContent, setRemoteContent] = useState({ heading: "", subheading: "", buttonText: "", buttonLink: "" });

	useEffect(() => {
		let active = true;
		const query = demoOnly ? "?is_demo=1" : "";

		fetchStorefrontJson<{ data?: unknown }>(`/landing/categories${query}`, host)
			.then((result) => {
				if (!active) return;
				const data = asRecord(result?.data);
				setCategories((Array.isArray(data.categories) ? data.categories : [])
					.map(normalizeCategory)
					.filter((category): category is CategoryItem => Boolean(category)));
				setRemoteContent({
					heading: String(data.heading || "").trim(),
					subheading: String(data.subheading || "").trim(),
					buttonText: String(data.button_text || "").trim(),
					buttonLink: String(data.button_link || "").trim(),
				});
				setLoading(false);
			})
			.catch(() => {
				if (!active) return;
				setCategories([]);
				setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [demoOnly, host]);

	return {
		categories,
		loading,
		content: {
			heading: textValue(content.title ?? content.heading, textValue(section.title, textValue(remoteContent.heading, fallbackContent.heading))),
			subheading: textValue(content.sub_title ?? content.subheading, textValue(section.subtitle, textValue(remoteContent.subheading, fallbackContent.subheading))),
			buttonText: textValue(content.button_text, textValue(remoteContent.buttonText, fallbackContent.buttonText)),
			buttonLink: textValue(content.button_link, textValue(remoteContent.buttonLink, fallbackContent.buttonLink)),
		},
	};
}

export const categoryHref = (category: CategoryItem, fallback: string) =>
	category.slug ? `/categories/${category.slug}` : fallback || "/categories";

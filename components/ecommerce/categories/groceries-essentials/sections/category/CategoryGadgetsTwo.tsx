"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { EcommerceSectionProps } from "@/components/ecommerce/categories/category-contract";
import { resolveApiAssetUrl } from "@/lib/config";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";

type CategoryItem = {
	id: string;
	name: string;
	slug: string;
	image: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const normalizeCategory = (value: unknown, host: string | null): CategoryItem | null => {
	const category = asRecord(value);
	const id = String(category.id || category.slug || "").trim();
	const name = String(category.name || category.title || "").trim();
	if (!id || !name) return null;

	const image = asRecord(category.image);
	const rawImage = String(
		image.url
		|| image.src
		|| (typeof category.image === "string" ? category.image : "")
		|| category.thumbnail
		|| "",
	).trim();

	return {
		id,
		name,
		slug: String(category.slug || "").trim(),
		image: rawImage ? resolveApiAssetUrl(rawImage, host) : "",
	};
};

export default function CategoryGadgetsTwo({ section, host, demoOnly }: EcommerceSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const title = String(content.title || section.title || "").trim();
	const [categories, setCategories] = useState<CategoryItem[]>([]);

	useEffect(() => {
		let active = true;
		const query = demoOnly ? "?is_demo=1" : "";

		void fetchStorefrontJson<{ data?: unknown }>(`/landing/categories${query}`, host)
			.then((result) => {
				if (!active) return;
				const data = result?.data;
				const items = Array.isArray(data) ? data : asRecord(data).categories;
				setCategories((Array.isArray(items) ? items : [])
					.map((item) => normalizeCategory(item, host))
					.filter((item): item is CategoryItem => item !== null)
					.slice(0, 6));
			})
			.catch(() => {
				if (active) setCategories([]);
			});

		return () => {
			active = false;
		};
	}, [demoOnly, host]);

	if (!title && categories.length === 0) return null;

	return (
		<section data-storefront-section="groceries-essentials-hot-category-gadgets-five" className="min-h-[calc(100vh-691px)] bg-[#f7f7f7] px-6 pb-10 pt-6">
			<div className="mx-auto w-full max-w-[1376px]">
				{title ? <h2 className="text-2xl font-semibold text-[#1f1f22]">{title}</h2> : null}
				{categories.length ? <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
					{categories.map((category) => (
						<Link className="flex min-h-[176px] flex-col items-center justify-center gap-2 bg-white p-3 text-base text-[#1f1f22]" href={category.slug ? `/categories/${encodeURIComponent(category.slug)}` : "/categories"} key={category.id}>
							{category.image ? <Image unoptimized alt={category.name} className="size-24 object-contain sm:size-28" height={137} src={category.image} width={137} /> : null}
							<span>{category.name}</span>
						</Link>
					))}
				</div> : null}
			</div>
		</section>
	);
}

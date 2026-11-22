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
	productsCount: number;
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
		productsCount: Math.max(0, Number(category.products_count ?? category.productsCount ?? 0) || 0),
	};
};

export default function CategoryEssentialsOne({ section, host, demoOnly }: EcommerceSectionProps) {
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
					.slice(0, 5));
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
		<section id="categories" data-storefront-section="groceries-essentials-category-essentials-one" className="min-h-[calc(100vh-815px)] bg-[#f4f6f6] px-4 pb-11 pt-7 sm:px-6 sm:pt-9 xl:pt-[45px]" aria-label={title || "Grocery categories"}>
			<div className="mx-auto w-full max-w-[1760px]">
				{title ? <h2 className="mb-5 text-2xl font-semibold text-[#064C50] sm:mb-6 sm:text-3xl">{title}</h2> : null}
				{categories.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 xl:grid-cols-5 xl:gap-[30px]">
					{categories.map((category) => (
						<Link className="relative min-h-[160px] overflow-hidden rounded-[18px] bg-white px-5 py-4 text-[#064C50] sm:min-h-[176px] sm:px-6 sm:py-[18px]" href={category.slug ? `/categories/${encodeURIComponent(category.slug)}` : "/categories"} key={category.id}>
							<h3 className="relative z-10 max-w-[70%] text-xl font-semibold leading-7 xl:max-w-none xl:text-2xl xl:leading-8">{category.name}</h3>
							<p className="relative z-10 mt-1 max-w-[65%] text-sm text-[#6f7077] sm:text-base">{category.productsCount} products</p>
							<span aria-hidden="true" className="absolute bottom-0 left-0 grid grid-cols-5 gap-2 p-2 opacity-35">
								{Array.from({ length: 20 }, (_, index) => <span className="size-1.5 rounded-full bg-[#d8d8d8]" key={index} />)}
							</span>
							{category.image ? <Image unoptimized alt={category.name} className="absolute right-4 bottom-3 h-[76px] w-[76px] object-contain sm:right-5 sm:bottom-4 sm:h-[90px] sm:w-[90px]" height={93} sizes="(min-width: 640px) 90px, 76px" src={category.image} width={90} /> : null}
						</Link>
					))}
				</div> : null}
			</div>
		</section>
	);
}

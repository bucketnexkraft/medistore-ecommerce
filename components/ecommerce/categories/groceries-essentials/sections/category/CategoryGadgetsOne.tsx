"use client";

import { createElement, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { icons as lucideIcons } from "lucide-react";
import type { EcommerceSectionProps } from "@/components/ecommerce/categories/category-contract";
import { resolveApiAssetUrl } from "@/lib/config";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";

type CategoryItem = {
	id: string;
	name: string;
	slug: string;
	image: string;
	icon: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const resolveLucideIcon = (name: string) => {
	if (!name) return null;
	if (lucideIcons[name as keyof typeof lucideIcons]) return lucideIcons[name as keyof typeof lucideIcons];
	const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
	const key = Object.keys(lucideIcons).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
	return key ? lucideIcons[key as keyof typeof lucideIcons] : null;
};

const normalizeCategory = (value: unknown, host: string | null): CategoryItem | null => {
	const category = asRecord(value);
	const id = String(category.id || category.slug || "").trim();
	const name = String(category.name || category.title || category.label || "").trim();
	if (!id || !name) return null;

	const image = asRecord(category.image);
	const icon = asRecord(category.icon);
	const rawImage = String(image.url || image.src || (typeof category.image === "string" ? category.image : "") || category.thumbnail || "").trim();
	const rawIcon = String(icon.url || icon.src || icon.name || (typeof category.icon === "string" ? category.icon : "")).trim();
	const iconIsAsset = /^(https?:\/\/|\/|storage\/|uploads\/)/i.test(rawIcon);

	return {
		id,
		name,
		slug: String(category.slug || "").trim(),
		image: rawImage ? resolveApiAssetUrl(rawImage, host) : iconIsAsset ? resolveApiAssetUrl(rawIcon, host) : "",
		icon: iconIsAsset ? "" : rawIcon,
	};
};

export default function CategoryGadgetsOne({ section, host, demoOnly }: EcommerceSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const title = String(content.title || "").trim();
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
					.filter((item): item is CategoryItem => item !== null));
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
		<section data-storefront-section="groceries-essentials-hot-category-gadgets-four" className="min-h-[calc(100vh-691px)] bg-[#f7f7f7] px-6 pb-10 pt-6">
			<div className="mx-auto w-full max-w-[1376px]">
				{title ? <h2 className="text-2xl font-semibold text-[#1f1f22]">{title}</h2> : null}
				{categories.length ? <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
					{categories.map((category) => {
						const Icon = resolveLucideIcon(category.icon);
						return (
							<Link className="flex min-h-[176px] flex-col items-center justify-center gap-2 bg-white p-3 text-base text-[#1f1f22] transition-shadow hover:shadow-sm" href={category.slug ? `/categories/${encodeURIComponent(category.slug)}` : "/categories"} key={category.id}>
								{category.image ? <Image unoptimized alt="" className="size-24 shrink-0 object-contain sm:size-28" height={137} src={category.image} width={137} /> : Icon ? createElement(Icon, { size: 56, strokeWidth: 1.7, "aria-hidden": true }) : null}
								<span>{category.name}</span>
							</Link>
						);
					})}
				</div> : null}
			</div>
		</section>
	);
}

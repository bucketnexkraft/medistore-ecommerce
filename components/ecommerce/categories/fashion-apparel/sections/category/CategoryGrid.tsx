"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { A11y, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";

import "swiper/css";
import "swiper/css/navigation";

type CategoryItem = {
	id: string;
	name: string;
	slug: string;
	image: string;
};

type CategoryGridProps = {
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
	heading: "Shop by Category",
	subheading: "Browse popular categories from this store.",
	buttonText: "View All",
	buttonLink: "/categories",
};

const sectionClass = "container mx-auto bg-white px-4 py-8 sm:px-6 md:py-12 lg:px-8";
const headerClass = "mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 md:mb-7";
const cardWidthClass = "w-36! sm:w-40! xl:w-44!";
const arrowButtonClass = "flex size-11 cursor-pointer items-center justify-center rounded-full border border-primary/30 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-transparent";

const asRecord = (value: unknown): Record<string, unknown> =>
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

function CategoryImage({ src }: { src: string }) {
	const [imageSrc, setImageSrc] = useState(src || "/images/placeholder.jpg");

	return (
		<Image
			src={imageSrc}
			alt=""
			fill
			unoptimized
			loading="lazy"
			sizes="(min-width: 1280px) 158px, (min-width: 640px) 142px, 126px"
			className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110"
			onError={() => setImageSrc("/images/placeholder.jpg")}
		/>
	);
}

function CategoryGridSkeleton() {
	return (
		<section className={sectionClass} aria-hidden="true">
			<div className={`motion-safe:animate-pulse ${headerClass}`}>
				<div className="space-y-2">
					<div className="h-7 w-40 rounded bg-neutral-200 md:h-9" />
					<div className="h-4 w-48 rounded bg-neutral-100" />
				</div>
				<div className="flex items-center gap-2">
					<div className="hidden size-11 rounded-full bg-neutral-100 md:block" />
					<div className="hidden size-11 rounded-full bg-neutral-100 md:block" />
					<div className="h-11 w-28 rounded-lg bg-neutral-200" />
				</div>
			</div>
			<div className="flex gap-4 overflow-hidden pb-4 motion-safe:animate-pulse">
				{Array.from({ length: 9 }, (_, index) => (
					<div key={index} className={`${cardWidthClass} shrink-0 rounded-xl border border-neutral-200 p-2`}>
						<div className="aspect-[4/3] rounded-lg bg-neutral-100" />
						<div className="space-y-2 px-1 pt-3 pb-1">
							<div className="h-4 w-4/5 rounded bg-neutral-200" />
							<div className="h-3 w-1/2 rounded bg-neutral-100" />
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

export default function CategoryGrid({ section, host, demoOnly }: CategoryGridProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const [categories, setCategories] = useState<CategoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [remoteContent, setRemoteContent] = useState({
		heading: "",
		subheading: "",
		buttonText: "",
		buttonLink: "",
	});
	const navigationId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const previousClass = `category-grid-prev-${navigationId}`;
	const nextClass = `category-grid-next-${navigationId}`;

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

	const resolved = useMemo(() => ({
		heading: textValue(content.title ?? content.heading, textValue(section.title, textValue(remoteContent.heading, fallbackContent.heading))),
		subheading: textValue(content.sub_title ?? content.subheading, textValue(section.subtitle, textValue(remoteContent.subheading, fallbackContent.subheading))),
		buttonText: textValue(content.button_text, textValue(remoteContent.buttonText, fallbackContent.buttonText)),
		buttonLink: textValue(content.button_link, textValue(remoteContent.buttonLink, fallbackContent.buttonLink)),
	}), [content.button_link, content.button_text, content.heading, content.sub_title, content.subheading, content.title, remoteContent.buttonLink, remoteContent.buttonText, remoteContent.heading, remoteContent.subheading, section.subtitle, section.title]);

	if (loading) return <CategoryGridSkeleton />;

	return (
		<section data-storefront-section="fashion-apparel-category-grid" className={sectionClass} aria-labelledby={`category-grid-heading-${navigationId}`}>
			<div className={headerClass}>
				<div className="min-w-0">
					<h2 id={`category-grid-heading-${navigationId}`} className="text-2xl font-bold text-neutral-900 md:text-3xl">{resolved.heading}</h2>
				<p className="mt-1 text-sm font-normal! text-muted-foreground! md:text-base">{resolved.subheading}</p>
				</div>
				<div className="flex items-center gap-3">
				{categories.length > 0 && (
						<div className="hidden gap-2 md:flex">
							<button type="button" aria-label="Previous categories" className={`${previousClass} ${arrowButtonClass}`}>
								<ChevronLeft className="size-5" aria-hidden="true" />
							</button>
							<button type="button" aria-label="Next categories" className={`${nextClass} ${arrowButtonClass}`}>
								<ChevronRight className="size-5" aria-hidden="true" />
							</button>
						</div>
					)}
					<Link href={resolved.buttonLink} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
						{resolved.buttonText}
						<ArrowRight className="size-4 shrink-0" aria-hidden="true" />
					</Link>
					</div>
			</div>
			{categories.length ? (
				<Swiper
					modules={[Navigation, A11y]}
					className="-mx-2! px-2! pt-1! pb-4!"
					spaceBetween={16}
					slidesPerView="auto"
					watchSlidesProgress
					navigation={{ prevEl: `.${previousClass}`, nextEl: `.${nextClass}` }}
					a11y={{ prevSlideMessage: "Previous categories", nextSlideMessage: "Next categories" }}
				>
					{categories.map((category) => (
						<SwiperSlide key={category.id} className={cardWidthClass}>
							<Link href={category.slug ? `/categories/${category.slug}` : resolved.buttonLink} className="group block rounded-xl border border-neutral-200 bg-white p-2 transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary">
								<div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100">
									<CategoryImage key={category.image} src={category.image} />
								</div>
								<div className="px-1 pt-2.5 pb-1">
								<h3 className="truncate text-sm font-semibold text-neutral-800 transition-colors group-hover:text-primary group-focus-visible:text-primary">{category.name}</h3>
									<span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
										Shop Now <ArrowRight className="size-3" aria-hidden="true" />
									</span>
								</div>
							</Link>
						</SwiperSlide>
					))}
				</Swiper>
			) : (
				<div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center text-sm text-muted-foreground">
					No categories found.
				</div>
			)}
		</section>
	);
}

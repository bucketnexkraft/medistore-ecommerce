"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Autoplay, Navigation } from "swiper/modules";
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
	heading: "Hot categories",
	subheading: "Browse popular categories from this store.",
	buttonText: "All Categories",
	buttonLink: "/categories",
};

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

function CategoryImage({ src, alt }: { src: string; alt: string }) {
	const [imageSrc, setImageSrc] = useState(src || "/images/placeholder.jpg");

	return (
		<Image
			src={imageSrc}
			alt={alt}
			fill
			unoptimized
			loading="lazy"
			sizes="(min-width: 1024px) 180px, (min-width: 640px) 22vw, 42vw"
			className="object-cover transition-transform duration-300 group-hover:scale-105"
			onError={() => setImageSrc("/images/placeholder.jpg")}
		/>
	);
}

function CategoryGridSkeleton() {
	return (
		<section className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8">
			<div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-12">
				<div className="w-full space-y-6 lg:w-1/4">
					<div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
					<div className="space-y-2">
						<div className="h-4 w-full animate-pulse rounded bg-gray-200" />
						<div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
					</div>
					<div className="h-12 w-40 animate-pulse rounded bg-gray-200" />
				</div>
				<div className="grid w-full flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{Array.from({ length: 5 }).map((_, index) => (
						<div key={index} className="space-y-3">
							<div className="aspect-square animate-pulse rounded-lg bg-gray-200" />
							<div className="mx-auto h-4 w-4/5 animate-pulse rounded bg-gray-200" />
						</div>
					))}
				</div>
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
		<section data-storefront-section="electronics-gadgets-category-grid" className="container mx-auto my-14 rounded-20 border border-gray-200 bg-white p-6 md:p-8">
			<div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-12">
				<div className="space-y-6 lg:w-1/4">
					<div className="flex items-center gap-2">
						<Image src="/images/header/fire.svg" alt="" width={26} height={26} aria-hidden="true" />
						<h2 className="text-xl font-semibold text-primary-black">{resolved.heading}</h2>
					</div>
					<p className="text-primary-body">{resolved.subheading}</p>
					<Link href={resolved.buttonLink || "#"} className="inline-flex rounded-sm bg-primary-black px-8 py-3 text-sm font-medium text-background transition hover:bg-foreground/90">
						{resolved.buttonText}
					</Link>
				</div>

				<div className="w-full flex-1 lg:w-3/4">
					{categories.length ? (
						<div className="relative flex items-center gap-2">
							<button type="button" aria-label="Previous categories" className={`${previousClass} flex size-8 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground`}>
								<ChevronLeft className="size-6" />
							</button>

							<div className="min-w-0 flex-1 overflow-hidden lg:px-16">
								<Swiper
									modules={[Navigation, Autoplay]}
									spaceBetween={16}
									slidesPerView={2}
									loop={categories.length > 5}
									autoplay={{ delay: 3000, disableOnInteraction: false }}
									navigation={{ prevEl: `.${previousClass}`, nextEl: `.${nextClass}` }}
									breakpoints={{ 480: { slidesPerView: 3 }, 640: { slidesPerView: 4 }, 1024: { slidesPerView: 5 } }}
								>
									{categories.map((category) => (
										<SwiperSlide key={category.id}>
											<Link href={category.slug ? `/categories/${category.slug}` : resolved.buttonLink || "/categories"} className="group flex cursor-pointer flex-col items-center gap-2">
												<div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
													<CategoryImage key={`${category.id}-${category.image}`} src={category.image} alt={category.name} />
												</div>
												<span className="line-clamp-1 w-full text-center font-medium text-primary-black">{category.name}</span>
											</Link>
										</SwiperSlide>
									))}
								</Swiper>
							</div>

							<button type="button" aria-label="Next categories" className={`${nextClass} flex size-8 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground`}>
								<ChevronRight className="size-6" />
							</button>
						</div>
					) : (
						<div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center text-sm text-primary-body">
							No categories found.
						</div>
					)}
				</div>
			</div>
		</section>
	);
}

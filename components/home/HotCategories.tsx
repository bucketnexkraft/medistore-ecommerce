"use client";

import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { resolveApiAssetUrl } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";

import "swiper/css";
import "swiper/css/navigation";

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

export type { HotCategory, HotCategoriesSection };

const fallbackSection: HotCategoriesSection = {
	heading: "Hot categories",
	subheading: "Categories that catching eyes and winning hearts across our marketplace.",
	button_text: "All Categories",
	button_link: "/categories",
	categories: [],
};
const categoryImageFallback = resolveApiAssetUrl();

let cachedSection: HotCategoriesSection | null = null;
let hotCategoriesPromise: Promise<HotCategoriesSection> | null = null;

async function fetchHotCategoriesSection() {
	if (cachedSection) return cachedSection;

	if (!hotCategoriesPromise) {
		hotCategoriesPromise = apiFetch("/landing/sections/hot-categories")
			.then(async (response) => {
				const result = response.ok ? await response.json() : null;
				const data = result?.data;

				cachedSection = {
					heading: String(data?.heading || fallbackSection.heading),
					subheading: String(data?.subheading || fallbackSection.subheading),
					button_text: String(data?.button_text || fallbackSection.button_text),
					button_link: String(data?.button_link || fallbackSection.button_link),
					categories: Array.isArray(data?.categories) ? data.categories : [],
				};

				return cachedSection;
			})
			.catch(() => {
				hotCategoriesPromise = null;
				return fallbackSection;
			});
	}

	return hotCategoriesPromise;
}

function CategoryImage({
	src,
	alt,
}: {
	src: string;
	alt: string;
}) {
	const [imageSrc, setImageSrc] = useState(resolveApiAssetUrl(src));

	return (
		<Image
			loader={({ src: loaderSrc }) => loaderSrc}
			unoptimized
			src={imageSrc}
			alt={alt}
			fill
			sizes="240px"
			className="object-cover group-hover:scale-105 transition-transform duration-300"
			onError={() => setImageSrc(categoryImageFallback)}
		/>
	);
}

function HotCategoriesSkeleton() {
	return (
		<section className="bg-white border border-gray-200 rounded-20 p-6 md:p-8 container mx-auto my-14">
			<div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
				<div className="lg:w-1/4 space-y-6 w-full">
					<div className="h-8 w-40 rounded bg-gray-200 animate-pulse" />
					<div className="space-y-2">
						<div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
						<div className="h-4 w-5/6 rounded bg-gray-200 animate-pulse" />
					</div>
					<div className="h-12 w-40 rounded bg-gray-200 animate-pulse" />
				</div>

				<div className="flex-1 w-full">
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
						{Array.from({ length: 5 }).map((_, index) => (
							<div key={index} className="space-y-3">
								<div className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
								<div className="h-4 w-4/5 mx-auto rounded bg-gray-200 animate-pulse" />
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

export default function HotCategories({ initialSection }: { initialSection?: HotCategoriesSection | null }) {
	const [section, setSection] = useState<HotCategoriesSection>(initialSection || cachedSection || fallbackSection);
	const [loading, setLoading] = useState(!initialSection && !cachedSection);
	const resolvedSection = initialSection || section;

	useEffect(() => {
		if (initialSection) {
			cachedSection = initialSection;
			return;
		}

		let mounted = true;

		fetchHotCategoriesSection().then((data) => {
			if (!mounted) return;

			setSection(data);
			setLoading(false);
		});

		return () => {
			mounted = false;
		};
	}, [initialSection]);

	if (loading) {
		return <HotCategoriesSkeleton />;
	}

	return (
		<section className="bg-white border border-gray-200 rounded-20 p-6 md:p-8 container mx-auto my-14">
			<div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
				<div className="lg:w-1/4 space-y-6">
					<div className="flex items-center gap-2">
						<Image src="/images/header/fire.svg" alt="fire" width={26} height={26} />
						<h4>{resolvedSection.heading}</h4>
					</div>
					<p>{resolvedSection.subheading}</p>
					<Link href={resolvedSection.button_link || "#"}>
						<Button variant="primaryBlack">{resolvedSection.button_text}</Button>
					</Link>
				</div>

				<div className="flex-1 w-full lg:w-3/4">
					<div className="relative flex items-center gap-2">
						<button className="swiper-button-prev-custom shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
							<ChevronLeft className="w-6 h-6" />
						</button>

						<div className="flex-1 overflow-hidden lg:px-16">
							<Swiper
								modules={[Navigation, Autoplay]}
								spaceBetween={16}
								slidesPerView={2}
								loop={resolvedSection.categories.length > 5}
								autoplay={{
									delay: 3000,
									disableOnInteraction: false,
								}}
								navigation={{
									prevEl: ".swiper-button-prev-custom",
									nextEl: ".swiper-button-next-custom",
								}}
								breakpoints={{
									480: { slidesPerView: 3 },
									640: { slidesPerView: 4 },
									1024: { slidesPerView: 5 },
								}}
							>
								{resolvedSection.categories.map((category) => (
									<SwiperSlide key={category.id}>
										<Link
											href={category.slug ? `/categories/${category.slug}` : resolvedSection.button_link || "/categories"}
											className="flex flex-col items-center gap-2 cursor-pointer group"
										>
											<div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
												<CategoryImage key={`${category.id}-${category.image}`} src={category.image} alt={category.name} />
											</div>
											<span className="text-primary-black font-medium text-center line-clamp-1 w-full">{category.name}</span>
										</Link>
									</SwiperSlide>
								))}
							</Swiper>
						</div>

						<button className="swiper-button-next-custom shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
							<ChevronRight className="w-6 h-6" />
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Navigation, Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import SafeImage from "@/components/common/SafeImage";
import { Button } from "@/components/ui/button";
import {
	fetchBrandsSectionClient,
	type BrandsSectionData,
	type StorefrontBrand,
} from "@/lib/brands";

import "swiper/css";
import "swiper/css/navigation";

const fallbackSection: BrandsSectionData = {
	heading: "Popular Brands",
	subheading: "Trusted names, standout identities, and products people keep coming back for.",
	brands: [],
	stats: {
		brands_count: 0,
		products_count: 0,
	},
};

function BrandCard({ brand }: { brand: StorefrontBrand }) {
	return (
		<Link
			href={brand.url || (brand.slug ? `/products?brand=${brand.slug}` : "/products")}
			className="group flex h-full flex-col rounded-[24px] border border-gray-200 bg-white p-5 transition duration-300 hover:border-gray-300"
		>
			<div className="relative mb-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[18px] border border-gray-100 bg-[#f8fafc]">
				<div className="relative h-24 w-24 overflow-hidden rounded-[20px] bg-white p-4 md:h-28 md:w-28">
					<SafeImage src={brand.image} alt={brand.name} fill sizes="120px" className="object-contain p-3 transition duration-300 group-hover:scale-105" />
				</div>
			</div>

			<div className="space-y-2">
				<h3 className="text-xl font-bold text-primary-black">{brand.name}</h3>
				<p className="text-sm leading-6 text-primary-body">{brand.products_count.toLocaleString()} products available.</p>
			</div>

			<div className="mt-auto pt-4">
				<span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-black transition group-hover:text-theme-coral">
					Shop this brand
					<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
				</span>
			</div>
		</Link>
	);
}

function BrandSpotlightSkeleton() {
	return (
		<section className="section py-10 md:py-14">
			<div className="overflow-hidden rounded-[32px] border border-secondary-stroke bg-white p-6 md:p-8 lg:p-10">
				<div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl space-y-3">
						<div className="h-5 w-28 animate-pulse rounded-full bg-gray-200" />
						<div className="h-10 w-72 animate-pulse rounded bg-gray-200" />
						<div className="h-5 w-full max-w-xl animate-pulse rounded bg-gray-100" />
					</div>
				</div>
				<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="rounded-[28px] border border-gray-100 bg-white p-5">
							<div className="mb-5 aspect-[4/3] animate-pulse rounded-[22px] bg-gray-100" />
							<div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
							<div className="mt-3 h-4 w-full animate-pulse rounded bg-gray-100" />
							<div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-100" />
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export default function BrandSpotlight({ initialSection }: { initialSection?: BrandsSectionData | null }) {
	const [section, setSection] = useState<BrandsSectionData>(initialSection || fallbackSection);
	const [loading, setLoading] = useState(!initialSection);

	useEffect(() => {
		if (initialSection) {
			return;
		}

		let mounted = true;

		fetchBrandsSectionClient(24).then((data) => {
			if (!mounted) return;
			setSection(data);
			setLoading(false);
		});

		return () => {
			mounted = false;
		};
	}, [initialSection]);

	if (loading) {
		return <BrandSpotlightSkeleton />;
	}

	if (!section.brands.length) {
		return (
			<section className="section py-10 md:py-14">
				<div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white p-6 md:p-8 lg:p-10">
					<div className="max-w-3xl">
						<p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-body">{section.heading}</p>
						<h2 className="mt-4 text-3xl font-bold text-primary-black md:text-4xl">{section.heading}</h2>
						<p className="mt-3 max-w-2xl text-base leading-7 text-primary-body md:text-lg">{section.subheading}</p>
						<p className="mt-6 text-sm text-primary-body">
							No brand items are available for this store yet. Add brands in the company data or update the template to use another section type.
						</p>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className="section py-10 md:py-14">
			<div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white p-6 md:p-8 lg:p-10">
				<div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl">
						<h2 className="text-3xl font-bold text-primary-black md:text-4xl">{section.heading}</h2>
						<p className="mt-3 max-w-2xl text-base leading-7 text-primary-body md:text-lg">{section.subheading}</p>
					</div>

					<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
						<Link href="/brands">
							<Button className="h-11 rounded-full px-6" variant="primaryBlack">
								View All Brands
							</Button>
						</Link>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<button className="brand-spotlight-prev inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-primary-black transition hover:border-primary-black hover:bg-primary-black hover:text-white">
						<ChevronLeft className="h-5 w-5" />
					</button>

					<div className="min-w-0 flex-1">
						<Swiper
							modules={[Navigation, Autoplay]}
							spaceBetween={20}
							slidesPerView={1.15}
							loop={section.brands.length > 4}
							autoplay={{
								delay: 3200,
								disableOnInteraction: false,
							}}
							navigation={{
								prevEl: ".brand-spotlight-prev",
								nextEl: ".brand-spotlight-next",
							}}
							breakpoints={{
								640: { slidesPerView: 2.1 },
								900: { slidesPerView: 3.1 },
								1280: { slidesPerView: 4 },
							}}
						>
							{section.brands.map((brand) => (
								<SwiperSlide key={brand.id}>
									<BrandCard brand={brand} />
								</SwiperSlide>
							))}
						</Swiper>
					</div>

					<button className="brand-spotlight-next inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-primary-black transition hover:border-primary-black hover:bg-primary-black hover:text-white">
						<ChevronRight className="h-5 w-5" />
					</button>
				</div>
			</div>
		</section>
	);
}

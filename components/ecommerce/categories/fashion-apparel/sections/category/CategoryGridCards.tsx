"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categoryHref, type CategoryItem, type CategorySectionProps, useCategorySection } from "./category-section-data";

function CategoryImage({ category }: { category: CategoryItem }) {
	const [src, setSrc] = useState(category.image || "/images/placeholder.jpg");

	return (
		<Image
			src={src}
			alt={category.name}
			fill
			unoptimized
			loading="lazy"
			sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
			className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
			onError={() => setSrc("/images/placeholder.jpg")}
		/>
	);
}

function CardsSkeleton() {
	return (
		<section className="container mx-auto my-14">
			<div className="mb-8 flex items-end justify-between gap-5">
				<div className="space-y-3">
					<div className="h-8 w-52 animate-pulse rounded bg-gray-200" />
					<div className="h-4 w-72 max-w-full animate-pulse rounded bg-gray-200" />
				</div>
				<div className="hidden h-10 w-32 animate-pulse rounded-full bg-gray-200 sm:block" />
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, index) => (
					<div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-200" />
				))}
			</div>
		</section>
	);
}

export default function CategoryGridCards(props: CategorySectionProps) {
	const { categories, loading, content } = useCategorySection(props);

	if (loading) return <CardsSkeleton />;

	return (
		<section data-storefront-section="fashion-apparel-category-grid-cards" className="container mx-auto my-14">
			<div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
				<div className="max-w-2xl">
					<p className="mb-2 text-sm font-medium text-primary-body">Curated collections</p>
					<h2 className="text-2xl font-semibold text-primary-black">{content.heading}</h2>
					<p className="mt-2 text-base font-medium text-primary-body">{content.subheading}</p>
				</div>
				<Link href={content.buttonLink || "/categories"} className="group inline-flex items-center gap-2 rounded-full border border-primary-black px-5 py-2.5 text-sm font-medium text-primary-black transition hover:bg-primary-black hover:text-white">
					{content.buttonText}
					<ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
				</Link>
			</div>

			{categories.length ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{categories.map((category, index) => (
						<Link key={category.id} href={categoryHref(category, content.buttonLink)} className={`group relative min-h-80 overflow-hidden rounded-2xl bg-gray-100 ${index === 0 ? "sm:col-span-2 lg:col-span-2" : ""}`}>
							<div className={`relative w-full ${index === 0 ? "aspect-[8/5] sm:h-full sm:min-h-[420px]" : "aspect-[4/5]"}`}>
								<CategoryImage key={`${category.id}-${category.image}`} category={category} />
								<div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
								<div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-6">
									<h3 className="text-base font-medium text-white">{category.name}</h3>
									<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-primary-black transition-transform group-hover:rotate-45">
										<ArrowUpRight className="size-5" />
									</span>
								</div>
							</div>
						</Link>
					))}
				</div>
			) : (
				<div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 text-center text-sm text-primary-body">No categories found.</div>
			)}
		</section>
	);
}


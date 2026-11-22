"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
			sizes="(min-width: 1024px) 14vw, (min-width: 640px) 24vw, 42vw"
			className="object-cover transition-transform duration-300 group-hover:scale-105"
			onError={() => setSrc("/images/placeholder.jpg")}
		/>
	);
}

function ClassicSkeleton() {
	return (
		<section className="container mx-auto my-14 rounded-3xl bg-[#f6f3ef] px-5 py-10 md:px-10 md:py-12">
			<div className="mx-auto mb-10 space-y-3 text-center">
				<div className="mx-auto h-8 w-52 animate-pulse rounded bg-gray-200" />
				<div className="mx-auto h-4 w-72 max-w-full animate-pulse rounded bg-gray-200" />
			</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
				{Array.from({ length: 6 }).map((_, index) => (
					<div key={index} className="space-y-3">
						<div className="mx-auto aspect-square w-full animate-pulse rounded-full bg-gray-200" />
						<div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-gray-200" />
					</div>
				))}
			</div>
		</section>
	);
}

export default function CategoryGridClassic(props: CategorySectionProps) {
	const { categories, loading, content } = useCategorySection(props);

	if (loading) return <ClassicSkeleton />;

	return (
		<section data-storefront-section="fashion-apparel-category-grid-classic" className="container mx-auto my-14 rounded-3xl bg-[#f6f3ef] px-5 py-10 md:px-10 md:py-12">
			<div className="mx-auto mb-10 max-w-2xl text-center">
				<p className="mb-2 text-sm font-medium text-primary-body">The category edit</p>
				<h2 className="text-2xl font-semibold text-primary-black">{content.heading}</h2>
				<p className="mt-3 text-base font-medium text-primary-body">{content.subheading}</p>
			</div>

			{categories.length ? (
				<>
					<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
						{categories.map((category) => (
							<Link key={category.id} href={categoryHref(category, content.buttonLink)} className="group text-center">
								<div className="relative mx-auto aspect-square w-full overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
									<CategoryImage key={`${category.id}-${category.image}`} category={category} />
								</div>
								<h3 className="mt-4 line-clamp-1 text-base font-medium text-primary-black transition-colors group-hover:text-primary-body">{category.name}</h3>
							</Link>
						))}
					</div>
					<div className="mt-10 text-center">
						<Link href={content.buttonLink || "/categories"} className="group inline-flex items-center gap-2 border-b border-primary-black pb-1 text-sm font-medium text-primary-black">
							{content.buttonText}
							<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>
				</>
			) : (
				<div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white/50 px-6 text-center text-sm text-primary-body">No categories found.</div>
			)}
		</section>
	);
}


"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categoryHref, type CategoryItem, type CategorySectionProps, useCategorySection } from "./category-section-data";

function CategoryImage({ category, sizes }: { category: CategoryItem; sizes: string }) {
	const [src, setSrc] = useState(category.image || "/images/placeholder.jpg");

	return (
		<Image
			src={src}
			alt={category.name}
			fill
			unoptimized
			loading="lazy"
			sizes={sizes}
			className="object-cover transition-transform duration-500 group-hover:scale-105"
			onError={() => setSrc("/images/placeholder.jpg")}
		/>
	);
}

function StackedSkeleton() {
	return (
		<section className="container mx-auto my-14 overflow-hidden rounded-3xl border border-gray-200 bg-white">
			<div className="grid lg:grid-cols-[0.85fr_1.15fr]">
				<div className="min-h-96 animate-pulse bg-gray-200" />
				<div className="space-y-5 p-6 md:p-10">
					<div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
					<div className="h-4 w-72 max-w-full animate-pulse rounded bg-gray-200" />
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="h-20 animate-pulse rounded-xl bg-gray-200" />
					))}
				</div>
			</div>
		</section>
	);
}

export default function CategoryStacked(props: CategorySectionProps) {
	const { categories, loading, content } = useCategorySection(props);
	const [featured, ...rest] = categories;

	if (loading) return <StackedSkeleton />;

	return (
		<section data-storefront-section="fashion-apparel-category-stacked" className="container mx-auto my-14 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
			{featured ? (
				<div className="grid lg:grid-cols-[0.85fr_1.15fr]">
					<Link href={categoryHref(featured, content.buttonLink)} className="group relative min-h-96 overflow-hidden bg-gray-100 lg:min-h-[540px]">
						<CategoryImage key={`${featured.id}-${featured.image}`} category={featured} sizes="(min-width: 1024px) 42vw, 100vw" />
						<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
						<div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white md:p-8">
							<div>
								<p className="mb-1 text-sm font-medium text-white/75">Featured category</p>
								<h3 className="text-base font-medium">{featured.name}</h3>
							</div>
							<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary-black transition-transform group-hover:translate-x-1">
								<ArrowRight className="size-5" />
							</span>
						</div>
					</Link>

					<div className="flex flex-col justify-center p-6 md:p-10 lg:p-12">
						<p className="mb-2 text-sm font-medium text-primary-body">Explore the collection</p>
						<h2 className="text-2xl font-semibold text-primary-black">{content.heading}</h2>
						<p className="mt-3 max-w-xl text-base font-medium text-primary-body">{content.subheading}</p>

						<div className="mt-8 divide-y divide-gray-200 border-y border-gray-200">
							{rest.map((category, index) => (
								<Link key={category.id} href={categoryHref(category, content.buttonLink)} className="group flex items-center gap-4 py-4">
									<span className="w-6 shrink-0 text-sm font-medium tabular-nums text-primary-body">{String(index + 2).padStart(2, "0")}</span>
									<div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
										<CategoryImage key={`${category.id}-${category.image}`} category={category} sizes="64px" />
									</div>
									<h3 className="min-w-0 flex-1 truncate text-base font-medium text-primary-black">{category.name}</h3>
									<ArrowRight className="size-5 shrink-0 text-primary-body transition-transform group-hover:translate-x-1 group-hover:text-primary-black" />
								</Link>
							))}
						</div>

						<Link href={content.buttonLink || "/categories"} className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-primary-black px-6 py-3 text-sm font-medium text-white transition hover:bg-primary-black/85">
							{content.buttonText}
							<ArrowRight className="size-4" />
						</Link>
					</div>
				</div>
			) : (
				<div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
					<h2 className="text-2xl font-semibold text-primary-black">{content.heading}</h2>
					<p className="mt-2 text-sm text-primary-body">No categories found.</p>
				</div>
			)}
		</section>
	);
}


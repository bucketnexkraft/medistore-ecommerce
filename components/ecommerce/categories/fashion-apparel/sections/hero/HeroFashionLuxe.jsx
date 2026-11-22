"use client";

import Image from "next/image";
import { useState } from "react";

const DEFAULT_HERO = {
	leftImage: "/Category_1/Apparel_4/hero-img-1.png",
	rightImage: "/Category_1/Apparel_4/category/category-img-1.png",
	title: "BULK CUSTOM WEAR,\nDONE RIGHT",
	description: "Three Easy Ways To Build Your Clothing Line:  Start From Scratch, Customize Blanks, Or Shop Ready-Made.",
	buttonLabel: "Custom Order",
	buttonUrl: "#",
};

const DEFAULT_CATEGORIES = [
	{ id: "polo-shirts", src: "/Category_1/Apparel_4/category/category-img-1.png", alt: "Polo shirts" },
	{ id: "fashion-collection", src: "/Category_1/Apparel_4/category/category-img-2.png", alt: "Fashion collection" },
	{ id: "neutral-jackets", src: "/Category_1/Apparel_4/category/category-img-3.png", alt: "Neutral jackets" },
];

const asRecord = (value) =>
	value && typeof value === "object" && !Array.isArray(value) ? value : {};

const resolveImage = (value, fallbackSrc, fallbackAlt) => {
	const image = asRecord(value);
	return {
		src: String(typeof value === "string" ? value : image.url || image.src || fallbackSrc).trim(),
		alt: String(image.alt || fallbackAlt).trim(),
	};
};

const getCategoryLabel = (id) => String(id || "").replace(/-/g, " ");

export default function HeroFashionLuxe({ section }) {
	const config = asRecord(section?.config);
	const content = asRecord(config.content);
	const legacyImages = Array.isArray(content.images) ? content.images : [];
	const legacyImage = (index) => asRecord(legacyImages[index]).image;

	const title = String(content.title || DEFAULT_HERO.title);
	const leftImage = resolveImage(content.left_image || legacyImage(0), DEFAULT_HERO.leftImage, title.replace("\n", " "));
	const rightImage = resolveImage(content.right_image || legacyImage(1), DEFAULT_HERO.rightImage, "Fashion collection");
	const description = String(content.description || DEFAULT_HERO.description);
	const buttonLabel = String(content.button_label || DEFAULT_HERO.buttonLabel);
	const buttonUrl = String(content.button_url || DEFAULT_HERO.buttonUrl);

	const configuredCategories = Array.isArray(content.categories)
		? content.categories.map((category, index) => {
			const item = asRecord(category);
			const fallback = DEFAULT_CATEGORIES[index] || DEFAULT_CATEGORIES[0];
			const image = resolveImage(item.image || item.src, fallback.src, fallback.alt);
			return {
				id: String(item.id || fallback.id),
				src: image.src,
				alt: image.alt,
				selected: Boolean(item.selected),
			};
		})
		: [];
	const categories = configuredCategories.length ? configuredCategories : DEFAULT_CATEGORIES;
	const initialCategory = categories.find((category) => category.selected) || categories[0];
	const [selectedImage, setSelectedImage] = useState(initialCategory?.src || rightImage.src);
	const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategory?.id);

	return (
		<main id="top" data-storefront-section="fashion-apparel-hero-fashion-luxe" className="min-h-screen bg-[#f7f7f7] px-6 pb-6 pt-6">
			<div className="mx-auto grid w-full max-w-[1536px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,692fr)_minmax(0,832fr)] xl:px-0">
				<article className="relative aspect-[692/740] overflow-hidden rounded-[7px]">
					<Image
						alt={leftImage.alt}
						className="object-cover"
						fill
						priority
						sizes="(min-width: 1024px) 45vw, 100vw"
						src={leftImage.src}
						unoptimized
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
					<div className="absolute inset-x-8 bottom-12 text-white">
						<h1 className="max-w-[480px] whitespace-pre-line text-[clamp(2.2rem,3.2vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.05em]">
							{title}
						</h1>
						<p className="mt-5 max-w-[530px] text-sm leading-[1.55] !text-white sm:text-base">
							{description}
						</p>
						<a
							className="mt-5 inline-flex h-11 min-w-40 items-center justify-center rounded-[4px] bg-[#1f1f22] px-7 text-sm text-white transition-colors hover:bg-black"
							href={buttonUrl}
						>
							{buttonLabel}
						</a>
					</div>
				</article>

				<article className="relative aspect-[832/740] overflow-hidden rounded-[7px]">
					<Image
						alt={selectedCategoryId ? getCategoryLabel(selectedCategoryId) : ""}
						className="object-cover"
						fill
						priority
						sizes="(min-width: 1024px) 54vw, 100vw"
						src={selectedImage || rightImage.src}
						unoptimized
					/>
					<div className="absolute inset-x-6 bottom-6 flex items-end justify-end gap-2.5 sm:inset-x-7 sm:gap-3">
						{categories.map((category) => (
							<button
								aria-label={getCategoryLabel(category.id)}
								className={`block h-[76px] w-[100px] overflow-hidden border-2 cursor-pointer bg-white/10 transition-opacity hover:opacity-80 sm:h-[103px] sm:w-[132px] ${
									category.id === selectedCategoryId ? "border-white" : "border-transparent"
								}`}
								key={category.id}
								onClick={() => {
									setSelectedImage(category.src);
									setSelectedCategoryId(category.id);
								}}
								type="button"
							>
								<Image
									alt={category.alt}
									className="h-full w-full object-cover"
									height={103}
									src={category.src}
									width={132}
									unoptimized
								/>
							</button>
						))}
					</div>
				</article>
			</div>
		</main>
	);
}

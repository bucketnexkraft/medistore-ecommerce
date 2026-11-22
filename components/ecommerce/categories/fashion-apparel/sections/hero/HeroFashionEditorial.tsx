import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { FashionSectionProps } from "../../types";

type HeroImage = {
	src: string;
	alt: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const resolveImage = (value: unknown, alt: string): HeroImage => {
	const image = asRecord(value);
	return {
		src: String(typeof value === "string" ? value : image.url || image.src || "").trim(),
		alt: String(image.alt || alt).trim(),
	};
};

export default function HeroFashionEditorial({ section }: FashionSectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const title = String(content.title || "STYLE THAT ELEVATES YOU");
	const subtitle = String(content.sub_title || "BUY ONE, GET ONE 50% OFF THE NEW COLLECTION");
	const configuredBackgroundColor = String(content.background_color || "").trim();
	const backgroundColor = /^#[0-9a-f]{6}$/i.test(configuredBackgroundColor)
		? configuredBackgroundColor
		: "#eeecdc";
	const buttonLabel = String(content.button_label || "SHOP");
	const buttonUrl = String(content.button_url || "#category");
	const thumbnailOne = resolveImage(content.image_one, `${title} collection 1`);
	const thumbnailTwo = resolveImage(content.image_two, `${title} collection 2`);
	const featureImage = resolveImage(content.image_three, title);

	if (!featureImage.src) return null;

	return (
		<section
			data-storefront-section="fashion-apparel-hero-editorial"
			className="border-b border-[#d8d5c5] px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12"
			style={{ backgroundColor }}
		>
			<div className="mx-auto grid w-full max-w-[1520px] items-center gap-12 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,50%)] lg:gap-10 lg:pb-[190px] lg:pt-18 xl:grid-cols-[1fr_598px] xl:gap-20">
				<div className="flex min-w-0 flex-col items-start">
					<h1 className="max-w-full font-[family-name:var(--font-bodoni)] text-[40px] uppercase leading-[1.08] tracking-[-0.055em] text-[#1c1815] sm:text-[48px] md:text-[60px] lg:leading-[1.22] xl:text-[84px] 2xl:text-[100px]">
						{title}
					</h1>

					<p className="mt-7 text-base font-medium tracking-[-0.01em] !text-[#242424] sm:text-lg lg:text-2xl">
						{subtitle}
					</p>

					<a
						className="mt-14 inline-flex items-center justify-center gap-3 rounded-full bg-black px-12 py-4 text-sm font-medium text-white transition-colors hover:bg-[#292929] sm:px-20 lg:px-[106px]"
						href={buttonUrl}
					>
						{buttonLabel}
						<ArrowRight aria-hidden="true" size={20} strokeWidth={1.6} />
					</a>

					<div className="mt-16 grid w-full max-w-[380px] grid-cols-2 gap-5 lg:max-xl:max-w-none lg:max-xl:gap-3">
						{[thumbnailOne, thumbnailTwo].map((image, index) => image.src ? (
							<Image
								key={`${image.src}-${index}`}
								className="aspect-square h-auto w-full max-w-[180px] object-cover lg:max-xl:max-w-none"
								src={image.src}
								alt={image.alt}
								width={225}
								height={225}
								unoptimized
							/>
						) : null)}
					</div>
				</div>

				<Image
					className="w-full object-cover lg:max-xl:h-auto lg:max-xl:max-w-full"
					src={featureImage.src}
					alt={featureImage.alt}
					width={598}
					height={721}
					priority
					unoptimized
				/>
			</div>
		</section>
	);
}

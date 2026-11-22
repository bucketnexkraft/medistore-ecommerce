import Image from "next/image";
import type { FashionSectionProps } from "../../types";

type HeroImage = {
	src: string;
	alt: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const DEFAULT_IMAGES = {
	top: "/Category_1/Apparel_3/hero-img-1.png",
	bottom: "/Category_1/Apparel_3/hero-img-2.png",
	featured: "/Category_1/Apparel_3/hero-img-3.png",
	assistant: "/Category_1/Apparel_3/ai_logo.png",
};

const resolveImage = (value: unknown, alt: string, fallbackSrc = ""): HeroImage => {
	const image = asRecord(value);
	return {
		src: String(typeof value === "string" ? value : image.url || image.src || fallbackSrc).trim(),
		alt: String(image.alt || alt).trim(),
	};
};

export default function HeroSplitSpotlight({ section }: FashionSectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const topTitle = String(content.top_title || "New gen\nX Controller");
	const bottomTitle = String(content.bottom_title || "DJI Mini 4K, Drone\nwith 4K UHD Camera");
	const featuredTitle = String(content.featured_title || "ROCKERZ 425");
	const topImage = resolveImage(content.top_image, topTitle.replace("\n", " "), DEFAULT_IMAGES.top);
	const bottomImage = resolveImage(content.bottom_image, bottomTitle.replace("\n", " "), DEFAULT_IMAGES.bottom);
	const featuredImage = resolveImage(content.featured_image, featuredTitle, DEFAULT_IMAGES.featured);
	const assistantLogo = resolveImage(content.assistant_logo, "LumiNex", DEFAULT_IMAGES.assistant);
	const assistantName = String(content.assistant_name || "LumiNex");
	const assistantDescription = String(content.assistant_description || "Your AI Shopping Assistant");
	const assistantLabel = String(content.assistant_label || "Open AI shopping assistant");

	return (
		<main data-storefront-section="fashion-apparel-hero-split-spotlight" className="min-h-screen bg-[#f7f7f7] px-6 pb-6 pt-[163px]">
			<div className="mx-auto grid w-full max-w-[1536px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,32.3%)_minmax(0,1fr)] xl:px-0">
				<div className="grid gap-6">
					<article className="relative aspect-[496/358] overflow-hidden rounded-[7px]">
						<Image alt={topImage.alt} className="object-cover" fill priority sizes="(min-width: 1024px) 32.3vw, 100vw" src={topImage.src} unoptimized />
						<h1 className="absolute left-8 top-7 max-w-[250px] whitespace-pre-line text-[clamp(1.7rem,2.1vw,2rem)] leading-[1.08] tracking-[-0.04em] text-white">
							{topTitle}
						</h1>
					</article>

					<article className="relative aspect-[496/358] overflow-hidden rounded-[7px]">
						<Image alt={bottomImage.alt} className="object-cover" fill sizes="(min-width: 1024px) 32.3vw, 100vw" src={bottomImage.src} unoptimized />
						<h2 className="absolute bottom-[83px] left-8 max-w-[320px] whitespace-pre-line text-xl font-bold leading-[1.5] text-white">
							{bottomTitle}
						</h2>
					</article>
				</div>

				<article className="relative aspect-[1016/740] overflow-hidden rounded-[7px]">
					<Image alt={featuredImage.alt} className="object-cover" fill priority sizes="(min-width: 1024px) 66.2vw, 100vw" src={featuredImage.src} unoptimized />
					<h2 className="absolute left-9 top-10 text-[clamp(3rem,6.2vw,6rem)] font-bold leading-[0.95] tracking-[-0.06em] text-white">
						{featuredTitle}
					</h2>
				</article>
			</div>

			{assistantLogo.src ? (
				<button aria-label={assistantLabel} className="fixed bottom-4 right-4 z-30 flex h-[84px] w-[calc(100vw-2rem)] max-w-[340px] items-center gap-4 rounded-[14px] bg-white px-5 text-left text-[#242424] shadow-[0_4px_20px_rgba(0,0,0,0.2)] sm:right-6" type="button">
					<Image alt={assistantLogo.alt} className="size-[59px] shrink-0 object-contain" height={63} src={assistantLogo.src} width={59} unoptimized />
					<span className="flex flex-col gap-1">
						<strong className="text-sm font-semibold">{assistantName}</strong>
						<span className="text-sm">{assistantDescription}</span>
					</span>
				</button>
			) : null}
		</main>
	);
}

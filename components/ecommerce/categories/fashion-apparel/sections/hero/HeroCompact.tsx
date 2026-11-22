import Image from "next/image";
import { Sarpanch } from "next/font/google";
import type { FashionSectionProps } from "../../types";

const sarpanch = Sarpanch({
	subsets: ["latin"],
	weight: "700",
});

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

function resolveImage(value: unknown) {
	const image = asRecord(value);
	return {
		src: String(typeof value === "string" ? value : image.url || "").trim(),
		alt: String(image.alt || "Fashion hero").trim(),
	};
}

export default function HeroCompact({ section }: FashionSectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const images = Array.isArray(content.images) ? content.images : [];
	const firstImage = asRecord(images[0]);
	const configuredBackground = resolveImage(content.background);
	const background = configuredBackground.src ? configuredBackground : resolveImage(firstImage.image);

	if (!background.src) return null;

	const leftTitle = String(content.left_title || "Special Project By STYLEST");
	const leftDescription = String(
		content.left_description ||
		"It Is A Long Established Fact That A Reader Will Be Distracted By The Readable Content Of A Page When Looking At Its Layout.",
	);
	const rightTitle = String(content.right_title || "Crafting Stories With Every Stitch");
	const rightDescription = String(
		content.right_description ||
		"It Is A Long Established Fact That A Reader Will Be Distracted By The Readable Content Of A Page When Looking At Its Layout.",
	);
	const bottomTitle = String(content.bottom_title || "Bletzertt");

	return (
		<section id="top" className="relative min-h-[928px] overflow-hidden bg-[#8e9091] text-white">
			<Image
				unoptimized
				className="object-cover object-center"
				src={background.src}
				alt={background.alt}
				fill
				priority
				sizes="100vw"
			/>

			<div className="absolute left-[5.1%] top-[62%] max-w-[380px]">
				<h1 className="text-[32px] font-semibold leading-[1.3] text-white">{leftTitle}</h1>
				<p className="mt-5 text-[18px] font-normal leading-[1.5] text-white/70">{leftDescription}</p>
			</div>

			<div className="absolute right-[6.5%] top-[24%] max-w-[293px]">
				<h2 className="text-[32px] font-semibold leading-[1.3] tracking-[-0.04em] text-white">{rightTitle}</h2>
				<p className="mt-5 text-[18px] font-normal leading-[1.5] text-white/70">{rightDescription}</p>
			</div>

			<p className={`${sarpanch.className} absolute bottom-[-18px] left-[4%] whitespace-nowrap text-[clamp(72px,19vw,231px)] font-bold leading-none text-white sm:bottom-[-30px] sm:left-[16%] md:bottom-[-35px] md:left-[15%] lg:bottom-[-60px] lg:left-0 xl:left-[20%] 2xl:left-[33%] lg:text-[231px]`}>
				{bottomTitle}
			</p>
		</section>
	);
}

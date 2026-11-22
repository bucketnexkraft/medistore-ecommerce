import Image from "next/image";
import type { GroceriesSectionProps } from "../../types";
import { resolveApiAssetUrl } from "@/lib/config";

const DEFAULT_HERO_IMAGE = "/Category_3/Essentials-1/hero-img.png";
const DEFAULT_SHAPE_IMAGE = "/Category_3/Essentials-1/shape.png";

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const resolveImage = (
	value: unknown,
	fallbackSrc: string,
	fallbackAlt: string,
	host: string | null,
) => {
	const image = asRecord(value);
	const rawSrc = String(typeof value === "string" ? value : image.url || image.src || fallbackSrc).trim() || fallbackSrc;

	return {
		src: resolveApiAssetUrl(rawSrc, host),
		alt: String(image.alt || fallbackAlt).trim(),
	};
};

export default function HeroEssentialsOne({ section, host }: GroceriesSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const title = String(content.title || "Your Favorite Store, Delivered to Your Door").trim();
	const description = String(content.description || "Shop fresh, organic, and sustainably sourced groceries with up to 4% savings on every order.").trim();
	const buttonLabel = String(content.button_label || "Shop now").trim();
	const buttonUrl = String(content.button_url || "#categories").trim();
	const heroImage = resolveImage(content.image, DEFAULT_HERO_IMAGE, "Reusable grocery bag filled with fresh vegetables", host);
	const shapeImage = resolveImage(content.shape, DEFAULT_SHAPE_IMAGE, "", host);

	return (
		<div data-storefront-section="groceries-essentials-hero-essentials-one" id="top" className="bg-[#f4f6f6] px-4 sm:px-6">
			<div className="mx-auto w-full max-w-[1760px]">
				<section className="relative min-h-[760px] overflow-hidden rounded-t-[20px] bg-[#064C50] py-12 text-[#fff5e9] [clip-path:ellipse(300%_110%_at_50%_-10%)] sm:py-14 xl:h-[644px] xl:min-h-0 xl:py-0 xl:[clip-path:ellipse(200%_213%_at_50%_-113%)] mt-8 mb-10" aria-labelledby="essentials-hero-title">
					<Image unoptimized alt={shapeImage.alt} className="pointer-events-none absolute inset-0 h-full w-full object-cover" fill priority sizes="(min-width: 1808px) 1760px, calc(100vw - 48px)" src={shapeImage.src} />

					<div className="relative z-10 mx-auto grid h-full max-w-[1464px] grid-cols-1 px-6 sm:px-10 xl:grid-cols-[minmax(0,1fr)_minmax(460px,50%)] xl:px-12 2xl:grid-cols-[minmax(0,1fr)_676px] 2xl:px-0">
						<div className="flex items-center pb-8 xl:pb-[76px]">
							<div className="max-w-[660px]">
								<h1 id="essentials-hero-title" className="text-[36px] leading-[1.2] font-extrabold tracking-[-0.025em] sm:text-[46px] lg:text-[52px] 2xl:text-[60px] 2xl:leading-[1.28]">
									{title}
								</h1>
								<p className="mt-5 text-base leading-7 sm:text-xl sm:leading-8 2xl:text-2xl">{description}</p>
								{buttonLabel && buttonUrl ? (
									<a className="mt-7 inline-flex h-[52px] items-center justify-center rounded-[12px] bg-[#b5eb62] px-7 text-xl font-bold text-[#064C50] transition-colors hover:bg-[#a6dc55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:mt-8 2xl:h-[58px] 2xl:px-8 2xl:text-2xl" href={buttonUrl}>
										{buttonLabel}
									</a>
								) : null}
							</div>
						</div>

						<div className="flex items-end justify-center">
							<Image unoptimized alt={heroImage.alt} className="h-auto w-full max-w-[676px] object-contain xl:max-h-[644px] 2xl:h-[644px] 2xl:w-[676px] 2xl:max-w-none" height={644} priority sizes="(min-width: 1536px) 676px, (min-width: 1280px) 50vw, calc(100vw - 80px)" src={heroImage.src} width={676} />
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

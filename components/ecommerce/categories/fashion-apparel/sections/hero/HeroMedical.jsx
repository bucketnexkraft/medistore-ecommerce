import Image from "next/image";
import { ArrowUpRight, Sparkles } from "lucide-react";

const DEFAULT_HERO = {
	leftImage: "/images/hero-medical/healthcare-background.webp",
	title: "BULK CUSTOM WEAR,\nDONE RIGHT",
	description: "Three Easy Ways To Build Your Clothing Line:  Start From Scratch, Customize Blanks, Or Shop Ready-Made.",
	buttonLabel: "Custom Order",
	buttonUrl: "#",
};

const DEMO_AVATARS = [1, 2, 3, 4].map((number) => ({
	src: `/images/hero-medical/customer-${number}.webp`,
	alt: "",
}));

const asRecord = (value) =>
	value && typeof value === "object" && !Array.isArray(value) ? value : {};

const resolveImage = (value, fallbackSrc, fallbackAlt) => {
	const image = asRecord(value);
	return {
		src: String(typeof value === "string" ? value : image.url || image.src || "").trim() || fallbackSrc,
		alt: String(image.alt || fallbackAlt).trim(),
	};
};

export default function HeroMedical({ section, demoOnly }) {
	const config = asRecord(section?.config);
	const content = asRecord(config.content);
	const legacyImages = Array.isArray(content.images) ? content.images : [];

	const title = String(content.title || DEFAULT_HERO.title);
	const leftAlt = title.replace("\n", " ");
	const legacyLeftImage = resolveImage(asRecord(legacyImages[0]).image, DEFAULT_HERO.leftImage, leftAlt);
	const leftImage = resolveImage(content.left_image, legacyLeftImage.src, legacyLeftImage.alt);
	const description = String(content.description || DEFAULT_HERO.description);
	const buttonLabel = String(content.button_label || DEFAULT_HERO.buttonLabel);
	const buttonUrl = String(content.button_url || DEFAULT_HERO.buttonUrl);

	const configuredAvatars = Array.isArray(content.categories)
		? content.categories.map((category) => {
			const item = asRecord(category);
			return resolveImage(item.image, String(item.src || "").trim(), "");
		}).filter((image) => image.src)
		: [];
	const avatars = demoOnly && configuredAvatars.length === 0 ? DEMO_AVATARS : configuredAvatars;

	return (
		<section id="top" data-storefront-section="fashion-apparel-hero-medical" className="relative isolate overflow-hidden bg-slate-950 text-white">
			<Image
				alt={leftImage.alt}
				className="-z-20 object-cover object-center lg:object-[center_42%]"
				fill
				priority
				sizes="100vw"
				src={leftImage.src}
				unoptimized
			/>
			<div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-slate-950/95 via-slate-950/80 to-slate-950/55 lg:bg-linear-to-r lg:from-slate-950/95 lg:via-slate-950/65 lg:to-slate-950/25" />

			<div className="mx-auto flex w-full max-w-[96rem] items-center px-5 py-14 sm:px-8 sm:py-16 lg:min-h-[37.5rem] lg:py-20">
				<div className="min-w-0 max-w-[38rem] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
					<div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white sm:mb-6">
						<Sparkles size={16} aria-hidden="true" className="shrink-0" />
						<span>{section?.subtitle || "Featured collection"}</span>
					</div>
					<h1 className="max-w-[13ch] whitespace-pre-line break-words text-[clamp(2.4rem,5.2vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.045em] text-white">
						{title}
					</h1>
					<p className="mt-5 max-w-[34rem] text-base leading-relaxed !text-white/85 sm:mt-6 sm:text-lg">
						{description}
					</p>
					<a
						className="group mt-8 inline-flex min-h-13 max-w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-950 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-7"
						href={buttonUrl}
					>
						{buttonLabel}
						<ArrowUpRight size={18} aria-hidden="true" className="shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" />
					</a>
					{avatars.length > 0 && (
						<div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
							<ul className="flex max-w-full flex-wrap gap-y-1 -space-x-3" aria-label="Hero avatars">
								{avatars.map((image, index) => (
									<li key={`${image.src}-${index}`} className="size-10 shrink-0 overflow-hidden rounded-full border-2 border-white/90 bg-slate-900 sm:size-11">
										<Image
											alt={image.alt}
											className="h-full w-full object-cover"
											height={44}
											src={image.src}
											width={44}
											unoptimized
										/>
									</li>
								))}
							</ul>
							<div className="min-w-0 leading-snug">
								<strong className="block text-base font-semibold text-white">
									{demoOnly ? "50,000+ Happy Customers" : "Here for your care"}
								</strong>
								<span className="mt-0.5 block text-sm text-white/70">
									{demoOnly ? "Trusted nationwide" : "Medical essentials for everyday needs"}
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}

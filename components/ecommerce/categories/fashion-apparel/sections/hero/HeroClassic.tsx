import Link from "next/link";
import SafeImage from "@/components/common/SafeImage";
import type { FashionSectionProps } from "../../types";

type HeroImage = {
	src: string;
	alt: string;
	href: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const resolveHeroImages = (section: FashionSectionProps["section"]): HeroImage[] => {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const images = Array.isArray(content.images) ? content.images : [];

	return images.flatMap((value, index) => {
		const item = asRecord(value);
		const imageValue = item.image;
		const image = asRecord(imageValue);
		const src = String(typeof imageValue === "string" ? imageValue : image.url || "").trim();

		if (!src) return [];

		return [{
			src,
			alt: String(image.alt || `Hero image ${index + 1}`).trim(),
			href: String(item.url || "#").trim() || "#",
		}];
	});
};

export default function HeroClassic({ section }: FashionSectionProps) {
	const [primary, secondary, tertiary] = resolveHeroImages(section);

	if (!primary) return null;

	const hasSideImages = Boolean(secondary || tertiary);

	return (
		<section data-storefront-section="fashion-apparel-hero-classic" className="container mx-auto px-4 py-10 lg:px-0">
			<div className={hasSideImages ? "grid gap-5 lg:grid-cols-[minmax(0,2.1fr)_minmax(320px,1fr)]" : "grid gap-5"}>
				<Link
					href={primary.href}
					className="group relative block min-h-[320px] overflow-hidden rounded-20 border border-secondary-stroke bg-white md:min-h-[420px] lg:min-h-[560px]"
					aria-label={primary.alt}
				>
					<SafeImage
						priority
						unoptimized
						fill
						sizes={hasSideImages ? "(min-width: 1024px) 67vw, 100vw" : "100vw"}
						src={primary.src}
						alt={primary.alt}
						className="object-cover transition duration-500 group-hover:scale-[1.02]"
					/>
				</Link>

				{hasSideImages ? (
					<div className="grid gap-5">
						{secondary ? (
							<Link
								href={secondary.href}
								className={`group relative block min-h-[220px] overflow-hidden rounded-20 border border-secondary-stroke bg-white md:min-h-[260px] ${tertiary ? "lg:min-h-[270px]" : "lg:min-h-[560px]"}`}
								aria-label={secondary.alt}
							>
								<SafeImage
									unoptimized
									fill
									loading="eager"
									sizes="(min-width: 1024px) 33vw, 100vw"
									src={secondary.src}
									alt={secondary.alt}
									className="object-cover transition duration-500 group-hover:scale-[1.03]"
								/>
							</Link>
						) : null}

						{tertiary ? (
							<Link
								href={tertiary.href}
								className={`group relative block min-h-[220px] overflow-hidden rounded-20 border border-secondary-stroke bg-white md:min-h-[260px] ${secondary ? "lg:min-h-[270px]" : "lg:min-h-[560px]"}`}
								aria-label={tertiary.alt}
							>
								<SafeImage
									unoptimized
									fill
									loading="eager"
									sizes="(min-width: 1024px) 33vw, 100vw"
									src={tertiary.src}
									alt={tertiary.alt}
									className="object-cover transition duration-500 group-hover:scale-[1.03]"
								/>
							</Link>
						) : null}
					</div>
				) : null}
			</div>
		</section>
	);
}

import Image from "next/image";
import type { EcommerceSectionProps } from "@/components/ecommerce/categories/category-contract";
import { resolveApiAssetUrl } from "@/lib/config";

type HeroImage = {
	id: string;
	url: string;
	alt: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const resolveImages = (value: unknown, host: string | null): HeroImage[] => {
	if (!Array.isArray(value)) return [];

	return value.flatMap((item, index) => {
		const record = asRecord(item);
		const image = asRecord(record.image);
		const url = String(image.url || record.url || "").trim();
		if (!url) return [];

		return [{
			id: String(image.id || record.id || `hero-image-${index + 1}`),
			url: resolveApiAssetUrl(url, host),
			alt: String(image.alt || record.alt || "").trim(),
		}];
	});
};

export default function HeroGadgetsFive({ section, host }: EcommerceSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const images = resolveImages(content.images, host);

	if (images.length === 0) return null;

	return (
		<section data-storefront-section="electronics-gadgets-hero-gadgets-five" className="bg-[#f7f7f7] px-6 pt-6" aria-label={images[0]?.alt || "Featured gadgets"}>
			<div className="mx-auto grid w-full max-w-[1376px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1036fr)_minmax(0,315fr)]">
				{images.map((image, index) => (
					<Image
						unoptimized
						alt={image.alt}
						className="h-auto w-full"
						height={528}
						key={image.id}
						priority={index === 0}
						sizes={index === 0 ? "(min-width: 1024px) 75vw, 100vw" : "(min-width: 1024px) 23vw, 100vw"}
						src={image.url}
						width={index === 0 ? 1036 : 315}
					/>
				))}
			</div>
		</section>
	);
}

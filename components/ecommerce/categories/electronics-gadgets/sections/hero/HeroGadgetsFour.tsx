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

const resolveImage = (value: unknown, host: string | null, fallbackId: string): HeroImage | null => {
	const image = asRecord(value);
	const url = String(image.url || "").trim();
	if (!url) return null;

	return {
		id: String(image.id || fallbackId),
		url: resolveApiAssetUrl(url, host),
		alt: String(image.alt || "").trim(),
	};
};

export default function HeroGadgetsFour({ section, host }: EcommerceSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const mainImage = resolveImage(content.main_image, host, "main");
	const sideImages = Array.isArray(content.side_images)
		? content.side_images.flatMap((item, index) => {
			const record = asRecord(item);
			const image = resolveImage(record.image || item, host, `side-${index + 1}`);
			return image ? [image] : [];
		})
		: [];

	if (!mainImage && sideImages.length === 0) return null;

	return (
		<section
			data-storefront-section="electronics-gadgets-hero-gadgets-four"
			className="bg-[#f7f7f7] px-6 pt-6"
			aria-label={mainImage?.alt || sideImages[0]?.alt || "Featured gadgets"}
		>
			<div className="mx-auto grid w-full max-w-[1376px] grid-cols-1 gap-6 bg-[#f5f5f5] lg:grid-cols-[minmax(0,1036fr)_minmax(0,315fr)]">
				{mainImage ? (
					<Image unoptimized alt={mainImage.alt} className="h-auto w-full" height={528} priority sizes="(min-width: 1024px) 75vw, 100vw" src={mainImage.url} width={1036} />
				) : <div />}

				{sideImages.length ? (
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
						{sideImages.map((image) => (
							<Image unoptimized alt={image.alt} className="h-auto w-full" height={252} key={image.id} sizes="(min-width: 1024px) 23vw, (min-width: 640px) 50vw, 100vw" src={image.url} width={315} />
						))}
					</div>
				) : null}
			</div>
		</section>
	);
}

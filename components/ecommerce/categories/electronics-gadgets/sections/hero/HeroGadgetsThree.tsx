import Image from "next/image";
import type { EcommerceSectionProps } from "@/components/ecommerce/categories/category-contract";
import { resolveApiAssetUrl } from "@/lib/config";

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

type HeroImage = {
	url: string;
	alt: string;
};

const resolveImage = (value: unknown, host: string | null): HeroImage | null => {
	const image = asRecord(value);
	const url = String(image.url || "").trim();
	if (!url) return null;

	return {
		url: resolveApiAssetUrl(url, host),
		alt: String(image.alt || "").trim(),
	};
};

export default function HeroGadgetsThree({ section, host }: EcommerceSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const mainImage = resolveImage(content.main_image, host);
	const bannerImage = resolveImage(content.banner_image, host);

	return (
		<section
			data-storefront-section="electronics-gadgets-hero-gadgets-three"
			className="min-h-screen bg-[#f7f7f7]"
			aria-label={mainImage?.alt || bannerImage?.alt || "Featured electronics and gadgets"}
		>
			{mainImage ? (
				<Image
					unoptimized
					alt={mainImage.alt}
					className="h-auto w-full"
					height={678}
					priority
					sizes="100vw"
					src={mainImage.url}
					width={1920}
				/>
			) : null}

			{bannerImage ? (
				<div className="mx-auto w-full max-w-[1790px] px-6 py-6">
					<Image
						unoptimized
						alt={bannerImage.alt}
						className="h-auto w-full"
						height={362}
						sizes="(min-width: 1790px) 1742px, calc(100vw - 48px)"
						src={bannerImage.url}
						width={1742}
					/>
				</div>
			) : null}
		</section>
	);
}

import Image from "next/image";
import Link from "next/link";
import type { EcommerceSectionProps } from "@/components/ecommerce/categories/category-contract";
import { resolveApiAssetUrl } from "@/lib/config";

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

export default function HeroGadgetsTwo({ section, host }: EcommerceSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const background = asRecord(content.background);
	const backgroundUrl = String(background.url || "").trim();
	const backgroundAlt = String(background.alt || "").trim();
	const eyebrow = String(content.eyebrow || "").trim();
	const title = String(content.title || "").trim();
	const description = String(content.description || "").trim();
	const price = String(content.price || "").trim();
	const buttonLabel = String(content.button_label || "").trim();
	const buttonUrl = String(content.button_url || "").trim();

	return (
		<section
			data-storefront-section="electronics-gadgets-hero-gadgets-two"
			className="relative min-h-[720px] overflow-hidden bg-[#8e9091] lg:min-h-[928px]"
			aria-label={backgroundAlt || title || "Featured product"}
		>
			{backgroundUrl ? (
				<Image
					unoptimized
					alt={backgroundAlt || title}
					className="object-cover object-center"
					fill
					priority
					sizes="100vw"
					src={resolveApiAssetUrl(backgroundUrl, host)}
				/>
			) : null}

			<div className="absolute inset-x-0 bottom-[84px] z-10 mx-auto flex w-full max-w-[1700px] flex-col gap-7 px-6 text-white sm:px-10 lg:flex-row lg:items-end lg:justify-between lg:px-6">
				{eyebrow || title || description ? (
					<div className="max-w-[560px] drop-shadow-[0_2px_8px_rgb(0_0_0/0.28)]">
						{eyebrow || title ? (
							<h1 className="text-[40px] leading-[1.12] font-bold tracking-[-0.03em] sm:text-[52px] lg:text-[64px]">
								{eyebrow ? <span className="block">{eyebrow}</span> : null}
								{title ? <span className="block">{title}</span> : null}
							</h1>
						) : null}
						{description ? <p className="mt-4 max-w-[550px] text-sm leading-6 sm:text-base">{description}</p> : null}
					</div>
				) : null}

				{price || (buttonLabel && buttonUrl) ? (
					<div className="flex h-[57px] w-fit items-center rounded-full border border-white/90 bg-white/10 p-1.5 pl-5 backdrop-blur-[2px]">
						{price ? <span className="mr-4 text-xl font-bold">{price}</span> : null}
						{buttonLabel && buttonUrl ? (
							<Link className="flex h-[41px] items-center rounded-full bg-[#087fe7] px-5 text-base font-medium transition-colors hover:bg-[#006dce]" href={buttonUrl}>
								{buttonLabel}
							</Link>
						) : null}
					</div>
				) : null}
			</div>
		</section>
	);
}

import Image from "next/image";
import Link from "next/link";
import type { EcommerceSectionProps } from "@/components/ecommerce/categories/category-contract";
import { resolveApiAssetUrl } from "@/lib/config";

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

export default function LumiNexAssistant({ section, host }: EcommerceSectionProps) {
	const content = asRecord(asRecord(section.config).content);
	const logo = asRecord(content.logo);
	const logoUrl = String(logo.url || "").trim();
	const name = String(content.name || "").trim();
	const description = String(content.description || "").trim();
	const label = String(content.accessibility_label || name || description || "Shopping assistant").trim();
	const buttonUrl = String(content.button_url || "").trim();

	if (!logoUrl && !name && !description) return null;

	const assistantContent = (
		<>
			{logoUrl ? <Image unoptimized alt="" className="size-[59px] shrink-0 object-contain" height={63} src={resolveApiAssetUrl(logoUrl, host)} width={59} /> : null}
			{name || description ? <span className="flex flex-col gap-1">
				{name ? <strong className="text-sm font-semibold">{name}</strong> : null}
				{description ? <span className="text-sm">{description}</span> : null}
			</span> : null}
		</>
	);
	const className = "fixed bottom-4 right-4 z-30 flex h-[84px] w-[calc(100vw-2rem)] max-w-[340px] items-center gap-4 rounded-[14px] bg-white px-5 text-left text-[#242424] shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5 sm:right-6";

	return buttonUrl
		? <Link aria-label={label} className={className} data-storefront-section="groceries-essentials-assistant-luminex" href={buttonUrl}>{assistantContent}</Link>
		: <aside aria-label={label} className={className} data-storefront-section="groceries-essentials-assistant-luminex">{assistantContent}</aside>;
}

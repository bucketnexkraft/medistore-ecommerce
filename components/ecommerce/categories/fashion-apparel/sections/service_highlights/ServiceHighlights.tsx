import { CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react";
import sectionSchemas from "@/api/config/storefront_section_schemas.json";
import type { FashionSectionProps } from "../../types";
import styles from "./ServiceHighlights.module.css";

type HighlightIcon = "shield" | "truck" | "payment" | "support";
type Highlight = { icon?: string; title?: string; description?: string };

const icons = {
	shield: { Component: ShieldCheck, color: "bg-blue-500" },
	truck: { Component: Truck, color: "bg-emerald-500" },
	payment: { Component: CreditCard, color: "bg-orange-500" },
	support: { Component: Headphones, color: "bg-cyan-500" },
} satisfies Record<HighlightIcon, { Component: typeof ShieldCheck; color: string }>;

const schema = sectionSchemas["Fashion & Apparel"].service_highlights["service-highlights"];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export default function ServiceHighlights({ section }: FashionSectionProps) {
	const sectionConfig = section.config && typeof section.config === "object" ? section.config as Record<string, unknown> : {};
	const content = sectionConfig.content && typeof sectionConfig.content === "object"
		? sectionConfig.content as { items?: Highlight[] }
		: {};
	const configuredItems = Array.isArray(content.items) ? content.items : schema.items.default;
	const items = configuredItems.filter((item) => text(item?.title));

	if (!items.length) return null;

	return (
		<section
			data-storefront-section="fashion-apparel-service-highlights"
			aria-label="Store service highlights"
			className={`${styles.section} relative z-10 flow-root bg-slate-50 pb-8`}
		>
			<ul className={`${styles.cards} mx-auto grid w-full max-w-[96rem] grid-cols-1 gap-3 px-5 sm:grid-cols-2 sm:gap-4 sm:px-8 lg:grid-cols-4 lg:gap-5`}>
				{items.map((item, index) => {
					const key = text(item.icon) as HighlightIcon;
					const { Component: Icon, color } = Object.hasOwn(icons, key) ? icons[key] : icons.shield;
					return (
						<li key={`${text(item.title)}-${index}`} className="flex min-w-0 items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_26px_rgba(15,23,42,0.14)] sm:gap-4 sm:p-5">
							<span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm sm:size-16 ${color}`}>
								<Icon aria-hidden="true" className="size-7 sm:size-8" />
							</span>
							<span className="min-w-0">
								<strong className="block break-words text-base font-bold leading-tight text-slate-800 sm:text-lg">{text(item.title)}</strong>
								{item.description ? <span className="mt-1 block break-words text-sm leading-snug text-slate-500">{text(item.description)}</span> : null}
							</span>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

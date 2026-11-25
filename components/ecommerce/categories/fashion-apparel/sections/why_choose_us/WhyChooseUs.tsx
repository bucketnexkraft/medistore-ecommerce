import Link from "next/link";
import { useId } from "react";
import { ArrowRight, Award, CreditCard, Headphones, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import sectionSchemas from "@/api/config/storefront_section_schemas.json";
import type { FashionSectionProps } from "../../types";

const benefitIcons = {
	shield: { Icon: ShieldCheck, classes: "bg-blue-100 text-blue-700" },
	truck: { Icon: Truck, classes: "bg-emerald-100 text-emerald-700" },
	headphones: { Icon: Headphones, classes: "bg-orange-100 text-orange-700" },
	award: { Icon: Award, classes: "bg-cyan-100 text-cyan-800" },
	returns: { Icon: RefreshCw, classes: "bg-rose-100 text-rose-700" },
	payment: { Icon: CreditCard, classes: "bg-teal-100 text-teal-700" },
};

type BenefitIcon = keyof typeof benefitIcons;
type Benefit = { icon?: string; title?: string; description?: string };
type Stat = { value?: string; label?: string };
type SectionContent = {
	eyebrow?: string;
	heading?: string;
	subheading?: string;
	benefits?: Benefit[];
	cta_heading?: string;
	cta_description?: string;
	browse_label?: string;
	browse_url?: string;
	contact_label?: string;
	contact_url?: string;
	show_stats?: boolean;
	stats?: Stat[];
};

const schema = sectionSchemas["Fashion & Apparel"].why_choose_us["why-choose-us"];

const demoBenefits: Record<BenefitIcon, { title: string; description: string }> = {
	shield: { title: "100% Genuine Products", description: "Medical supplies come from authorized distributors with product documentation and warranty coverage." },
	truck: { title: "Nationwide Delivery", description: "Ship to all 64 districts in Bangladesh and track your order as it is delivered." },
	headphones: { title: "24/7 Product Support", description: "Talk to medical equipment specialists whenever you need help with products or orders." },
	award: { title: "Equipment Quality Checks", description: "Equipment is checked against quality standards before it reaches customers." },
	returns: { title: "Easy Returns", description: "Return defective products within 7 days for a full refund, subject to the return policy." },
	payment: { title: "Secure Payment", description: "Choose bKash, Nagad, card payment, or cash on delivery at checkout." },
};

const demoStats = [
	{ value: "50K+", label: "Happy Customers" },
	{ value: "10K+", label: "Products" },
	{ value: "500+", label: "Partners" },
	{ value: "8+", label: "Years in Business" },
];

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const link = (value: unknown) => {
	const href = text(value);
	return /^(?:\/(?![\/\\])|#[\w-]+$|https?:\/\/[^/\\\s]+|mailto:[^\s]+|tel:\+?[\d(). -]+$)/i.test(href)
		&& !/[\\\u0000-\u001f\u007f]/.test(href) ? href : "";
};

export default function WhyChooseUs({ section, demoOnly }: FashionSectionProps) {
	const headingId = useId();
	const content = (section.config as { content?: SectionContent } | undefined)?.content ?? {};
	const withDemoDefault = (value: string | undefined, defaultValue: string, demoValue: string) => {
		const configured = text(value);
		return demoOnly && (!configured || configured === defaultValue) ? demoValue : configured;
	};
	const eyebrow = text(content.eyebrow) || (demoOnly ? "Medical Store Benefits" : "");
	const heading = text(content.heading) || text(section.title) || "Why Choose Us?";
	const subheading = withDemoDefault(content.subheading, schema.subheading.default, "Get the healthcare equipment and specialist support you need, wherever you are in Bangladesh.") || text(section.subtitle);
	const benefits = (Array.isArray(content.benefits) ? content.benefits : schema.benefits.default).filter((benefit) => text(benefit?.title));
	const bannerHeading = withDemoDefault(content.cta_heading, schema.cta_heading.default, "Find Premium Healthcare Equipment");
	const bannerDescription = withDemoDefault(content.cta_description, schema.cta_description.default, "Shop equipment for clinics, labs, and home care, with guidance from a team that understands your needs.");
	const browseHref = link(content.browse_url ?? schema.browse_url.default);
	const browseLabel = text(content.browse_label ?? schema.browse_label.default);
	const contactHref = link(content.contact_url) || (demoOnly ? "https://www.medistorebd.com/contact" : "");
	const contactLabel = text(content.contact_label ?? schema.contact_label.default);
	const showBrowse = browseHref && browseLabel;
	const showContact = contactHref && contactLabel;
	const configuredStats = Array.isArray(content.stats) ? content.stats.filter((stat) => text(stat?.value) && text(stat?.label)) : [];
	const stats = content.show_stats === false ? [] : configuredStats.length ? configuredStats : demoOnly ? demoStats : [];

	return (
		<section
			data-storefront-section="fashion-apparel-why-choose-us"
			aria-labelledby={headingId}
			className="bg-linear-to-b from-slate-50 to-white py-12 text-[#152841] md:py-16 lg:py-20"
		>
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					{eyebrow && <span className="mb-3 inline-flex rounded-full bg-blue-100 px-3.5 py-1 text-xs font-semibold tracking-wide text-blue-900 uppercase">{eyebrow}</span>}
					<h2 id={headingId} className="text-3xl leading-tight font-bold tracking-tight md:text-[2.375rem]">{heading}</h2>
					{subheading && <p className="mt-3 text-base leading-relaxed font-normal! text-slate-600!">{subheading}</p>}
				</div>
				{benefits.length > 0 && (
					<ul aria-label="Store benefits" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3 lg:gap-6">
						{benefits.map((benefit, index) => {
							const icon = text(benefit.icon);
							const { Icon, classes } = Object.hasOwn(benefitIcons, icon) ? benefitIcons[icon as BenefitIcon] : benefitIcons.shield;
							const defaultCard = demoOnly && schema.benefits.default.find((card) =>
								card.title === benefit.title || card.description === benefit.description
							);
							const demoCard = defaultCard ? demoBenefits[defaultCard.icon as BenefitIcon] : undefined;
							const title = demoCard && defaultCard && benefit.title === defaultCard.title
								? demoCard.title
								: text(benefit.title);
							const description = demoCard && defaultCard && benefit.description === defaultCard.description
								? demoCard.description
								: text(benefit.description);

							return (
								<li key={index} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
									<span className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${classes}`}>
										<Icon className="size-6" aria-hidden="true" />
									</span>
									<h3 className="text-lg font-bold wrap-break-word">{title}</h3>
									{description && <p className="mt-2 text-sm leading-relaxed font-normal! wrap-break-word text-slate-600!">{description}</p>}
								</li>
							);
						})}
					</ul>
				)}
				{(bannerHeading || bannerDescription || showBrowse || showContact || stats.length > 0) && (
					<div className="mt-9 flex flex-col gap-6 rounded-2xl bg-linear-to-br from-[#243c5b] to-[#101f35] p-6 text-white md:mt-12 md:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
						{(bannerHeading || bannerDescription || showBrowse || showContact) && (
							<div className="min-w-0 max-w-xl">
								{bannerHeading && <h3 className="text-2xl leading-tight font-bold wrap-break-word md:text-3xl">{bannerHeading}</h3>}
								{bannerDescription && <p className="mt-2 text-sm leading-relaxed font-normal! wrap-break-word text-slate-200! md:text-base">{bannerDescription}</p>}
								{(showBrowse || showContact) && (
									<div className="mt-5 flex flex-wrap gap-3">
										{showBrowse && (
											<Link href={browseHref} className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold wrap-break-word text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
												<span className="min-w-0">{browseLabel}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" />
											</Link>
										)}
										{showContact && (
											<Link href={contactHref} className="inline-flex min-h-11 max-w-full items-center justify-center rounded-lg border border-white/50 px-4 py-2.5 text-sm font-semibold wrap-break-word text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
												{contactLabel}
											</Link>
										)}
									</div>
								)}
							</div>
						)}
						{stats.length > 0 && (
							<dl aria-label="Store statistics" className="grid w-full gap-3 min-[360px]:grid-cols-2 lg:max-w-sm">
								{stats.map((stat, index) => (
									<div key={index} className="flex min-w-0 flex-col-reverse gap-1 rounded-lg border border-white/10 bg-white/10 px-3 py-4 text-center">
										<dt className="text-xs wrap-break-word text-slate-200 sm:text-sm">{text(stat.label)}</dt>
										<dd className="text-2xl font-bold wrap-break-word tabular-nums">{text(stat.value)}</dd>
									</div>
								))}
							</dl>
						)}
					</div>
				)}
			</div>
		</section>
	);
}

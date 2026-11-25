"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Pause, Percent, Play, Zap } from "lucide-react";
import type { FashionSectionProps } from "../../types";
import { asRecord, textValue, useBrandStripData } from "./brand-showcase-data";
import styles from "./BrandShowcase.module.css";

type Logo = { id: string; name: string; image: string; url?: string };

const fallbackLogos: Logo[] = [
	{ id: "microlife", name: "Microlife", image: "/images/brand-showcase/microlife.webp" },
	{ id: "omron", name: "Omron", image: "/images/brand-showcase/omron.webp" },
	{ id: "beurer", name: "Beurer", image: "/images/brand-showcase/beurer.webp" },
	{ id: "rossmax", name: "Rossmax", image: "/images/brand-showcase/rossmax.webp" },
];

const promotions = [
	{
		id: "flash-sale",
		title: "Flash Sale",
		subtitle: "Limited-time offers",
		demoSubtitle: "Up to 40% Off",
		description: "Find deals on selected products.",
		demoDescription: "Limited-time offers on selected medical equipment.",
		href: "/limited-sale",
		icon: Zap,
		background: "from-[#cb4e08] via-[#cc4c18] to-[#ed695c]",
	},
	{
		id: "new-arrivals",
		title: "New Arrivals",
		subtitle: "Recently added",
		demoSubtitle: "Latest Equipment",
		description: "Explore the latest additions to our catalog.",
		demoDescription: "Explore the latest additions to our medical catalog.",
		href: "/new-arrival",
		icon: Gift,
		background: "from-[#168448] via-[#0d855e] to-[#30a99a]",
	},
	{
		id: "bundle-deals",
		title: "Bundle Deals",
		subtitle: "Shop together",
		demoSubtitle: "Save More",
		description: "Discover deals you can shop together.",
		demoDescription: "Save up to 25% when you buy together.",
		href: "/group-purchase",
		icon: Percent,
		background: "from-[#2869c7] via-[#1b76bb] to-[#289fba]",
	},
];

const logoClass = "group relative flex h-20 w-36 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-center shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-800 sm:h-24 sm:w-44";

function BrandLogo({ logo }: { logo: Logo }) {
	const [failed, setFailed] = useState(false);
	const hasImage = !failed && /^(?:\/(?!\/)|https?:\/\/)/i.test(logo.image)
		&& !/\/placeholder\.jpg(?:[?#]|$)/i.test(logo.image);

	if (!hasImage) {
		return <span className="line-clamp-2 text-sm font-semibold text-neutral-700">{logo.name}</span>;
	}

	return (
		<Image
			src={logo.image}
			alt={logo.name}
			fill
			unoptimized
			sizes="(min-width: 640px) 176px, 144px"
			className="object-contain px-4 py-4 sm:px-5"
			onError={() => setFailed(true)}
		/>
	);
}

function LogoStrip({ logos }: { logos: Logo[] }) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const groupRef = useRef<HTMLUListElement>(null);
	const stripId = useId();
	const [cycle, setCycle] = useState({ width: 0, repeats: 0 });
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		const viewport = viewportRef.current;
		const group = groupRef.current;
		if (!viewport || !group) return;
		const measure = () => {
			const width = group.getBoundingClientRect().width;
			if (!width || !viewport.clientWidth) return;
			const repeats = Math.ceil(viewport.clientWidth / width);
			setCycle((current) => current.width === width && current.repeats === repeats ? current : { width, repeats });
		};
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(group);
		measure();
		return () => observer.disconnect();
	}, []);

	const trackStyle = {
		"--brand-cycle": `${cycle.width}px`,
		"--brand-duration": `${Math.max(4, cycle.width / 55)}s`,
	} as CSSProperties;

	function renderLogos(duplicate: boolean) {
		return logos.map((logo) => (
			<li key={logo.id} className="shrink-0">
				{logo.url ? (
					<Link href={logo.url} tabIndex={duplicate ? -1 : undefined} className={logoClass}>
						<BrandLogo key={logo.image} logo={logo} />
					</Link>
				) : (
					<div className={logoClass}>
						<BrandLogo key={logo.image} logo={logo} />
					</div>
				)}
			</li>
		));
	}

	return (
		<div className="relative">
			<div id={stripId} ref={viewportRef} className={styles.viewport} data-animated={cycle.repeats > 0} data-paused={paused}>
				<div className={styles.track} style={trackStyle}>
					<ul ref={groupRef} className={styles.group} aria-label="Partner brands">
						{renderLogos(false)}
					</ul>
					{Array.from({ length: cycle.repeats }, (_, index) => (
						<ul key={index} aria-hidden="true" className={`${styles.group} ${styles.repeat}`}>
							{renderLogos(true)}
						</ul>
					))}
				</div>
			</div>
			{cycle.repeats > 0 && (
				<button
					type="button"
					aria-controls={stripId}
					aria-label={paused ? "Play brand animation" : "Pause brand animation"}
					onClick={() => setPaused(!paused)}
					className={`${styles.control} absolute right-4 -bottom-7 size-9 cursor-pointer place-items-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900 sm:right-6`}
				>
					{paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
				</button>
			)}
		</div>
	);
}

function countLabel(value: unknown, fallback: string) {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return new Intl.NumberFormat("en").format(value);
	}
	return textValue(value, fallback);
}

function PromotionCards({ items, demoOnly }: { items: unknown; demoOnly?: boolean }) {
	const configured = Array.isArray(items) && items.length ? items : promotions.map(() => null);

	return (
		<ul aria-label="Store promotions" className="container mx-auto mt-12 grid grid-cols-1 gap-4 px-4 sm:px-6 md:mt-16 md:grid-cols-3 lg:gap-6 lg:px-8">
			{configured.map((value, index) => {
				const { id, title, subtitle, demoSubtitle, description, demoDescription, href, icon: Icon, background } = promotions[index % promotions.length];
				const card = asRecord(value);
				const image = typeof card.image === "string" ? card.image : asRecord(card.image).url;
				const imageSrc = textValue(image, "");
				const cardHref = textValue(card.url, "");
				const destination = /^(?:\/(?!\/)|https?:\/\/|#)/i.test(cardHref) ? cardHref : href;

				return (
					<li key={`${id}-${index}`} className="min-w-0">
						<Link
							href={destination}
							className={`group relative isolate flex h-full min-h-48 flex-col overflow-hidden rounded-2xl bg-linear-to-r ${background} p-5 text-white shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-800 lg:p-6`}
						>
							<div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/2 opacity-30 [mask-image:linear-gradient(to_right,transparent,black)] transition-opacity group-hover:opacity-50 group-focus-visible:opacity-50 motion-reduce:transition-none">
								<Image
									alt=""
									src={/^(?:\/(?!\/)|https?:\/\/)/i.test(imageSrc) ? imageSrc : `/images/brand-showcase/${id}.webp`}
									fill
									unoptimized
									sizes="(min-width: 768px) 17vw, 50vw"
									className="object-cover object-center"
								/>
							</div>
							<span className="mb-3 grid size-12 shrink-0 place-items-center rounded-xl bg-white/20">
								<Icon aria-hidden="true" className="size-6" />
							</span>
							<h3 className="text-xl leading-tight font-bold lg:text-2xl">{textValue(card.title, title)}</h3>
							<span className="text-sm font-semibold lg:text-base">{textValue(card.subtitle, demoOnly ? demoSubtitle : subtitle)}</span>
							<div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-2">
								<span className="min-w-32 flex-1 text-sm">{textValue(card.description, demoOnly ? demoDescription : description)}</span>
								<span aria-hidden="true" className={`${styles.promoAction} ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-neutral-900`}>
									Shop Now <ArrowRight className="size-3.5" />
								</span>
							</div>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

export default function BrandShowcase(props: FashionSectionProps) {
	const { config, content, dataModel, itemsAllow, loading, visibleBrands, stats } = useBrandStripData(props);
	const headingId = useId();
	const sectionTitle = textValue(props.section.title, "");
	const heading = textValue(content.heading ?? content.title ?? config.heading, sectionTitle && sectionTitle.toLowerCase() !== "brand showcase" ? sectionTitle : "Our Partner Brands");
	const subheading = textValue(content.subheading ?? content.sub_title ?? config.subheading, textValue(props.section.subtitle, "Discover the brands behind our products."));
	const logos = visibleBrands.length ? visibleBrands : fallbackLogos.slice(0, itemsAllow);
	const values = { ...asRecord(content.stats), ...content, ...(props.demoOnly || visibleBrands.length ? stats : undefined) };
	const figures = [
		{ label: "Partner Brands", value: props.demoOnly && !visibleBrands.length ? String(logos.length) : countLabel(values.brands_count, "") },
		{ label: "Products Available", value: countLabel(values.products_count, props.demoOnly ? "10,000+" : "") },
		{ label: "Authenticity Rate", value: textValue(values.authenticity_rate, props.demoOnly ? "99%" : "") },
		{ label: "Support Available", value: textValue(values.support_availability, props.demoOnly ? "24/7" : "") },
	].filter(({ value }) => value);

	if (dataModel !== "brands") return null;

	return (
		<section data-storefront-section="fashion-apparel-brand-showcase" aria-labelledby={headingId} aria-busy={loading} className="bg-neutral-50 py-10 text-neutral-900 md:py-14">
			<div className="container mx-auto mb-6 px-4 text-center md:mb-8">
				<h2 id={headingId} className="text-2xl font-bold md:text-3xl">{heading}</h2>
				<p className="mt-2 text-sm font-normal! text-neutral-600! md:text-base">{subheading}</p>
			</div>
			{loading ? <div className="h-24 bg-neutral-100 motion-safe:animate-pulse" aria-hidden="true" /> : <LogoStrip logos={logos} />}
			{!loading && figures.length > 0 && (
				<dl className="mx-auto mt-10 grid max-w-4xl grid-cols-2 justify-items-center gap-5 px-4 text-center md:flex md:flex-wrap md:justify-center md:gap-x-12">
					{figures.map(({ label, value }) => (
						<div key={label} className="flex min-w-0 flex-col-reverse gap-0.5">
							<dt className="text-xs text-neutral-600 sm:text-sm">{label}</dt>
							<dd className="text-2xl font-bold tabular-nums sm:text-3xl md:text-4xl">{value}</dd>
						</div>
					))}
				</dl>
			)}
			<PromotionCards items={content.promotions} demoOnly={props.demoOnly} />
		</section>
	);
}

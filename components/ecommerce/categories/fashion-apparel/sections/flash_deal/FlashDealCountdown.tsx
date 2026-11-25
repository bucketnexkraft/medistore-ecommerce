"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SafeImage from "@/components/common/SafeImage";
import { useAmount } from "@/lib/amount";
import { getCountdownParts, useFlashDealSection, ZERO_PARTS, type FlashDealProduct } from "./flash-deal-data";
import type { FashionSectionProps } from "../../types";

function Countdown({ endsAt }: { endsAt: string | null }) {
	const [nowMs, setNowMs] = useState<number | null>(null);
	const countdown = useMemo(() => nowMs === null ? ZERO_PARTS : getCountdownParts(endsAt, nowMs), [endsAt, nowMs]);

	useEffect(() => {
		if (!endsAt) return;

		const initialTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
		const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
		return () => {
			window.clearTimeout(initialTimer);
			window.clearInterval(timer);
		};
	}, [endsAt]);

	return (
		<div className="flex flex-wrap gap-2" aria-label="Flash deal time remaining" aria-live="polite">
			{[
				["Days", countdown.days],
				["Hours", countdown.hours],
				["Min", countdown.minutes],
				["Sec", countdown.seconds],
			].map(([label, value]) => (
				<div key={label} className="min-w-16 rounded-2xl border border-[#f3d9c7] bg-white/85 px-2.5 py-2 text-center shadow-sm">
					<div className="text-lg font-bold leading-none text-primary-black">{value}</div>
					<div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-body">{label}</div>
				</div>
			))}
		</div>
	);
}

function ProductCard({ product, formatPrice }: { product: FlashDealProduct; formatPrice: (value: number) => string }) {
	const stockLabel = product.quantity > 0 ? `${product.quantity} in stock` : "Selling fast";
	const metaLabel = product.reviews > 0 && product.rating !== null ? `${product.rating.toFixed(1)} rating` : "Limited";

	return (
		<article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
			<Link href={product.url} className="relative block aspect-[4/3] overflow-hidden bg-gray-100" aria-label={product.name}>
				<SafeImage
					unoptimized
					src={product.image}
					alt={product.name}
					fill
					sizes="(min-width: 1280px) 280px, (min-width: 640px) 42vw, 90vw"
					className="object-cover transition duration-300 group-hover:scale-105"
				/>
				{product.discountPercent > 0 ? (
					<span className="absolute left-3 top-3 rounded-full bg-primary-green px-2.5 py-1 text-xs font-bold text-white">-{product.discountPercent}%</span>
				) : null}
			</Link>

			<div className="flex items-center justify-between gap-2 bg-primary-green px-3 py-2 text-xs text-white">
				<span className="truncate font-semibold">{product.brand || product.category}</span>
				<span className="shrink-0 rounded bg-white px-2 py-1 font-medium text-primary-black">{metaLabel}</span>
			</div>

			<Link href={product.url} className="flex flex-1 flex-col p-4">
				<h3 className="line-clamp-2 min-h-12 text-lg font-bold leading-snug text-primary-black transition-colors group-hover:text-secondary-red">{product.name}</h3>
				<div className="mt-3 flex flex-wrap items-baseline gap-2">
					<span className="text-xl font-bold text-primary-black">{formatPrice(product.price)}</span>
					{product.originalPrice > product.price ? <span className="text-sm text-gray-500 line-through">{formatPrice(product.originalPrice)}</span> : null}
				</div>
				<p className="mt-auto pt-3 text-sm font-medium text-primary-body">{stockLabel}</p>
			</Link>
		</article>
	);
}

function FlashDealSkeleton({ itemCount }: { itemCount: number }) {
	return (
		<section className="container mx-auto my-14 rounded-[30px] border border-[#f3d9c7] bg-white p-6 md:p-8" aria-busy="true">
			<div className="mb-8 space-y-3">
				<div className="h-8 w-52 animate-pulse rounded bg-gray-200" />
				<div className="h-4 w-full max-w-xl animate-pulse rounded bg-gray-100" />
			</div>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{Array.from({ length: itemCount }).map((_, index) => (
					<div key={index} className="overflow-hidden rounded-2xl border border-gray-100 p-3">
						<div className="aspect-[4/3] animate-pulse rounded-xl bg-gray-100" />
						<div className="mt-4 h-5 w-4/5 animate-pulse rounded bg-gray-200" />
						<div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-gray-100" />
					</div>
				))}
			</div>
		</section>
	);
}

export default function FlashDealCountdown({ section, host, demoOnly, showEmptyState = false, formatPagePrice }: FashionSectionProps & {
	showEmptyState?: boolean;
	formatPagePrice?: (value: number) => string;
}) {
	const { products, endsAt, loading, enabled, itemsAllow, heading, subheading, buttonText, buttonLink, formatPrice } = useFlashDealSection({ section, host, demoOnly });

	if (!enabled) return null;
	if (loading) return <FlashDealSkeleton itemCount={Math.min(itemsAllow, 4)} />;
	if (products.length === 0) return showEmptyState ? (
		<section className="section py-10" aria-label="Flash deal availability">
			<div className="rounded-xl border border-border p-6 text-center">
				<p>No flash deals to display right now.</p>
				<Link href={buttonLink} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground transition-colors hover:bg-primary/85">
					{buttonText}
				</Link>
			</div>
		</section>
	) : null;

	const displayPrice = formatPagePrice ?? formatPrice;
	const heroProduct = products[0];
	const gridProducts = products.slice(1);

	return (
		<section data-storefront-section="fashion-apparel-flash-deal-countdown" className="section my-14">
			<div className="overflow-hidden rounded-[30px] border border-[#f3d9c7] bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#fff1f2_100%)] p-6 shadow-[0_24px_60px_rgba(234,88,12,0.10)] md:p-8 lg:p-10">
				<div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl">
						<span className="inline-flex rounded-full bg-[#111827] px-4 py-2 text-sm font-semibold text-white">Flash deal</span>
						<h2 className="mt-4 text-3xl font-bold text-primary-black md:text-4xl">{heading}</h2>
						{subheading ? <p className="mt-3 text-base leading-7 text-primary-body">{subheading}</p> : null}
					</div>

					<div className="flex flex-col items-start gap-4 lg:items-end">
						<Countdown endsAt={endsAt} />
						<Link href={buttonLink} className="inline-flex items-center rounded-full bg-primary-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
							{buttonText}
						</Link>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)]">
					<Link href={heroProduct.url} className="group relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#1f2937_0%,#c2410c_52%,#fb7185_100%)] p-7 text-white">
						<div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_210px] md:items-center">
							<div className="flex h-full flex-col justify-between gap-6">
								<div>
									<span className="inline-flex rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">{heroProduct.discountPercent > 0 ? `${heroProduct.discountPercent}% off` : "Limited time"}</span>
									<h3 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">{heroProduct.name}</h3>
									<p className="mt-3 text-sm font-semibold text-white/80">{heroProduct.brand || heroProduct.category}</p>
								</div>
								<div>
								<p className="text-3xl font-bold">{displayPrice(heroProduct.price)}</p>
								{heroProduct.originalPrice > heroProduct.price ? <p className="mt-1 text-sm text-white/70 line-through">{displayPrice(heroProduct.originalPrice)}</p> : null}
								</div>
							</div>
							<div className="relative min-h-48 overflow-hidden rounded-2xl bg-white/10">
								<SafeImage unoptimized src={heroProduct.image} alt={heroProduct.name} fill sizes="240px" className="object-contain p-4 transition duration-300 group-hover:scale-105" />
							</div>
						</div>
					</Link>

					{gridProducts.length > 0 ? (
						<div className="grid gap-5 sm:grid-cols-2">
							{gridProducts.map((product) => <ProductCard key={product.id} product={product} formatPrice={displayPrice} />)}
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}

export function FlashDealsPageContent({ host, demoOnly }: Pick<FashionSectionProps, "host" | "demoOnly">) {
	const { formatAmount } = useAmount();

	return (
		<main className="pb-8">
			<div className="section pt-8 md:pt-12">
				<h1 className="text-3xl font-bold tracking-tight md:text-4xl">Flash Deals</h1>
			</div>
			<FlashDealCountdown
				section={{ title: "Current offers", config: { data: { items_allow: 24 } } }}
				host={host}
				demoOnly={demoOnly}
				sections={[]}
				index={0}
				showEmptyState
				formatPagePrice={formatAmount}
			/>
		</main>
	);
}

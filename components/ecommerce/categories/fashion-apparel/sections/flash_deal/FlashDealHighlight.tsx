"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock3, Star, Tag } from "lucide-react";
import { A11y, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import SafeImage from "@/components/common/SafeImage";
import type { FashionSectionProps } from "../../types";
import { getCountdownParts, useFlashDealSection, ZERO_PARTS, type FlashDealProduct } from "./flash-deal-data";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/a11y";

function HighlightCountdown({ endsAt }: { endsAt: string | null }) {
	const [nowMs, setNowMs] = useState<number | null>(null);
	const endTime = endsAt ? new Date(endsAt).getTime() : NaN;
	const hasDeadline = Number.isFinite(endTime);
	const countdown = nowMs === null ? ZERO_PARTS : getCountdownParts(endsAt, nowMs);
	const expired = hasDeadline && nowMs !== null && nowMs >= endTime;

	useEffect(() => {
		if (!hasDeadline) return;

		const initialTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
		const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
		return () => {
			window.clearTimeout(initialTimer);
			window.clearInterval(timer);
		};
	}, [endsAt, hasDeadline]);

	if (!hasDeadline) return null;

	return (
		<div className="w-full max-w-xs shrink-0">
			<div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary-body">
				<Clock3 className="size-4" aria-hidden="true" />
				<span>{expired ? "Offer ended" : "Offer ends in"}</span>
			</div>
			<div role="timer" aria-label="Flash deal time remaining" aria-live="off" className="grid grid-cols-4 gap-2">
				{[
					["Days", countdown.days],
					["Hours", countdown.hours],
					["Min", countdown.minutes],
					["Sec", countdown.seconds],
				].map(([label, value]) => (
					<div key={label} className="rounded-lg bg-primary-blue px-2 py-3 text-center text-white">
						<div className="text-xl font-semibold tabular-nums">{value}</div>
						<div className="mt-1 text-sm font-medium text-white/75">{label}</div>
					</div>
				))}
			</div>
		</div>
	);
}

function DealTicket({ product, formatPrice }: { product: FlashDealProduct; formatPrice: (value: number) => string }) {
	const rating = product.rating !== null && product.reviews > 0 ? product.rating.toFixed(1) : null;
	const saving = Math.max(0, product.originalPrice - product.price);

	return (
		<article className="h-full">
			<Link
				href={product.url}
				className="group grid h-full grid-cols-[minmax(0,1fr)_5rem] overflow-hidden rounded-xl border border-gray-200 bg-white text-primary-black transition-shadow hover:ring-2 hover:ring-primary-blue/20 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary-blue sm:grid-cols-[minmax(0,1fr)_6rem]"
			>
				<div className="grid min-w-0 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
					<div className="relative aspect-[4/3] overflow-hidden bg-gray-100 sm:aspect-auto sm:min-h-64">
						<SafeImage
							unoptimized
							src={product.image}
							fallbackSrc="/images/placeholder.jpg"
							alt={product.name}
							fill
							loading="lazy"
							sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 65vw"
							className="object-contain p-3 transition-transform duration-300 motion-safe:group-hover:scale-105"
						/>
					</div>
					<div className="flex min-w-0 flex-col p-4 sm:py-5">
						<div className="truncate text-sm font-medium text-primary-body">{product.brand || product.category}</div>
						<h3 className="mt-2 line-clamp-2 text-base font-medium">{product.name}</h3>
						{rating ? (
							<div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-primary-body" aria-label={rating + " out of 5, " + product.reviews + " reviews"}>
								<Star className="size-3.5 shrink-0 fill-primary-blue text-primary-blue" aria-hidden="true" />
								<span>{rating} ({product.reviews})</span>
							</div>
						) : null}
						<div className="mt-auto pt-4">
							<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
								<span className="text-xl font-semibold">{formatPrice(product.price)}</span>
								{saving > 0 ? <del className="text-sm text-primary-body">{formatPrice(product.originalPrice)}</del> : null}
							</div>
							{product.quantity > 0 ? <div className="mt-2 text-sm text-primary-body">{product.quantity} in stock</div> : null}
							<span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-blue underline underline-offset-4">
								Shop deal
								<ArrowUpRight className="size-4" aria-hidden="true" />
							</span>
						</div>
					</div>
				</div>

				<div className="relative flex flex-col items-center justify-center gap-2 border-l border-dashed border-primary-blue/20 bg-primary-blue/5 px-2 py-6 text-center text-primary-blue before:absolute before:-left-2 before:-top-2 before:size-4 before:rounded-full before:bg-gray-50 before:content-[''] after:absolute after:-bottom-2 after:-left-2 after:size-4 after:rounded-full after:bg-gray-50 after:content-['']">
					<Tag className="mb-1 size-5" aria-hidden="true" />
					{product.discountPercent > 0 ? (
						<>
							<span className="text-2xl font-semibold tabular-nums">{product.discountPercent}%</span>
							<span className="text-sm font-medium">OFF</span>
						</>
					) : (
						<span className="text-base font-medium">Deal</span>
					)}
					{saving > 0 ? (
						<div className="mt-3 w-full border-t border-primary-blue/15 pt-3 text-sm">
							<div>Save</div>
							<div className="mt-1 break-all font-semibold">{formatPrice(saving)}</div>
						</div>
					) : null}
				</div>
			</Link>
		</article>
	);
}

function HighlightSkeleton({ itemCount }: { itemCount: number }) {
	return (
		<section className="section my-14" aria-busy="true" aria-label="Loading flash deals">
			<div className="overflow-hidden rounded-20 border border-gray-200 bg-gray-50">
				<div className="flex flex-wrap items-center justify-between gap-6 border-b border-gray-200 bg-white p-6 md:p-8">
					<div className="w-full max-w-lg space-y-3">
						<div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
						<div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
						<div className="h-4 w-full animate-pulse rounded bg-gray-200" />
					</div>
					<div className="h-24 w-64 max-w-full animate-pulse rounded-lg bg-primary-blue/10" />
				</div>
				<div className="flex gap-5 overflow-hidden p-6 md:p-8">
					{Array.from({ length: itemCount }).map((_, index) => (
						<div key={index} className="flex min-h-64 min-w-0 shrink-0 basis-full overflow-hidden rounded-xl border border-gray-200 bg-white lg:basis-[calc(50%-10px)]">
							<div className="w-2/5 animate-pulse bg-gray-200" />
							<div className="flex flex-1 flex-col justify-center gap-4 p-5">
								<div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
								<div className="h-5 w-full animate-pulse rounded bg-gray-200" />
								<div className="h-7 w-2/3 animate-pulse rounded bg-gray-200" />
							</div>
							<div className="w-20 animate-pulse bg-primary-blue/5" />
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export default function FlashDealHighlight(props: FashionSectionProps) {
	const { products, endsAt, loading, enabled, itemsAllow, heading, subheading, buttonText, buttonLink, formatPrice } = useFlashDealSection(props);
	const navigationId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const previousId = "flash-highlight-prev-" + navigationId;
	const nextId = "flash-highlight-next-" + navigationId;

	if (!enabled) return null;
	if (loading) return <HighlightSkeleton itemCount={Math.min(itemsAllow, 2)} />;
	if (products.length === 0) return null;

	const maxDiscount = Math.max(...products.map((product) => product.discountPercent));

	return (
		<section data-storefront-section="fashion-apparel-flash-deal-highlight" className="section my-14">
			<div className="overflow-hidden rounded-20 border border-gray-200 bg-gray-50">
				<div className="flex flex-col justify-between gap-6 border-b border-gray-200 bg-white p-6 text-primary-black md:p-8 lg:flex-row lg:items-center lg:gap-10">
					<div className="min-w-0 max-w-2xl">
						{maxDiscount > 0 ? (
							<div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-blue/20 bg-primary-blue/5 px-3 py-1.5 text-sm font-medium text-primary-blue">
								<Tag className="size-4" aria-hidden="true" />
								Up to {maxDiscount}% off
							</div>
						) : null}
						<h2 className="text-2xl font-semibold">{heading}</h2>
						{subheading ? <div className="mt-2 text-base font-medium text-primary-body">{subheading}</div> : null}
					</div>
					<HighlightCountdown endsAt={endsAt} />
				</div>

				<div className="p-5 md:p-8">
					<div className="min-w-0 overflow-hidden">
						<Swiper
							modules={[Navigation, A11y]}
							slidesPerView={Math.min(products.length, 1.06)}
							spaceBetween={20}
							breakpoints={{
								640: { slidesPerView: Math.min(products.length, 1.15) },
								1024: { slidesPerView: Math.min(products.length, 2) },
							}}
							loop={false}
							watchOverflow
							watchSlidesProgress
							navigation={{ prevEl: "#" + previousId, nextEl: "#" + nextId, addIcons: false }}
							a11y={{
								containerMessage: heading,
								containerRoleDescriptionMessage: "carousel",
								prevSlideMessage: "Previous deals",
								nextSlideMessage: "Next deals",
								slideLabelMessage: "Deal {{index}} of {{slidesLength}}",
							}}
							className="!overflow-visible"
						>
							{products.map((product) => (
								<SwiperSlide key={product.id} className="!h-auto">
									<DealTicket product={product} formatPrice={formatPrice} />
								</SwiperSlide>
							))}
						</Swiper>
					</div>

					<div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-5">
						<Link href={buttonLink} className="inline-flex items-center gap-2 text-sm font-medium text-primary-blue underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-blue">
							{buttonText}
							<ArrowUpRight className="size-4" aria-hidden="true" />
						</Link>
						<div className="flex items-center gap-3">
							<span className="mr-1 text-sm font-medium text-primary-body">{products.length} {products.length === 1 ? "deal" : "deals"}</span>
							<button id={previousId} type="button" aria-label="Previous deals" className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-primary-blue transition hover:border-primary-blue hover:bg-primary-blue/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue disabled:cursor-not-allowed disabled:opacity-30">
								<ChevronLeft className="size-5" aria-hidden="true" />
							</button>
							<button id={nextId} type="button" aria-label="Next deals" className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-primary-blue transition hover:border-primary-blue hover:bg-primary-blue/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue disabled:cursor-not-allowed disabled:opacity-30">
								<ChevronRight className="size-5" aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}


"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
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

function resolveImages(value: unknown, host: string | null): HeroImage[] {
	if (!Array.isArray(value)) return [];

	const images = value.flatMap((item, index) => {
		if (!item || typeof item !== "object") return [];
		const record = item as Record<string, unknown>;
		const image = asRecord(record.image);
		const rawUrl = String(image.url || record.url || record.src || "").trim();
		if (!rawUrl) return [];
		return [{
			id: String(image.id || record.id || `image-${index + 1}`),
			url: resolveApiAssetUrl(rawUrl, host),
			alt: String(image.alt || record.alt || `Gadgets promotion ${index + 1}`),
		}];
	});

	return images;
}

export default function HeroGadgetsOne({ section, host }: EcommerceSectionProps) {
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const slides = useMemo(() => resolveImages(content.slides, host), [content.slides, host]);
	const banners = useMemo(() => resolveImages(content.banners, host), [content.banners, host]);
	const autoplay = content.autoplay === undefined ? true : Boolean(content.autoplay);
	const intervalSeconds = Math.max(2, Math.min(15, Number(content.interval_seconds || 4)));
	const [activeSlideIndex, setActiveSlideIndex] = useState(1);
	const [dragOffset, setDragOffset] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
	const dragStartX = useRef<number | null>(null);
	const visibleSlideIndex = slides.length ? (activeSlideIndex - 1 + slides.length) % slides.length : 0;

	useEffect(() => {
		setActiveSlideIndex(1);
	}, [slides.length]);

	useEffect(() => {
		if (!autoplay || slides.length < 2) return;
		const timer = window.setInterval(() => {
			setIsTransitionEnabled(true);
			setActiveSlideIndex((current) => current + 1);
		}, intervalSeconds * 1000);
		return () => window.clearInterval(timer);
	}, [autoplay, intervalSeconds, slides.length]);

	const showPreviousSlide = () => {
		setIsTransitionEnabled(true);
		setActiveSlideIndex((current) => current - 1);
	};

	const showNextSlide = () => {
		setIsTransitionEnabled(true);
		setActiveSlideIndex((current) => current + 1);
	};

	const handleTransitionEnd = () => {
		if (activeSlideIndex !== 0 && activeSlideIndex !== slides.length + 1) return;
		setIsTransitionEnabled(false);
		setActiveSlideIndex(activeSlideIndex === 0 ? slides.length : 1);
		window.requestAnimationFrame(() => window.requestAnimationFrame(() => setIsTransitionEnabled(true)));
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		dragStartX.current = event.clientX;
		setDragOffset(0);
		setIsDragging(true);
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (dragStartX.current !== null) setDragOffset(event.clientX - dragStartX.current);
	};

	const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
		if (dragStartX.current === null) return;
		const distance = event.clientX - dragStartX.current;
		if (distance <= -50) showNextSlide();
		if (distance >= 50) showPreviousSlide();
		dragStartX.current = null;
		setDragOffset(0);
		setIsDragging(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	};

	const loopedSlides = slides.length ? [slides[slides.length - 1], ...slides, slides[0]] : [];

	return (
		<section data-storefront-section="electronics-gadgets-hero-gadgets-one" className="bg-[#f7f7f7] px-5 pb-11 pt-4 lg:px-6" aria-label="Featured electronics and gadgets">
			<div className="mx-auto w-full max-w-[1536px]">
				{slides.length > 0 ? <div className={`relative touch-pan-y select-none overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`} onPointerCancel={handlePointerEnd} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd}>
					<div className={`flex ${!isDragging && isTransitionEnabled ? "transition-transform duration-500 ease-in-out" : ""}`} onTransitionEnd={handleTransitionEnd} style={{ transform: `translate3d(calc(-${activeSlideIndex * 100}% + ${dragOffset}px), 0, 0)` }}>
						{loopedSlides.map((slide, index) => <Image unoptimized alt={slide.alt} className="h-auto w-full shrink-0" draggable={false} height={650} key={`${slide.id}-${index}`} priority={index === 1} sizes="(min-width: 1584px) 1536px, calc(100vw - 48px)" src={slide.url} width={1536} />)}
					</div>
					{slides.length > 1 ? <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-1 sm:bottom-3 sm:gap-1.5 lg:bottom-5 lg:gap-2" aria-label="Hero slides">{slides.map((slide, index) => <button aria-label={`Show ${slide.alt}`} aria-pressed={index === visibleSlideIndex} className={`size-1.5 rounded-full transition-colors sm:size-2 lg:size-3 ${index === visibleSlideIndex ? "bg-white" : "bg-[#647184]"}`} key={slide.id} onClick={() => { setIsTransitionEnabled(true); setActiveSlideIndex(index + 1); }} type="button" />)}</div> : null}
				</div> : null}

				{banners.length > 0 ? <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">{banners.map((banner) => <Image unoptimized alt={banner.alt} className="h-auto w-full" height={214} key={banner.id} sizes="(min-width: 768px) calc((100vw - 80px) / 3), calc(100vw - 48px)" src={banner.url} width={501} />)}</div> : null}
			</div>
		</section>
	);
}

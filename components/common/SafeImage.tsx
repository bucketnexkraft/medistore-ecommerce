"use client";

import { useMemo, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageIcon } from "lucide-react";
import { resolveApiAssetUrl } from "@/lib/config";

type SafeImageProps = Omit<ImageProps, "src"> & {
	src: string | null | undefined;
	fallbackSrc?: string;
};

export default function SafeImage({
	src,
	alt,
	fallbackSrc = resolveApiAssetUrl(),
	...props
}: SafeImageProps) {
	const resolvedSrc = useMemo(() => {
		const candidate = src || fallbackSrc;

		if (!candidate) {
			return fallbackSrc;
		}

		const assetUrl = resolveApiAssetUrl(candidate);

		if (assetUrl !== candidate) {
			return assetUrl;
		}

		// Normalize same-origin non-asset URLs so next/image treats them as local assets.
		if (typeof window !== "undefined") {
			try {
				const url = new URL(candidate);
				if (url.origin === window.location.origin) {
					return `${url.pathname}${url.search}`;
				}
			} catch {
			}
		}

		return candidate;
	}, [fallbackSrc, src]);
	const [failedForSrc, setFailedForSrc] = useState<string | null>(null);
	const [loadedForSrc, setLoadedForSrc] = useState<string | null>(null);
	const isFill = Boolean(props.fill);
	const displaySrc = failedForSrc === resolvedSrc ? fallbackSrc : resolvedSrc;
	const shouldShowImage = Boolean(displaySrc);
	const isLoaded = loadedForSrc === displaySrc;
	const shouldShowPlaceholder = !isLoaded;

	return (
		<div
			className={`overflow-hidden bg-[#f3f4f6] ${isFill ? "absolute inset-0" : "relative inline-block"}`}
		>
			{shouldShowPlaceholder ? (
				<div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] text-slate-300">
					<ImageIcon className="size-8" aria-hidden="true" />
				</div>
			) : null}

			{shouldShowImage ? (
				<Image
					key={resolvedSrc}
					{...props}
					alt={alt}
					src={displaySrc}
					className={`${props.className || ""} ${isFill ? "z-10" : ""}`.trim()}
					onLoad={() => setLoadedForSrc(displaySrc)}
					onError={() => {
						if (displaySrc !== fallbackSrc) {
							setFailedForSrc(resolvedSrc);
							setLoadedForSrc(null);
							return;
						}

						setFailedForSrc(resolvedSrc);
						setLoadedForSrc(null);
					}}
					style={{
						...(props.style || {}),
						opacity: isLoaded ? 1 : 0,
						transition: "opacity 180ms ease",
						position: props.fill ? "absolute" : props.style?.position,
					}}
				/>
			) : null}
		</div>
	);
}

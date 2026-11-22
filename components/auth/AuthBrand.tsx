"use client";

import { DEFAULT_BRAND, normalizePreferencesData, resolveBrandLogo, resolveBrandName, type BrandState } from "@/lib/header-context";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export function AuthBrand() {
	const [brand, setBrand] = useState<BrandState>(DEFAULT_BRAND);
	const [logoSrc, setLogoSrc] = useState<string | null>(DEFAULT_BRAND.logoUrl);

	useEffect(() => {
		const loadBranding = async () => {
			try {
				const [preferencesResult, settingsResult] = await Promise.all([
					fetchStorefrontJson<{ data?: unknown }>("/landing/preferences"),
					fetchStorefrontJson<{ data?: unknown }>("/landing/settings/basic"),
				]);
				const preferencesData = normalizePreferencesData(preferencesResult?.data);
				const settingsData = normalizePreferencesData(settingsResult?.data);
				const nextBrand = {
					name: resolveBrandName(null, preferencesData, settingsData),
					logoUrl: resolveBrandLogo(preferencesData, settingsData),
				};

				setBrand(nextBrand);
				setLogoSrc(nextBrand.logoUrl);
			} catch {
			}
		};

		void loadBranding();
	}, []);

	return (
		<Link href="/" className="inline-flex items-center gap-3">
			{logoSrc ? (
				<Image
					key={logoSrc}
					loader={({ src }) => src}
					unoptimized
					src={logoSrc}
					alt={`${brand.name} logo`}
					width={120}
					height={100}
					className="h-auto max-h-16 w-auto object-contain"
					onError={() => setLogoSrc(null)}
				/>
			) : null}
			<span className="text-2xl font-bold text-primary-black">{brand.name}</span>
		</Link>
	);
}

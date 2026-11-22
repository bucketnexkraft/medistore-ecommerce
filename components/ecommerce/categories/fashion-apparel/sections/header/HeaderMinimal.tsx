"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Heart, Menu, Search, ShoppingBag } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { AllCategoriesMegaMenu } from "@/components/common/AllCategoriesMegaMenu";
import { AccountAvatar } from "./AccountAvatar";
import StorefrontCurrencySelector from "@/components/common/StorefrontCurrencySelector";
import {
	buildDynamicSocialLinks,
	DEFAULT_BRAND,
	getAllCategoriesNavItem,
	mapHeaderActionsToNavItems,
	resolveHeaderSearchPlaceholder,
	type BrandState,
	type HeaderInitialData,
	type HeaderNavItem,
	type SocialLinkState,
} from "@/lib/header-context";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";

type HeaderProps = {
	initialData?: HeaderInitialData;
	section?: StorefrontChromeSection;
	host?: string | null;
	demoOnly?: boolean;
};

const socialIconMap = {
	facebook: FaFacebookF,
	instagram: FaInstagram,
	x: FaXTwitter,
	twitter: FaXTwitter,
} as const;

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function SocialIcon({ social }: { social: SocialLinkState }) {
	if (social.iconType === "image") {
		return <Image unoptimized src={social.icon} alt="" width={16} height={16} className="h-4 w-4 object-contain" />;
	}

	const key = social.icon.toLowerCase().replace(/[-_ ]/g, "") as keyof typeof socialIconMap;
	const Icon = socialIconMap[key];

	return Icon ? <Icon aria-hidden="true" size={16} /> : <span aria-hidden="true">•</span>;
}

function Brand({ brand }: { brand: BrandState }) {
	const [logoFailed, setLogoFailed] = useState(false);

	return (
		<Link href="/" className="flex min-w-0 shrink-0 items-center gap-2" aria-label={brand.name}>
			{brand.logoUrl && !logoFailed ? (
				<Image
					src={brand.logoUrl}
					alt={`${brand.name} logo`}
					width={34}
					height={34}
					unoptimized
					className="h-8 w-8 object-contain"
					onError={() => setLogoFailed(true)}
				/>
			) : null}
			<span className="truncate text-lg font-semibold tracking-[-0.03em] text-[#242424]">{brand.name}</span>
		</Link>
	);
}

function resolveBrand(initialData?: HeaderInitialData): BrandState {
	return initialData?.brand || DEFAULT_BRAND;
}

function resolveNavigation(section?: StorefrontChromeSection, initialData?: HeaderInitialData): HeaderNavItem[] {
	const configuredActions = Array.isArray(section?.actions) ? section.actions : [];
	const dynamicItems = configuredActions.length > 0 ? mapHeaderActionsToNavItems(configuredActions) : [];

	return dynamicItems.length > 1
		? dynamicItems
		: initialData?.navItems?.length
			? initialData.navItems
			: [getAllCategoriesNavItem()];
}

export default function HeaderMinimal({ section, initialData, host, demoOnly }: HeaderProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [query, setQuery] = useState("");
	const config = asRecord(section?.config);
	const content = asRecord(config.content);
	const hasConfiguredSocialLinks = Array.isArray(content.social_links);
	const socialLinks = hasConfiguredSocialLinks
		? buildDynamicSocialLinks(null, section)
		: initialData?.socialLinks || [];
	const searchPlaceholder = Object.prototype.hasOwnProperty.call(content, "search_placeholder_text")
		? resolveHeaderSearchPlaceholder(section)
		: initialData?.searchPlaceholder || "Search any product...";
	const navigation = resolveNavigation(section, initialData);
	const categoryItem = navigation[0];

	const handleSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const value = query.trim();
		if (value) window.location.assign(`/products?q=${encodeURIComponent(value)}`);
	};

	return (
		<header className="relative z-40 border-b border-[#dedede] bg-white text-[#242424]">
			<div className="mx-auto flex min-h-[76px] w-full max-w-[1536px] items-center gap-5 px-5 lg:px-8">
				<Brand brand={resolveBrand(initialData)} />

				<form onSubmit={handleSearch} className="hidden min-w-0 flex-1 lg:flex">
					<div className="flex h-10 w-full max-w-[620px] items-center rounded-full border border-[#d8d8d8] px-4 focus-within:border-[#242424]">
						<input
							aria-label={searchPlaceholder}
							className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8d98a8]"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={searchPlaceholder}
							type="search"
						/>
						<button type="submit" aria-label="Search" className="text-[#242424]">
							<Search size={18} strokeWidth={1.8} aria-hidden="true" />
						</button>
					</div>
				</form>

				<div className="ml-auto hidden items-center gap-4 lg:flex">
					<StorefrontCurrencySelector />
					{socialLinks.map((social) => (
						<a
							key={`${social.label}-${social.href}`}
							href={social.href}
							target={social.href.startsWith("/") ? undefined : "_blank"}
							rel={social.href.startsWith("/") ? undefined : "noopener noreferrer"}
							aria-label={social.label}
							className="transition-opacity hover:opacity-60"
						>
							<SocialIcon social={social} />
						</a>
					))}
					<Link href="/wishlist" aria-label="Wishlist" className="transition-opacity hover:opacity-60">
						<Heart size={18} strokeWidth={1.8} aria-hidden="true" />
					</Link>
					<Link href="/cart" aria-label="Shopping bag" className="transition-opacity hover:opacity-60">
						<ShoppingBag size={18} strokeWidth={1.8} aria-hidden="true" />
					</Link>
					<Link href="/user-dashboard" aria-label="Account" className="transition-opacity hover:opacity-60">
						<AccountAvatar className="size-7" />
					</Link>
				</div>

				<button
					type="button"
					className="cursor-pointer lg:hidden"
					aria-label="Open menu"
					aria-expanded={menuOpen}
					onClick={() => setMenuOpen((isOpen) => !isOpen)}
				>
					<Menu size={22} aria-hidden="true" />
				</button>
			</div>

			<div className="border-t border-[#1e1e20] bg-[#1e1e20] text-white">
				<div className="mx-auto flex min-h-[52px] w-full max-w-[1536px] items-center gap-7 overflow-x-auto px-5 lg:px-8">
					{categoryItem ? (
						<button
							type="button"
							onClick={() => setMenuOpen((isOpen) => !isOpen)}
							className="flex shrink-0 cursor-pointer items-center gap-2 text-sm transition-opacity hover:opacity-70"
						>
							<Menu size={17} aria-hidden="true" />
							{categoryItem.label || "All categories"}
						</button>
					) : null}
					<nav className="flex items-center gap-7 whitespace-nowrap text-sm" aria-label="Store navigation">
						{navigation.slice(1).map((item) => (
							<Link key={`${item.label}-${item.href}`} href={item.href} className="transition-opacity hover:opacity-70">
								{item.label}
							</Link>
						))}
					</nav>
				</div>
			</div>

			{menuOpen ? <AllCategoriesMegaMenu isOpen onClose={() => setMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} desktopTopOffset={128} /> : null}
		</header>
	);
}

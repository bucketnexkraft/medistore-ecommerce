"use client";

import Image from "next/image";
import Link from "next/link";
import { createElement, FormEvent, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, icons as lucideIcons } from "lucide-react";
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

const resolveLucideIcon = (name: string) => {
	if (lucideIcons[name as keyof typeof lucideIcons]) return lucideIcons[name as keyof typeof lucideIcons];
	const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
	const key = Object.keys(lucideIcons).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
	return key ? lucideIcons[key as keyof typeof lucideIcons] : null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function SocialIcon({ social }: { social: SocialLinkState }) {
	if (social.iconType === "image") {
		return <Image unoptimized src={social.icon} alt="" width={17} height={17} className="h-[17px] w-[17px] object-contain" />;
	}

	const key = social.icon.toLowerCase().replace(/[-_ ]/g, "") as keyof typeof socialIconMap;
	const SocialBrandIcon = socialIconMap[key];
	if (SocialBrandIcon) return <SocialBrandIcon aria-hidden="true" size={17} />;

	const LucideIcon = resolveLucideIcon(social.icon);
	return LucideIcon
		? createElement(LucideIcon, { "aria-hidden": true, size: 17, strokeWidth: 1.8 })
		: null;
}

function Brand({ brand }: { brand: BrandState }) {
	const [logoFailed, setLogoFailed] = useState(false);

	return (
		<Link href="/" className="flex shrink-0 items-center gap-2" aria-label={brand.name}>
			{brand.logoUrl && !logoFailed ? (
				<Image
					unoptimized
					src={brand.logoUrl}
					alt={`${brand.name} logo`}
					width={36}
					height={36}
					priority
					className="h-9 w-9 object-contain"
					onError={() => setLogoFailed(true)}
				/>
			) : null}
			<span className="text-2xl font-black tracking-tight text-[#242424]">{brand.name}</span>
		</Link>
	);
}

function resolveNavigation(section: StorefrontChromeSection | undefined, initialData?: HeaderInitialData): HeaderNavItem[] {
	const configuredActions = Array.isArray(section?.actions) ? section.actions : [];
	const configuredNavigation = configuredActions.length > 0 ? mapHeaderActionsToNavItems(configuredActions) : [];

	return configuredNavigation.length > 1
		? configuredNavigation
		: initialData?.navItems?.length
			? initialData.navItems
			: [getAllCategoriesNavItem()];
}

export default function HeaderClassic({ section, initialData, host, demoOnly }: HeaderProps) {
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
		<header className="sticky top-0 z-40 text-[#242424]">
			<div className="border-b border-[#dedede] bg-[#f7f7f7]">
				<div className="mx-auto grid min-h-[80px] w-full max-w-[1536px] grid-cols-[auto_1fr_auto] items-center gap-8 px-6">
					<Brand brand={initialData?.brand || DEFAULT_BRAND} />

					<form onSubmit={handleSearch} className="hidden h-10 w-full max-w-[708px] items-center justify-self-center rounded-full border border-[#d8d8d8] px-5 lg:flex">
						<input
							aria-label={searchPlaceholder}
							className="min-w-0 flex-1 bg-transparent text-sm text-[#242424] outline-none placeholder:text-[#8d98a8]"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={searchPlaceholder}
							type="search"
						/>
						<button type="submit" aria-label="Search" className="text-[#242424]">
							<Search size={19} aria-hidden="true" />
						</button>
					</form>

					<div className="hidden items-center gap-5 text-sm lg:flex">
						<StorefrontCurrencySelector />
						<div className="flex items-center gap-4">
							{socialLinks.map((social) => (
								<a
									key={`${social.label}-${social.href}`}
									href={social.href}
									target={social.href.startsWith("/") ? undefined : "_blank"}
									rel={social.href.startsWith("/") ? undefined : "noopener noreferrer"}
									aria-label={social.label}
									className="transition-opacity hover:opacity-70"
								>
									<SocialIcon social={social} />
								</a>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="border-b border-[#1e1e20] bg-[#1e1e20] text-white">
				<div className="mx-auto flex min-h-[59px] w-full max-w-[1536px] items-center gap-8 overflow-x-auto px-6">
					{categoryItem ? (
						<button
							type="button"
							onClick={() => setMenuOpen((isOpen) => !isOpen)}
							className="flex shrink-0 items-center gap-3 text-sm transition-opacity hover:opacity-70 cursor-pointer"
						>
							<Menu size={18} aria-hidden="true" />
							{categoryItem.label || "All categories"}
						</button>
					) : null}

					<nav className="hidden items-center gap-10 whitespace-nowrap text-sm lg:flex" aria-label="Store navigation">
						{navigation.slice(1).map((item) => (
							<Link key={`${item.label}-${item.href}`} href={item.href} className="transition-opacity hover:opacity-70">
								{item.label}
							</Link>
						))}
					</nav>

					<div className="ml-auto flex shrink-0 items-center gap-3">
						<Link href="/wishlist" aria-label="Wishlist" className="flex size-9 items-center justify-center rounded-full bg-white text-[#242424] transition-opacity hover:opacity-80">
							<Heart size={19} aria-hidden="true" />
						</Link>
						<Link href="/cart" aria-label="Shopping bag" className="flex size-9 items-center justify-center rounded-full bg-white text-[#242424] transition-opacity hover:opacity-80">
							<ShoppingBag size={19} aria-hidden="true" />
						</Link>
						<Link href="/user-dashboard" aria-label="Account" className="flex size-9 items-center justify-center rounded-full bg-white text-[#242424] transition-opacity hover:opacity-80">
							<AccountAvatar className="size-7" />
						</Link>
					</div>
				</div>
			</div>

			<button
				type="button"
				aria-label="Open menu"
				className="fixed right-5 top-5 z-50 cursor-pointer rounded-full bg-white p-2 text-[#242424] shadow lg:hidden"
				onClick={() => setMenuOpen((isOpen) => !isOpen)}
			>
				<Menu size={20} aria-hidden="true" />
			</button>
			{menuOpen ? <AllCategoriesMegaMenu isOpen onClose={() => setMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} desktopTopOffset={139} /> : null}
		</header>
	);
}

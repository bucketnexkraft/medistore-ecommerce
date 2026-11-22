"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, Heart, Menu, Search, ShoppingBag } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { AllCategoriesMegaMenu } from "@/components/common/AllCategoriesMegaMenu";
import { AccountAvatar } from "./AccountAvatar";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
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

type LanguageOption = {
	id: number | string;
	label: string;
	value: string;
	flag: string;
};

type LanguageOptionWithDefault = LanguageOption & {
	isDefault: boolean;
};

const LANGUAGE_STORAGE_KEY = "arcade-selected-language";
const DEFAULT_LANGUAGES: LanguageOption[] = [
	{ id: "en", label: "Eng", value: "en", flag: "/images/header/en.svg" },
	{ id: "bn", label: "বাং", value: "bn", flag: "/images/header/flag-bd.svg" },
];

function LanguageFlag({ src, alt }: { src: string; alt: string }) {
	const [imageSrc, setImageSrc] = useState(src);

	return (
		<Image
			unoptimized
			src={imageSrc}
			alt={alt}
			width={20}
			height={14}
			className="rounded-sm object-cover"
			onError={() => setImageSrc("/images/header/en.svg")}
		/>
	);
}

function LocaleSelector({ host }: { host?: string | null }) {
	const { currencies, selectedCurrency, setSelectedCurrency } = useCurrency();
	const [languages, setLanguages] = useState(DEFAULT_LANGUAGES);
	const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGES[0]);
	const [currencyOpen, setCurrencyOpen] = useState(false);
	const [languageOpen, setLanguageOpen] = useState(false);

	useEffect(() => {
		const loadLanguages = async () => {
			try {
				const result = await fetchStorefrontJson<{ data?: unknown }>("/translation-languages", host);
				const nextLanguages: LanguageOptionWithDefault[] = Array.isArray(result?.data)
					? result.data.flatMap((item) => {
						const record = asRecord(item);
						const value = String(record.code || "").toLowerCase();
						if (!value) return [];
						return [{
							id: String(record.id || value),
							label: value === "en" ? "Eng" : value === "bn" ? "বাংলা" : String(record.name || value.toUpperCase()).slice(0, 3),
							value,
							flag: String(record.image_url || (value === "bn" ? "/images/header/flag-bd.svg" : "/images/header/en.svg")),
							isDefault: Boolean(record.is_default),
						}];
					})
					: [];
				const availableLanguages: LanguageOption[] = nextLanguages.length ? nextLanguages : DEFAULT_LANGUAGES;
				const storedValue = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
				const defaultValue = nextLanguages.find((language) => language.isDefault)?.value || DEFAULT_LANGUAGES[0].value;
				setLanguages(availableLanguages);
				setSelectedLanguage(
					availableLanguages.find((language) => language.value === String(storedValue || "").toLowerCase()) ||
					availableLanguages.find((language) => language.value === defaultValue) ||
					availableLanguages[0],
				);
			} catch {
			}
		};

		void loadLanguages();
	}, [host]);

	return (
		<div className="flex items-center text-sm">
			<div className="relative flex items-center gap-2 border-r border-white/70 pr-5">
				<button type="button" className="flex items-center gap-2" onClick={() => { setCurrencyOpen(!currencyOpen); setLanguageOpen(false); }}>
					{selectedCurrency.label}
					<ChevronDown aria-hidden="true" size={14} strokeWidth={1.7} />
				</button>
				{currencyOpen ? (
					<div className="absolute right-0 top-full z-50 mt-2 min-w-32 rounded-md bg-white py-1 text-[#242424] shadow-lg">
						{currencies.map((currency) => (
							<button key={currency.value} type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[#f4f4f4]" onClick={() => { setSelectedCurrency(currency); setCurrencyOpen(false); }}>
								{currency.label}
							</button>
						))}
					</div>
				) : null}
			</div>

			<div className="relative ml-5 flex items-center gap-2 border-r border-white/70 pr-5">
				<button type="button" className="flex items-center gap-2" onClick={() => { setLanguageOpen(!languageOpen); setCurrencyOpen(false); }}>
					<LanguageFlag src={selectedLanguage.flag} alt={selectedLanguage.label} />
					{selectedLanguage.label}
					<ChevronDown aria-hidden="true" size={14} strokeWidth={1.7} />
				</button>
				{languageOpen ? (
					<div className="absolute right-0 top-full z-50 mt-2 min-w-32 rounded-md bg-white py-1 text-[#242424] shadow-lg">
						{languages.map((language) => (
							<button key={language.value} type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[#f4f4f4]" onClick={() => { setSelectedLanguage(language); window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language.value); setLanguageOpen(false); }}>
								<LanguageFlag src={language.flag} alt={language.label} />
								{language.label}
							</button>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}

function SocialIcon({ social }: { social: SocialLinkState }) {
	if (social.iconType === "image") {
		return <Image unoptimized src={social.icon} alt="" width={17} height={17} className="h-[17px] w-[17px] object-contain" />;
	}

	const key = social.icon.toLowerCase().replace(/[-_ ]/g, "") as keyof typeof socialIconMap;
	const Icon = socialIconMap[key];

	return Icon ? <Icon aria-hidden="true" size={17} /> : <span aria-hidden="true">•</span>;
}

function Brand({ brand }: { brand: BrandState }) {
	const [logoFailed, setLogoFailed] = useState(false);

	return (
		<Link href="#top" className="flex shrink-0 items-center gap-2" aria-label={brand.name}>
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
			<span className="truncate text-2xl font-bold tracking-tight text-white">{brand.name}</span>
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

export default function HeaderCompact({ section, initialData, host, demoOnly }: HeaderProps) {
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
		<header className="absolute inset-x-0 top-0 z-20 text-white">
			<div className="border-b border-white/30">
				<div className="mx-auto grid min-h-[80px] w-full max-w-[1536px] grid-cols-[auto_1fr_auto] items-center gap-8 px-6">
					<Brand brand={initialData?.brand || DEFAULT_BRAND} />

					<form onSubmit={handleSearch} className="hidden h-10 w-full max-w-[708px] items-center justify-self-center rounded-full border border-white/70 px-5 lg:flex">
						<input
							aria-label={searchPlaceholder}
							className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/90"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={searchPlaceholder}
							type="search"
						/>
						<button type="submit" aria-label="Search" className="text-white">
							<Search size={19} aria-hidden="true" />
						</button>
					</form>

					<div className="hidden items-center gap-5 text-sm lg:flex">
						<LocaleSelector host={host} />
						<div className="flex items-center gap-4 border-l border-white/70 pl-5">
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

			<div className="border-b border-white/40 bg-[#21212429]">
				<div className="mx-auto flex min-h-[59px] w-full max-w-[1536px] items-center gap-8 overflow-hidden px-6">
					{categoryItem ? (
						<button
							type="button"
							onClick={() => setMenuOpen((isOpen) => !isOpen)}
							className="flex shrink-0 cursor-pointer items-center gap-3 text-sm transition-opacity hover:opacity-70"
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
						<Link href="/user-dashboard" aria-label="Account" className="flex size-9 items-center justify-center rounded-full bg-white text-sm text-[#242424] transition-opacity hover:opacity-80 sm:h-9 sm:w-auto sm:gap-2 sm:px-3">
							<AccountAvatar className="size-7" />
							<span className="hidden sm:inline">Account</span>
						</Link>
					</div>
				</div>
			</div>

			{menuOpen ? <AllCategoriesMegaMenu isOpen onClose={() => setMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} desktopTopOffset={139} /> : null}
		</header>
	);
}

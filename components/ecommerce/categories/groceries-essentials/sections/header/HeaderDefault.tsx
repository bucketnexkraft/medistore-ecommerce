"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardPath, readStoredAuthToken, readStoredAuthUser } from "@/lib/auth";
import { createElement, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { socialLinks as defaultSocialLinks, headerActions } from "@/data/header-data";
import { usePathname, useRouter } from "next/navigation";
import { AllCategoriesMegaMenu, prefetchMegaMenuCategories } from "@/components/common/AllCategoriesMegaMenu";
import { apiFetch } from "@/lib/api-client";
import { useAmount } from "@/lib/amount";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { icons as lucideIcons } from "lucide-react";
import { resolveApiAssetUrl } from "@/lib/config";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import {
	buildDynamicSocialLinks,
	DEFAULT_BRAND,
	type BrandState,
	getAllCategoriesNavItem,
	type HeaderInitialData,
	type HeaderNavItem,
	mapHeaderActionsToNavItems,
	normalizePreferencesData,
	resolveBrandName,
	resolveHeaderSearchPlaceholder,
	type SocialLinkState,
} from "@/lib/header-context";

export type HeaderProps = {
	initialData?: HeaderInitialData;
	section?: StorefrontChromeSection;
	host?: string | null;
	demoOnly?: boolean;
	previewMode?: boolean;
};

type SearchSuggestion = {
	id: string;
	name: string;
	slug: string;
	code: string | null;
	thumbnail: string | null;
	category: string | null;
	price: number;
	url: string;
};

const resolveLucideIcon = (name: string) => {
	const aliases: Record<string, string> = {
		home: "House",
		"shopping-bag": "ShoppingBag",
		"magnifying-glass": "Search",
		"map-pin": "MapPin",
		"arrow-right": "ArrowRight",
		facebook: "Facebook",
		instagram: "Instagram",
		twitter: "Twitter",
		x: "Twitter",
	};
	const requested = aliases[name.toLowerCase()] || name;
	if (lucideIcons[requested as keyof typeof lucideIcons]) return lucideIcons[requested as keyof typeof lucideIcons];
	const normalized = requested.toLowerCase().replace(/[^a-z0-9]/g, "");
	const key = Object.keys(lucideIcons).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
	return key ? lucideIcons[key as keyof typeof lucideIcons] : null;
};

function SocialIcon({ social }: { social: SocialLinkState }) {
	if (social.iconType === "image") {
		return <Image unoptimized src={social.icon} alt={social.label} width={17} height={17} className="size-[17px] object-contain" />;
	}

	const Icon = resolveLucideIcon(social.icon);
	return Icon ? createElement(Icon, { className: "size-[17px]", strokeWidth: 1.8, "aria-hidden": true }) : null;
}

// Platform sample links are demo content, not links configured by this store.
const storeSocialLinks = (links: SocialLinkState[]) =>
	links.filter((link) => !defaultSocialLinks.some((sample) => sample.href === link.href));

type LanguageOption = {
	id: number | string;
	label: string;
	value: string;
	flag: string;
	direction: "ltr" | "rtl";
};

type LanguageOptionWithDefault = LanguageOption & {
	isDefault: boolean;
};

const LANGUAGE_STORAGE_KEY = "arcade-selected-language";
const DEFAULT_LANGUAGE_OPTIONS: LanguageOption[] = [
	{ id: "en", label: "Eng", value: "en", flag: "/images/header/en.svg", direction: "ltr" },
	{ id: "bn", label: "\u09AC\u09BE\u0982", value: "bn", flag: "/images/header/flag-bd.svg", direction: "ltr" },
];

const LANGUAGE_FLAG_MAP: Record<string, string> = {
	en: "/images/header/en.svg",
	bn: "/images/header/flag-bd.svg",
};

const toLanguageLabel = (name: string, code: string) => {
	const normalizedCode = code.toLowerCase();

	if (normalizedCode === "en") {
		return "Eng";
	}

	if (normalizedCode === "bn") {
		return "\u09AC\u09BE\u0982";
	}

	return name.length <= 4 ? name : name.slice(0, 3);
};

function LanguageFlag({ src, alt }: { src: string; alt: string }) {
	const [imageSrc, setImageSrc] = useState(src || "/images/header/en.svg");

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

function SuggestionThumbnail({ src, alt }: { src: string | null; alt: string }) {
	const [imageSrc, setImageSrc] = useState(src || "/images/placeholder.jpg");

	return (
		<Image
			key={src || "fallback-thumbnail"}
			unoptimized
			src={imageSrc}
			alt={alt}
			width={48}
			height={48}
			className="h-full w-full object-cover"
			onError={() => setImageSrc("/images/placeholder.jpg")}
		/>
	);
}

function BrandLink({
	brand,
	logoSize,
	textClassName,
	showText = true,
	onClick,
}: {
	brand: BrandState;
	logoSize: number;
	textClassName: string;
	showText?: boolean;
	onClick?: () => void;
}) {
	const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
	const logoSrc = brand.logoUrl && failedLogoUrl !== brand.logoUrl ? brand.logoUrl : null;

	return (
		<Link href="/" className="flex shrink-0 items-center gap-2" onClick={onClick}>
			{logoSrc ? (
				<Image
					key={logoSrc}
					unoptimized
					src={logoSrc}
					alt={`${brand.name} logo`}
					width={logoSize}
					height={logoSize}
					className="h-auto max-h-10 w-auto object-contain"
					onError={() => setFailedLogoUrl(brand.logoUrl)}
				/>
			) : null}
			{showText || !logoSrc ? <span className={textClassName}>{brand.name}</span> : null}
		</Link>
	);
}

function CountBadge({ count }: { count: number }) {
	if (count <= 0) {
		return null;
	}

	return (
		<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-green px-1 text-[11px] font-bold leading-none text-white">
			{count > 99 ? "99+" : count}
		</span>
	);
}

function resolveNavigation(section?: StorefrontChromeSection, initialData?: HeaderInitialData): HeaderNavItem[] {
	const configuredActions = Array.isArray(section?.actions) ? section.actions : [];
	const configuredNavigation = configuredActions.length > 0 ? mapHeaderActionsToNavItems(configuredActions) : [];

	return configuredNavigation.length > 1
		? configuredNavigation
		: initialData?.navItems?.length
			? initialData.navItems
			: [getAllCategoriesNavItem()];
}

function SearchAutocomplete({ mobile = false, placeholder = "Search any product...", host, demoOnly = false }: { mobile?: boolean; placeholder?: string; host?: string | null; demoOnly?: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	const { formatAmount } = useAmount();
	const wrapperRef = useRef<HTMLFormElement>(null);
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);

	useEffect(() => {
		const handleOutsideClick = (event: MouseEvent) => {
			if (!wrapperRef.current?.contains(event.target as Node)) {
				setOpen(false);
				setActiveIndex(-1);
			}
		};

		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, []);

	useEffect(() => {
		setOpen(false);
		setActiveIndex(-1);
	}, [pathname]);

	useEffect(() => {
		const trimmedQuery = query.trim();

		if (trimmedQuery.length < 2) {
			setSuggestions([]);
			setOpen(false);
			setLoading(false);
			setActiveIndex(-1);
			return;
		}

		const controller = new AbortController();
		const timeoutId = window.setTimeout(async () => {
			try {
				setLoading(true);
				const params = new URLSearchParams({
					q: trimmedQuery,
					limit: mobile ? "6" : "8",
				});
				if (demoOnly) params.set("is_demo", "1");
				const response = await apiFetch(`/landing/products/search?${params.toString()}`, {
					signal: controller.signal,
				}, host);
				const result = response.ok ? await response.json() : null;
				const items = Array.isArray(result?.data) ? result.data : [];

				setSuggestions(items);
				setOpen(true);
				setActiveIndex(items.length > 0 ? 0 : -1);
			} catch (error) {
				if (!(error instanceof DOMException && error.name === "AbortError")) {
					setSuggestions([]);
					setOpen(true);
					setActiveIndex(-1);
				}
			} finally {
				setLoading(false);
			}
		}, 250);

		return () => {
			controller.abort();
			window.clearTimeout(timeoutId);
		};
	}, [demoOnly, host, query, mobile]);

	const goToSuggestion = (suggestion: SearchSuggestion) => {
		setOpen(false);
		setQuery(suggestion.name);
		router.push(suggestion.url);
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (activeIndex >= 0 && suggestions[activeIndex]) {
			goToSuggestion(suggestions[activeIndex]);
			return;
		}
		if (suggestions[0]) {
			goToSuggestion(suggestions[0]);
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!open || suggestions.length === 0) {
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((current) => (current + 1) % suggestions.length);
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
		}

		if (event.key === "Enter" && activeIndex >= 0) {
			event.preventDefault();
			goToSuggestion(suggestions[activeIndex]);
		}

		if (event.key === "Escape") {
			setOpen(false);
			setActiveIndex(-1);
		}
	};

	const showEmptyState = !loading && query.trim().length >= 2 && suggestions.length === 0;

	return (
		<form ref={wrapperRef} onSubmit={handleSubmit} className="relative">
			<input
				type="text"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onFocus={() => {
					if (query.trim().length >= 2) {
						setOpen(true);
					}
				}}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className={
					mobile
						? "h-9 w-full rounded-md border border-border bg-background px-4 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
						: "h-10 w-full rounded-full border border-border bg-background px-4 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none"
				}
			/>
			<button
				type="submit"
				className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Search"
			>
				<Image src="/images/header/search.svg" alt="Search" width={18} height={18} />
			</button>

			{open && (
				<div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-background shadow-[0_16px_50px_rgba(15,23,42,0.14)]">
					{loading ? (
						<div className="px-4 py-4 text-sm text-muted-foreground">Searching products...</div>
					) : null}

					{showEmptyState ? (
						<div className="px-4 py-4 text-sm text-muted-foreground">No matching products found.</div>
					) : null}

					{!loading && suggestions.length > 0 ? (
						<div className="py-2">
							{suggestions.map((suggestion, index) => (
								<button
									key={suggestion.id}
									type="button"
									onMouseEnter={() => setActiveIndex(index)}
									onClick={() => goToSuggestion(suggestion)}
									className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
										index === activeIndex ? "bg-accent" : "bg-background hover:bg-accent/70"
									}`}
								>
									<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
										<SuggestionThumbnail src={suggestion.thumbnail} alt={suggestion.name} />
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-semibold text-foreground">{suggestion.name}</div>
										<div className="truncate text-xs text-muted-foreground">
											{suggestion.category || "Product"}
											{suggestion.code ? ` • ${suggestion.code}` : ""}
										</div>
									</div>
									<div className="shrink-0 text-sm font-semibold text-foreground">
										{suggestion.price > 0 ? formatAmount(suggestion.price) : ""}
									</div>
								</button>
							))}
						</div>
					) : null}
				</div>
			)}
		</form>
	);
}

// ─── Top Bar (White Section) ────────────────────────────────────────────────
function TopBar({ brand, socialLinks, searchPlaceholder, host, demoOnly = false }: { brand: BrandState; socialLinks: SocialLinkState[]; searchPlaceholder: string; host?: string | null; demoOnly?: boolean }) {
	const { currencies, selectedCurrency, setSelectedCurrency } = useCurrency();
	const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGE_OPTIONS);
	const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(DEFAULT_LANGUAGE_OPTIONS[0]);
	const [currencyOpen, setCurrencyOpen] = useState(false);
	const [languageOpen, setLanguageOpen] = useState(false);
	const selectorsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const closeSelectorsOnOutsideClick = (event: PointerEvent) => {
			if (selectorsRef.current?.contains(event.target as Node)) return;

			setCurrencyOpen(false);
			setLanguageOpen(false);
		};

		const closeSelectorsOnEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") return;

			setCurrencyOpen(false);
			setLanguageOpen(false);
		};

		document.addEventListener("pointerdown", closeSelectorsOnOutsideClick);
		document.addEventListener("keydown", closeSelectorsOnEscape);

		return () => {
			document.removeEventListener("pointerdown", closeSelectorsOnOutsideClick);
			document.removeEventListener("keydown", closeSelectorsOnEscape);
		};
	}, []);

	useEffect(() => {
		const loadLanguages = async () => {
			try {
				const result = await fetchStorefrontJson<{ data?: unknown }>("/translation-languages", host);
				const languageItems: LanguageOptionWithDefault[] = Array.isArray(result?.data)
					? result.data
							.map((item: { id?: number | string; name?: string; code?: string; direction?: "ltr" | "rtl"; is_default?: boolean; image_url?: string | null }) => {
								const code = String(item?.code || "").toLowerCase();
								if (!code) {
									return null;
								}

								const label = toLanguageLabel(String(item?.name || code.toUpperCase()), code);

								return {
									id: item?.id ?? code,
									label,
									value: code,
									flag: String(item?.image_url || "").trim() || LANGUAGE_FLAG_MAP[code] || "/images/header/en.svg",
									direction: item?.direction === "rtl" ? "rtl" : "ltr",
									isDefault: Boolean(item?.is_default),
								};
							})
							.filter((item): item is LanguageOptionWithDefault => item !== null)
					: [];

					const nextLanguages =
						languageItems.length > 0
							? languageItems.map((item) => ({
									id: item.id,
									label: item.label,
									value: item.value,
									flag: item.flag,
									direction: item.direction,
								}))
							: DEFAULT_LANGUAGE_OPTIONS;
				const storedLanguage = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
				const defaultLanguageCode =
					languageItems.find((item) => item.isDefault)?.value || DEFAULT_LANGUAGE_OPTIONS[0].value;

				const preferredLanguage =
					nextLanguages.find((item) => item.value === String(storedLanguage || "").toLowerCase()) ||
					nextLanguages.find((item) => item.value === defaultLanguageCode) ||
					nextLanguages[0];

				setLanguages(nextLanguages);
				setSelectedLanguage(preferredLanguage);
			} catch {
			}
		};

		void loadLanguages();
	}, [host]);

	return (
		<div className="border-b border-border bg-background">
			<div className="mx-auto flex  container items-center gap-6 py-5 px-4 lg:px-0">
				{/* Logo */}
				<BrandLink key={`desktop-${brand.logoUrl || "fallback"}-${brand.name}`} brand={brand} logoSize={32} textClassName="text-xl font-bold text-foreground" />

				{/* Search Bar */}
				<div className="hidden flex-1 md:block">
					<div className="mx-auto max-w-2xl">
						<SearchAutocomplete placeholder={searchPlaceholder} host={host} demoOnly={demoOnly} />
					</div>
				</div>

				{/* Right Section: Currency, Language, Social */}
				<div ref={selectorsRef} className="ml-auto flex shrink-0 items-center gap-3">
					{/* Currency Selector */}
					<div className="relative hidden lg:block">
						<button
							type="button"
							aria-expanded={currencyOpen}
							onClick={() => {
								setCurrencyOpen(!currencyOpen);
								setLanguageOpen(false);
							}}
							className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
						>
							{selectedCurrency.label}
							<Image
								src="/images/header/chevron-down.svg"
								alt=""
								width={16}
								height={16}
								className={`transition-transform ${currencyOpen ? "rotate-180" : ""}`}
							/>
						</button>
						{currencyOpen && (
							<div className="absolute top-full right-0 z-50 mt-1 min-w-30 rounded-md border border-border bg-background py-1 shadow-lg">
								{currencies.map((currency) => (
									<button
										key={currency.value}
										type="button"
										onClick={() => {
											setSelectedCurrency(currency);
											setCurrencyOpen(false);
										}}
										className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
											selectedCurrency.value === currency.value ? "font-medium text-foreground" : "text-muted-foreground"
										}`}
									>
										{currency.label}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Language Selector */}
					<div className="relative hidden lg:block">
						<button
							type="button"
							aria-expanded={languageOpen}
							onClick={() => {
								setLanguageOpen(!languageOpen);
								setCurrencyOpen(false);
							}}
							className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
						>
							<LanguageFlag key={selectedLanguage.flag || selectedLanguage.value} src={selectedLanguage.flag} alt={selectedLanguage.label} />
							{selectedLanguage.label}
							<Image
								src="/images/header/chevron-down.svg"
								alt=""
								width={16}
								height={16}
								className={`transition-transform ${languageOpen ? "rotate-180" : ""}`}
							/>
						</button>
						{languageOpen && (
							<div className="absolute top-full right-0 z-50 mt-1 min-w-30 rounded-md border border-border bg-background py-1 shadow-lg">
								{languages.map((language) => (
									<button
										key={language.value}
										type="button"
										onClick={() => {
											setSelectedLanguage(language);
											if (typeof window !== "undefined") {
												window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language.value);
											}
											setLanguageOpen(false);
										}}
										className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
											selectedLanguage.value === language.value ? "font-medium text-foreground" : "text-muted-foreground"
										}`}
									>
										<LanguageFlag key={language.flag || language.value} src={language.flag} alt={language.label} />
										{language.label}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Social Links */}
					<div className="hidden items-center gap-3 border-l border-[#d8d8d8] pl-5 lg:flex">
						{socialLinks.map((social) => (
							<Link
								key={social.label}
								href={social.href}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={social.label}
							>
								<SocialIcon social={social} />
							</Link>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Bottom Nav Bar (Dark Section) ──────────────────────────────────────────
function BottomNav({
	cartCount,
	wishlistCount,
	navItems,
	backgroundColor,
	host,
	demoOnly,
}: {
	cartCount: number;
	wishlistCount: number;
	navItems: HeaderNavItem[];
	backgroundColor: string;
	host?: string | null;
	demoOnly?: boolean;
}) {
	const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
	const { isAuthenticated, isLoading, user } = useAuth();
	// const buttonRef = useRef<HTMLButtonElement>(null);

	const handleAllCategoriesClick = () => {
		// setIsMegaMenuOpen(!isMegaMenuOpen);
		// if (buttonRef.current) {
		// 	(buttonRef.current as any).isClickingButton = true;
		// }
		setIsMegaMenuOpen((prev) => !prev);
	};

	const handleAllCategoriesIntent = () => {
		prefetchMegaMenuCategories(host, demoOnly);
	};

	const pathname = usePathname();
	const isWishlist = pathname === "/wishlist";
	const accountHref =
		isAuthenticated || (isLoading && readStoredAuthToken() && readStoredAuthUser())
			? getDashboardPath(user || readStoredAuthUser())
			: "/signin";

	return (
		<div style={{ backgroundColor }}>
			<div className="mx-auto flex container items-center justify-between py-2.5 px-4 lg:px-0">
				{/* Navigation Links */}
				<nav className="hidden items-center lg:flex">
					{navItems.map((item) =>
						item.label === "All categories" ? (
							// ref={buttonRef}
							<button
								key={item.label}
								onClick={handleAllCategoriesClick}
								onMouseEnter={handleAllCategoriesIntent}
								onFocus={handleAllCategoriesIntent}
								className="flex items-center gap-2 text-sm font-medium text-background hover:text-background/80 transition-colors whitespace-nowrap py-2 cursor-pointer"
							>
								<Image src={item.icon || ""} alt="menu" width={14} height={14} />
								{item.label}
							</button>
						) : (
							<Link
								key={item.label}
								href={item.href}
								className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-background transition-colors hover:text-background/80 ${
									item.isButton ? "mr-1 rounded-md  hover:bg-background/15" : ""
								}`}
							>
								{item.icon && (
									<Image src={item.icon} alt="icon" width={item.isButton ? 16 : 18} height={item.isButton ? 16 : 18} className={item.isButton ? "" : ""} />
								)}
								{item.label}
							</Link>
						),
					)}
				</nav>

				{/* Right Actions */}
				<div className="hidden items-center gap-1 lg:flex">
					{headerActions.map((action) => (
						<Link
							key={action.label}
							href={action.label === "Account" ? accountHref : action.href}
							className={`relative flex h-9 items-center gap-1.5 bg-white px-2 py-1.5 text-sm font-medium text-[#242424] transition-colors hover:bg-white/80 ${
								action.showLabel ? "rounded-full  px-3" : "w-9  rounded-full!"
							}`}
							aria-label={action.label}
						>
							<Image src={isWishlist && action.icon2 ? action.icon2 : action.icon} alt={action.label} width={20} height={20} />
							{action.label === "Cart" ? <CountBadge count={cartCount} /> : null}
							{action.label === "Wishlist" ? <CountBadge count={wishlistCount} /> : null}
							{action.showLabel && <span className="text-sm">{action.label}</span>}
						</Link>
					))}
				</div>
			</div>
			{/* Mega Menu */}
		{isMegaMenuOpen && <AllCategoriesMegaMenu isOpen={isMegaMenuOpen} onClose={() => setIsMegaMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} />}
		</div>
	);
}

// ─── Mobile Navigation (Sheet Drawer) ───────────────────────────────────────
function MobileNav({
	brand,
	socialLinks,
	cartCount,
	wishlistCount,
	navItems,
	host,
	demoOnly,
}: {
	brand: BrandState;
	socialLinks: SocialLinkState[];
	cartCount: number;
	wishlistCount: number;
	navItems: HeaderNavItem[];
	host?: string | null;
	demoOnly?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
	const { isAuthenticated, isLoading, user } = useAuth();
	const handleAllCategoriesClick = () => {
		// setIsMegaMenuOpen(!isMegaMenuOpen);
		// if (buttonRef.current) {
		// 	(buttonRef.current as any).isClickingButton = true;
		// }
		setIsMegaMenuOpen((prev) => !prev);
	};

	const handleAllCategoriesIntent = () => {
		prefetchMegaMenuCategories(host, demoOnly);
	};

	const accountHref =
		isAuthenticated || (isLoading && readStoredAuthToken() && readStoredAuthUser())
			? getDashboardPath(user || readStoredAuthUser())
			: "/signin";

	return (
		<div className="flex items-center lg:hidden">
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<Button variant="ghost" size="icon" className="text-foreground bg-primary-black hover:bg-primary-black">
						<Image src="/images/header/ham.png" alt="Open menu" width={14} height={12} />
						<span className="sr-only">Open menu</span>
					</Button>
				</SheetTrigger>

				<SheetContent side="right" className="w-[70%] overflow-y-auto bg-background p-0 sm:max-w-[70%]">
					<SheetHeader className="border-b border-border px-4 py-4">
						<SheetTitle>
							<BrandLink key={`drawer-${brand.logoUrl || "fallback"}-${brand.name}`} brand={brand} logoSize={28} textClassName="text-lg font-bold text-foreground" onClick={() => setOpen(false)} />
						</SheetTitle>
					</SheetHeader>

					{/* Mobile Nav Menu Items */}
					<div className="flex flex-col py-2">
						<p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu</p>
						{navItems.map((item, i) =>
							item.label === "All categories" ? (
								// ref={buttonRef}
								<button
									key={item.label}
									onClick={handleAllCategoriesClick}
									onMouseEnter={handleAllCategoriesIntent}
									onFocus={handleAllCategoriesIntent}
									className="flex items-center gap-2 text-sm font-medium py-2 pl-4 cursor-pointer"
								>
									<div className="bg-primary-black w-5 h-5 rounded-xs flex items-center justify-center">
										<Image src={item.icon || ""} alt="menu" width={14} height={14} />
									</div>
									{item.label}
								</button>
							) : (
								<Link
									key={item.label}
									href={item.href}
									onClick={() => setOpen(false)}
									className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
								>
									{item.icon && (
										<Image src={item.icon} alt="" width={18} height={18} className={`${i == 0 ? "bg-primary-black p-1 rounded-xs" : "bg-primary-white"}`} />
									)}
									<span>{item.label}</span>
								</Link>
							),
						)}
					</div>

					<Separator />

					{/* Mobile Actions */}
					<div className="flex flex-col py-2">
						<p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Account</p>
						{headerActions.map((action) => (
							<Link
								key={action.label}
								href={action.label === "Account" ? accountHref : action.href}
								onClick={() => setOpen(false)}
								className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
							>
								<div className="relative flex size-8 items-center justify-center rounded-full bg-gray-200">
									<Image src={action.icon} alt={action.label} width={18} height={18} />
									{action.label === "Cart" ? <CountBadge count={cartCount} /> : null}
									{action.label === "Wishlist" ? <CountBadge count={wishlistCount} /> : null}
								</div>
								<span>{action.label}</span>
							</Link>
						))}
					</div>

					<Separator />

					{/* Mobile Social Links */}
					<div className="flex flex-col py-2">
						<p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow Us</p>
						<div className="flex items-center gap-3 px-4 py-2">
							{socialLinks.map((social) => (
								<Link
									key={social.label}
									href={social.href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={social.label}
								>
									<SocialIcon social={social} />
								</Link>
							))}
						</div>
					</div>
				</SheetContent>
			</Sheet>
			{isMegaMenuOpen && <AllCategoriesMegaMenu isOpen={isMegaMenuOpen} onClose={() => setIsMegaMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} />}
		</div>
	);
}

// ─── Main Header ────────────────────────────────────────────────────────────
export default function Header({ initialData, section, host, demoOnly }: HeaderProps) {
	const sectionContent = section?.config?.content;
	const configuredLogoValue = sectionContent?.logo;
	const configuredLogo = String(
		configuredLogoValue && typeof configuredLogoValue === "object" && !Array.isArray(configuredLogoValue)
			? (configuredLogoValue as Record<string, unknown>).url || ""
			: "",
	).trim();
	const configuredName = String(sectionContent?.brand_name || "").trim();
	const navigationBackgroundColor = String(sectionContent?.navigation_background_color || "").trim()
		|| "var(--storefront-primary, var(--primary-black, #212124))";
	const resolvedNavigation = resolveNavigation(section, initialData);
	const hasConfiguredSocialLinks = Array.isArray(sectionContent?.social_links);
	const hasConfiguredSearchPlaceholder = Object.prototype.hasOwnProperty.call(sectionContent || {}, "search_placeholder_text") || Object.prototype.hasOwnProperty.call(sectionContent || {}, "search_placeholder");
	const [brand, setBrand] = useState<BrandState>({
		name: configuredName || initialData?.brand.name || DEFAULT_BRAND.name,
		logoUrl: configuredLogo
			? resolveApiAssetUrl(configuredLogo, host)
			: initialData?.brand.logoUrl || null,
	});
	const [socialLinks, setSocialLinks] = useState<SocialLinkState[]>(
		hasConfiguredSocialLinks
			? buildDynamicSocialLinks(null, section)
			: storeSocialLinks(initialData?.socialLinks || []),
	);
	const [searchPlaceholder, setSearchPlaceholder] = useState(hasConfiguredSearchPlaceholder ? resolveHeaderSearchPlaceholder(section) : (initialData?.searchPlaceholder || "Search any product..."));
	const [navItems, setNavItems] = useState<HeaderNavItem[]>(resolvedNavigation);
	const [hasBuilderHeader, setHasBuilderHeader] = useState<boolean | null>(initialData?.hasBuilderHeader ?? Boolean(section));
	const { count: cartCount } = useCart();
	const { count: wishlistCount } = useWishlist();
	const { isAuthenticated, isLoading, user } = useAuth();
	const pathname = usePathname();
	const mobileAccountHref =
		isAuthenticated || (isLoading && readStoredAuthToken() && readStoredAuthUser())
			? getDashboardPath(user || readStoredAuthUser())
			: "/signin";

	// Metadata is resolved server-side with the storefront host. Use it immediately
	// as a client fallback so the platform default never remains in the header while
	// the storefront settings request is loading (or when that request is blocked).
	useEffect(() => {
		const documentTitle = typeof document !== "undefined" ? document.title.trim() : "";
		const normalizedTitle = documentTitle.toLowerCase();

		if (configuredName || !documentTitle || normalizedTitle === "nex commerce" || normalizedTitle === DEFAULT_BRAND.name.toLowerCase()) {
			return;
		}

		const updateBrandTimer = window.setTimeout(() => {
			setBrand((current) => (current.name === DEFAULT_BRAND.name ? { ...current, name: documentTitle } : current));
		}, 0);

		return () => window.clearTimeout(updateBrandTimer);
	}, [configuredName]);

	useEffect(() => {
		if (initialData) {
			return;
		}

		prefetchMegaMenuCategories(host, demoOnly);

		const loadHeaderContext = async () => {
			try {
				const [settingsJson, preferencesJson, homeJson] = await Promise.all([
					fetchStorefrontJson<{ data?: unknown }>(`/landing/settings/basic${demoOnly ? "?is_demo=1" : ""}`, host),
					fetchStorefrontJson<{ data?: unknown }>(`/landing/preferences${demoOnly ? "?is_demo=1" : ""}`, host),
					fetchStorefrontJson<{ data?: { sections?: StorefrontChromeSection[] } }>(`/home?react=1${demoOnly ? "&is_demo=1" : ""}`, host),
				]);
				const preferencesData = normalizePreferencesData(preferencesJson?.data);
				const settingsData = normalizePreferencesData(settingsJson?.data);
				const sections = Array.isArray(homeJson?.data?.sections) ? (homeJson.data.sections as StorefrontChromeSection[]) : [];
				const headerSection =
					sections.find((section) => String(section?.template?.slot || "").toLowerCase() === "header") ||
					sections.find((section) => String(section?.variant || "").toLowerCase() === "header") ||
					null;

				setHasBuilderHeader(Boolean(headerSection));
				setBrand({
					name: configuredName || resolveBrandName(headerSection, preferencesData, settingsData),
					// A category header should only show a logo explicitly uploaded for
					// this store. Do not fall back to the platform's default logo.
					logoUrl: configuredLogo
						? resolveApiAssetUrl(configuredLogo, host)
						: String(preferencesData?.site_logo ?? "").trim() || null,
				});
				if (!hasConfiguredSocialLinks) {
					setSocialLinks(storeSocialLinks(buildDynamicSocialLinks(preferencesData, headerSection)));
				}
				setSearchPlaceholder(resolveHeaderSearchPlaceholder(headerSection));
				setNavItems(mapHeaderActionsToNavItems(Array.isArray(headerSection?.actions) ? headerSection.actions : []));
			} catch {
			}
		};

		void loadHeaderContext();
	}, [configuredLogo, configuredName, demoOnly, hasConfiguredSocialLinks, host, initialData]);

	if (pathname === "/" && hasBuilderHeader === false) {
		return null;
	}

	return (
		<header className="sticky top-0 z-40 [&_a]:cursor-pointer [&_button]:cursor-pointer">
			{/* Mobile Top Bar */}
			<div className="flex items-center justify-between bg-background border-b border-border px-4 py-2 lg:hidden">
				<BrandLink key={`mobile-${brand.logoUrl || "fallback"}-${brand.name}`} brand={brand} logoSize={28} textClassName="text-lg font-bold text-foreground" />

				<div className="flex items-center gap-1">
					{/* Mobile quick actions */}
					<Link href="/wishlist" className="relative rounded-md p-2 transition-colors hover:bg-accent" aria-label="Favourites">
						<Image src="/images/header/heart-rounded.svg" alt="wishlist" width={20} height={20} className="" />
						<CountBadge count={wishlistCount} />
					</Link>
					<Link href="/cart" className="relative rounded-md p-2 transition-colors hover:bg-accent" aria-label="Cart">
						<Image src="/images/header/shopping-bag.svg" alt="Cart" width={20} height={20} className="" />
						<CountBadge count={cartCount} />
					</Link>
					<Link href={mobileAccountHref} className="rounded-md p-2 transition-colors hover:bg-accent" aria-label="Account">
						<Image src="/images/header/profile.svg" alt="Account" width={20} height={20} className="" />
					</Link>
					<MobileNav brand={brand} socialLinks={socialLinks} cartCount={cartCount} wishlistCount={wishlistCount} navItems={navItems} host={host} demoOnly={demoOnly} />
				</div>
			</div>

			{/* Mobile Search */}
			<div className="border-b border-border bg-background px-4 py-2 lg:hidden">
					<SearchAutocomplete mobile placeholder={searchPlaceholder} host={host} demoOnly={demoOnly} />
			</div>

			{/* Desktop Top Bar */}
			<div className="hidden lg:block">
			<TopBar brand={brand} socialLinks={socialLinks} searchPlaceholder={searchPlaceholder} host={host} demoOnly={demoOnly} />
			</div>

			{/* Desktop Bottom Nav */}
			<div className="hidden lg:block">
			<BottomNav cartCount={cartCount} wishlistCount={wishlistCount} navItems={navItems} backgroundColor={navigationBackgroundColor} host={host} demoOnly={demoOnly} />
			</div>
		</header>
	);
}

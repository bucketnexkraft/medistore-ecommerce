"use client";

import Image, { type ImageProps } from "next/image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Link from "next/link";
import { createElement, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Heart, Menu, Search, ShoppingBag, UserRound, icons as lucideIcons } from "lucide-react";
import { AllCategoriesMegaMenu, prefetchMegaMenuCategories } from "@/components/common/AllCategoriesMegaMenu";
import type { EcommerceChromeComponentProps } from "@/components/ecommerce/categories/chrome-registry";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { getDashboardPath, readStoredAuthToken, readStoredAuthUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { apiFetch } from "@/lib/api-client";
import { useAmount } from "@/lib/amount";
import { resolveApiAssetUrl } from "@/lib/config";
import { buildDynamicSocialLinks, DEFAULT_BRAND, getAllCategoriesNavItem, mapHeaderActionsToNavItems, normalizePreferencesData, resolveBrandName, resolveHeaderSearchPlaceholder, type BrandState, type HeaderNavItem } from "@/lib/header-context";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";
import { socialLinks as defaultSocialLinks } from "@/data/header-data";

// The shared helper may return platform sample links. They are not store data.
const storeSocialLinks = (links: ReturnType<typeof buildDynamicSocialLinks>) =>
	links.filter((link) => !defaultSocialLinks.some((sample) => sample.href === link.href));

type LanguageOption = { id: number | string; label: string; value: string; flag: string; direction: "ltr" | "rtl" };
type LanguageOptionWithDefault = LanguageOption & { isDefault: boolean };
const LANGUAGE_STORAGE_KEY = "arcade-selected-language";
// Match Fashion's initial render while the language API is loading.
const DEFAULT_LANGUAGES: LanguageOption[] = [
	{ id: "en", value: "en", label: "Eng", flag: "/images/header/en.svg", direction: "ltr" },
	{ id: "bn", value: "bn", label: "\u09AC\u09BE\u0982", flag: "/images/header/flag-bd.svg", direction: "ltr" },
];
const languageLabel = (name: string, code: string) => {
	if (code === "en") return "Eng";
	if (code === "bn") return "\u09AC\u09BE\u0982";
	return name.length <= 4 ? name : name.slice(0, 3);
};
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};


const resolveLucideIcon = (name: string) => {
	const aliases: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", twitter: "Twitter", x: "Twitter" };
	const requested = aliases[name.toLowerCase()] || name;
	if (lucideIcons[requested as keyof typeof lucideIcons]) return lucideIcons[requested as keyof typeof lucideIcons];
	const normalized = requested.toLowerCase().replace(/[^a-z0-9]/g, "");
	const key = Object.keys(lucideIcons).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
	return key ? lucideIcons[key as keyof typeof lucideIcons] : null;
};

function SocialIcon({ icon, iconType, label }: { icon: string; iconType?: "image" | "lucide"; label: string }) {
	if (iconType === "image") return <Image unoptimized src={icon} alt={label} width={17} height={17} className="size-[17px] object-contain" />;
	const Icon = resolveLucideIcon(icon);
	return Icon ? createElement(Icon, { className: "size-[17px]", strokeWidth: 1.8, "aria-hidden": true }) : null;
}

function HeaderImage({ fallback, alt, ...props }: ImageProps & { fallback?: string }) {
	const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
	const failed = failedSrc === props.src;
	if (failed && !fallback) return null;
	return <Image {...props} alt={alt} src={failed ? fallback! : props.src} onError={() => setFailedSrc(props.src)} />;
}

type SearchSuggestion = { id: string; code?: string | null; name: string; thumbnail: string | null; category: string | null; price: number; url: string };

function SearchAutocomplete({ mobile = false, placeholder, host, demoOnly = false }: { mobile?: boolean; placeholder: string; host: string | null; demoOnly?: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchPath = useRef(pathname);
	const { formatAmount } = useAmount();
	const wrapperRef = useRef<HTMLFormElement>(null);
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	useEffect(() => { setOpen(false); setActiveIndex(-1); }, [pathname]);

	useEffect(() => {
		const close = (event: MouseEvent) => { if (!wrapperRef.current?.contains(event.target as Node)) { setOpen(false); setActiveIndex(-1); } };
		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, []);

	useEffect(() => {
		if (searchPath.current !== pathname) {
			searchPath.current = pathname;
			setLoading(false);
			return;
		}
		const value = query.trim();
		if (value.length < 2) { setSuggestions([]); setOpen(false); setLoading(false); setActiveIndex(-1); return; }
		const controller = new AbortController();
		const timeout = window.setTimeout(async () => {
			try {
				setLoading(true);
				const params = new URLSearchParams({ q: value, limit: mobile ? "6" : "8" });
				if (demoOnly) params.set("is_demo", "1");
				const response = await apiFetch(`/landing/products/search?${params.toString()}`, { signal: controller.signal }, host);
				const result = response.ok ? await response.json() : null;
				if (controller.signal.aborted) return;
				const items = Array.isArray(result?.data) ? result.data : [];
				setSuggestions(items); setOpen(true); setActiveIndex(items.length ? 0 : -1);
			} catch (error) {
				if (!(error instanceof DOMException && error.name === "AbortError")) { setSuggestions([]); setOpen(true); setActiveIndex(-1); }
			} finally { if (!controller.signal.aborted) setLoading(false); }
		}, 250);
		return () => { controller.abort(); window.clearTimeout(timeout); };
	}, [demoOnly, host, mobile, query, pathname]);

	const choose = (item: SearchSuggestion) => { setOpen(false); setActiveIndex(-1); setQuery(item.name); router.push(item.url); };
	const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (suggestions[activeIndex]) choose(suggestions[activeIndex]); else if (suggestions[0]) choose(suggestions[0]); };
	const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!open || !suggestions.length) return;
		if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => (current + 1) % suggestions.length); }
		if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => current <= 0 ? suggestions.length - 1 : current - 1); }
		if (event.key === "Enter" && suggestions[activeIndex]) { event.preventDefault(); choose(suggestions[activeIndex]); }
		if (event.key === "Escape") { setOpen(false); setActiveIndex(-1); }
	};

	return (
		<form ref={wrapperRef} onSubmit={submit} className="relative">
			<input
				type="text"
				aria-label={placeholder || "Search products"}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
				onKeyDown={keyDown}
				placeholder={placeholder}
				className={mobile
					? "h-9 w-full rounded-md border border-white/70 bg-white/10 px-4 pr-10 text-sm text-white placeholder:text-white/90 outline-none focus:border-white"
					: "h-10 w-full rounded-full border border-white/70 bg-transparent px-4 pr-10 text-sm text-white placeholder:text-white/90 outline-none"}
			/>
			<button type="submit" aria-label="Search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white transition-opacity hover:opacity-70">
				<Search aria-hidden="true" size={19} />
			</button>
			{open && query.trim().length >= 2 ? (
				<div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-[0_16px_50px_rgba(15,23,42,0.14)]">
					{loading ? <div role="status" className="px-4 py-4 text-sm text-muted-foreground">Searching products...</div> : null}
					{!loading && suggestions.length === 0 ? <div role="status" className="px-4 py-4 text-sm text-muted-foreground">No matching products found.</div> : null}
					{!loading && suggestions.length > 0 ? (
						<div className="py-2">
							{suggestions.map((item, index) => (
								<button
									key={item.id}
									type="button"
									onMouseEnter={() => setActiveIndex(index)}
									onClick={() => choose(item)}
									className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${index === activeIndex ? "bg-accent" : "bg-background hover:bg-accent/70"}`}
								>
									<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
										<HeaderImage fallback="/images/placeholder.jpg" unoptimized src={item.thumbnail || "/images/placeholder.jpg"} alt={item.name} width={48} height={48} className="h-full w-full object-cover" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
										<div className="truncate text-xs text-muted-foreground">{item.category || "Product"}{item.code ? ` · ${item.code}` : ""}</div>
									</div>
									<div className="shrink-0 text-sm font-semibold text-foreground">{item.price > 0 ? formatAmount(item.price) : ""}</div>
								</button>
							))}
						</div>
					) : null}
				</div>
			) : null}
		</form>
	);
}

function resolveNavigation(section: EcommerceChromeComponentProps["section"], initial?: HeaderNavItem[]) {
	const actions = Array.isArray(section.actions) ? section.actions : [];
	const configured = actions.length ? mapHeaderActionsToNavItems(actions) : [];
	if (configured.length > 1) return configured;
	if (initial?.length) return initial;
	return [getAllCategoriesNavItem()];
}

export default function HeaderGadgetsTwo({ section, host, initialData, demoOnly }: EcommerceChromeComponentProps) {
	const selectorsRef = useRef<HTMLDivElement>(null);
	const content = asRecord(asRecord(section.config).content);
	const configuredLogo = String(asRecord(content.logo).url || "").trim();
	const configuredName = String(content.brand_name || "").trim();
	const configuredSocials = Array.isArray(content.social_links);
	const configuredPlaceholder = Object.prototype.hasOwnProperty.call(content, "search_placeholder_text") || Object.prototype.hasOwnProperty.call(content, "search_placeholder");
	const [brand, setBrand] = useState<BrandState>({ name: configuredName || initialData?.brand.name || DEFAULT_BRAND.name, logoUrl: configuredLogo ? resolveApiAssetUrl(configuredLogo, host) : initialData?.brand.logoUrl || null });
	const [socials, setSocials] = useState(configuredSocials ? buildDynamicSocialLinks(null, section) : storeSocialLinks(initialData?.socialLinks || []));
	const [placeholder, setPlaceholder] = useState(configuredPlaceholder ? resolveHeaderSearchPlaceholder(section) : initialData?.searchPlaceholder || "Search any product...");
	const [navigation, setNavigation] = useState(resolveNavigation(section, initialData?.navItems));
	const [hasHeader, setHasHeader] = useState<boolean | null>(initialData?.hasBuilderHeader ?? true);
	const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);
	const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(DEFAULT_LANGUAGES[0]);
	const [menuOpen, setMenuOpen] = useState(false);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [currencyOpen, setCurrencyOpen] = useState(false);
	const [languageOpen, setLanguageOpen] = useState(false);
	const { currencies, selectedCurrency, setSelectedCurrency } = useCurrency();
	const { count: cartCount } = useCart();
	const { count: wishlistCount } = useWishlist();
	const { isAuthenticated, isLoading, user } = useAuth();
	const pathname = usePathname();
	const accountHref = isAuthenticated || (isLoading && readStoredAuthToken() && readStoredAuthUser()) ? getDashboardPath(user || readStoredAuthUser()) : "/signin";

	useEffect(() => {
		prefetchMegaMenuCategories(host, demoOnly);
		void fetchStorefrontJson<{ data?: unknown }>("/translation-languages", host).then((json) => {
			const languageItems: LanguageOptionWithDefault[] = (Array.isArray(json?.data) ? json.data : []).flatMap((row) => {
				const item = asRecord(row); const code = String(item.code || "").toLowerCase();
				if (!code) return [];
				return [{ id: (item.id as number | string | null) ?? code, value: code, label: languageLabel(String(item.name || code.toUpperCase()), code), flag: String(item.image_url || "").trim() || DEFAULT_LANGUAGES.find((language) => language.value === code)?.flag || DEFAULT_LANGUAGES[0].flag, direction: item.direction === "rtl" ? "rtl" as const : "ltr" as const, isDefault: Boolean(item.is_default) }];
			});
			const nextLanguages = languageItems.length ? languageItems : DEFAULT_LANGUAGES;
			const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
			const defaultCode = languageItems.find((item) => item.isDefault)?.value || DEFAULT_LANGUAGES[0].value;
			setLanguages(nextLanguages);
			setSelectedLanguage(nextLanguages.find((item) => item.value === String(stored || "").toLowerCase()) || nextLanguages.find((item) => item.value === defaultCode) || nextLanguages[0]);
		}).catch(() => undefined);
	}, [demoOnly, host]);

	useEffect(() => {
		const closeSelectors = (event: PointerEvent) => {
			if (selectorsRef.current?.contains(event.target as Node)) return;
			setCurrencyOpen(false);
			setLanguageOpen(false);
		};
		const closeOnEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				setCurrencyOpen(false);
				setLanguageOpen(false);
			}
		};
		document.addEventListener("pointerdown", closeSelectors);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeSelectors);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, []);

	useEffect(() => {
		if (initialData) return;
		const suffix = demoOnly ? "?is_demo=1" : "";
		void Promise.all([
			fetchStorefrontJson<{ data?: unknown }>(`/landing/settings/basic${suffix}`, host),
			fetchStorefrontJson<{ data?: unknown }>(`/landing/preferences${suffix}`, host),
			fetchStorefrontJson<{ data?: { sections?: StorefrontChromeSection[] } }>(`/home?react=1${demoOnly ? "&is_demo=1" : ""}`, host),
		]).then(([settingsJson, preferencesJson, homeJson]) => {
			const preferences = normalizePreferencesData(preferencesJson?.data); const settings = normalizePreferencesData(settingsJson?.data);
			const sections = Array.isArray(homeJson?.data?.sections) ? homeJson.data.sections : [];
			const header = sections.find((item) => String(item?.template?.slot || "").toLowerCase() === "header") || sections.find((item) => String(item?.variant || "").toLowerCase() === "header") || null;
			setHasHeader(Boolean(header));
			setBrand({ name: configuredName || resolveBrandName(header, preferences, settings), logoUrl: configuredLogo ? resolveApiAssetUrl(configuredLogo, host) : String(preferences?.site_logo || "").trim() || null });
			if (!configuredSocials) setSocials(storeSocialLinks(buildDynamicSocialLinks(preferences, header)));
			if (!configuredPlaceholder) setPlaceholder(resolveHeaderSearchPlaceholder(header));
			if (!Array.isArray(section.actions) || !section.actions.length) setNavigation(mapHeaderActionsToNavItems(Array.isArray(header?.actions) ? header.actions : []));
		}).catch(() => undefined);
	}, [configuredLogo, configuredName, configuredPlaceholder, configuredSocials, demoOnly, host, initialData, section.actions]);

	useEffect(() => {
		const title = document.title.trim();
		if (configuredName || !title || ["nex commerce", DEFAULT_BRAND.name.toLowerCase()].includes(title.toLowerCase())) return;
		const timeout = window.setTimeout(() => {
			setBrand((current) => current.name === DEFAULT_BRAND.name ? { ...current, name: title } : current);
		}, 0);
		return () => window.clearTimeout(timeout);
	}, [configuredName]);

	const toggleCategories = () => setMenuOpen((current) => !current);
	const prefetchCategories = () => prefetchMegaMenuCategories(host, demoOnly);

	if (pathname === "/" && hasHeader === false) return null;

	return <header data-storefront-section="electronics-gadgets-header-gadgets-two" className="absolute inset-x-0 top-0 z-40 text-white [&_button]:cursor-pointer [&_a]:cursor-pointer">
		<div className="flex items-center justify-between border-b border-white/30 bg-[#21212429] px-4 py-2 lg:hidden">
			<Link className="flex min-w-0 items-center gap-2" href="/">{brand.logoUrl ? <HeaderImage unoptimized src={brand.logoUrl} alt={`${brand.name} logo`} width={28} height={28} className="size-7 object-contain" /> : null}<span className="truncate text-lg font-black">{brand.name}</span></Link>
			<div className="flex items-center gap-1"><Link href="/wishlist" aria-label="Wishlist" className="relative p-2"><Heart size={20} /><Badge count={wishlistCount} /></Link><Link href="/cart" aria-label="Cart" className="relative p-2"><ShoppingBag size={20} /><Badge count={cartCount} /></Link><Link href={accountHref} aria-label="Account" className="p-2"><UserRound size={20} /></Link><button type="button" aria-label="Open menu" className="p-2" onClick={() => setMobileNavOpen(true)}><Menu size={22} /></button></div>
		</div>
		{content.show_search === false ? null : <div className="border-b border-white/30 bg-[#21212429] px-4 py-2 lg:hidden"><SearchAutocomplete mobile placeholder={placeholder} host={host} demoOnly={demoOnly} /></div>}
		<div className="hidden border-b border-white/30 bg-[#21212429] lg:block"><div className="mx-auto grid min-h-20 w-full max-w-[1536px] grid-cols-[auto_1fr_auto] items-center gap-5 px-5 lg:gap-8 lg:px-6">
			<Link className="flex min-w-0 shrink-0 items-center gap-2" href="/" aria-label={brand.name}>{brand.logoUrl ? <HeaderImage unoptimized src={brand.logoUrl} alt={`${brand.name} logo`} width={36} height={36} className="h-9 w-9 object-contain" /> : null}<span className="truncate text-2xl font-black tracking-tight">{brand.name}</span></Link>
			{content.show_search === false ? <div /> : <div className="w-full max-w-[708px] justify-self-center"><SearchAutocomplete placeholder={placeholder} host={host} demoOnly={demoOnly} /></div>}
			<div ref={selectorsRef} className="hidden items-center gap-5 text-sm lg:flex">
				<div className="relative border-r border-white/70 pr-5">
					<button type="button" aria-expanded={currencyOpen} className="flex items-center gap-2" onClick={() => { setCurrencyOpen(!currencyOpen); setLanguageOpen(false); }}>{selectedCurrency.label}<ChevronDown size={14} className={currencyOpen ? "rotate-180" : ""} /></button>
					{currencyOpen ? <div className="absolute right-0 top-full z-50 mt-2 min-w-36 rounded-md border bg-white py-1 text-[#242424] shadow-lg">{currencies.map((item) => <button key={item.value} type="button" className={`block w-full px-3 py-2 text-left hover:bg-gray-100 ${selectedCurrency.value === item.value ? "font-semibold" : ""}`} onClick={() => { setSelectedCurrency(item); setCurrencyOpen(false); }}>{item.label}</button>)}</div> : null}
				</div>
				{selectedLanguage ? <div className="relative">
					<button type="button" aria-expanded={languageOpen} className="flex items-center gap-2" onClick={() => { setLanguageOpen(!languageOpen); setCurrencyOpen(false); }}>
						{selectedLanguage.flag ? <HeaderImage unoptimized src={selectedLanguage.flag} alt="" width={24} height={16} className="h-4 w-6 object-contain" /> : null}{selectedLanguage.label}<ChevronDown size={14} className={languageOpen ? "rotate-180" : ""} />
					</button>
					{languageOpen ? <div className="absolute right-0 top-full z-50 mt-2 min-w-36 rounded-md border bg-white py-1 text-[#242424] shadow-lg">{languages.map((item) => <button key={item.value} type="button" className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 ${selectedLanguage.value === item.value ? "font-semibold" : ""}`} onClick={() => { setSelectedLanguage(item); window.localStorage.setItem(LANGUAGE_STORAGE_KEY, item.value); setLanguageOpen(false); }}>{item.flag ? <HeaderImage unoptimized src={item.flag} alt="" width={20} height={14} className="object-contain" /> : null}{item.label}</button>)}</div> : null}
				</div> : null}
				<div className="flex items-center gap-3 border-l border-white/70 pl-5">{socials.map((item) => <a key={`${item.label}-${item.href}`} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}><SocialIcon icon={item.icon} iconType={item.iconType} label={item.label} /></a>)}</div>
			</div>
		</div></div>
		<div className="hidden border-b border-white/40 bg-black/10 text-white lg:block"><div className="mx-auto flex min-h-[59px] w-full max-w-[1536px] items-center gap-8 overflow-hidden px-5 lg:px-6">
			<button type="button" onClick={toggleCategories} onMouseEnter={prefetchCategories} onFocus={prefetchCategories} className="flex shrink-0 items-center gap-3 text-sm"><Menu size={18} />{navigation[0]?.label || "All categories"}</button>
			<nav className="hidden items-center gap-10 whitespace-nowrap text-sm lg:flex" aria-label="Store navigation">{navigation.slice(1).map((item) => <Link key={item.label + item.href} href={item.href} className={`flex items-center gap-2 py-1.5 ${item.isButton ? "rounded-md px-3 hover:bg-white/15" : ""}`}>{item.icon ? <Image src={item.icon} alt="" width={item.isButton ? 16 : 18} height={item.isButton ? 16 : 18} /> : null}{item.label}</Link>)}</nav>
			<div className="ml-auto flex shrink-0 items-center gap-3">
				<Link href="/wishlist" aria-label={`Wishlist (${wishlistCount})`} className="relative flex size-9 items-center justify-center rounded-full bg-white text-[#242424]"><Heart size={19} /><Badge count={wishlistCount} /></Link>
				<Link href="/cart" aria-label={`Cart (${cartCount})`} className="relative flex size-9 items-center justify-center rounded-full bg-white text-[#242424]"><ShoppingBag size={19} /><Badge count={cartCount} /></Link>
				<Link href={accountHref} aria-label="Account" className="flex size-9 items-center justify-center rounded-full bg-white text-[#242424] sm:w-auto sm:gap-2 sm:px-3"><span className="flex size-7 items-center justify-center rounded-full bg-[#f49b44]"><UserRound size={17} /></span><span className="hidden sm:inline">Account</span></Link>
			</div>
		</div></div>
		<Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
			<SheetContent side="right" className="w-[78%] max-w-sm overflow-y-auto bg-white p-5 text-[#242424] [&_button]:cursor-pointer [&_a]:cursor-pointer">
				<SheetHeader className="mb-5 border-b pb-4">
					<SheetTitle>
						<Link href="/" className="flex items-center gap-2 pr-6" onClick={() => setMobileNavOpen(false)}>
							{brand.logoUrl ? <HeaderImage unoptimized src={brand.logoUrl} alt={brand.name} width={28} height={28} className="size-7 object-contain" /> : null}
							<span className="font-bold">{brand.name}</span>
						</Link>
					</SheetTitle>
				</SheetHeader>
				<nav className="flex flex-col" aria-label="Mobile store navigation">
					{navigation.map((item) => item.label === "All categories"
						? <button key={item.label} type="button" className="flex items-center gap-2 py-3 text-left font-medium" onMouseEnter={prefetchCategories} onFocus={prefetchCategories} onClick={() => { setMobileNavOpen(false); toggleCategories(); }}>{item.icon ? <Image src={item.icon} alt="" width={14} height={14} /> : null}{item.label}</button>
						: <Link key={item.label + item.href} href={item.href} className="flex items-center gap-3 py-3 font-medium" onClick={() => setMobileNavOpen(false)}>{item.icon ? <Image src={item.icon} alt="" width={18} height={18} /> : null}{item.label}</Link>)}
				</nav>
				<div className="mt-5 flex flex-col gap-3 border-t pt-5">
					<p className="text-sm font-semibold">My Account</p>
					<Link href="/wishlist" className="flex items-center gap-3 py-2" onClick={() => setMobileNavOpen(false)}><span className="relative"><Heart size={20} /><Badge count={wishlistCount} /></span>Wishlist</Link>
					<Link href="/cart" className="flex items-center gap-3 py-2" onClick={() => setMobileNavOpen(false)}><span className="relative"><ShoppingBag size={20} /><Badge count={cartCount} /></span>Cart</Link>
					<Link href={accountHref} className="flex items-center gap-3 py-2" onClick={() => setMobileNavOpen(false)}><UserRound size={20} />Account</Link>
				</div>
				<div className="mt-5 border-t pt-5">
					<p className="mb-3 text-sm font-semibold">Preferences</p>
					<label className="mb-1 text-xs text-gray-500" htmlFor="gadgets-two-mobile-currency">Currency</label>
					<select id="gadgets-two-mobile-currency" value={selectedCurrency.value} onChange={(event) => { const currency = currencies.find((item) => item.value === event.target.value); if (currency) setSelectedCurrency(currency); }} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
						{currencies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
					</select>
					<label className="mb-1 mt-3 block text-xs text-gray-500" htmlFor="gadgets-two-mobile-language">Language</label>
					<select id="gadgets-two-mobile-language" value={selectedLanguage.value} onChange={(event) => { const language = languages.find((item) => item.value === event.target.value); if (language) { setSelectedLanguage(language); window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language.value); } }} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
						{languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
					</select>
				</div>
				{socials.length ? <div className="mt-5 border-t pt-5">
					<p className="mb-3 text-sm font-semibold">Follow Us</p>
					<div className="flex gap-3">{socials.map((item) => <a key={item.label + item.href} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label} className="rounded-md border border-gray-200 p-2 transition-colors hover:bg-gray-100"><SocialIcon icon={item.icon} iconType={item.iconType} label={item.label} /></a>)}</div>
				</div> : null}
			</SheetContent>
		</Sheet>
		{menuOpen ? <AllCategoriesMegaMenu isOpen onClose={() => setMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} desktopTopOffset={139} /> : null}
	</header>;
}

function Badge({ count }: { count: number }) {
	return count > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-[#f49b44] px-1 text-[10px] font-bold">{count > 99 ? "99+" : count}</span> : null;
}

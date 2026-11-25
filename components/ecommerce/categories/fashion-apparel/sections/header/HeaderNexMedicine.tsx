"use client";

import { createElement, FormEvent, KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { socialLinks as defaultSocialLinks } from "@/data/header-data";
import { usePathname, useRouter } from "next/navigation";
import { AllCategoriesMegaMenu, prefetchMegaMenuCategories } from "@/components/common/AllCategoriesMegaMenu";
import { apiFetch } from "@/lib/api-client";
import { useAmount } from "@/lib/amount";
import { useCompare } from "@/components/providers/CompareProvider";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { ChevronDown, ExternalLink, Menu, Package, Phone, Search, Zap, icons as lucideIcons } from "lucide-react";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import { normalizeStorefrontNavHref } from "@/lib/storefront-links";
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
	preferencesData?: Record<string, unknown> | null;
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
		ad: "Megaphone",
		home: "House",
		"shopping-bag": "ShoppingBag",
		"magnifying-glass": "Search",
		"map-pin": "MapPin",
		"arrow-right": "ArrowRight",
	};
	const requested = aliases[name.toLowerCase()] || name;
	if (lucideIcons[requested as keyof typeof lucideIcons]) return lucideIcons[requested as keyof typeof lucideIcons];
	const normalized = requested.toLowerCase().replace(/[^a-z0-9]/g, "");
	const key = Object.keys(lucideIcons).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
	return key ? lucideIcons[key as keyof typeof lucideIcons] : null;
};

function SocialIcon({ social }: { social: SocialLinkState }) {
	const iconClassName = "size-[18px] lg:size-6";
	if (social.iconType === "lucide") {
		const Icon = resolveLucideIcon(social.icon) ?? ExternalLink;
		return createElement(Icon, { className: iconClassName, strokeWidth: 1.8, "aria-hidden": true });
	}

	return <Image src={social.icon} alt="" width={24} height={24} className={`${iconClassName} object-contain`} />;
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
	textClassName,
	showText = false,
	onClick,
}: {
	brand: BrandState;
	textClassName: string;
	showText?: boolean;
	onClick?: () => void;
}) {
	const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
	const logoSrc = brand.logoUrl && failedLogoUrl !== brand.logoUrl ? brand.logoUrl : null;

	return (
		<Link href="/" className="flex min-w-0 max-w-44 items-center gap-2" onClick={onClick}>
			{logoSrc ? (
				<Image
					key={logoSrc}
					unoptimized
					src={logoSrc}
					alt={`${brand.name} logo`}
					width={176}
					height={48}
					className="h-auto max-h-9 w-auto max-w-full object-contain md:max-h-12"
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
		<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-blue px-1 text-[11px] font-bold leading-none text-primary-foreground">
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

function SearchAutocomplete({ placeholder, host, demoOnly = false }: { placeholder: string; host?: string | null; demoOnly?: boolean }) {
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
					limit: "8",
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
	}, [demoOnly, host, query]);

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
				aria-label="Search products"
				className="h-11 w-full rounded-xl border border-input bg-muted/40 pl-4 pr-14 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary-blue focus:ring-1 focus:ring-primary-blue lg:h-[3.25rem] lg:pr-16 lg:text-base"
			/>
			<button
				type="submit"
					className="absolute inset-y-1 right-1 grid w-10 cursor-pointer place-items-center rounded-lg bg-primary-blue text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue lg:w-11"
				aria-label="Search"
			>
				<Search size={19} aria-hidden="true" />
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
									className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors ${
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


const headerContainer = "mx-auto w-full max-w-[96rem] px-4 sm:px-6 lg:px-8";
const quickActionClass = "relative grid size-9 shrink-0 place-items-center rounded-lg text-foreground transition-colors hover:bg-primary-blue/10 hover:text-primary-blue focus-visible:outline-2 focus-visible:outline-primary-blue sm:size-10";
const storeSocialLinks = (links: SocialLinkState[]) =>
	links.filter((link) => !defaultSocialLinks.some((sample) => sample.href === link.href));

const normalizeHeaderIconHref = (href: string) =>
	normalizeStorefrontNavHref(/^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/.test(href) ? `https://${href}` : href);

const isPresetBrandName = (name?: string | null) =>
	name?.trim().toLowerCase().replace(/[\s_-]+/g, " ") === "header nex medical";

function resolveSupportPhone(section?: StorefrontChromeSection | null, preferences?: HeaderProps["preferencesData"]) {
	const candidates = [section?.config?.content?.support_phone, preferences?.phone_number, preferences?.application_phone];
	return candidates
		.map((value) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "")
		.find((phone) => /^\+?\d+$/.test(phone.replace(/[\s().-]/g, ""))) ?? "";
}

function HeaderSocialLinks({ links, counts, className }: { links: SocialLinkState[]; counts: ReadonlyMap<string, number>; className: string }) {
	if (links.length === 0) return null;

	return (
		<div role="group" aria-label="Social links" className={className}>
			{links.map((social, index) => {
				const count = counts.get(social.href.split(/[?#]/, 1)[0]) ?? 0;
				const isExternal = /^(?:https?:)?\/\//i.test(social.href);
				return (
					<Link
						key={`${social.icon}-${social.href}-${index}`}
						href={social.href}
						data-storefront-header-link
						target={isExternal ? "_blank" : undefined}
						rel={isExternal ? "noopener noreferrer" : undefined}
						className={quickActionClass}
						aria-label={count > 0 ? `${social.label} (${count})` : social.label}
						title={social.label}
					>
						<SocialIcon social={social} />
						<CountBadge count={count} />
					</Link>
				);
			})}
		</div>
	);
}

function SupportContact({ phone, className }: { phone: string; className: string }) {
	if (!phone) return null;
	const number = phone.replace(/[\s().-]/g, "");

	return (
		<a href={`tel:${number}`} className={`cursor-pointer ${className}`} aria-label={`Call support at ${phone}`}>
			<Phone size={19} className="shrink-0" aria-hidden="true" />
			<span dir="ltr">{phone}</span>
		</a>
	);
}

const isTrackOrder = (item: HeaderNavItem) => item.href.split(/[?#]/)[0] === "/track-order";
const defaultFlashDeal: HeaderNavItem = { label: "Flash Deal", href: "/flash-deals" };
const isFlashDeal = (item: HeaderNavItem) =>
	["/flash-deals", "/limited-sale"].includes(item.href.split(/[?#]/)[0]) || /^flash deals?$/i.test(item.label.trim());

function FlashDealLink({ item, onClick }: { item: HeaderNavItem; onClick?: () => void }) {
	return (
		<Link href={item.href} data-storefront-header-link onClick={onClick} className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md bg-linear-to-r from-orange-700 to-rose-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:from-orange-800 hover:to-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current lg:self-stretch lg:rounded-none lg:px-5">
			<Zap size={16} aria-hidden="true" className="shrink-0" />
			{item.label}
		</Link>
	);
}

function BottomNav({ navItems, flashDeal, host, demoOnly }: {
	navItems: HeaderNavItem[];
	flashDeal: HeaderNavItem;
	host?: string | null;
	demoOnly?: boolean;
}) {
	const [megaMenuTop, setMegaMenuTop] = useState<number | null>(null);
	const navBarRef = useRef<HTMLDivElement>(null);
	const categoriesButtonRef = useRef<HTMLButtonElement>(null);
	const menuPanelRef = useRef<HTMLDivElement>(null);
	const closeTimer = useRef<number | undefined>(undefined);
	const focusOnOpen = useRef(false);
	const menuId = useId();
	const pathname = usePathname();
	const prefetchCategories = () => prefetchMegaMenuCategories(host, demoOnly);
	const navLinkClass = "flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-primary-foreground/15 focus-visible:outline-2 focus-visible:outline-primary-foreground";

	const closeMenu = useCallback(() => {
		window.clearTimeout(closeTimer.current);
		focusOnOpen.current = false;
		setMegaMenuTop(null);
	}, []);

	function openMenu(focusPanel = false) {
		window.clearTimeout(closeTimer.current);
		if (focusPanel) {
			if (menuPanelRef.current) menuPanelRef.current.focus();
			else focusOnOpen.current = true;
		}
		setMegaMenuTop(navBarRef.current?.getBoundingClientRect().bottom ?? 130);
	}

	function scheduleMenuClose() {
		window.clearTimeout(closeTimer.current);
		closeTimer.current = window.setTimeout(() => {
			const focused = document.activeElement;
			if (focused?.matches(":focus-visible") && menuPanelRef.current?.contains(focused)) return;
			closeMenu();
		}, 150);
	}

	useEffect(() => () => window.clearTimeout(closeTimer.current), []);

	useEffect(() => {
		if (megaMenuTop === null) return;
		if (focusOnOpen.current) {
			focusOnOpen.current = false;
			menuPanelRef.current?.focus();
		}
		const onPointerDown = ({ target }: PointerEvent) => {
			if (target instanceof Node && !categoriesButtonRef.current?.contains(target) && !menuPanelRef.current?.contains(target)) {
				closeMenu();
			}
		};
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			const returnFocus = menuPanelRef.current?.contains(document.activeElement);
			closeMenu();
			if (returnFocus) categoriesButtonRef.current?.focus();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [megaMenuTop, closeMenu]);

	return (
		<div
			ref={navBarRef}
			className="relative hidden border-y border-primary-blue bg-primary-black lg:block"
			onBlur={({ relatedTarget }) => {
				if (relatedTarget && !categoriesButtonRef.current?.contains(relatedTarget) && !menuPanelRef.current?.contains(relatedTarget)) closeMenu();
			}}
		>
			<div className={`${headerContainer} flex min-h-12 items-center gap-4 text-primary-foreground`}>
				<nav aria-label="Store navigation" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
					{navItems.map((item) => item.label === "All categories" && !item.href ? (
						<button
							key={item.label}
							type="button"
							ref={categoriesButtonRef}
							aria-expanded={megaMenuTop !== null}
							aria-controls={megaMenuTop !== null ? menuId : undefined}
							onClick={(event) => openMenu(event.detail === 0)}
							onPointerEnter={(event) => { if (event.pointerType === "mouse") openMenu(); }}
							onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleMenuClose(); }}
							onKeyDown={(event) => {
								if (event.key === "ArrowDown") {
									event.preventDefault();
									openMenu(true);
								}
							}}
							onFocus={prefetchCategories}
							className={navLinkClass}
						>
							{item.label}
							<ChevronDown size={15} aria-hidden="true" />
						</button>
					) : (
						<Link key={`${item.href}-${item.label}`} href={item.href} data-storefront-header-link className={navLinkClass} aria-current={pathname === item.href ? "page" : undefined}>
							{isTrackOrder(item) ? <Package size={16} aria-hidden="true" /> : null}
							{item.label}
						</Link>
					))}
				</nav>
				<FlashDealLink item={flashDeal} />
			</div>
			{megaMenuTop !== null && (
				<div
					id={menuId}
					ref={menuPanelRef}
					role="region"
					aria-label="All categories"
					tabIndex={-1}
					className="absolute inset-x-0 top-full z-40"
					onPointerEnter={() => window.clearTimeout(closeTimer.current)}
					onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleMenuClose(); }}
				>
					<AllCategoriesMegaMenu isOpen onClose={closeMenu} storefrontHost={host} demoOnly={demoOnly} desktopTopOffset={megaMenuTop} presentation="dropdown" />
				</div>
			)}
		</div>
	);
}

function MobileNav({
	brand,
	supportPhone,
	socialLinks,
	socialCounts,
	navItems,
	flashDeal,
	host,
	demoOnly,
}: {
	brand: BrandState;
	supportPhone: string;
	socialLinks: SocialLinkState[];
	socialCounts: ReadonlyMap<string, number>;
	navItems: HeaderNavItem[];
	flashDeal: HeaderNavItem;
	host?: string | null;
	demoOnly?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
	const handleAllCategoriesClick = () => {
		setOpen(false);
		setIsMegaMenuOpen(true);
	};

	const handleAllCategoriesIntent = () => {
		prefetchMegaMenuCategories(host, demoOnly);
	};

	return (
		<div className="flex items-center lg:hidden">
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<Button variant="ghost" size="icon" className={quickActionClass}>
						<Menu size={21} aria-hidden="true" />
						<span className="sr-only">Open menu</span>
					</Button>
				</SheetTrigger>

				<SheetContent side="right" className="w-[70%] overflow-y-auto bg-background p-0 sm:max-w-[70%]">
					<SheetHeader className="border-b border-border px-4 py-4">
						<SheetTitle>
							<BrandLink key={`drawer-${brand.logoUrl || "fallback"}-${brand.name}`} brand={brand} textClassName="truncate text-lg font-bold text-foreground" onClick={() => setOpen(false)} />
						</SheetTitle>
						<SupportContact phone={supportPhone} className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary-blue" />
					</SheetHeader>
					<div className="px-4 pt-4">
						<FlashDealLink item={flashDeal} onClick={() => setOpen(false)} />
					</div>

					{/* Mobile Nav Menu Items */}
					<div className="flex flex-col py-2">
						<p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu</p>
						{navItems.map((item, i) =>
							item.label === "All categories" && !item.href ? (
								<button
									key={item.label}
									type="button"
									aria-expanded={isMegaMenuOpen}
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
									data-storefront-header-link
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

					{socialLinks.length > 0 && (
						<>
							<Separator />
							<HeaderSocialLinks links={socialLinks} counts={socialCounts} className="flex flex-wrap items-center gap-1 px-4 py-3" />
						</>
					)}
				</SheetContent>
			</Sheet>
			{isMegaMenuOpen && <AllCategoriesMegaMenu isOpen={isMegaMenuOpen} onClose={() => setIsMegaMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} />}
		</div>
	);
}

// ─── Main Header ────────────────────────────────────────────────────────────
export default function HeaderNexMedicine({ initialData, preferencesData, section, host, demoOnly }: HeaderProps) {
	const sectionContent = section?.config?.content;
	const resolvedNavigation = resolveNavigation(section, initialData);
	const hasConfiguredSearchPlaceholder = Object.prototype.hasOwnProperty.call(sectionContent || {}, "search_placeholder_text") || Object.prototype.hasOwnProperty.call(sectionContent || {}, "search_placeholder");
	const [brand, setBrand] = useState<BrandState>(() => {
		const initialBrand = initialData?.brand || DEFAULT_BRAND;
		return isPresetBrandName(initialBrand.name)
			? { ...initialBrand, name: resolveBrandName(null, preferencesData, null) }
			: initialBrand;
	});
	const [fetchedSocialLinks, setFetchedSocialLinks] = useState<SocialLinkState[]>([]);
	const socialLinks = Array.isArray(sectionContent?.social_links)
		? buildDynamicSocialLinks(null, section, normalizeHeaderIconHref)
		: initialData ? storeSocialLinks(initialData.socialLinks) : fetchedSocialLinks;
	const [searchPlaceholder, setSearchPlaceholder] = useState(hasConfiguredSearchPlaceholder ? resolveHeaderSearchPlaceholder(section) : (initialData?.searchPlaceholder || "Search any product..."));
	const [navItems, setNavItems] = useState<HeaderNavItem[]>(resolvedNavigation);
	const [hasBuilderHeader, setHasBuilderHeader] = useState<boolean | null>(initialData?.hasBuilderHeader ?? Boolean(section));
	const { count: cartCount } = useCart();
	const { count: wishlistCount } = useWishlist();
	const { count: compareCount } = useCompare();
	const pathname = usePathname();
	const [fetchedSupportPhone, setFetchedSupportPhone] = useState("");
	const supportPhone = resolveSupportPhone(section, preferencesData) || fetchedSupportPhone;

	// Metadata is resolved server-side with the storefront host. Use it immediately
	// as a client fallback so the platform default never remains in the header while
	// the storefront settings request is loading (or when that request is blocked).
	useEffect(() => {
		const documentTitle = typeof document !== "undefined" ? document.title.trim() : "";
		const normalizedTitle = documentTitle.toLowerCase();

		if (!documentTitle || normalizedTitle === "nex commerce" || normalizedTitle === DEFAULT_BRAND.name.toLowerCase()) {
			return;
		}

		const updateBrandTimer = window.setTimeout(() => {
			setBrand((current) => (current.name === DEFAULT_BRAND.name ? { ...current, name: documentTitle } : current));
		}, 0);

		return () => window.clearTimeout(updateBrandTimer);
	}, []);

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

				setFetchedSupportPhone(resolveSupportPhone(headerSection, preferencesData));
				setHasBuilderHeader(Boolean(headerSection));
				setBrand({
					name: resolveBrandName(isPresetBrandName(headerSection?.title) ? null : headerSection, preferencesData, settingsData),
					// A category header should only show a logo explicitly uploaded for
					// this store. Do not fall back to the platform's default logo.
					logoUrl: String(preferencesData?.site_logo ?? "").trim() || null,
				});
				const nextSocialLinks = buildDynamicSocialLinks(preferencesData, headerSection, normalizeHeaderIconHref);
				setFetchedSocialLinks(Array.isArray(headerSection?.config?.content?.social_links) ? nextSocialLinks : storeSocialLinks(nextSocialLinks));
				setSearchPlaceholder(resolveHeaderSearchPlaceholder(headerSection));
				setNavItems(mapHeaderActionsToNavItems(Array.isArray(headerSection?.actions) ? headerSection.actions : []));
			} catch {
			}
		};

		void loadHeaderContext();
	}, [demoOnly, host, initialData]);

	if (pathname === "/" && hasBuilderHeader === false) {
		return null;
	}

	const resolvedItems = navItems.flatMap((item) => {
		if (item.label === "All categories" && !item.href) return [item];
		const href = normalizeStorefrontNavHref(item.href);
		return href ? [{ ...item, href }] : [];
	});
	const flashDeal = resolvedItems.find(isFlashDeal) ?? defaultFlashDeal;
	const navigation = resolvedItems.filter((item) => !isFlashDeal(item));
	const socialCounts = new Map<string, number>([
		["/wishlist", wishlistCount],
		["/user-dashboard/compare", compareCount],
		["/cart", cartCount],
	]);

	return (
		<header className="sticky top-0 z-40 bg-white text-foreground" data-storefront-section="fashion-apparel-header-nex-medicine">
			<div className={`${headerContainer} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 py-2.5 sm:gap-x-4 lg:min-h-20 lg:grid-cols-[minmax(8rem,1fr)_minmax(0,36rem)_minmax(max-content,1fr)_auto] lg:gap-x-5 lg:py-0`}>
				<div className="col-start-1 row-start-1 min-w-0">
					<BrandLink brand={brand} textClassName="truncate text-lg font-bold text-foreground lg:text-xl" />
				</div>
				<div className="col-span-2 col-start-1 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
					<SearchAutocomplete placeholder={searchPlaceholder} host={host} demoOnly={demoOnly} />
				</div>
				<div className="col-start-3 row-start-1 hidden min-w-0 justify-center lg:flex">
					<SupportContact phone={supportPhone} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-2 text-base font-semibold tabular-nums text-foreground hover:text-primary-blue focus-visible:outline-2 focus-visible:outline-primary-blue" />
				</div>
				<div className="col-start-2 row-start-1 justify-self-end lg:col-start-4">
					<HeaderSocialLinks links={socialLinks} counts={socialCounts} className="hidden w-max max-w-60 flex-wrap items-center gap-x-4 gap-y-1 border-l border-border pl-4 lg:flex" />
					<MobileNav brand={brand} supportPhone={supportPhone} socialLinks={socialLinks} socialCounts={socialCounts} navItems={navigation} flashDeal={flashDeal} host={host} demoOnly={demoOnly} />
				</div>
			</div>
			<BottomNav navItems={navigation} flashDeal={flashDeal} host={host} demoOnly={demoOnly} />
		</header>
	);
}

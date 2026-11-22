"use client";

import Image from "next/image";
import Link from "next/link";
import { Handbag, Menu, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { AllCategoriesMegaMenu } from "@/components/common/AllCategoriesMegaMenu";
import StorefrontCurrencySelector from "@/components/common/StorefrontCurrencySelector";
import { apiFetch } from "@/lib/api-client";
import { useAmount } from "@/lib/amount";
import { useCart } from "@/lib/cart";
import type { HeaderInitialData } from "@/lib/header-context";
import type { FashionSectionProps } from "../../types";

const actionIcons = { menu: Menu, search: Search, bag: Handbag } as const;

type ActionIcon = keyof typeof actionIcons;

type NavbarAction = {
	id: string;
	icon: ActionIcon;
	label: string;
	url: string;
};

type NavbarLogo = {
	src: string;
	alt: string;
	link: string;
};

type NavbarProps = {
	host?: string | null;
	demoOnly?: boolean;
	logo: NavbarLogo;
	actions: NavbarAction[];
	brandName: string;
	searchOpen: boolean;
	searchPlaceholder: string;
	onMenuOpen: () => void;
	onSearchToggle: () => void;
	onSearchClose: () => void;
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

const defaultActions: NavbarAction[] = [
	{ id: "menu", icon: "menu", label: "Open menu", url: "" },
	{ id: "search", icon: "search", label: "Search", url: "/products" },
	{ id: "bag", icon: "bag", label: "Shopping bag", url: "/cart" },
];

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const normalizeAction = (value: unknown, index: number): NavbarAction | null => {
	const action = asRecord(value);
	const icon = String(action.icon || "").trim().toLowerCase() as ActionIcon;
	if (!actionIcons[icon]) return null;

	return {
		id: String(action.id || `${icon}-${index + 1}`).trim(),
		icon,
		label: String(action.label || icon).trim(),
		url: String(action.url || "").trim(),
	};
};

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

function ProductSearch({ placeholder, onClose, host, demoOnly }: { placeholder: string; onClose: () => void; host?: string | null; demoOnly?: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	const { formatAmount } = useAmount();
	const wrapperRef = useRef<HTMLFormElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [suggestionsOpen, setSuggestionsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		setSuggestionsOpen(false);
		setActiveIndex(-1);
	}, [pathname]);

	useEffect(() => {
		const handleOutsideClick = (event: MouseEvent) => {
			if (!wrapperRef.current?.contains(event.target as Node)) {
				setSuggestionsOpen(false);
				setActiveIndex(-1);
			}
		};

		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, []);

	useEffect(() => {
		const trimmedQuery = query.trim();
		if (trimmedQuery.length < 2) {
			setSuggestions([]);
			setSuggestionsOpen(false);
			setLoading(false);
			setActiveIndex(-1);
			return;
		}

		const controller = new AbortController();
		setSuggestions([]);
		setActiveIndex(-1);
		setLoading(true);
		setSuggestionsOpen(true);
		const timeoutId = window.setTimeout(async () => {
			try {
				setLoading(true);
				const params = new URLSearchParams({ q: trimmedQuery, limit: "8" });
				if (demoOnly) params.set("is_demo", "1");
				const response = await apiFetch(`/landing/products/search?${params.toString()}`, {
					signal: controller.signal,
				}, host);
				const result = response.ok ? await response.json() : null;
				if (controller.signal.aborted) return;
				const items = Array.isArray(result?.data) ? result.data as SearchSuggestion[] : [];

				setSuggestions(items);
				setSuggestionsOpen(true);
				setActiveIndex(items.length > 0 ? 0 : -1);
			} catch (error) {
				if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
					setSuggestions([]);
					setSuggestionsOpen(true);
					setActiveIndex(-1);
				}
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		}, 250);

		return () => {
			controller.abort();
			window.clearTimeout(timeoutId);
		};
	}, [query, host, demoOnly]);

	const goToSuggestion = (suggestion: SearchSuggestion) => {
		setSuggestionsOpen(false);
		onClose();
		router.push(suggestion.url);
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const selectedSuggestion = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
		if (selectedSuggestion) goToSuggestion(selectedSuggestion);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
			return;
		}

		if (!suggestionsOpen || suggestions.length === 0) return;
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
	};

	const showEmptyState = !loading && query.trim().length >= 2 && suggestions.length === 0;

	return (
		<form ref={wrapperRef} onSubmit={handleSubmit} className="relative w-full">
			<Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#1b1b1b]/55" aria-hidden="true" />
			<input
				ref={inputRef}
				type="search"
				value={query}
				onChange={(event) => {
					setQuery(event.target.value);
					setSuggestions([]);
					setActiveIndex(-1);
				}}
				onFocus={() => query.trim().length >= 2 && setSuggestionsOpen(true)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className="h-14 w-full rounded-full border border-[#c8c5b4] bg-white/90 pl-12 pr-14 text-base text-[#1b1b1b] outline-none transition focus:border-[#1b1b1b] focus:ring-4 focus:ring-black/5"
			/>
			<button type="button" onClick={onClose} className="absolute right-4 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#1b1b1b] transition hover:bg-black/5" aria-label="Close search">
				<X className="size-5" aria-hidden="true" />
			</button>

			{suggestionsOpen ? (
				<div className="absolute left-0 right-0 top-full z-50 mt-3 max-h-[min(480px,70vh)] overflow-y-auto rounded-2xl border border-[#d8d5c5] bg-white shadow-[0_20px_60px_rgba(27,27,27,0.16)]">
					{loading ? <div className="px-5 py-4 text-sm text-[#1b1b1b]/60">Searching products...</div> : null}
					{showEmptyState ? <div className="px-5 py-4 text-sm text-[#1b1b1b]/60">No matching products found.</div> : null}
					{!loading && suggestions.length > 0 ? (
						<div className="py-2">
							{suggestions.map((suggestion, index) => (
								<button
									key={suggestion.id}
									type="button"
									onMouseEnter={() => setActiveIndex(index)}
									onClick={() => goToSuggestion(suggestion)}
									className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${index === activeIndex ? "bg-[#eeecdc]" : "bg-white hover:bg-[#eeecdc]/65"}`}
								>
									<div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#d8d5c5] bg-[#eeecdc]/40">
										<SuggestionThumbnail src={suggestion.thumbnail} alt={suggestion.name} />
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-semibold text-[#1b1b1b]">{suggestion.name}</div>
										<div className="truncate text-xs text-[#1b1b1b]/55">
											{suggestion.category || "Product"}{suggestion.code ? ` • ${suggestion.code}` : ""}
										</div>
									</div>
									<div className="shrink-0 text-sm font-semibold text-[#1b1b1b]">{suggestion.price > 0 ? formatAmount(suggestion.price) : ""}</div>
								</button>
							))}
						</div>
					) : null}
				</div>
			) : null}
		</form>
	);
}

function Navbar({ logo, actions, brandName, searchOpen, searchPlaceholder, onMenuOpen, onSearchToggle, onSearchClose, host, demoOnly }: NavbarProps) {
	const { count: cartCount } = useCart();
	const menuAction = actions.find((action) => action.icon === "menu") || defaultActions[0];
	const utilityActions = actions.filter((action) => action.id !== menuAction.id);
	const MenuIcon = actionIcons[menuAction.icon];

	return (
		<nav
			className="relative h-[120px] shrink-0 border-b border-[#d8d5c5] bg-[#eeecdc]"
			aria-label="Main navigation"
			data-storefront-section="fashion-apparel-header-overlay"
		>
			<div className="relative mx-auto flex h-full w-full max-w-[1720px] items-center justify-between px-6 min-[1770px]:px-0">
				<button
					className="flex size-9 cursor-pointer items-center justify-center text-[#1b1b1b] transition-opacity hover:opacity-60"
					type="button"
					aria-label={menuAction.label}
					onClick={onMenuOpen}
				>
					<MenuIcon aria-hidden="true" size={36} strokeWidth={1.8} />
				</button>

				<Link
					className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
					href={logo.link || "/"}
					aria-label={`${brandName} home`}
				>
					{logo.src ? (
						<Image
							src={logo.src}
							alt={logo.alt || brandName}
							width={76}
							height={65}
							className="h-[65px] w-[76px] object-contain"
							priority
						/>
					) : (
						<span className="text-xl font-semibold tracking-[0.12em] text-[#1b1b1b]">{brandName}</span>
					)}
				</Link>

				<div className="flex items-center gap-4 text-[#1b1b1b] sm:gap-9">
					<StorefrontCurrencySelector />
					{utilityActions.map((action) => {
						const Icon = actionIcons[action.icon];
						const className = "relative flex size-9 items-center justify-center transition-opacity hover:opacity-60";
						if (action.icon === "search") {
							return (
								<button key={action.id} className={className} type="button" aria-label={action.label} onClick={onSearchToggle} aria-expanded={searchOpen}>
									<Icon aria-hidden="true" size={36} strokeWidth={1.8} />
								</button>
							);
						}

						if (action.icon === "bag") {
							return (
								<Link key={action.id} className={className} href={action.url || "/cart"} aria-label={`${action.label} (${cartCount} items)`}>
									<Icon aria-hidden="true" size={36} strokeWidth={1.8} />
									{cartCount > 0 ? <span aria-live="polite" className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1b1b1b] px-1 text-xs font-semibold text-white">{cartCount > 99 ? "99+" : cartCount}</span> : null}
								</Link>
							);
						}

						return action.url ? (
							<Link key={action.id} className={className} href={action.url} aria-label={action.label}>
								<Icon aria-hidden="true" size={36} strokeWidth={1.8} />
							</Link>
						) : (
							<button key={action.id} className={className} type="button" aria-label={action.label}>
								<Icon aria-hidden="true" size={36} strokeWidth={1.8} />
							</button>
						);
					})}
				</div>

				<div
					className={`absolute inset-x-5 top-1/2 z-20 origin-right -translate-y-1/2 transition-all duration-300 ease-out sm:left-24 sm:right-6 ${
						searchOpen
							? "visible translate-x-0 scale-x-100 opacity-100"
							: "invisible translate-x-8 scale-x-75 opacity-0 pointer-events-none"
					}`}
				>
					{searchOpen ? <ProductSearch placeholder={searchPlaceholder} onClose={onSearchClose} host={host} demoOnly={demoOnly} /> : null}
				</div>
			</div>
		</nav>
	);
}

type HeaderOverlayProps = FashionSectionProps & {
	initialData?: HeaderInitialData;
};

export default function HeaderOverlay({ section, initialData, host, demoOnly }: HeaderOverlayProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const config = asRecord(section.config);
	const content = asRecord(config.content);
	const configuredLogo = asRecord(content.logo);
	const configuredActions = Array.isArray(content.actions)
		? content.actions.map(normalizeAction).filter((action): action is NavbarAction => action !== null)
		: [];
	const actions = configuredActions.length > 0 ? configuredActions : defaultActions;
	const logo: NavbarLogo = {
		src: String(configuredLogo.url || initialData?.brand.logoUrl || "").trim(),
		alt: String(configuredLogo.alt || initialData?.brand.name || "Store logo").trim(),
		link: String(content.logo_link || "/").trim() || "/",
	};

	return (
		<header className="relative z-40">
			<Navbar
				host={host}
				demoOnly={demoOnly}
				logo={logo}
				actions={actions}
				brandName={initialData?.brand.name || "Store"}
				searchOpen={searchOpen}
				searchPlaceholder={String(content.search_placeholder_text || initialData?.searchPlaceholder || "Search any product...")}
				onMenuOpen={() => {
					setSearchOpen(false);
					setMenuOpen((isOpen) => !isOpen);
				}}
				onSearchToggle={() => {
					setMenuOpen(false);
					setSearchOpen((current) => !current);
				}}
				onSearchClose={() => setSearchOpen(false)}
			/>
			{menuOpen ? <AllCategoriesMegaMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} storefrontHost={host} demoOnly={demoOnly} desktopTopOffset={120} /> : null}
		</header>
	);
}

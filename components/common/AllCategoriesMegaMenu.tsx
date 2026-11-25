"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { resolveApiAssetUrl } from "@/lib/config";

type MegaMenuProduct = {
id: string;
name: string;
image: string;
link: string;
};

type MegaMenuCategory = {
id: string;
label: string;
icon: string;
products: MegaMenuProduct[];
};

interface AllCategoriesMegaMenuProps {
isOpen: boolean;
onClose: () => void;
storefrontHost?: string | null;
demoOnly?: boolean;
desktopTopOffset?: number;
presentation?: "overlay" | "dropdown";
}

const megaMenuCache = new Map<string, MegaMenuCategory[]>();
const megaMenuPromises = new Map<string, Promise<MegaMenuCategory[]>>();
const menuImageFallback = resolveApiAssetUrl();

function resolveMenuImageSrc(src?: string | null) {
    return resolveApiAssetUrl(src);
}

function resolveMegaMenuCacheKey(storefrontHost?: string | null, demoOnly = false) {
	const host = String(storefrontHost || (typeof window === "undefined" ? "server" : window.location.host)).toLowerCase();
	return `${host}:${demoOnly ? "demo" : "live"}`;
}

async function fetchMegaMenuCategories(storefrontHost?: string | null, demoOnly = false) {
	const cacheKey = resolveMegaMenuCacheKey(storefrontHost, demoOnly);
	const cachedCategories = megaMenuCache.get(cacheKey);
	if (cachedCategories) return cachedCategories;
	const pendingRequest = megaMenuPromises.get(cacheKey);
	if (pendingRequest) return pendingRequest;

	const request = (async () => {
		try {
			const response = await apiFetch(`/landing/categories/mega-menu${demoOnly ? "?is_demo=1" : ""}`, { cache: "no-store" }, storefrontHost);
			const result = response.ok ? ((await response.json().catch(() => null)) as { data?: unknown; categories?: unknown } | null) : null;
			const items = Array.isArray(result?.data)
				? result.data
				: Array.isArray((result?.data as { categories?: unknown } | undefined)?.categories)
					? ((result?.data as { categories: MegaMenuCategory[] }).categories)
					: Array.isArray(result?.categories)
						? result.categories
						: [];

			megaMenuCache.set(cacheKey, items as MegaMenuCategory[]);
			return items as MegaMenuCategory[];
		} catch {
			return [];
		} finally {
			megaMenuPromises.delete(cacheKey);
		}
	})();

	megaMenuPromises.set(cacheKey, request);
	return request;
}

export function prefetchMegaMenuCategories(storefrontHost?: string | null, demoOnly = false) {
	void fetchMegaMenuCategories(storefrontHost, demoOnly);
}

    function MenuImage({
    src,
    alt,
    width,
    height,
    className,
    fill = false,
    }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    fill?: boolean;
    }) {
    const [imageSrc, setImageSrc] = useState(resolveMenuImageSrc(src));

    return (
    <Image loader={({ src: loaderSrc })=> loaderSrc}
        unoptimized
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        sizes={fill ? "160px" : undefined}
        className={className}
        onError={() => setImageSrc(menuImageFallback)}
        />
        );
        }

        function CategorySkeleton() {
        return (
        <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="animate-pulse h-10 bg-gray-200 rounded" />
            ))}
        </div>
        );
        }

        function ProductSkeleton() {
        return (
        <>
            <div className="animate-pulse h-7 bg-gray-200 rounded w-48 mb-6" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                    <div className="aspect-square rounded-lg bg-gray-200 mb-3" />
                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
                </div>
                ))}
            </div>
        </>
        );
        }

        export function AllCategoriesMegaMenu({
        isOpen,
        onClose,
        storefrontHost,
        demoOnly = false,
        desktopTopOffset = 136,
        presentation = "overlay",
        }: AllCategoriesMegaMenuProps) {
        const isDropdown = presentation === "dropdown";
        const cacheKey = resolveMegaMenuCacheKey(storefrontHost, demoOnly);
        const [categories, setCategories] = useState<MegaMenuCategory[]>(
            () => megaMenuCache.get(cacheKey) || []
            );
            const [hoveredCategory, setHoveredCategory] = useState(
            megaMenuCache.get(cacheKey)?.[0]?.id || ""
            );
            const [loading, setLoading] = useState(() => !megaMenuCache.get(cacheKey));

            useEffect(() => {
            let mounted = true;

            fetchMegaMenuCategories(storefrontHost, demoOnly).then((items) => {
            if (!mounted) return;

            setCategories(items);
            setHoveredCategory(items[0]?.id || "");
            setLoading(false);
            });

            return () => {
            mounted = false;
            };
            }, [demoOnly, storefrontHost]);

            useEffect(() => {
            if (!isOpen || isDropdown) return;

            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";

            return () => {
            document.body.style.overflow = originalOverflow;
            };
            }, [isOpen, isDropdown]);

            const currentCategory = useMemo(() => {
            return categories.find((category) => category.id === hoveredCategory);
            }, [categories, hoveredCategory]);

            if (!isOpen) return null;

            const showSkeleton = loading;

            return (
            <div
                className={isDropdown ? "relative" : "fixed inset-0 z-40"}
                style={{
                    "--mega-menu-desktop-top": `${desktopTopOffset}px`,
                    "--mega-menu-desktop-max-height": `calc(100vh - ${desktopTopOffset}px)`,
                } as CSSProperties}
                onClick={isDropdown ? undefined : onClose}
            >
            <div
                className={`${isDropdown ? "" : "absolute top-16 left-0 right-0 md:top-[var(--mega-menu-desktop-top)]"} bg-white border-b border-gray-200 shadow-lg max-md:h-[calc(100vh-64px)] max-md:overflow-y-auto md:h-[460px] md:max-h-[var(--mega-menu-desktop-max-height)] md:overflow-hidden`}
                onClick={isDropdown ? undefined : (event) => event.stopPropagation()}
            >
                <div className="section h-full pb-24 md:pb-0">
                    <div className="grid grid-cols-1 md:h-full md:grid-cols-4">
                        <div
                            className="hidden border border-gray-200 pt-4 md:col-span-1 md:block md:min-h-0 md:h-full md:overflow-y-auto">
                            {showSkeleton ? (
                            <CategorySkeleton />
                            ) : (
                            <nav className="divide-y">
                                {categories.map((category) => (
                                <button key={category.id} onMouseEnter={()=> setHoveredCategory(category.id)}
                                    onClick={() => setHoveredCategory(category.id)}
                                    className={`w-full text-left px-4 py-3.5 transition-all duration-200 flex
                                    items-center gap-3 cursor-pointer ${
                                    hoveredCategory === category.id
                                    ? "bg-[var(--storefront-primary-soft)] font-semibold"
                                    : ""
                                    }`}
                                    >
                                    <MenuImage key={`${category.id}-${category.icon}`} src={category.icon} alt={category.label} width={20} height={20}
                                        className="h-5 w-5 object-cover rounded-sm" />

                                    <span className="text-sm">{category.label}</span>
                                </button>
                                ))}
                            </nav>
                            )}
                        </div>

                        <div className="py-6 px-4 md:col-span-3 md:h-full md:overflow-y-auto">
                            {showSkeleton ? (
                            <ProductSkeleton />
                            ) : currentCategory ? (
                            <>
                                <h3 className="text-xl font-semibold mb-6">
                                    {currentCategory.label}
                                </h3>

                                {currentCategory.products?.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {currentCategory.products.map((product) => (
                                    <Link key={product.id} href={product.link} onClick={onClose}
                                        className="group cursor-pointer">
                                    <div
                                        className="rounded-xl overflow-hidden mb-3 relative aspect-square bg-gray-50 border border-gray-100">
                                        <MenuImage key={`${product.id}-${product.image}`} src={product.image} alt={product.name} fill
                                            className="object-contain p-6 group-hover:scale-105 transition-transform duration-300" />
                                    </div>

                                    <p
                                        className="text-sm text-gray-900 text-center group-hover:text-primary-blue transition-colors">
                                        {product.name}
                                    </p>
                                    </Link>
                                    ))}
                                </div>
                                ) : (
                                <div className="flex items-center justify-center min-h-[400px]">
                                    <div className="text-center max-w-md">
                                        <div
                                            className="mx-auto w-24 h-24 rounded-full bg-[var(--storefront-primary-soft)] flex items-center justify-center mb-6">
                                            <svg className="w-12 h-12 text-primary-blue" fill="none"
                                                stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                    d="M20 13V7a2 2 0 00-2-2h-3V4a2 2 0 00-2-2h-2a2 2 0 00-2 2v1H6a2 2 0 00-2 2v6m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" />
                                            </svg>
                                        </div>

                                        <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                            No Products Available
                                        </h3>

                                        <p className="text-gray-500 leading-relaxed">
                                            There are currently no products available in this category.
                                            Please browse other categories or check back later.
                                        </p>

                                        <div
                                            className="mt-6 inline-flex items-center px-4 py-2 rounded-full bg-[var(--storefront-primary-soft)] text-primary-blue text-sm font-medium">
                                            Explore Other Categories
                                        </div>
                                    </div>
                                </div>
                                )}
                            </>
                            ) : (
                            <ProductSkeleton />
                            )}

                            {!showSkeleton && (
                            <div className="md:hidden mb-6 -mx-4 px-4 border-b border-gray-200">
                                <div className="flex gap-2 overflow-x-auto py-6">
                                    {categories.map((category) => (
                                    <button key={category.id} onClick={()=> setHoveredCategory(category.id)}
                                        className={`cursor-pointer px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium
                                        transition-colors ${
                                        hoveredCategory === category.id
                                        ? "bg-[var(--storefront-primary-soft)] text-primary-blue"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                        >
                                        {category.label}
                                    </button>
                                    ))}
                                </div>
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            </div>
            );
            }

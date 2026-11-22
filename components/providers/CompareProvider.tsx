"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "arcade:compare-items";
const MAX_COMPARE_ITEMS = 4;

export type CompareItem = {
	product_id: string;
	slug: string;
	name: string;
	thumbnail: string;
	price: number;
	brand: {
		name: string;
	} | null;
	category: {
		name: string;
		slug?: string;
	} | null;
	available_quantity: number;
	stock_label: string | null;
	url: string;
	code?: string | null;
	unit?: string | null;
	vat?: number | null;
	description?: string | null;
	variants_display?: string[];
	added_at: string;
};

type CompareTarget = {
	product_id: string;
	slug?: string | null;
	name: string;
	thumbnail?: string | null;
	price?: number | null;
	brand?: {
		name: string;
	} | null;
	category?: {
		name: string;
		slug?: string;
	} | null;
	available_quantity?: number | null;
	stock_label?: string | null;
	url?: string | null;
	code?: string | null;
	unit?: string | null;
	vat?: number | null;
	description?: string | null;
	variants_display?: string[] | null;
};

type CompareContextValue = {
	items: CompareItem[];
	count: number;
	isLoading: boolean;
	maxItems: number;
	isCompared: (target: string) => boolean;
	addItem: (item: CompareTarget) => { success: boolean; reason?: "limit" | "invalid" };
	removeItem: (productId: string) => void;
	toggleItem: (item: CompareTarget) => { added: boolean; success: boolean; reason?: "limit" | "invalid" };
	clearItems: () => void;
};

const CompareContext = createContext<CompareContextValue | undefined>(undefined);

function normalizeItem(item: CompareTarget): CompareItem | null {
	if (!item.product_id || !item.name) {
		return null;
	}

	const slug = String(item.slug || "");
	const url = item.url || (slug ? `/product/${slug}` : `/products/${item.product_id}`);

	return {
		product_id: String(item.product_id),
		slug,
		name: String(item.name),
		thumbnail: String(item.thumbnail || "/images/placeholder.jpg"),
		price: Number(item.price || 0),
		brand: item.brand?.name ? { name: String(item.brand.name) } : null,
		category: item.category?.name
			? {
					name: String(item.category.name),
					slug: item.category.slug ? String(item.category.slug) : undefined,
				}
			: null,
		available_quantity: Number(item.available_quantity || 0),
		stock_label: item.stock_label ? String(item.stock_label) : null,
		url: String(url),
		code: item.code ? String(item.code) : null,
		unit: item.unit ? String(item.unit) : null,
		vat: typeof item.vat === "number" ? item.vat : null,
		description: item.description ? String(item.description) : null,
		variants_display: Array.isArray(item.variants_display) ? item.variants_display.map(String) : [],
		added_at: new Date().toISOString(),
	};
}

export function CompareProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<CompareItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		try {
			const saved = window.localStorage.getItem(STORAGE_KEY);
			const parsed = saved ? (JSON.parse(saved) as CompareItem[]) : [];
			setItems(Array.isArray(parsed) ? parsed : []);
		} catch {
			setItems([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isLoading) {
			return;
		}

		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	}, [isLoading, items]);

	const isCompared = useCallback(
		(target: string) => items.some((item) => item.product_id === target || item.slug === target),
		[items],
	);

	const addItem = useCallback(
		(target: CompareTarget) => {
			const normalized = normalizeItem(target);

			if (!normalized) {
				return { success: false as const, reason: "invalid" as const };
			}

			if (items.some((item) => item.product_id === normalized.product_id)) {
				return { success: true as const };
			}

			if (items.length >= MAX_COMPARE_ITEMS) {
				return { success: false as const, reason: "limit" as const };
			}

			setItems((current) => [normalized, ...current]);
			return { success: true as const };
		},
		[items],
	);

	const removeItem = useCallback((productId: string) => {
		setItems((current) => current.filter((item) => item.product_id !== productId));
	}, []);

	const toggleItem = useCallback(
		(target: CompareTarget) => {
			const existing = items.find((item) => item.product_id === target.product_id || item.slug === target.slug);

			if (existing) {
				removeItem(existing.product_id);
				return { added: false as const, success: true as const };
			}

			const result = addItem(target);
			return { added: true as const, ...result };
		},
		[addItem, items, removeItem],
	);

	const clearItems = useCallback(() => {
		setItems([]);
	}, []);

	const value = useMemo<CompareContextValue>(
		() => ({
			items,
			count: items.length,
			isLoading,
			maxItems: MAX_COMPARE_ITEMS,
			isCompared,
			addItem,
			removeItem,
			toggleItem,
			clearItems,
		}),
		[addItem, clearItems, isCompared, isLoading, items, removeItem, toggleItem],
	);

	return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
	const context = useContext(CompareContext);

	if (!context) {
		throw new Error("useCompare must be used within a CompareProvider");
	}

	return context;
}

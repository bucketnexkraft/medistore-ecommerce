"use client";

import { apiFetch } from "@/lib/api-client";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type WishlistItem = {
	id: string;
	product_id: string;
	slug: string;
	name: string;
	thumbnail: string;
	price: number;
	available_quantity: number;
	brand: {
		name: string;
	} | null;
	category: {
		name: string;
		slug: string;
	} | null;
	stock_display: {
		stock_visibility: boolean;
		stock_visibility_label: string | null;
		stock_quantity: number | null;
		stock_display: string | null;
	};
	url: string;
	added_at: string | null;
};

type WishlistContextValue = {
	items: WishlistItem[];
	count: number;
	isLoading: boolean;
	isMutating: (target: string) => boolean;
	isWishlisted: (target: string) => boolean;
	refresh: () => Promise<void>;
	addItem: (target: { productId?: string | null; productSlug?: string | null }) => Promise<boolean>;
	removeItem: (productId: string) => Promise<boolean>;
	toggleItem: (target: { productId?: string | null; productSlug?: string | null }) => Promise<boolean>;
	clearLocalState: () => void;
};

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
	const { token, isAuthenticated, isLoading: isAuthLoading, clearAuthSession } = useAuth();
	const [items, setItems] = useState<WishlistItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [pendingIds, setPendingIds] = useState<string[]>([]);

	const resolveTargetKey = useCallback((target: { productId?: string | null; productSlug?: string | null }) => {
		return String(target.productId || target.productSlug || "");
	}, []);

	const clearLocalState = useCallback(() => {
		setItems([]);
		setPendingIds([]);
		setIsLoading(false);
	}, []);

	const refresh = useCallback(async () => {
		if (!token || !isAuthenticated) {
			clearLocalState();
			return;
		}

		setIsLoading(true);

		try {
			const response = await apiFetch("/wishlists", {
				headers: getAuthHeaders(token),
				cache: "no-store",
			});
			const result = await response.json().catch(() => null);
			if (response.status === 401) {
				clearAuthSession(token);
			}
			setItems(Array.isArray(result?.data) ? result.data : []);
		} catch {
			setItems([]);
		} finally {
			setIsLoading(false);
		}
	}, [clearAuthSession, clearLocalState, isAuthenticated, token]);

	useEffect(() => {
		if (isAuthLoading) {
			setIsLoading(true);
			return;
		}

		void refresh();
	}, [isAuthLoading, refresh]);

	const runWithPending = useCallback(async <T,>(targetKey: string, action: () => Promise<T>) => {
		setPendingIds((current) => (current.includes(targetKey) ? current : [...current, targetKey]));

		try {
			return await action();
		} finally {
			setPendingIds((current) => current.filter((id) => id !== targetKey));
		}
	}, []);

	const addItem = useCallback(
		async (target: { productId?: string | null; productSlug?: string | null }) => {
			if (!token || !isAuthenticated) {
				return false;
			}

			const targetKey = resolveTargetKey(target);
			if (!targetKey) {
				return false;
			}

			return runWithPending(targetKey, async () => {
				try {
					const response = await apiFetch("/wishlists", {
						method: "POST",
						headers: getAuthHeaders(token),
						body: JSON.stringify({
							product_id: target.productId || undefined,
							product_slug: target.productSlug || undefined,
						}),
					});
					const result = response.ok ? await response.json() : null;

					if (!response.ok || !result?.data) {
						return false;
					}

					setItems((current) => {
						const filtered = current.filter((item) => item.product_id !== result.data.product_id);
						return [result.data as WishlistItem, ...filtered];
					});

					return true;
				} catch {
					return false;
				}
			});
		},
		[isAuthenticated, resolveTargetKey, runWithPending, token],
	);

	const removeItem = useCallback(
		async (productId: string) => {
			if (!token || !isAuthenticated) {
				return false;
			}

			return runWithPending(productId, async () => {
				try {
					const response = await apiFetch(`/wishlists/${encodeURIComponent(productId)}`, {
						method: "DELETE",
						headers: getAuthHeaders(token),
					});

					if (!response.ok) {
						return false;
					}

					setItems((current) => current.filter((item) => item.product_id !== productId));
					return true;
				} catch {
					return false;
				}
			});
		},
		[isAuthenticated, runWithPending, token],
	);

	const isWishlisted = useCallback(
		(target: string) => items.some((item) => item.product_id === target || item.slug === target),
		[items],
	);

	const toggleItem = useCallback(
		async (target: { productId?: string | null; productSlug?: string | null }) => {
			const productId = target.productId ? String(target.productId) : null;
			const productSlug = target.productSlug ? String(target.productSlug) : null;
			const existingItem = items.find((item) => item.product_id === productId || item.slug === productSlug);

			if (existingItem) {
				return removeItem(existingItem.product_id);
			}

			return addItem(target);
		},
		[addItem, items, removeItem],
	);

	const value = useMemo<WishlistContextValue>(
		() => ({
			items,
			count: items.length,
			isLoading,
			isMutating: (target: string) => pendingIds.includes(target),
			isWishlisted,
			refresh,
			addItem,
			removeItem,
			toggleItem,
			clearLocalState,
		}),
		[addItem, clearLocalState, isLoading, isWishlisted, items, pendingIds, refresh, removeItem, toggleItem],
	);

	return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
	const context = useContext(WishlistContext);

	if (!context) {
		throw new Error("useWishlist must be used within a WishlistProvider");
	}

	return context;
}

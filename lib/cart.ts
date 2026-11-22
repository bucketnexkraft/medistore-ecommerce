"use client";

import { useEffect, useMemo, useState } from "react";
import { trackStorefrontEvent } from "@/lib/analytics";

export const CART_STORAGE_KEY = "arcade-cart";
export const CART_UPDATED_EVENT = "arcade-cart-updated";

export type CartItem = {
	id: string;
	slug: string;
	name: string;
	price: number;
	taxRate?: number | null;
	image: string;
	quantity: number;
	maxQuantity: number | null;
	brand: string | null;
	variantLabel?: string | null;
	variantSelection?: Record<string, string> | null;
	category: {
		name: string;
		slug: string;
	} | null;
};

function isBrowser() {
	return typeof window !== "undefined";
}

function normalizeQuantity(quantity: number, maxQuantity: number | null) {
	const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;

	if (typeof maxQuantity === "number" && maxQuantity > 0) {
		return Math.min(safeQuantity, maxQuantity);
	}

	return safeQuantity;
}

function serializeVariantSelection(variantSelection?: Record<string, string> | null) {
	if (!variantSelection || typeof variantSelection !== "object") {
		return "";
	}

	return Object.entries(variantSelection)
		.filter(([key, value]) => key.trim() !== "" && value.trim() !== "")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${key}:${value}`)
		.join("|");
}

function isSameCartEntry(left: CartItem, right: CartItem) {
	return left.id === right.id && serializeVariantSelection(left.variantSelection) === serializeVariantSelection(right.variantSelection);
}

export function getCartItems(): CartItem[] {
	if (!isBrowser()) {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(CART_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];

		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveCartItems(items: CartItem[]) {
	if (!isBrowser()) {
		return;
	}

	window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
	window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function addCartItem(item: CartItem) {
	const currentItems = getCartItems();
	const existingIndex = currentItems.findIndex((cartItem) => isSameCartEntry(cartItem, item));

	if (existingIndex >= 0) {
		const existingItem = currentItems[existingIndex];
		currentItems[existingIndex] = {
			...existingItem,
			quantity: normalizeQuantity(existingItem.quantity + item.quantity, existingItem.maxQuantity ?? item.maxQuantity),
		};
	} else {
		currentItems.push({
			...item,
			quantity: normalizeQuantity(item.quantity, item.maxQuantity),
		});
	}

	saveCartItems(currentItems);
	trackStorefrontEvent("add_to_cart", {
		productId: item.id,
		productName: item.name,
		value: item.price * item.quantity,
		metadata: { quantity: item.quantity, category: item.category?.name, brand: item.brand },
	});
	return currentItems;
}

export function updateCartItemQuantity(id: string, quantity: number, variantSelection?: Record<string, string> | null) {
	const nextItems = getCartItems()
		.map((item) =>
			item.id === id && serializeVariantSelection(item.variantSelection) === serializeVariantSelection(variantSelection)
				? { ...item, quantity: normalizeQuantity(quantity, item.maxQuantity) }
				: item,
		)
		.filter((item) => item.quantity > 0);

	saveCartItems(nextItems);
	return nextItems;
}

export function removeCartItem(id: string, variantSelection?: Record<string, string> | null) {
	const targetVariantSelection = serializeVariantSelection(variantSelection);
	const removedItem = getCartItems().find(
		(item) => item.id === id && serializeVariantSelection(item.variantSelection) === targetVariantSelection,
	);
	const nextItems = getCartItems().filter(
		(item) => !(item.id === id && serializeVariantSelection(item.variantSelection) === targetVariantSelection),
	);
	saveCartItems(nextItems);
	if (removedItem) {
		trackStorefrontEvent("remove_from_cart", {
			productId: removedItem.id,
			productName: removedItem.name,
			value: removedItem.price * removedItem.quantity,
			metadata: { quantity: removedItem.quantity },
		});
	}
	return nextItems;
}

export function clearCart() {
	saveCartItems([]);
}

export function useCart() {
	const [items, setItems] = useState<CartItem[]>(() => getCartItems());

	useEffect(() => {
		const syncCart = () => {
			setItems(getCartItems());
		};

		syncCart();
		window.addEventListener(CART_UPDATED_EVENT, syncCart);
		window.addEventListener("storage", syncCart);

		return () => {
			window.removeEventListener(CART_UPDATED_EVENT, syncCart);
			window.removeEventListener("storage", syncCart);
		};
	}, []);

	const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
	const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

	return {
		items,
		count,
		subtotal,
		addItem: addCartItem,
		updateItemQuantity: updateCartItemQuantity,
		removeItem: removeCartItem,
		clear: clearCart,
	};
}

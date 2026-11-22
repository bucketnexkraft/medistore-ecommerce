"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCartItems } from "@/lib/cart";
import { trackStorefrontEvent } from "@/lib/analytics";

let lastTrackedLocation = "";

export function StorefrontAnalytics() {
	const pathname = usePathname();

	useEffect(() => {
		const location = `${pathname}${window.location.search}`;
		if (lastTrackedLocation === location) return;
		lastTrackedLocation = location;

		trackStorefrontEvent("page_view");

		if (pathname === "/cart") {
			const items = getCartItems();
			trackStorefrontEvent("view_cart", {
				value: items.reduce((total, item) => total + item.price * item.quantity, 0),
				metadata: { quantity: items.reduce((total, item) => total + item.quantity, 0) },
			});
		}

		if (pathname.startsWith("/checkout")) {
			const items = getCartItems();
			trackStorefrontEvent("begin_checkout", {
				value: items.reduce((total, item) => total + item.price * item.quantity, 0),
				metadata: { quantity: items.reduce((total, item) => total + item.quantity, 0) },
			});
		}

		const searchTerm = new URLSearchParams(window.location.search).get("search");
		if (searchTerm) trackStorefrontEvent("search", { metadata: { search_term: searchTerm } });
	}, [pathname]);

	return null;
}

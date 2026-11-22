"use client";

import { useEffect } from "react";
import { trackStorefrontEvent } from "@/lib/analytics";

export function PurchaseAnalytics({ orderId }: { orderId: string }) {
	useEffect(() => {
		if (!orderId) return;
		trackStorefrontEvent("purchase", { eventId: `purchase-${orderId}`, orderId });
	}, [orderId]);

	return null;
}

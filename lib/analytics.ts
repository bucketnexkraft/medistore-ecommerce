import { apiFetch } from "@/lib/api-client";

const SESSION_KEY = "arcade-analytics-session";
const ATTRIBUTION_KEY = "arcade-analytics-attribution";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
let initialPixelPageViewHandled = false;

export type StorefrontAnalyticsEvent =
	| "page_view"
	| "view_item"
	| "add_to_cart"
	| "remove_from_cart"
	| "view_cart"
	| "begin_checkout"
	| "purchase"
	| "search";

type EventPayload = {
	eventId?: string;
	productId?: string | null;
	productName?: string | null;
	orderId?: string | null;
	value?: number | null;
	currency?: string | null;
	metadata?: Record<string, string | number | null | undefined>;
};

type TrackingWindow = Window & {
	dataLayer?: Array<Record<string, unknown>>;
	fbq?: (...args: unknown[]) => void;
	ttq?: { track?: (event: string, payload?: Record<string, unknown>) => void };
};

function createId(prefix: string) {
	const randomId = typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return `${prefix}-${randomId}`;
}

export function getAnalyticsSessionId() {
	if (typeof window === "undefined") return "server";

	try {
		const stored = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as { id?: string; touchedAt?: number } | null;
		const now = Date.now();
		const id = stored?.id && stored.touchedAt && now - stored.touchedAt < SESSION_TIMEOUT_MS
			? stored.id
			: createId("session");
		window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id, touchedAt: now }));
		return id;
	} catch {
		return createId("session");
	}
}

function getAttribution() {
	if (typeof window === "undefined") return { source: "(direct)", medium: "(none)", campaign: null };

	try {
		const existing = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY) || "null");
		if (existing?.source) return existing;

		const params = new URLSearchParams(window.location.search);
		let source = params.get("utm_source");
		let medium = params.get("utm_medium");
		const campaign = params.get("utm_campaign");

		if (!source && document.referrer) {
			try {
				const referrerHost = new URL(document.referrer).hostname;
				if (referrerHost && referrerHost !== window.location.hostname) {
					source = referrerHost;
					medium = "referral";
				}
			} catch {
				// Ignore malformed referrers and report the visit as direct.
			}
		}

		const attribution = { source: source || "(direct)", medium: medium || "(none)", campaign };
		window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
		return attribution;
	} catch {
		return { source: "(direct)", medium: "(none)", campaign: null };
	}
}

function sendToMarketingPlatforms(eventName: StorefrontAnalyticsEvent, payload: EventPayload) {
	const trackingWindow = window as TrackingWindow;
	const marketingPayload = {
		content_ids: payload.productId ? [payload.productId] : undefined,
		content_name: payload.productName || undefined,
		value: payload.value ?? undefined,
		currency: payload.currency || undefined,
	};

	trackingWindow.dataLayer = trackingWindow.dataLayer || [];
	trackingWindow.dataLayer.push({ event: eventName, ecommerce: marketingPayload });

	const metaEvents: Partial<Record<StorefrontAnalyticsEvent, string>> = {
		page_view: "PageView",
		view_item: "ViewContent",
		add_to_cart: "AddToCart",
		begin_checkout: "InitiateCheckout",
		purchase: "Purchase",
	};
	const tiktokEvents: Partial<Record<StorefrontAnalyticsEvent, string>> = {
		view_item: "ViewContent",
		add_to_cart: "AddToCart",
		begin_checkout: "InitiateCheckout",
		purchase: "CompletePayment",
	};

	const shouldSendMetaEvent = eventName !== "page_view" || initialPixelPageViewHandled;
	if (eventName === "page_view") initialPixelPageViewHandled = true;
	if (shouldSendMetaEvent && metaEvents[eventName] && trackingWindow.fbq) trackingWindow.fbq("track", metaEvents[eventName], marketingPayload);
	if (tiktokEvents[eventName] && trackingWindow.ttq?.track) trackingWindow.ttq.track(tiktokEvents[eventName], marketingPayload);
}

export function trackStorefrontEvent(eventName: StorefrontAnalyticsEvent, payload: EventPayload = {}) {
	if (typeof window === "undefined" || navigator.doNotTrack === "1") return;

	const attribution = getAttribution();
	const body = {
		event_id: payload.eventId || createId("event"),
		session_id: getAnalyticsSessionId(),
		event_name: eventName,
		product_id: payload.productId || undefined,
		product_name: payload.productName || undefined,
		order_id: payload.orderId || undefined,
		page_path: `${window.location.pathname}${window.location.search}`,
		page_title: document.title,
		referrer: document.referrer || undefined,
		source: attribution.source,
		medium: attribution.medium,
		campaign: attribution.campaign || undefined,
		value: payload.value ?? undefined,
		currency: payload.currency || undefined,
		metadata: payload.metadata,
	};

	sendToMarketingPlatforms(eventName, payload);
	void apiFetch("/landing/analytics/events", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		keepalive: true,
	}).catch(() => {
		// Analytics must never interrupt shopping or checkout.
	});
}

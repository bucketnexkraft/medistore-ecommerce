"use client";

import { apiFetch } from "@/lib/api-client";

type CachedPayload = {
	payload: unknown;
	expiresAt: number;
};

// This cache only joins consumers during the same initial render. Storefront
// catalog/configuration data is editable, so it must not survive indefinitely.
const RESPONSE_CACHE_TTL_MS = 30_000;
const responseCache = new Map<string, CachedPayload>();
const promiseCache = new Map<string, Promise<unknown>>();

const cacheKeyFor = (path: string, storefrontHost?: string | null) => {
	const host = String(storefrontHost || (typeof window === "undefined" ? "server" : window.location.host)).toLowerCase();
	return `${host}:${path}`;
};

export async function fetchStorefrontJson<T = unknown>(path: string, storefrontHost?: string | null): Promise<T | null> {
	const cacheKey = cacheKeyFor(path, storefrontHost);
	const shouldBypassCache = path === "/preferences" || path === "/landing/social-auth";

	if (!shouldBypassCache && responseCache.has(cacheKey)) {
		const cachedEntry = responseCache.get(cacheKey);
		if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
			return cachedEntry.payload as T;
		}
		responseCache.delete(cacheKey);
	}

	// Even no-store resources should share the same in-flight request. React
	// StrictMode mounts effects twice in development; without this guard both
	// mounts occupy the storefront API worker with identical requests.
	const existingPromise = promiseCache.get(cacheKey);
	if (existingPromise) {
		return ((await existingPromise) as T) ?? null;
	}

	const loadPayload = async () => {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const response = await apiFetch(
					path,
					{ cache: "no-store" },
					storefrontHost,
				);
				if (!response.ok) continue;

				const payload = await response.json().catch(() => null);
				if (payload !== null) return payload;
			} catch {
				// Retry once after a transient proxy/API failure.
			}
		}

		return null;
	};

	const request = loadPayload()
		.then((payload) => {
			// A failed/non-JSON response must never become a permanent successful
			// cache entry. Otherwise one temporary 503 leaves the section empty
			// until the whole browser runtime is restarted.
			if (!shouldBypassCache && payload !== null && typeof payload !== "undefined") {
				responseCache.set(cacheKey, {
					payload,
					expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
				});
			}
			promiseCache.delete(cacheKey);
			return payload;
		})
		.catch(() => {
			promiseCache.delete(cacheKey);
			return null;
		});

	promiseCache.set(cacheKey, request);

	return ((await request) as T) ?? null;
}

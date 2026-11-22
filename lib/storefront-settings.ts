import { cache } from "react";
import { headers } from "next/headers";
import { serverApiFetch } from "@/lib/api-client";
import { normalizePreferencesData } from "@/lib/storefront-preferences";

const fetchStorefrontSettings = cache(async (host: string | null) => {
	try {
		const [settingsResponse, preferencesResponse] = await Promise.all([
			serverApiFetch("/landing/settings/basic", host, { next: { revalidate: 120 } }),
			serverApiFetch("/landing/preferences", host, { next: { revalidate: 120 } }),
		]);

		const settingsJson = settingsResponse.ok ? await settingsResponse.json() : null;
		const preferencesJson = preferencesResponse.ok ? await preferencesResponse.json() : null;

		return {
			settingsData: settingsJson?.data ?? null,
			preferencesData: normalizePreferencesData(preferencesJson?.data),
		};
	} catch {
		return {
			settingsData: null,
			preferencesData: null,
		};
	}
});

export async function loadStorefrontSettings(providedHost?: string | null) {
	const host =
		typeof providedHost !== "undefined"
			? providedHost
			: await headers().then((headerStore) => headerStore.get("host"));

	return fetchStorefrontSettings(host);
}

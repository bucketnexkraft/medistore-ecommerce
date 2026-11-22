import { cache } from "react";
import { headers } from "next/headers";
import { serverApiFetch } from "@/lib/api-client";

const normalizeHost = (value?: string | null) => {
	const normalized = String(value || "").trim().toLowerCase();

	if (normalized === "") {
		return null;
	}

	return normalized.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
};

const resolveStorefrontRequestHost = async (providedHost?: string | null) => {
	if (typeof providedHost !== "undefined" && providedHost !== null) {
		const normalizedProvidedHost = normalizeHost(providedHost);
		if (normalizedProvidedHost) {
			return normalizedProvidedHost;
		}
	}

	const headerStore = await headers();
	const candidates = [
		headerStore.get("x-storefront-host"),
		headerStore.get("x-forwarded-host"),
		headerStore.get("host"),
	];

	for (const candidate of candidates) {
		const normalized = normalizeHost(candidate);
		if (normalized) {
			return normalized;
		}
	}

	return null;
};

export type StorefrontApiSection = Record<string, unknown>;

export type StorefrontPageData = {
	host: string | null;
	page: Record<string, unknown> | null;
	storefrontCategory: Record<string, unknown> | null;
	storefrontTemplate: Record<string, unknown> | null;
	sections: StorefrontApiSection[];
	contentHtml: string;
	theme: Record<string, unknown> | null;
	requestFailed: boolean;
};

type StorefrontApiResponse = {
	data?: {
		page?: Record<string, unknown>;
		theme?: Record<string, unknown>;
		storefront_category?: Record<string, unknown>;
		storefront_template?: Record<string, unknown>;
		sections?: StorefrontApiSection[];
		content_html?: string;
	};
};

const fetchStorefrontPageData = cache(async (path: string, host: string | null) => {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const response = await serverApiFetch(path, host, { cache: "no-store" });

			if (response.ok) {
				const result = (await response.json()) as StorefrontApiResponse;

				return {
					host,
					page: result?.data?.page || null,
					theme: result?.data?.theme || null,
					storefrontCategory: result?.data?.storefront_category || null,
					storefrontTemplate: result?.data?.storefront_template || null,
					sections: Array.isArray(result?.data?.sections) ? result.data.sections : [],
					contentHtml: String(result?.data?.content_html || "").trim(),
					requestFailed: false,
				};
			}
		} catch {
			// A cold backend/proxy can fail the first request while becoming
			// available immediately afterwards. Retry once before rendering the
			// genuine empty-store state.
		}

		if (attempt === 0) {
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
	}

	return {
		host,
		page: null as Record<string, unknown> | null,
		storefrontCategory: null as Record<string, unknown> | null,
		storefrontTemplate: null as Record<string, unknown> | null,
		sections: [] as StorefrontApiSection[],
		contentHtml: "",
		theme: null as Record<string, unknown> | null,
		requestFailed: true,
	};
});

export async function loadStorefrontPageData(path: string, providedHost?: string | null) {
	const host = await resolveStorefrontRequestHost(providedHost);

	return fetchStorefrontPageData(path, host);
}

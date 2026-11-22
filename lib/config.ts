const normalizeUrl = (value = "") => {
	const normalized = String(value || "").trim();

	if (normalized === "" || normalized.toLowerCase() === "null" || normalized.toLowerCase() === "undefined") {
		return "";
	}

	return normalized.replace(/\/+$/, "");
};

export const normalizeApiBaseUrl = (value = "") => {
	const normalized = normalizeUrl(value);

	if (!normalized || normalized.endsWith("/api/v1")) {
		return normalized;
	}

	if (normalized.endsWith("/api")) {
		return `${normalized}/v1`;
	}

	return `${normalized}/api/v1`;
};

const normalizedApiUrl = normalizeUrl(process.env.NEXT_PUBLIC_API_URL);
const normalizedApiBaseUrl = normalizeUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
const normalizedStorageUrl = normalizeUrl(process.env.NEXT_PUBLIC_STORAGE_URL);

export const API_BASE_URL = normalizeApiBaseUrl(normalizedApiUrl || normalizedApiBaseUrl) || "/api/v1";

export const buildApiUrl = (path = "") => {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${API_BASE_URL}${normalizedPath}`;
};

const resolveApiAssetBaseUrl = () => {
	if (normalizedStorageUrl) {
		return normalizedStorageUrl;
	}

	try {
		const apiUrl = new URL(API_BASE_URL);
		return apiUrl.origin;
	} catch {
		return "";
	}
};

export const API_ASSET_BASE_URL = resolveApiAssetBaseUrl();

export const buildApiAssetUrl = (path = "") => {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;

	if (!API_ASSET_BASE_URL) {
		return normalizedPath;
	}

	return `${API_ASSET_BASE_URL}${normalizedPath}`;
};

const normalizeAssetHost = (host?: string | null) =>
	String(host || "").trim().toLowerCase();

export const resolveApiAssetUrl = (value?: string | null, storefrontHost?: string | null) => {
	const candidate = String(value || "").trim();

	if (!candidate) {
		return buildApiAssetUrl("/images/placeholder.jpg");
	}

	if (candidate.startsWith("/images/")) {
		return buildApiAssetUrl(candidate);
	}

	try {
		const url = new URL(candidate);
		const host = normalizeAssetHost(url.host);
		const activeStorefrontHost =
			typeof window !== "undefined" ? normalizeAssetHost(window.location.host) : "";
		const providedStorefrontHost = normalizeAssetHost(storefrontHost);

		if (
			url.pathname.startsWith("/images/")
			&& (host === activeStorefrontHost || host === providedStorefrontHost)
		) {
			return buildApiAssetUrl(`${url.pathname}${url.search}`);
		}
	} catch {
	}

	return candidate;
};

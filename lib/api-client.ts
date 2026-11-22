import { buildApiUrl } from "@/lib/config";

type NextFetchInit = RequestInit & {
	next?: {
		revalidate?: number | false;
		tags?: string[];
	};
};

// Storefront responses can contain the configured home sections and catalog
// data. Do not abort a valid response while its body is still being received.
const STOREFRONT_REQUEST_TIMEOUT_MS = 30_000;
const STOREFRONT_PREVIEW_REQUEST_TIMEOUT_MS = 30_000;
// Storefront preview sections load independently. A small queue made the
// catalog sections wait behind unrelated header/footer requests.
const BROWSER_GET_CONCURRENCY = 8;

type BrowserGetTask = () => void;

const browserGetQueue: BrowserGetTask[] = [];
let activeBrowserGetRequests = 0;

const drainBrowserGetQueue = () => {
	while (activeBrowserGetRequests < BROWSER_GET_CONCURRENCY && browserGetQueue.length > 0) {
		const nextTask = browserGetQueue.shift();
		nextTask?.();
	}
};

const abortReason = (signal?: AbortSignal | null) =>
	signal?.reason instanceof Error
		? signal.reason
		: new DOMException("The request was aborted.", "AbortError");

const scheduleBrowserGet = (request: () => Promise<Response>, signal?: AbortSignal | null) =>
	new Promise<Response>((resolve, reject) => {
		const run = () => {
			if (signal?.aborted) {
				reject(abortReason(signal));
				drainBrowserGetQueue();
				return;
			}

			activeBrowserGetRequests += 1;
			request()
				.then(resolve, reject)
				.finally(() => {
					activeBrowserGetRequests -= 1;
					drainBrowserGetQueue();
				});
		};

		browserGetQueue.push(run);
		drainBrowserGetQueue();
	});

const isPreviewRequestPath = (path: string) =>
	path.includes("public-preview")
	|| path.includes("template_id=")
	|| path.includes("is_demo=1")
	|| path.includes("is_demo=true");

const createRequestSignal = (providedSignal?: AbortSignal | null, timeoutMs = STOREFRONT_REQUEST_TIMEOUT_MS) => {
	const controller = new AbortController();

	if (providedSignal?.aborted) {
		controller.abort(providedSignal.reason);
	} else {
		providedSignal?.addEventListener("abort", () => controller.abort(providedSignal.reason), { once: true });
	}

	// Keep the timeout signal alive through response.json() as well. A timeout
	// around fetch() alone does not protect against a stalled response body.
	setTimeout(() => controller.abort(new Error("Storefront API request timed out")), timeoutMs);

	return controller.signal;
};

export type PaymentScope = "plan_purchase" | "ecommerce_order";

const normalizeHost = (value?: string | null) => {
	const normalized = String(value || "").trim().toLowerCase();
	return normalized !== "" ? normalized : null;
};

const resolveClientHost = () => {
	if (typeof window === "undefined") {
		return null;
	}

	return normalizeHost(window.location.host);
};

export const getApiHeaders = (headers?: HeadersInit) => {
	const mergedHeaders: Record<string, string> = {};

	if (headers instanceof Headers) {
		headers.forEach((value, key) => {
			mergedHeaders[key] = value;
		});
	} else if (Array.isArray(headers)) {
		for (const [key, value] of headers) {
			mergedHeaders[key] = value;
		}
	} else if (headers && typeof headers === "object") {
		for (const [key, value] of Object.entries(headers)) {
			if (typeof value !== "undefined") {
				mergedHeaders[key] = String(value);
			}
		}
	}

	if (!("Accept" in mergedHeaders) && !("accept" in mergedHeaders)) {
		mergedHeaders.Accept = "application/json";
	}

	return mergedHeaders;
};

export const withPaymentScopeHeaders = (
	headers: HeadersInit | undefined,
	paymentScope: PaymentScope,
) => {
	const mergedHeaders = getApiHeaders(headers);

	return {
		...mergedHeaders,
		"X-Payment-Scope": paymentScope,
	};
};

const withStorefrontHostHeaders = (headers: Record<string, string>, host?: string | null) => {
	const normalizedHost = normalizeHost(host);

	if (!normalizedHost) {
		return headers;
	}

	return {
		...headers,
		"X-Storefront-Host": normalizedHost,
	};
};

export const buildCompanyScopedApiUrl = (path = "") => buildApiUrl(path);

const buildBrowserApiUrl = (path = "") => buildCompanyScopedApiUrl(path);

export const resolveServerApiUrl = (path: string, host?: string | null) => {
	void host;
	return buildCompanyScopedApiUrl(path);
};

export const apiFetch = (path: string, init: NextFetchInit = {}, storefrontHost?: string | null) => {
	const requestUrl = typeof window === "undefined" ? buildCompanyScopedApiUrl(path) : buildBrowserApiUrl(path);
	const timeoutMs = isPreviewRequestPath(path) ? STOREFRONT_PREVIEW_REQUEST_TIMEOUT_MS : STOREFRONT_REQUEST_TIMEOUT_MS;
	const executeRequest = () => fetch(requestUrl, {
		...init,
		signal: createRequestSignal(init.signal, timeoutMs),
		headers: withStorefrontHostHeaders(getApiHeaders(init.headers), storefrontHost ?? resolveClientHost()),
	});
	const method = String(init.method || "GET").trim().toUpperCase();

	return typeof window !== "undefined" && method === "GET"
		? scheduleBrowserGet(executeRequest, init.signal)
		: executeRequest();
};

export const serverApiFetch = (path: string, host: string | null, init: NextFetchInit = {}) => {
	const timeoutMs = isPreviewRequestPath(path) ? STOREFRONT_PREVIEW_REQUEST_TIMEOUT_MS : STOREFRONT_REQUEST_TIMEOUT_MS;

	return fetch(resolveServerApiUrl(path, host), {
		...init,
		signal: createRequestSignal(init.signal, timeoutMs),
		headers: withStorefrontHostHeaders(getApiHeaders(init.headers), host),
	});
};

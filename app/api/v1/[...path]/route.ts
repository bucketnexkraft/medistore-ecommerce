import { NextRequest, NextResponse } from "next/server";
import { normalizeApiBaseUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

const configuredApiBaseUrl = normalizeApiBaseUrl(
	process.env.NEXT_PUBLIC_API_URL
	|| process.env.NEXT_PUBLIC_API_BASE_URL
	|| "http://127.0.0.1:8000/api/v1",
);

const getStorefrontHost = (request: NextRequest) =>
	request.headers.get("x-storefront-host")
	|| request.headers.get("x-forwarded-host")
	|| request.headers.get("host")
	|| request.nextUrl.host;

async function forwardRequest(request: NextRequest) {
	const apiPath = request.nextUrl.pathname.replace(/^\/api\/v1(?=\/|$)/, "") || "/";
	const upstreamUrl = `${configuredApiBaseUrl}${apiPath}${request.nextUrl.search}`;
	const headers = new Headers(request.headers);
	const storefrontHost = getStorefrontHost(request);
	const authorization = request.headers.get("authorization");

	// These are connection-specific headers for the Next server, not the API.
	headers.delete("host");
	headers.delete("content-length");
	headers.delete("connection");
	headers.delete("accept-encoding");

	// The backend resolves the company exclusively from the storefront host.
	headers.set("accept", "application/json");
	headers.set("x-requested-with", "XMLHttpRequest");
	headers.set("x-storefront-host", storefrontHost);
	headers.set("x-forwarded-host", storefrontHost);
	if (authorization) {
		headers.set("authorization", authorization);
	}

	const method = request.method.toUpperCase();
	const body = method === "GET" || method === "HEAD" || method === "OPTIONS"
		? undefined
		: await request.arrayBuffer();

	try {
		const response = await fetch(upstreamUrl, {
			method,
			headers,
			body,
			redirect: "manual",
			cache: "no-store",
			signal: request.signal,
		});
		const responseHeaders = new Headers(response.headers);

		// The upstream fetch may already have decoded the response body.
		responseHeaders.delete("content-encoding");
		responseHeaders.delete("content-length");
		responseHeaders.delete("transfer-encoding");

		return new NextResponse(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	} catch {
		return NextResponse.json(
			{ status: false, message: "Storefront API is unavailable.", data: null },
			{ status: 503 },
		);
	}
}

export const GET = forwardRequest;
export const HEAD = forwardRequest;
export const OPTIONS = forwardRequest;
export const POST = forwardRequest;
export const PUT = forwardRequest;
export const PATCH = forwardRequest;
export const DELETE = forwardRequest;

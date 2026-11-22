import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  extractStorefrontSubdomain,
  isLocalHost,
  normalizeHost,
  resolvePlatformRootDomain,
} from "@/lib/storefront-host";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const host = normalizeHost(request.headers.get("host"));
  const rootDomain = resolvePlatformRootDomain(host);
  const subdomain = extractStorefrontSubdomain(host, rootDomain);

  requestHeaders.set("x-storefront-host", host);
  requestHeaders.set("x-storefront-path", request.nextUrl.pathname);
  requestHeaders.set("x-storefront-root-domain", rootDomain);
  requestHeaders.set("x-storefront-subdomain", subdomain);
  requestHeaders.set("x-storefront-managed-host", subdomain ? "1" : "0");
  requestHeaders.set("x-storefront-local-host", isLocalHost(host) ? "1" : "0");

  const templateId = request.nextUrl.searchParams.get("template_id");
  const demoFlag = String(request.nextUrl.searchParams.get("is_demo") || "").toLowerCase();
  requestHeaders.set(
    "x-storefront-template-preview",
    templateId && ["true", "1"].includes(demoFlag) ? "1" : "0",
  );

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

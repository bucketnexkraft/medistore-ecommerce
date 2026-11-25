"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

function buildPreviewHref(
	href: string,
	searchParams: { get(name: string): string | null },
	previewPages?: string[],
) {
	if (!href.startsWith("/") || href.startsWith("//")) return null;

	const templateId = searchParams.get("template_id");
	const isDemo = searchParams.get("is_demo");
	if (!templateId || !["true", "1"].includes(String(isDemo || "").toLowerCase())) return null;

	const target = new URL(href, "http://preview.local");
	const targetPage = target.pathname.replace(/^\/+|\/+$/g, "") || "home";
	if (previewPages && !isPreviewPage(targetPage, previewPages)) return null;
	const previewParams = new URLSearchParams(target.search);
	previewParams.set("template_id", templateId);
	previewParams.set("is_demo", "true");
	previewParams.set("preview_page", targetPage);

	return `/?${previewParams.toString()}${target.hash}`;
}

function isPreviewPage(page: string, configuredPages: string[]) {
	const path = page.toLowerCase();
	if (path === "signin") return false;
	return ["home", "blog", "flash-deals"].includes(path) || /^blog\/[^/]+$/.test(path) || configuredPages.includes(path);
}

export default function PreviewNavigationGuard({ children, pagePaths = [] }: { children: ReactNode; pagePaths?: string[] }) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}

		const target = event.target as HTMLElement | null;
		const link = target?.closest("a");
		if (!link || link.target === "_blank") return;

		const href = link.getAttribute("href");
		if (!href) return;

		const previewHref = buildPreviewHref(href, searchParams, link.hasAttribute("data-storefront-header-link") ? pagePaths : undefined);
		if (!previewHref || previewHref === href) return;

		event.preventDefault();
		router.push(previewHref);
	};

	return <div onClickCapture={handleClickCapture}>{children}</div>;
}

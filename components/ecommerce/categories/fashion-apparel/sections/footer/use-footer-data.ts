"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import type { FashionSectionProps } from "../../types";

type FooterLink = {
	label: string;
	href: string;
};

export type FooterColumn = {
	title: string;
	note?: string;
	links: FooterLink[];
};

type FooterGroup = {
	title?: string;
	note?: string;
	label?: string;
	subtitle?: string;
	links?: unknown[];
};

type SocialLink = {
	label: string;
	href: string;
};

const SOCIAL_FIELDS = [
	{ key: "facebook_link", label: "Facebook" },
	{ key: "instagram_link", label: "Instagram" },
	{ key: "twitter_link", label: "X (Twitter)" },
	{ key: "linkedin_link", label: "LinkedIn" },
	{ key: "youtube_link", label: "YouTube" },
] as const;

export const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const textValue = (value: unknown, fallback: string) => {
	const normalized = String(value ?? "").trim();
	return normalized || fallback;
};

const normalizeHref = (value: unknown) => {
	const href = String(value ?? "").trim();
	return href || "#";
};

function resolveActionHref(action: Record<string, unknown>) {
	const linkType = String(action.link_type || "").trim().toLowerCase();
	const routeKey = String(action.route_key || "").trim();
	const expression = String(action.expression || "").trim();
	const targetPageSlug = String(action.target_page_slug || "").trim();
	const targetPageRouteKey = String(action.target_page_route_key || "").trim();

	if (linkType === "external_url") return normalizeHref(expression);
	if (linkType === "internal_route") return normalizeHref(routeKey || expression);
	if (linkType === "storefront_page") {
		if (targetPageRouteKey) return normalizeHref(targetPageRouteKey);
		return targetPageSlug ? `/${targetPageSlug.toLowerCase().replace(/^\/+/, "")}` : "#";
	}

	if (expression) return normalizeHref(expression);
	if (targetPageSlug) return `/${targetPageSlug.toLowerCase().replace(/^\/+/, "")}`;
	return normalizeHref(routeKey);
}

function resolveActionLabel(action: Record<string, unknown>) {
	return textValue(action.name ?? action.label ?? action.slug, "");
}

function buildFooterColumns(actions: unknown[], configuredGroups: unknown[]): FooterColumn[] {
	const columns: FooterColumn[] = [];

	const addLink = (groupName: string, label: string, href: string, note = "") => {
		if (!label || !href || href === "#") return;

		const existingColumn = columns.find((column) => column.title.toLowerCase() === groupName.toLowerCase());
		if (existingColumn) {
			if (!existingColumn.note && note) existingColumn.note = note;
			existingColumn.links.push({ label, href });
			return;
		}

		columns.push({ title: groupName, note: note || undefined, links: [{ label, href }] });
	};

	actions.forEach((value) => {
		const action = asRecord(value);
		addLink(
			textValue(action.footer_group, "Information"),
			resolveActionLabel(action),
			resolveActionHref(action),
			textValue(action.label, ""),
		);
	});

	if (columns.length) return columns;

	configuredGroups.forEach((value) => {
		const group = asRecord(value) as FooterGroup;
		const groupName = textValue(group.title, "Information");
		const groupNote = textValue(group.note ?? group.subtitle ?? group.label, "");
		const links = Array.isArray(group.links) ? group.links : [];

		links.forEach((value) => {
			const link = asRecord(value);
			const label = resolveActionLabel(link);
			const href = link.link_type || link.expression || link.route_key || link.target_page_slug
				? resolveActionHref(link)
				: normalizeHref(link.href || link.path);
			addLink(groupName, label, href, groupNote);
		});
	});

	return columns.filter((column) => column.links.length > 0);
}

export function useFooterData({ section, preferencesData, host, demoOnly }: FashionSectionProps) {
	const config = asRecord(section.config);
	const configuredContent = asRecord(config.content);
	const content = Object.keys(configuredContent).length ? configuredContent : config;
	const providedPreferences = asRecord(preferencesData);
	const hasProvidedPreferences = Object.keys(providedPreferences).length > 0;
	const [fetchedFooterData, setFetchedFooterData] = useState<Record<string, unknown> | null>(null);
	const [fetchedPreferences, setFetchedPreferences] = useState<Record<string, unknown> | null>(null);

	useEffect(() => {
		let active = true;
		const path = demoOnly ? "/landing/sections/footer?is_demo=1" : "/landing/sections/footer";
		fetchStorefrontJson<{ data?: unknown }>(path, host)
			.then((result) => {
				if (active) {
					setFetchedFooterData(asRecord(result?.data));
				}
			})
			.catch(() => {
				// Builder section values are enough to render the footer if this fallback fails.
			});

		return () => {
			active = false;
		};
	}, [demoOnly, host]);

	useEffect(() => {
		if (hasProvidedPreferences) return;

		let active = true;
		const path = demoOnly ? "/landing/preferences?is_demo=1" : "/landing/preferences";
		fetchStorefrontJson<{ data?: unknown }>(path, host)
			.then((result) => {
				if (active) {
					setFetchedPreferences(asRecord(result?.data));
				}
			})
			.catch(() => {
				// Footer preferences are optional; builder content remains usable without them.
			});

		return () => {
			active = false;
		};
	}, [demoOnly, hasProvidedPreferences, host]);

	const preferences = Object.keys(providedPreferences).length ? providedPreferences : fetchedPreferences ?? {};
	const footerData = fetchedFooterData ?? {};
	const brandName = textValue(
		content.brand_name ?? preferences.application_name ?? preferences.name ?? preferences.store_name ?? preferences.company_name ?? footerData.brand_label,
		"Store",
	);
	const configuredLogo = typeof content.logo === "string" ? content.logo : asRecord(content.logo).url;
	const logoUrl = textValue(configuredLogo, "") || textValue(preferences.site_logo ?? footerData.brand_logo_url, "");
	const heading = textValue(content.heading ?? section.title, brandName);
	const description = textValue(content.description ?? section.subtitle, "Shop trusted products and discover something new every day.");
	const newsletterTitle = textValue(content.newsletter_title ?? footerData.newsletter_title, "Stay in the loop");
	const newsletterDescription = textValue(content.newsletter_description ?? content.newsletter_text ?? footerData.newsletter_text, "Subscribe for new arrivals, special offers, and store updates.");
	const newsletterPlaceholder = textValue(content.newsletter_placeholder ?? footerData.newsletter_text, "Enter your email");
	const copyright = textValue(content.copyright ?? preferences.copyright ?? footerData.copyright, `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`);

	const columns = useMemo(() => {
		const actions = Array.isArray(section.actions) ? section.actions : [];
		const configuredGroups = Array.isArray(content.footer_groups) ? content.footer_groups : content.footer_group;
		const apiGroups = fetchedFooterData?.footer_groups;
		const groups = Array.isArray(configuredGroups) && configuredGroups.length
			? configuredGroups
			: Array.isArray(apiGroups) ? apiGroups : [];
		return buildFooterColumns(actions, groups);
	}, [section.actions, content.footer_groups, content.footer_group, fetchedFooterData]);
	const socialLinks = SOCIAL_FIELDS.map<SocialLink | null>((field) => {
		const href = String(preferences[field.key] ?? "").trim();
		return href ? { label: field.label, href } : null;
	}).filter((link): link is SocialLink => link !== null);

	return { content, preferences, brandName, logoUrl, heading, description, newsletterTitle, newsletterDescription, newsletterPlaceholder, copyright, columns, socialLinks };
}

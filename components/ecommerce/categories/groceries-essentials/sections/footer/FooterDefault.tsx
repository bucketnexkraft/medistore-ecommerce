"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import type { GroceriesSectionProps } from "../../types";

type FooterLink = {
	label: string;
	href: string;
};

type FooterColumn = {
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

const asRecord = (value: unknown): Record<string, unknown> =>
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

function FooterLogo({ src, alt, fallbackLabel }: { src: string; alt: string; fallbackLabel: string }) {
	const [failed, setFailed] = useState(false);

	return src && !failed ? (
		<Image
			unoptimized
			src={src}
			alt={alt}
			width={150}
			height={44}
			className="h-11 w-auto max-w-[150px] object-contain object-left"
			onError={() => setFailed(true)}
		/>
	) : <span className="text-xl font-bold text-white">{fallbackLabel}</span>;
}

export default function FooterDefault({ section, preferencesData, host, demoOnly }: GroceriesSectionProps) {
	const config = asRecord(section.config);
	const configuredContent = asRecord(config.content);
	const content = Object.keys(configuredContent).length ? configuredContent : config;
	const configuredGroups = Array.isArray(content.footer_groups)
		? content.footer_groups
		: Array.isArray(content.footer_group)
			? content.footer_group
			: [];
	const actions = Array.isArray(section.actions) ? section.actions : [];
	const providedPreferences = asRecord(preferencesData);
	const hasProvidedPreferences = Object.keys(providedPreferences).length > 0;
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
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
	const fallbackGroups = configuredGroups.length
		? configuredGroups
		: Array.isArray(footerData.footer_groups)
			? footerData.footer_groups
			: [];
	const brandName = textValue(
		content.brand_name ?? preferences.application_name ?? preferences.name ?? preferences.store_name ?? preferences.company_name ?? footerData.brand_label,
		"Store",
	);
	const logoUrl = textValue(content.logo ?? preferences.site_logo ?? footerData.brand_logo_url, "");
	const heading = textValue(content.heading ?? section.title, brandName);
	const description = textValue(content.description ?? section.subtitle, "Shop trusted products and discover something new every day.");
	const newsletterTitle = textValue(content.newsletter_title ?? footerData.newsletter_title, "Stay in the loop");
	const newsletterDescription = textValue(content.newsletter_description ?? content.newsletter_text ?? footerData.newsletter_text, "Subscribe for new arrivals, special offers, and store updates.");
	const newsletterPlaceholder = textValue(content.newsletter_placeholder ?? footerData.newsletter_text, "Enter your email");
	const copyright = textValue(content.copyright ?? preferences.copyright ?? footerData.copyright, `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`);

	const columns = useMemo(() => buildFooterColumns(actions, fallbackGroups), [actions, fallbackGroups]);
	const socialLinks = SOCIAL_FIELDS.map<SocialLink | null>((field) => {
		const href = String(preferences[field.key] ?? "").trim();
		return href ? { label: field.label, href } : null;
	}).filter((link): link is SocialLink => link !== null);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedEmail = email.trim().toLowerCase();
		if (!trimmedEmail || isSubmitting) return;

		setIsSubmitting(true);
		try {
			const response = await apiFetch("/landing/newsletter/subscribe", {
				method: "POST",
				headers: getAuthHeaders(),
				body: JSON.stringify({ email: trimmedEmail }),
			}, host);
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== true) {
				throw new Error(extractApiError(payload, "Newsletter subscription failed."));
			}

			setEmail("");
			toast({ title: "Subscribed", description: "This email has been added to the newsletter list." });
		} catch (error) {
			toast({
				title: "Subscription failed",
				description: error instanceof Error ? error.message : "Newsletter subscription failed.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<footer data-storefront-section="groceries-essentials-footer-default" className="bg-primary-black py-14 text-white md:py-20">
			<div className="container mx-auto px-6 lg:px-8">
				<div className="grid gap-12 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)] xl:gap-20">
					<div>
						<div className="mb-10 flex flex-col gap-5 border-b border-white/15 pb-10 sm:flex-row sm:items-start sm:justify-between">
							<div className="max-w-xl">
								<Link href="/" className="inline-flex items-center" aria-label={`${brandName} home`}>
									<FooterLogo key={logoUrl || "fallback-logo"} src={logoUrl} alt={`${brandName} logo`} fallbackLabel={brandName} />
								</Link>
								<h2 className="mt-6 text-2xl font-bold md:text-3xl">{heading}</h2>
								{description ? <p className="mt-3 max-w-lg text-sm leading-6 text-white/65 md:text-base">{description}</p> : null}
							</div>
							{socialLinks.length ? (
								<div className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
									{socialLinks.map((social) => <Link key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 underline-offset-4 transition hover:text-white hover:underline">{social.label}</Link>)}
								</div>
							) : null}
						</div>

						{columns.length ? (
							<nav className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" aria-label="Footer navigation">
								{columns.map((column) => (
									<div key={column.title}>
										<h3 className="mb-4 text-base font-semibold">{column.title}</h3>
										{column.note ? <p className="mb-4 text-xs leading-5 text-white/45">{column.note}</p> : null}
										<ul className="space-y-3">
											{column.links.map((link) => <li key={`${column.title}-${link.label}`}><Link href={link.href} className="text-sm text-white/65 transition hover:text-white">{link.label}</Link></li>)}
										</ul>
									</div>
								))}
							</nav>
						) : null}
					</div>

					<div className="rounded-3xl p-7 md:p-9">
						<h2 className="text-2xl font-bold leading-tight md:text-3xl">{newsletterTitle}</h2>
						<p className="mt-3 text-sm leading-6 text-gray-600">{newsletterDescription}</p>
						<form onSubmit={handleSubmit} className="mt-7">
							<label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
							<div className="relative">
								<input id="footer-newsletter-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={newsletterPlaceholder} className="h-14 w-full rounded-xl bg-gray-100 px-4 pr-14 text-gray-900 outline-none ring-0 placeholder:text-gray-500 focus:ring-2 focus:ring-primary-black" />
								<button type="submit" disabled={isSubmitting} aria-label="Subscribe" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-900 transition hover:text-theme-coral disabled:cursor-not-allowed disabled:opacity-50"><ArrowRight className="size-6" /></button>
							</div>
						</form>
					</div>
				</div>

				<div className="mt-12 border-t border-white/15 pt-6 text-xs text-white/50">
					<span>{copyright}</span>
				</div>
			</div>
		</footer>
	);
}

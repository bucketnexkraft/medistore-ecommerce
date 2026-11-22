"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { usePathname } from "next/navigation";
import { resolveStorefrontActionHref } from "@/lib/storefront-links";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";

interface FooterLink {
	label: string;
	href: string;
}

interface FooterColumn {
	title: string;
	subtitle?: string;
	links: FooterLink[];
}

type FooterSocialLink = {
	label: string;
	href: string;
};

export type FooterProps = {
	initialSection?: StorefrontChromeSection | null;
	preferencesData?: Record<string, unknown> | null;
	host?: string | null;
	demoOnly?: boolean;
};

const SOCIAL_LINK_FIELDS = [
	{ key: "facebook_link", label: "Facebook" },
	{ key: "instagram_link", label: "Instagram" },
	{ key: "twitter_link", label: "X (Twitter)" },
	{ key: "linkedin_link", label: "LinkedIn" },
	{ key: "youtube_link", label: "YouTube" },
] as const;

export function Footer({ initialSection = null, preferencesData = null, host = null, demoOnly = false }: FooterProps) {
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [dynamicFooterSection, setDynamicFooterSection] = useState<StorefrontChromeSection | null>(initialSection);
	const [hasBuilderFooter, setHasBuilderFooter] = useState<boolean | null>(initialSection ? true : null);
	const [fetchedPreferencesData, setFetchedPreferencesData] = useState<Record<string, unknown> | null>(null);
	const pathname = usePathname();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const trimmedEmail = email.trim().toLowerCase();
		if (trimmedEmail === "" || isSubmitting) {
			return;
		}

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
			toast({
				title: "Subscribed",
				description: "This email has been added to the newsletter list.",
			});
		} catch (error) {
			toast({
				title: "Subscription failed",
				description: error instanceof Error ? error.message : "Newsletter subscription failed.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	useEffect(() => {
		if (initialSection) {
			return;
		}

		let active = true;

		const loadFooterContext = async () => {
			try {
				const result = await fetchStorefrontJson<{ data?: { sections?: StorefrontChromeSection[] } }>(`/home?react=1${demoOnly ? "&is_demo=1" : ""}`, host);
				const sections = Array.isArray(result?.data?.sections) ? (result.data.sections as StorefrontChromeSection[]) : [];
				const footerSection =
					sections.find((section) => String(section?.template?.slot || "").toLowerCase() === "footer") ||
					sections.find((section) => String(section?.variant || "").toLowerCase() === "footer") ||
					null;

				if (!active) return;
				setHasBuilderFooter(Boolean(footerSection));
				setDynamicFooterSection(footerSection);
			} catch {
				return;
			}
		};

		loadFooterContext();

		return () => {
			active = false;
		};
	}, [demoOnly, host, initialSection]);

	useEffect(() => {
		if (preferencesData) {
			return;
		}

		let active = true;

		const loadFooterPreferences = async () => {
			try {
				const result = await fetchStorefrontJson<{ data?: unknown }>(`/landing/preferences${demoOnly ? "?is_demo=1" : ""}`, host);
				if (!active) return;
				setFetchedPreferencesData(result?.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : null);
			} catch {
				return;
			}
		};

		loadFooterPreferences();

		return () => {
			active = false;
		};
	}, [demoOnly, host, initialSection, preferencesData]);

	const footerActions = Array.isArray(dynamicFooterSection?.actions) ? dynamicFooterSection.actions : [];
	const dynamicColumns: FooterColumn[] = footerActions.reduce<FooterColumn[]>((columns, action) => {
		const label = String(action?.name || action?.slug || "").trim();
		const href = resolveStorefrontActionHref(action);
		const footerGroup = String(action?.footer_group || "").trim();

		if (label === "" || href === "#" || href === "") {
			return columns;
		}

		const groupName = footerGroup || "Information";
		const groupKey = groupName.toLowerCase();
		const existingColumnIndex = columns.findIndex((column) => column.title.toLowerCase() === groupKey);

		if (existingColumnIndex >= 0) {
			const existingColumn = columns[existingColumnIndex];
			columns[existingColumnIndex] = {
				...existingColumn,
				links: [...existingColumn.links, { label, href }],
			};

			return columns;
		}

		columns.push({
			title: groupName,
			links: [{ label, href }],
		});

		return columns;
	}, []);
	const hasDynamicLinkContent = dynamicColumns.length > 0;
	const resolvedPreferencesData = preferencesData ?? fetchedPreferencesData;
	const socialLinks: FooterSocialLink[] = SOCIAL_LINK_FIELDS.map((field): FooterSocialLink | null => {
		const href = String(resolvedPreferencesData?.[field.key] ?? "").trim();

		if (href === "") {
			return null;
		}

		return {
			label: field.label,
			href,
		};
	}).filter((item): item is FooterSocialLink => item !== null);
	const newsletterTitle =
		dynamicFooterSection?.title || "Get 10% off of your first order just by signing up to our newsletter.";
	const newsletterSubtitle = dynamicFooterSection?.subtitle || "";

	// On the home page, wait for builder footer detection before rendering to avoid a flash of fallback content.
	if (pathname === "/" && hasBuilderFooter !== true) {
		return null;
	}

	return (
		<footer className="bg-primary-black text-white pt-24 pb-8">
			<div className="section">
				{/* Main Content - Flex Row */}
				<div className="flex flex-col xl:flex-row gap-8 mb-12 lg:gap-12">
					{/* Left Section - lg:w-4/6 */}
					<div className="xl:w-4/6">
						{hasDynamicLinkContent ? (
							<div className="grid grid-cols-1 gap-8 border-b border-secondary-stroke pb-24 mb-12 md:grid-cols-2 xl:grid-cols-3">
								{dynamicColumns.map((column, index) => (
									<div key={`${column.title || "footer-group"}-${index}`}>
										<h3 className="mb-3 text-lg font-semibold text-white">{column.title}</h3>
										<ul className="space-y-4">
											{column.links.map((link, linkIndex) => (
												<li key={`${link.label || "footer-link"}-${linkIndex}`}>
													<Link href={link.href} className="text-sm text-bg transition-colors hover:text-white/60">
														{link.label}
													</Link>
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						) : null}

						<div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex flex-wrap gap-6">
								{socialLinks.slice(0, 6).map((link, index) => (
									<Link key={index} href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-bg underline transition-colors hover:text-white/60" aria-label={link.label}>
										{link.label}
									</Link>
								))}
							</div>
						</div>
					</div>

					{/* Right Section - lg:w-2/6 */}
					<div className="xl:w-2/6">
						<div className="bg-white text-gray-900 rounded-3xl p-8 h-full flex flex-col justify-center">
							{/* Title */}
							<h2 className="text-2xl font-bold mb-4 leading-tight">{newsletterTitle}</h2>
							{newsletterSubtitle ? <p className="mb-6 text-sm text-gray-600">{newsletterSubtitle}</p> : null}

							{/* Email Input Form */}
							<form onSubmit={handleSubmit}>
								<div className="relative">
									<input
										type="email"
										placeholder="Email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="w-full bg-gray-100 text-gray-900 placeholder-gray-500 px-4 py-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 pr-12"
										required
									/>
									<button
										type="submit"
										disabled={isSubmitting}
										className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-900 hover:text-red-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
										aria-label="Subscribe"
									>
										<ArrowRight size={24} />
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}

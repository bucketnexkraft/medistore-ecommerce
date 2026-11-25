"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, BadgeCheck, Building2, Clock, FileCheck, Handshake, Mail, MapPin, Phone, ShieldCheck, Smartphone } from "lucide-react";
import { FaApple, FaFacebookF, FaGooglePlay, FaInstagram, FaLinkedinIn, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { toast } from "@/hooks/use-toast";
import { resolveApiAssetUrl } from "@/lib/config";
import type { FashionSectionProps } from "../../types";
import { asRecord, useFooterData, type FooterColumn } from "./use-footer-data";
import { useFooterSubscription } from "./use-footer-subscription";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function scrollToTop() {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
}

function showPreviewLinkNotice(label: string) {
	toast({
		title: label,
		description: "This link hasn’t been added to the store yet.",
	});
}

function safeLink(value: unknown) {
	const href = text(value);
	return !/[\\\s]/.test(href) && /^(?:\/(?!\/)|https?:\/\/[^/]+)/i.test(href) ? href : "";
}

function imageUrl(value: unknown, host: string | null) {
	const src = safeLink(typeof value === "string" ? value : asRecord(value).url);
	return src.startsWith("/images/checkout/") ? src : src ? resolveApiAssetUrl(src, host) : "";
}

function readItems(value: unknown, host: string | null) {
	return (Array.isArray(value) ? value : []).flatMap((item) => {
		const record = asRecord(item);
		const label = text(record.label);
		return label ? [{
			label,
			description: text(record.description),
			image: imageUrl(record.image, host),
			href: safeLink(record.url),
		}] : [];
	});
}

const demoPayments = [
	{ label: "Visa", image: "/images/checkout/visa.svg" },
	{ label: "Mastercard", image: "/images/checkout/master.svg" },
	{ label: "bKash" },
	{ label: "Nagad" },
];

const demoAccreditations = [
	{ label: "Store registration", description: "Business information" },
	{ label: "Product documentation", description: "Specifications and guides" },
	{ label: "Supplier network", description: "Brands and distributors" },
	{ label: "Equipment support", description: "Product and order assistance" },
];

const demoAccreditationIcons = [Building2, FileCheck, Handshake, ShieldCheck];
type MenuItem = {
	label: string;
	match: RegExp;
	fallbackHref?: string;
};

const quickMenu: MenuItem[] = [
	{ label: "About Us", match: /^about(?: us)?$/ },
	{ label: "Contact Us", match: /^contact(?: us)?$/ },
	{ label: "Track Order", match: /^track(?: your)? order(?: fast)?$/, fallbackHref: "/track-order" },
	{ label: "FAQ", match: /^(?:faqs?|frequently asked questions)$/ },
	{ label: "Blog & Health Tips", match: /^blogs?(?: and health tips)?$/, fallbackHref: "/blog" },
];

const terms = { label: "Terms and Conditions", match: /^terms(?: and conditions| of (?:service|use))?$/ };
const privacy = { label: "Privacy Policy", match: /^privacy(?: policy)?$/ };
const refunds = { label: "Refund and Returns Policy", match: /^(?:refunds?(?: and returns?)?|returns?(?: and refunds?)?)(?: policy)?$/ };
const policyMenu: MenuItem[] = [
	terms,
	privacy,
	refunds,
	{ label: "Shipping & Delivery Info", match: /^(?:shipping(?: and delivery)?|delivery)(?: info(?:rmation)?| policy)?$/ },
	{ label: "Security Policy", match: /^security(?: policy)?$/ },
];
const legalMenu: MenuItem[] = [privacy, terms, refunds, { label: "Sitemap", match: /^site ?map$/ }];

const normalizeMenuName = (value: string) =>
	value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

function selectMenuLinks(items: MenuItem[], links: FooterColumn["links"], showSamples = false) {
	return items.flatMap(({ label, match, fallbackHref }) => {
		const configured = links.find((link) => {
			const slug = link.href.split(/[?#]/, 1)[0].split("/").filter(Boolean).at(-1) ?? "";
			return match.test(normalizeMenuName(link.label)) || match.test(normalizeMenuName(slug));
		});
		const href = configured?.href ?? fallbackHref ?? "";
		return href || showSamples ? [{ label, href }] : [];
	});
}

const linkClass = "break-words text-slate-300 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
const sectionHeading = "text-base font-semibold tracking-wide text-white";
const contactIcon = "mt-0.5 size-4 shrink-0 text-rose-300";
const socialIcons = {
	Facebook: FaFacebookF,
	Instagram: FaInstagram,
	"X (Twitter)": FaXTwitter,
	LinkedIn: FaLinkedinIn,
	YouTube: FaYoutube,
};

function FooterMenu({ title, links, className }: { title: string; links: FooterColumn["links"]; className: string }) {
	if (!links.length) return null;

	return (
		<nav aria-label={title} className={`min-w-0 ${className}`}>
			<h2 className={sectionHeading}>{title}</h2>
			<ul className="mt-4 space-y-2.5 text-sm">
				{links.map(({ label, href }) => (
					<li key={label}>
						{href ? <Link href={href} className={linkClass}>{label}</Link> : <span className="text-slate-300">{label}</span>}
					</li>
				))}
			</ul>
		</nav>
	);
}

function FooterImage({ src, width, height, className, fallback }: {
	src: string;
	width: number;
	height: number;
	className: string;
	fallback: React.ReactNode;
}) {
	const [failedSrc, setFailedSrc] = useState("");
	return src && src !== failedSrc ? (
		<Image src={src} width={width} height={height} alt="" unoptimized className={className} onError={() => setFailedSrc(src)} />
	) : fallback;
}

export default function FooterMedical(props: FashionSectionProps) {
	const { host, demoOnly, previewMode } = props;
	const data = asRecord(asRecord(props.section.config).data);
	const footer = useFooterData(props);
	const { content, preferences, brandName, copyright } = footer;
	const subscription = useFooterSubscription(host, demoOnly || previewMode);
	const emailId = useId();
	const heading = text(content.heading) || `About ${brandName}`;
	const description = text(content.description) || text(props.section.subtitle) || "Browse healthcare products, equipment, and supplies for everyday care.";
	const address = text(content.address) || (demoOnly ? "NexKraft · Dhaka, Bangladesh" : "");
	const hours = text(content.opening_hours) || (demoOnly ? "Monday–Saturday, 9:00 AM–6:00 PM" : "");
	const phone = text(content.contact_phone) || text(preferences.phone_number) || text(preferences.application_phone);
	const phoneHref = /^\+?\d[\d(). -]*$/.test(phone) ? `tel:${phone.replace(/[^+\d]/g, "")}` : "";
	const email = text(content.contact_email) || text(preferences.email);
	const contactEmailHref = /^[^\s?&#]+@[^\s?&#]+\.[^\s?&#]+$/.test(email) ? `mailto:${encodeURIComponent(email).replace("%40", "@")}` : "";
	const logo = imageUrl(footer.logoUrl, host);
	const newsletterHeading = text(content.newsletter_title) || "Stay Connected";
	const newsletterDescription = text(content.newsletter_description ?? content.newsletter_text)
		|| "Get updates on new equipment, articles, and store offers.";
	const emailPlaceholder = text(content.newsletter_placeholder) || "Enter your email address";
	const configuredAccreditations = readItems(content.accreditations, host);
	const configuredPayments = readItems(content.payment_methods, host);
	const payments = demoOnly && !configuredPayments.length ? readItems(demoPayments, host) : configuredPayments;
	const configuredLegalLinks = readItems(content.legal_links, host).filter(({ href }) => href);
	const legalNote = text(content.legal_note) || (demoOnly ? "Business registration details" : "");
	const securityNote = text(content.security_note) || (demoOnly ? "Secure checkout and payment options" : "");
	const menuLinks = footer.columns.flatMap(({ links }) => links).filter(({ href }) => safeLink(href));
	const quickLinks = selectMenuLinks(quickMenu, menuLinks, demoOnly);
	const policyLinks = selectMenuLinks(policyMenu, menuLinks, demoOnly);
	const legalLinks = configuredLegalLinks.length ? configuredLegalLinks : selectMenuLinks(legalMenu, menuLinks);
	const configuredSocialLinks = footer.socialLinks.filter(({ href }) => safeLink(href));
	const socialLinks = demoOnly && !configuredSocialLinks.length
		? ["Facebook", "YouTube", "Instagram", "LinkedIn"].map((label) => ({ label, href: "" }))
		: configuredSocialLinks;
	const appBadges = [
		{ label: "App Store", hint: "Download on", Icon: FaApple, href: safeLink(content.app_store_url) },
		{ label: "Google Play", hint: "Available on", Icon: FaGooglePlay, href: safeLink(content.google_play_url) },
	].map((app) => ({ ...app, href: /^https?:\/\//i.test(app.href) ? app.href : "" }));
	const hasAppLinks = appBadges.some(({ href }) => href);
	const topStrip = text(data.top_strip) || "auto";
	const useAppStrip = topStrip === "mobile_app"
		|| (topStrip === "auto" && (hasAppLinks || (demoOnly && !configuredAccreditations.length)));
	const showDemoAccreditations = demoOnly && topStrip === "accreditations" && !configuredAccreditations.length;
	const accreditations = showDemoAccreditations ? readItems(demoAccreditations, host) : configuredAccreditations;
	const accreditationDescription = text(content.accreditations_description)
		|| (showDemoAccreditations ? "Business details, supplier information, and product support." : "");

	return (
		<footer data-storefront-section="fashion-apparel-footer-medical" className="bg-[#17283f] text-white">
			{useAppStrip && (hasAppLinks || demoOnly) && (
				<section aria-label="Mobile app" className="border-b border-white/10 bg-slate-950/35">
					<div className="container mx-auto flex flex-col gap-4 px-5 py-6 sm:px-8 md:flex-row md:items-center md:justify-between">
						<div className="flex items-start gap-3">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-rose-300">
								<Smartphone aria-hidden="true" className="size-5" />
							</span>
							<div className="min-w-0">
								<h2 className="break-words text-lg font-semibold">{text(content.app_heading) || "Download the Mobile App"}</h2>
								<p className="text-sm text-slate-300!">{text(content.app_description) || "Browse the store and manage orders from your phone."}</p>
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							{appBadges.map(({ label, hint, Icon, href }) => {
								const badgeClass = "inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-white/15 bg-slate-950 px-4 py-1.5 text-left text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
								const badge = (
									<><Icon aria-hidden="true" className="size-4 shrink-0" /><span className="text-xs font-semibold"><span className="block text-[10px] font-normal text-slate-300">{hint}</span>{label}</span></>
								);
								if (href) {
									return <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={badgeClass}>{badge}</a>;
								}
								return demoOnly ? (
									<button key={label} type="button" className={badgeClass} onClick={() => showPreviewLinkNotice(label)}>
										{badge}
									</button>
								) : null;
							})}
						</div>
					</div>
				</section>
			)}
			{!useAppStrip && topStrip !== "none" && accreditations.length > 0 && (
				<section aria-label="Accreditations and partners" className="border-b border-white/10 bg-slate-950/25">
					<div className="container mx-auto px-5 py-6 text-center sm:px-8">
						<h2 className="break-words text-xs font-semibold tracking-wider text-slate-200 uppercase">{text(content.accreditations_heading) || "Accreditations & Partners"}</h2>
						{accreditationDescription && (
							<p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-slate-300!">{accreditationDescription}</p>
						)}
						<ul className="mt-4 flex flex-wrap justify-center gap-3">
							{accreditations.map(({ label, description: note, image, href }, index) => {
								const Icon = showDemoAccreditations ? demoAccreditationIcons[index] ?? BadgeCheck : BadgeCheck;
								return (
									<li key={`${label}-${index}`} className="flex min-w-0 max-w-full items-center gap-2.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left">
										<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-slate-100">
											<FooterImage src={image} width={28} height={28} className="max-h-7 max-w-7 object-contain" fallback={<Icon aria-hidden="true" className="size-4" />} />
										</span>
										<div className="min-w-0">
											{href ? <Link href={href} className={`text-xs font-semibold ${linkClass}`}>{label}</Link> : <span className="block break-words text-xs font-semibold">{label}</span>}
											{note && <span className="mt-0.5 block break-words text-xs leading-snug text-slate-300">{note}</span>}
										</div>
									</li>
								);
							})}
						</ul>
					</div>
				</section>
			)}

			<div className="container mx-auto px-5 sm:px-8">
				<div className="grid gap-x-8 gap-y-9 py-10 md:grid-cols-2 lg:grid-cols-4 lg:py-12">
					<div className="min-w-0">
						<h2 className={`break-words ${sectionHeading}`}>{heading}</h2>
						{logo && (
							<Link href="/" aria-label={`${brandName} home`} className="mt-4 inline-block max-w-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
								<FooterImage src={logo} width={144} height={44} className="h-11 w-auto max-w-full rounded-md bg-white p-1 object-contain" fallback={<span className="break-words text-sm font-semibold">{brandName}</span>} />
							</Link>
						)}
						{description && <p className="mt-3 break-words text-sm leading-relaxed text-slate-300!">{description}</p>}
						{(address || phone || email || hours) && (
							<address className="mt-4 grid gap-2.5 break-words text-sm leading-relaxed text-slate-300 not-italic">
								{address && <span className="flex gap-2.5"><MapPin aria-hidden="true" className={contactIcon} /><span className="min-w-0 whitespace-pre-line">{address}</span></span>}
								{(phone || demoOnly) && <span className="flex gap-2.5"><Phone aria-hidden="true" className={contactIcon} />{phoneHref ? <a href={phoneHref} className={linkClass}>{phone}</a> : <span>{phone || "+1 202-555-0143"}</span>}</span>}
								{(email || demoOnly) && <span className="flex gap-2.5"><Mail aria-hidden="true" className={contactIcon} />{contactEmailHref ? <a href={contactEmailHref} className={`min-w-0 ${linkClass}`}>{email}</a> : <span className="min-w-0">{email || "help@store.example"}</span>}</span>}
								{hours && <span className="flex gap-2.5"><Clock aria-hidden="true" className={contactIcon} /><span className="min-w-0">{hours}</span></span>}
							</address>
						)}
						{socialLinks.length > 0 && (
							<div className="mt-5">
								<h3 className="text-xs font-semibold tracking-wide text-slate-200 uppercase">Follow us</h3>
								<ul aria-label="Social media" className="mt-2 flex flex-wrap gap-2">
									{socialLinks.map(({ label, href }) => {
										const Icon = socialIcons[label as keyof typeof socialIcons];
										const icon = Icon ? <Icon aria-hidden="true" className="size-3.5" /> : label;
										const iconClass = "flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/5 px-2 text-xs hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
										return (
											<li key={label}>
												{href ? (
													<a href={href} aria-label={label} target="_blank" rel="noopener noreferrer" className={iconClass}>{icon}</a>
												) : (
													<button type="button" aria-label={label} className={iconClass} onClick={() => showPreviewLinkNotice(label)}>
														{icon}
													</button>
												)}
											</li>
										);
									})}
								</ul>
							</div>
						)}
					</div>

					<FooterMenu title="Quick Links" links={quickLinks} className="lg:col-start-2" />
					<FooterMenu title="Information & Policies" links={policyLinks} className="lg:col-start-3" />

					<div className="min-w-0 lg:col-start-4">
						<h2 className={`break-words ${sectionHeading}`}>{newsletterHeading}</h2>
						<p className="mt-3 text-sm leading-relaxed text-slate-300!">{newsletterDescription}</p>
						<form onSubmit={subscription.handleSubmit} className="mt-4 flex flex-wrap gap-2">
							<label htmlFor={emailId} className="sr-only">Email address</label>
							<input id={emailId} type="email" required maxLength={255} autoComplete="email" value={subscription.email} onChange={(event) => subscription.setEmail(event.target.value)} placeholder={emailPlaceholder} className="min-h-11 min-w-0 flex-[1_1_9rem] rounded-lg border border-white/30 bg-white/5 px-3 text-base text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:text-sm" />
							<button type="submit" disabled={subscription.isSubmitting} className="min-h-11 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-70">
								{subscription.isSubmitting ? "Subscribing…" : "Subscribe"}
							</button>
						</form>
					</div>
				</div>
			</div>

			{(payments.length > 0 || securityNote) && (
				<div className="border-t border-white/10 bg-slate-950/20">
					<div className="container mx-auto flex flex-col items-center gap-3 px-5 py-4 text-center sm:px-8 md:flex-row md:justify-between md:text-left">
						{payments.length > 0 && (
							<div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
								<h2 className="mr-2 text-xs font-semibold tracking-wide text-slate-200 uppercase">We accept</h2>
								<ul aria-label="Accepted payment methods" className="flex flex-wrap justify-center gap-2">
									{payments.map(({ label, image }, index) => (
										<li key={`${label}-${index}`} aria-label={label} className="flex min-h-8 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-900">
											<FooterImage src={image} width={40} height={20} className="h-5 w-10 object-contain" fallback={<span>{label}</span>} />
										</li>
									))}
								</ul>
							</div>
						)}
						{securityNote && (
							<div className="flex items-center gap-2 text-xs font-medium text-emerald-200 md:ml-auto">
								<ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
								<span>{securityNote}</span>
							</div>
						)}
					</div>
				</div>
			)}

			<div className="border-t border-white/10">
				<div className="container mx-auto flex flex-col items-center gap-4 px-5 py-4 text-center text-xs leading-relaxed text-slate-300 sm:px-8 md:flex-row md:justify-between md:text-left">
					<div>
						<span>{copyright}</span>
						{legalNote && <span className="mt-1 block">{legalNote}</span>}
					</div>
					<div className="flex flex-wrap items-center justify-center gap-4">
						{legalLinks.length > 0 && (
							<nav aria-label="Legal links">
								<ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
									{legalLinks.map(({ label, href }) => <li key={`${label}-${href}`}><Link href={href} className={linkClass}>{label}</Link></li>)}
								</ul>
							</nav>
						)}
						<button type="button" onClick={scrollToTop} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
							Back to top <ArrowUp aria-hidden="true" className="size-4" />
						</button>
					</div>
				</div>
			</div>
		</footer>
	);
}

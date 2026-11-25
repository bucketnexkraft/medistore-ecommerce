"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FashionSectionProps } from "../../types";
import { useFooterData } from "./use-footer-data";
import { useFooterSubscription } from "./use-footer-subscription";

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

export default function FooterDefault(props: FashionSectionProps) {
	const { brandName, logoUrl, heading, description, newsletterTitle, newsletterDescription, newsletterPlaceholder, copyright, columns, socialLinks } = useFooterData(props);
	const { email, setEmail, isSubmitting, handleSubmit } = useFooterSubscription(props.host);

	return (
		<footer data-storefront-section="fashion-apparel-footer-default" className="bg-primary-black py-14 text-white md:py-20">
			<div className="container mx-auto px-6 lg:px-8">
				<div className="grid gap-12 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)] xl:gap-20">
					<div>
						<div className="mb-10 flex flex-col gap-5 border-b border-white/15 pb-10 sm:flex-row sm:items-start sm:justify-between">
							<div className="max-w-xl">
								<Link href="/" className="inline-flex items-center" aria-label={`${brandName} home`}>
									<FooterLogo key={logoUrl || "fallback-logo"} src={logoUrl} alt={`${brandName} logo`} fallbackLabel={brandName} />
								</Link>
								<h2 className="mt-6 text-2xl font-bold md:text-3xl">{heading}</h2>
								{description ? <p className="mt-3 max-w-lg text-sm leading-6 !text-inherit md:text-base">{description}</p> : null}
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

					<div className="rounded-3xl md:p-9">
						<h2 className="text-2xl font-bold leading-tight md:text-3xl">{newsletterTitle}</h2>
						<p className="mt-3 text-sm leading-6 !text-inherit">{newsletterDescription}</p>
						<form onSubmit={handleSubmit} className="mt-7">
							<label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
							<div className="relative">
								<input id="footer-newsletter-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={newsletterPlaceholder} className="h-14 w-full rounded-xl bg-gray-100 px-4 pr-14 text-gray-900 outline-none ring-0 placeholder:text-gray-500 focus:ring-2 focus:ring-primary-black" />
								<button type="submit" disabled={isSubmitting} aria-label="Subscribe" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-900 transition hover:text-theme-coral enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"><ArrowRight className="size-6" /></button>
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

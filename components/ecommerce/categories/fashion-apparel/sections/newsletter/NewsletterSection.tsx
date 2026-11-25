"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import type { FashionSectionProps } from "../../types";

const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const textValue = (value: unknown, fallback: string) => {
	const text = typeof value === "string" ? value.trim() : "";
	return text || fallback;
};

export default function NewsletterSection({ section, host, demoOnly, index }: FashionSectionProps) {
	const content = asRecord(section.content);
	const heading = textValue(content.heading ?? section.title, "Subscribe to Our Newsletter");
	const description = textValue(content.description ?? section.subtitle, "Get the latest updates on new products, health tips, and exclusive offers delivered straight to your inbox.");
	const placeholder = textValue(content.placeholder, "Enter your email address");
	const buttonLabel = textValue(content.button_label, "Subscribe");
	const privacyNote = textValue(content.privacy_note, "We respect your privacy. Unsubscribe at any time.");
	const emailInputId = `fashion-newsletter-email-${index}`;
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail || isSubmitting) return;
		if (demoOnly) {
			toast({ title: "Demo preview", description: "Newsletter subscriptions are disabled in preview." });
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await apiFetch("/landing/newsletter/subscribe", {
				method: "POST",
				headers: getAuthHeaders(),
				body: JSON.stringify({ email: normalizedEmail }),
			}, host);
			const payload = await response.json().catch(() => null);
			if (!response.ok || payload?.status !== true) throw new Error(extractApiError(payload, "Newsletter subscription failed."));
			setEmail("");
			toast({ title: "Subscribed", description: "This email has been added to the newsletter list." });
		} catch (error) {
			toast({ title: "Subscription failed", description: error instanceof Error ? error.message : "Newsletter subscription failed." });
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section data-storefront-section="fashion-apparel-newsletter-subscribe" aria-labelledby="fashion-newsletter-heading" className="bg-gradient-to-br from-[#254d78] via-[#2d5d8d] to-[#1e4168] px-5 py-14 text-center text-white sm:px-8 md:py-20">
			<div className="mx-auto max-w-3xl">
				<div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/10 md:size-20">
					<Mail aria-hidden="true" className="size-8 md:size-9" />
				</div>
				<h2 id="fashion-newsletter-heading" className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{heading}</h2>
				<p className="mx-auto mt-4 max-w-2xl text-base leading-7 !text-white/85 sm:text-lg">{description}</p>
				<form onSubmit={handleSubmit} className="mx-auto mt-8 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
					<label htmlFor={emailInputId} className="sr-only">Email address</label>
					<input id={emailInputId} type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={placeholder} className="h-14 min-w-0 flex-1 rounded-xl border border-white/30 bg-white px-5 text-left text-base text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-white/70" />
					<button type="submit" disabled={isSubmitting} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-red-600 px-7 text-base font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#254d78] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-70">
						{isSubmitting ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : null}
						{isSubmitting ? "Subscribing…" : buttonLabel}
					</button>
				</form>
				<p className="mt-5 text-sm !text-white/75">{privacyNote}</p>
			</div>
		</section>
	);
}

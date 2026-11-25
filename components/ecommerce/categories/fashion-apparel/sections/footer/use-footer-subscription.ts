"use client";

import { useState, type FormEvent } from "react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { extractApiError, getAuthHeaders } from "@/lib/auth";

export function useFooterSubscription(host: string | null, demoOnly = false) {
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedEmail = email.trim().toLowerCase();
		if (!trimmedEmail || isSubmitting) return;
		if (demoOnly) {
			toast({ title: "Demo preview", description: "Newsletter subscriptions are disabled in preview." });
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

	return { email, setEmail, isSubmitting, handleSubmit };
}

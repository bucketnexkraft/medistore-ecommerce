"use client";

import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import { normalizePreferencesData } from "@/lib/storefront-preferences";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type FloatingChatSupportProps = {
	chatSupportChannel?: string | null;
	facebookPageId?: string | null;
	whatsappNumber?: string | null;
};

function WhatsappIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
			<path d="M19.05 4.94A9.88 9.88 0 0 0 12.02 2C6.55 2 2.1 6.44 2.1 11.92c0 1.75.46 3.46 1.33 4.96L2 22l5.28-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.47 0 9.91-4.45 9.91-9.92a9.84 9.84 0 0 0-2.89-6.97Zm-7.03 15.2h-.01a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3.13.82.84-3.05-.2-.31a8.23 8.23 0 0 1-1.27-4.35c0-4.56 3.71-8.27 8.28-8.27a8.2 8.2 0 0 1 5.86 2.43 8.2 8.2 0 0 1 2.42 5.85c0 4.57-3.71 8.28-8.26 8.28Zm4.54-6.2c-.25-.12-1.49-.73-1.72-.82-.23-.08-.4-.12-.57.13-.16.24-.65.81-.79.97-.15.16-.3.18-.55.06-.25-.13-1.04-.38-1.98-1.22-.73-.65-1.22-1.45-1.36-1.69-.14-.24-.02-.37.1-.49.11-.11.25-.3.37-.45.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.57-1.37-.78-1.88-.21-.5-.42-.43-.57-.44h-.49c-.16 0-.42.06-.65.3-.22.24-.86.84-.86 2.05s.88 2.39 1 2.55c.12.16 1.73 2.64 4.19 3.7.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.49-.61 1.69-1.2.21-.6.21-1.11.14-1.21-.06-.1-.23-.17-.48-.3Z" />
		</svg>
	);
}

function MessengerIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
			<path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.92 1.46 5.53 3.74 7.23V22l3.22-1.78c.97.27 1.99.42 3.04.42 5.52 0 10-4.15 10-9.27S17.52 2 12 2Zm1.01 12.46-2.54-2.71-4.95 2.71 5.45-5.79 2.6 2.71 4.88-2.71-5.44 5.79Z" />
		</svg>
	);
}

function normalizeWhatsappUrl(value: string) {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	const digits = trimmed.replace(/[^\d]/g, "");
	return digits ? `https://wa.me/${digits}` : null;
}

function normalizeFacebookUrl(value: string) {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	if (/^\d+$/.test(trimmed)) {
		return `https://m.me/${trimmed}`;
	}

	return `https://m.me/${trimmed.replace(/^@/, "")}`;
}

export function FloatingChatSupport({
	chatSupportChannel,
	facebookPageId,
	whatsappNumber,
}: FloatingChatSupportProps) {
	const pathname = usePathname();
	const initialSupportState = {
		chatSupportChannel: String(chatSupportChannel || "").trim(),
		facebookPageId: String(facebookPageId || "").trim(),
		whatsappNumber: String(whatsappNumber || "").trim(),
	};
	const [supportState, setSupportState] = useState({
		chatSupportChannel: initialSupportState.chatSupportChannel,
		facebookPageId: initialSupportState.facebookPageId,
		whatsappNumber: initialSupportState.whatsappNumber,
	});

	useEffect(() => {
		let ignore = false;

		const loadPreferences = async () => {
			try {
				const payload = await fetchStorefrontJson<{ data?: unknown }>("/landing/preferences");
				const preferences = normalizePreferencesData(payload?.data);

				if (!preferences || ignore) {
					return;
				}

				setSupportState({
					chatSupportChannel: String(preferences.chat_support_channel ?? "").trim(),
					facebookPageId: String(preferences.facebook_page_id ?? "").trim(),
					whatsappNumber: String(preferences.whatsapp_number ?? "").trim(),
				});
			} catch {
				return;
			}
		};

		void loadPreferences();

		return () => {
			ignore = true;
		};
	}, []);

	if (
		pathname.startsWith("/user-dashboard")
		|| pathname.startsWith("/checkout")
		|| pathname.startsWith("/login")
		|| pathname.startsWith("/register")
		|| pathname.startsWith("/seller-dashboard")
		|| pathname.startsWith("/template-preview")
	) {
		return null;
	}

	const whatsappUrl = normalizeWhatsappUrl(supportState.whatsappNumber);
	const facebookUrl = normalizeFacebookUrl(supportState.facebookPageId);
	const preferredChannel = supportState.chatSupportChannel.toLowerCase();
	const actions = [
		whatsappUrl ? { id: "whatsapp", label: "WhatsApp", href: whatsappUrl } : null,
		facebookUrl ? { id: "facebook", label: "Messenger", href: facebookUrl } : null,
	].filter((item): item is { id: string; label: string; href: string } => item !== null);

	if (actions.length === 0) {
		return null;
	}

	const orderedActions = [...actions].sort((left, right) => {
		if (left.id === preferredChannel) return -1;
		if (right.id === preferredChannel) return 1;
		return 0;
	});

	return (
		<div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
			{orderedActions.map((action) => (
				<a
					key={action.id}
					href={action.href}
					target="_blank"
					rel="noreferrer"
					className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_16px_34px_rgba(15,23,42,0.22)] transition hover:-translate-y-1 ${
						action.id === "whatsapp"
							? "bg-[#25D366] hover:bg-[#20bd5c]"
							: "bg-[#0084FF] hover:bg-[#0072db]"
					}`}
					aria-label={`Open ${action.label}`}
					title={action.label}
				>
					{action.id === "whatsapp" ? <WhatsappIcon /> : <MessengerIcon />}
				</a>
			))}
		</div>
	);
}

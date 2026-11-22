"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import StorefrontPreloader from "@/components/common/StorefrontPreloader";
import { apiFetch } from "@/lib/api-client";

export default function StorefrontHomeRetry() {
	const router = useRouter();
	const [retryState, setRetryState] = useState<"checking" | "failed">("checking");

	const checkStorefront = useCallback(async () => {
		setRetryState("checking");

		try {
			const response = await apiFetch("/home?react=1", { cache: "no-store" });
			const payload = response.ok ? await response.json().catch(() => null) : null;

			if (response.ok && payload?.data) {
				router.refresh();
				return;
			}
		} catch {
			// Keep the recovery action available when the API is still warming up.
		}

		setRetryState("failed");
	}, [router]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void checkStorefront();
		}, 250);

		return () => window.clearTimeout(timer);
	}, [checkStorefront]);

	if (retryState === "checking") {
		return <StorefrontPreloader />;
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-[#f3f1f1] px-6">
			<section className="text-center">
				<p className="text-sm text-[#6b3e3e]">Storefront could not be loaded.</p>
				<button
					type="button"
					onClick={() => void checkStorefront()}
					className="mt-4 rounded-full border border-[#6b3e3e] bg-white px-5 py-2 text-sm font-medium text-[#6b3e3e] transition hover:bg-[#6b3e3e] hover:text-white"
				>
					Retry storefront
				</button>
			</section>
		</main>
	);
}

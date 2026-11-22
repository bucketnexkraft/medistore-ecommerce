"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, withPaymentScopeHeaders } from "@/lib/api-client";
import { clearCart } from "@/lib/cart";

interface OrderPaymentCallbackClientProps {
	trx: string;
	type: "success" | "cancel";
}

export function OrderPaymentCallbackClient({ trx, type }: OrderPaymentCallbackClientProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [message, setMessage] = useState(type === "success" ? "Confirming your payment..." : "Canceling your payment...");

	useEffect(() => {
		let cancelled = false;

		const handleCallback = async () => {
			try {
				const query = new URLSearchParams(searchParams.toString());
				const suffix = query.toString() ? `?${query.toString()}` : "";
				const response = await apiFetch(`/landing/order-payments/${encodeURIComponent(trx)}/${type}${suffix}`, {
					method: "GET",
					cache: "no-store",
					headers: withPaymentScopeHeaders(undefined, "ecommerce_order"),
				});
				const payload = await response.json().catch(() => null);

				if (!cancelled && response.ok && payload?.status === 1) {
					if (type === "success") {
						clearCart();
					}

					router.replace(String(payload?.data?.redirect_path || (type === "success" ? "/order-success" : "/payment-cancel")));
					return;
				}

				if (!cancelled) {
					setMessage(payload?.message || "We could not process the payment callback.");
					router.replace(String(payload?.data?.redirect_path || "/payment-failed"));
				}
			} catch {
				if (!cancelled) {
					setMessage("We could not process the payment callback.");
					router.replace("/payment-failed");
				}
			}
		};

		void handleCallback();

		return () => {
			cancelled = true;
		};
	}, [router, searchParams, trx, type]);

	return (
		<div className="section py-16">
			<div className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
				<h1 className="text-3xl font-bold text-primary-black">Please wait</h1>
				<p className="mt-4 text-base text-primary-body">{message}</p>
			</div>
		</div>
	);
}

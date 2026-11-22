import { CheckCircle2 } from "lucide-react";
import { ClearCartOnMount } from "@/components/checkout/payment-status/ClearCartOnMount";
import { PaymentStatusPage } from "@/components/checkout/payment-status/PaymentStatusPage";
import { PurchaseAnalytics } from "@/components/checkout/payment-status/PurchaseAnalytics";

interface OrderSuccessPageProps {
	searchParams?: Promise<{
		method?: string;
		orderId?: string;
	}>;
}

export default async function Page({ searchParams }: OrderSuccessPageProps) {
	const resolvedSearchParams = (await searchParams) || {};
	const isCod = String(resolvedSearchParams.method || "").toLowerCase() === "cod";
	const orderId = String(resolvedSearchParams.orderId || "").trim();
	const description = isCod
		? orderId
			? `Your COD order ${orderId} has been placed successfully. You can track it using the order number.`
			: "Your COD order has been placed successfully. You can track it using your order number."
		: orderId
			? `Your online payment for order ${orderId} was completed successfully. You can track it using the order number.`
			: "Your online payment was completed successfully and your order is now being processed.";

	const primaryHref = orderId ? `/track-order?orderId=${encodeURIComponent(orderId)}` : "/user-dashboard/orders";
	const primaryLabel = orderId ? "Track My Order" : "View My Orders";

	return (
		<>
			<PurchaseAnalytics orderId={orderId} />
			<ClearCartOnMount />
			<PaymentStatusPage
				title="Order confirmed"
				description={description}
				icon={<CheckCircle2 className="h-10 w-10 text-green-600" />}
				primaryHref={primaryHref}
				primaryLabel={primaryLabel}
				secondaryHref="/"
				secondaryLabel="Continue Shopping"
			/>
		</>
	);
}

import { XCircle } from "lucide-react";
import { PaymentStatusPage } from "@/components/checkout/payment-status/PaymentStatusPage";

export default function Page() {
	return (
		<PaymentStatusPage
			title="Payment failed"
			description="We could not confirm your online payment. Please try again with the same order from checkout or choose a different payment gateway."
			icon={<XCircle className="h-10 w-10 text-red-500" />}
			primaryHref="/checkout-one"
			primaryLabel="Try Checkout Again"
			secondaryHref="/cart"
			secondaryLabel="Back to Cart"
		/>
	);
}

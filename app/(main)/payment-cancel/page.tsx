import { CircleSlash2 } from "lucide-react";
import { PaymentStatusPage } from "@/components/checkout/payment-status/PaymentStatusPage";

export default function Page() {
	return (
		<PaymentStatusPage
			title="Payment canceled"
			description="You canceled the online payment before it was completed. No worries, your order was not finalized and you can return to checkout whenever you're ready."
			icon={<CircleSlash2 className="h-10 w-10 text-amber-500" />}
			primaryHref="/checkout-one"
			primaryLabel="Back to Checkout"
			secondaryHref="/cart"
			secondaryLabel="Review Cart"
		/>
	);
}

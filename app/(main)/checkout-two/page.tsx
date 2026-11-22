import { RequireAuth } from "@/components/auth/RequireAuth";
import CheckoutTwo from "@/components/checkout/checkout-two/CheckoutTwo";

export default function page() {
	return (
		<RequireAuth>
			<CheckoutTwo />
		</RequireAuth>
	);
}

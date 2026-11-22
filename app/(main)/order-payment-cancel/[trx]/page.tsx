import { OrderPaymentCallbackClient } from "@/components/checkout/payment-status/OrderPaymentCallbackClient";

export default async function Page({ params }: { params: Promise<{ trx: string }> }) {
	const { trx } = await params;

	return <OrderPaymentCallbackClient trx={trx} type="cancel" />;
}

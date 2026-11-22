"use client";

import Image from "next/image";
import { Landmark, Wallet } from "lucide-react";
import { BillingData, CheckoutGateway } from "@/data/checkout-data";
import { cn } from "@/lib/utils";
import type { BillingFieldErrors } from "./BuyerInformation";

interface BillingInformationProps {
	data: BillingData;
	errors?: BillingFieldErrors;
	gateways: CheckoutGateway[];
	isLoadingGateways: boolean;
	supportsPaymentGateway?: boolean;
	isCodAvailable?: boolean;
	codMessage?: string | null;
	onFieldChange?: (field: keyof BillingFieldErrors) => void;
	onChange: (data: BillingData) => void;
}

export function BillingInformation({
	data,
	errors,
	gateways,
	isLoadingGateways,
	supportsPaymentGateway = true,
	isCodAvailable = true,
	codMessage = null,
	onFieldChange,
	onChange,
}: BillingInformationProps) {
	const handleCashOnDelivery = () => {
		if (!isCodAvailable) {
			return;
		}

		onFieldChange?.("gatewayId");
		onChange({
			...data,
			paymentMethod: "cod",
			gatewayId: null,
		});
	};

	const handleGatewaySelect = (gatewayId: string) => {
		onFieldChange?.("gatewayId");
		onChange({
			...data,
			paymentMethod: "gateway",
			gatewayId,
		});
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<h2 className="text-xl font-bold">Billing Information</h2>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				<button
					type="button"
					onClick={handleCashOnDelivery}
					disabled={!isCodAvailable}
					className={cn(
						"rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
						data.paymentMethod === "cod" ? "border-primary-blue bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300",
					)}
				>
					<div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-primary-black">
						<Wallet size={18} />
					</div>
					<h6 className="font-medium">Cash on Delivery</h6>
					<p className="mt-1 text-sm text-primary-body">{isCodAvailable ? "Pay when your order arrives." : "Unavailable for the selected delivery area."}</p>
				</button>

				{supportsPaymentGateway ? (
					isLoadingGateways ? (
						<div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-primary-body">Loading payment gateways...</div>
					) : gateways.length > 0 ? (
						gateways.map((gateway) => {
							const isSelected = data.paymentMethod === "gateway" && data.gatewayId === gateway.id;

							return (
								<button
									key={gateway.id}
									type="button"
									onClick={() => handleGatewaySelect(gateway.id)}
									className={cn(
										"rounded-lg border p-4 text-left transition-colors",
										isSelected ? "border-primary-blue bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300",
									)}
								>
									<div className="mb-3 flex h-10 items-center">
										{gateway.image_url ? (
											<Image loader={({ src }) => src} unoptimized src={gateway.image_url} alt={gateway.name} width={40} height={40} className="h-10 w-auto object-contain" />
										) : (
											<div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-primary-black">
												<Landmark size={18} />
											</div>
										)}
									</div>
									<h6 className="font-medium">{gateway.name}</h6>
									<p className="mt-1 text-sm text-primary-body">
										{gateway.description?.trim() || `Pay online in ${gateway.currency_code.toUpperCase()}.`}
									</p>
								</button>
							);
						})
					) : (
						<div className="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-sm text-primary-body">
							No online payment gateways are available right now.
						</div>
					)
				) : null}
			</div>

			{data.paymentMethod === "cod" ? (
				<p className="mt-4 text-xs text-primary-body">COD orders are confirmed now and payment stays pending until delivery.</p>
			) : data.paymentMethod === "gateway" ? (
				<p className="mt-4 text-xs text-primary-body">You will be redirected to the selected payment gateway to complete your order.</p>
			) : null}
			{codMessage ? <p className="mt-2 text-xs text-amber-700">{codMessage}</p> : null}
			{errors?.gatewayId ? <p className="mt-3 text-sm text-rose-600">{errors.gatewayId}</p> : null}
		</div>
	);
}

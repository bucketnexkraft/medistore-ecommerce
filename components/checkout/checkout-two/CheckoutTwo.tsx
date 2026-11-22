"use client";

import { OrderSummary } from "../checkout-one/OrderSummary";
import { SavedBuyerInformation } from "./SavedBuyerInformation";

export default function CheckoutTwo() {
	const handleAddressSelect = (addressId: string) => {
		console.log("Selected address:", addressId);
	};

	const handleBillingSelect = (billingId: string) => {
		console.log("Selected billing:", billingId);
	};

	return (
		<div className="min-h-screen">
			<div className="section py-14">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 xl:px-12">
					{/* Left Column - Saved Information */}
					<div>
						<SavedBuyerInformation onAddressSelect={handleAddressSelect} onBillingSelect={handleBillingSelect} />
					</div>

					{/* Right Column - Order Summary */}
					<div>
						<OrderSummary />
					</div>
				</div>
			</div>
		</div>
	);
}

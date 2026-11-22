"use client";

import { useState } from "react";
import { savedAddresses, savedBillingMethods } from "@/data/checkout-data";

interface SavedBuyerInformationProps {
	onAddressSelect?: (addressId: string) => void;
	onBillingSelect?: (billingId: string) => void;
}

export function SavedBuyerInformation({ onAddressSelect, onBillingSelect }: SavedBuyerInformationProps) {
	const [selectedAddress, setSelectedAddress] = useState(savedAddresses[0].id);
	const [selectedBilling, setSelectedBilling] = useState(savedBillingMethods[0].id);

	const handleAddressSelect = (id: string) => {
		setSelectedAddress(id);
		onAddressSelect?.(id);
	};

	const handleBillingSelect = (id: string) => {
		setSelectedBilling(id);
		onBillingSelect?.(id);
	};

	const handleChangeAddress = (id: string) => {
		console.log("Change address:", id);
	};

	const handleChangeMethod = (id: string) => {
		console.log("Change method:", id);
	};

	return (
		<div className="space-y-12 bg-white rounded-lg p-6">
			{/* Shipping Information */}
			<div className="">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-2xl font-bold">Shipping Information</h2>
					<button className="text-primary-blue bg-zinc-100 px-2.5 py-1.5 rounded-md text-sm font-semibold cursor-pointer">Add new address</button>
				</div>

				<div className="">
					{savedAddresses.map((address) => (
						<div key={address.id} className="p-4 hover:border-gray-300 transition-colors">
							<div className="flex items-start gap-4">
								<input
									type="radio"
									name="address"
									id={`address-${address.id}`}
									checked={selectedAddress === address.id}
									onChange={() => handleAddressSelect(address.id)}
									className="w-4 h-4 text-purple-600 mt-1.5 shrink-0 cursor-pointer"
								/>
								<div className="flex-1 min-w-0">
									<label htmlFor={`address-${address.id}`} className="font-bold cursor-pointer">
										{address.label}
									</label>
									<p className="italic text-sm mt-1">{address.street}</p>
									<p className="italic text-sm">{address.city}</p>
								</div>
								<button
									onClick={() => handleChangeAddress(address.id)}
									className=" hover:text-primary-blue cursor-pointer italic text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
								>
									Change address
								</button>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Billing Information */}
			<div className="">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-2xl font-bold text-gray-900">Billing Information</h2>
					<button className="text-primary-blue bg-zinc-100 px-2.5 py-1.5 rounded-md text-sm font-semibold cursor-pointer">Add new method</button>
				</div>

				<div className="">
					{savedBillingMethods.map((method) => (
						<div key={method.id} className="p-4">
							<div className="flex items-start gap-4">
								<input
									type="radio"
									name="billing"
									id={`billing-${method.id}`}
									checked={selectedBilling === method.id}
									onChange={() => handleBillingSelect(method.id)}
									className="w-4 h-4 text-purple-600 mt-1.5 shrink-0 cursor-pointer"
								/>
								<div className="flex-1 min-w-0">
									<label htmlFor={`billing-${method.id}`} className="font-bold cursor-pointer">
										{method.label}
									</label>
									<p className="italic text-sm mt-1">{method.cardNumber}</p>
									<p className="italic text-sm">{method.expiryDate}</p>
								</div>
								<button
									onClick={() => handleChangeMethod(method.id)}
									className="hover:text-primary-blue text-xs font-medium italic cursor-pointer whitespace-nowrap shrink-0 transition-colors"
								>
									Change method
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

import { SavedShippingAddress, ShippingFormData } from "@/data/checkout-data";
import type { CheckoutDeliverySelection } from "@/data/checkout-data";
import type { CheckoutDivisionOption, CheckoutDistrictOption, CheckoutUpazilaOption } from "@/lib/checkout-delivery";
import { cn } from "@/lib/utils";
import type { ShippingFieldErrors } from "./BuyerInformation";
import { PhoneNumberInput } from "./PhoneNumberInput";

interface ShippingInformationProps {
	data: ShippingFormData;
	errors?: ShippingFieldErrors;
	isAuthenticated?: boolean;
	supportsLocationDelivery?: boolean;
	selectedSavedAddress: SavedShippingAddress | null;
	savedAddresses: SavedShippingAddress[];
	isLoadingSavedAddresses: boolean;
	useDifferentShippingAddress: boolean;
	deliverySelection: CheckoutDeliverySelection;
	isLoadingDeliverySettings: boolean;
	divisions: CheckoutDivisionOption[];
	districts: CheckoutDistrictOption[];
	upazilas: CheckoutUpazilaOption[];
	selectedDivisionId: string;
	selectedDistrictId: string;
	selectedUpazilaId: string;
	onSelectSavedAddress: (address: SavedShippingAddress) => void;
	onToggleDifferentShippingAddress: (checked: boolean) => void;
	onDivisionChange: (divisionId: string) => void;
	onDistrictChange: (districtId: string) => void;
	onUpazilaChange: (upazilaId: string) => void;
	onFieldChange?: (field: keyof ShippingFormData) => void;
	onChange: (data: ShippingFormData) => void;
}

export function ShippingInformation({
	data,
	errors,
	isAuthenticated = false,
	supportsLocationDelivery = true,
	selectedSavedAddress,
	savedAddresses,
	isLoadingSavedAddresses,
	useDifferentShippingAddress,
	deliverySelection,
	isLoadingDeliverySettings,
	divisions,
	districts,
	upazilas,
	selectedDivisionId,
	selectedDistrictId,
	selectedUpazilaId,
	onSelectSavedAddress,
	onToggleDifferentShippingAddress,
	onDivisionChange,
	onDistrictChange,
	onUpazilaChange,
	onFieldChange,
	onChange,
}: ShippingInformationProps) {
	const handleChange = (field: keyof ShippingFormData, value: string) => {
		onFieldChange?.(field);
		onChange({ ...data, [field]: value });
	};

	const getInputClassName = (field: keyof ShippingFormData) =>
		cn(
			"w-full rounded-lg border bg-white px-4 py-3 text-primary-black placeholder:text-transparent focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent",
			errors?.[field] ? "border-rose-400 bg-rose-50/60" : "border-gray-200",
		);

	const shouldShowForm = useDifferentShippingAddress || !isAuthenticated || (!isLoadingSavedAddresses && savedAddresses.length === 0);
	const hasLocationOptions = divisions.length > 0 || districts.length > 0 || upazilas.length > 0;
	const showLocationDelivery = supportsLocationDelivery && (hasLocationOptions || isLoadingDeliverySettings);
	const availableDistricts = districts.filter((item) => !selectedDivisionId || item.divisionId === selectedDivisionId);
	const availableUpazilas = upazilas.filter((item) => item.districtId === selectedDistrictId);

	return (
		<div className=" ">
			<div className="flex items-center justify-between mb-12">
				<h2 className="text-xl font-bold">Shipping Information</h2>
			</div>

			<div className="space-y-4">
				{isAuthenticated ? (
					<div className="rounded-lg border border-gray-200 overflow-hidden">
						<div className="border-b border-gray-200 bg-zinc-50 px-4 py-3">
							<h3 className="text-sm font-semibold text-primary-black">Profile Shipping Address</h3>
						</div>
						{isLoadingSavedAddresses ? (
							<div className="px-4 py-5 text-sm text-primary-body">Loading saved addresses...</div>
						) : savedAddresses.length > 0 && selectedSavedAddress ? (
							<div className="space-y-4 px-4 py-4">
								<div className="rounded-lg border border-gray-200 bg-white p-4">
									<p className="font-semibold text-primary-black">{selectedSavedAddress.full_name}</p>
									<p className="mt-1 text-sm text-primary-body">{selectedSavedAddress.email || "No email added"}</p>
									<p className="mt-1 text-sm text-primary-black">{selectedSavedAddress.phone}</p>
									<p className="mt-2 text-sm text-primary-body">
										{selectedSavedAddress.address}, {selectedSavedAddress.city}
										{selectedSavedAddress.postal_code ? `, ${selectedSavedAddress.postal_code}` : ""}
									</p>
								</div>
								{savedAddresses.length > 1 ? (
									<select
										value={selectedSavedAddress.id}
										onChange={(event) => {
											const nextAddress = savedAddresses.find((address) => address.id === event.target.value);
											if (nextAddress) {
												onSelectSavedAddress(nextAddress);
											}
										}}
										className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-primary-black focus:outline-none focus:ring-2 focus:ring-purple-600"
									>
										{savedAddresses.map((address) => (
											<option key={address.id} value={address.id}>
												{address.full_name} - {address.address}
											</option>
										))}
									</select>
								) : null}
								<label className="flex items-center gap-3 text-sm text-primary-black">
									<input
										type="checkbox"
										checked={useDifferentShippingAddress}
										onChange={(event) => onToggleDifferentShippingAddress(event.target.checked)}
										className="h-4 w-4 rounded border-gray-300"
									/>
									<span>Use a different shipping address</span>
								</label>
							</div>
						) : null}
					</div>
				) : null}

				{shouldShowForm ? (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2">First Name</label>
								<input
									type="text"
									value={data.firstName}
									onChange={(e) => handleChange("firstName", e.target.value)}
									className={getInputClassName("firstName")}
								/>
								{errors?.firstName ? <p className="mt-2 text-sm text-rose-600">{errors.firstName}</p> : null}
							</div>
							<div>
								<label className="block text-sm  font-medium mb-2">Last Name</label>
								<input
									type="text"
									value={data.lastName}
									onChange={(e) => handleChange("lastName", e.target.value)}
									className={getInputClassName("lastName")}
								/>
								{errors?.lastName ? <p className="mt-2 text-sm text-rose-600">{errors.lastName}</p> : null}
							</div>
						</div>

						<div>
							<label className="block text-sm  font-medium mb-2">Email</label>
								<input
									type="email"
									value={data.email}
									onChange={(e) => handleChange("email", e.target.value)}
									className={getInputClassName("email")}
								/>
							{errors?.email ? <p className="mt-2 text-sm text-rose-600">{errors.email}</p> : null}
						</div>

						<div>
							<label className="block text-sm  font-medium mb-2">Phone Number</label>
							<PhoneNumberInput
								value={data.phone}
								onChange={(nextPhone) => handleChange("phone", nextPhone)}
								error={errors?.phone}
							/>
							{errors?.phone ? <p className="mt-2 text-sm text-rose-600">{errors.phone}</p> : null}
						</div>

						<div>
							<label className="block text-sm  font-medium mb-2">Address</label>
								<input
									type="text"
									value={data.address}
									onChange={(e) => handleChange("address", e.target.value)}
									className={getInputClassName("address")}
								/>
							{errors?.address ? <p className="mt-2 text-sm text-rose-600">{errors.address}</p> : null}
						</div>

						{showLocationDelivery ? (
							<>
								<div className="rounded-lg border border-gray-200 bg-zinc-50 p-4">
									<div className="mb-3 flex items-start justify-between gap-4">
										<div>
											<h3 className="font-semibold text-primary-black">Delivery area</h3>
											<p className="mt-1 text-sm text-primary-body">Delivery charge and COD availability are pulled from this company&apos;s shipping setup.</p>
										</div>
										{isLoadingDeliverySettings ? <span className="text-xs text-primary-body">Loading...</span> : null}
									</div>
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
										<div>
											<label className="mb-2 block text-sm font-medium">Zone</label>
											<select
												value={selectedDivisionId}
												onChange={(event) => onDivisionChange(event.target.value)}
												className={getInputClassName("city")}
											>
												<option value="">Select zone</option>
												{divisions.map((division) => (
													<option key={division.id} value={division.id}>
														{division.name}
													</option>
												))}
											</select>
										</div>
										<div>
											<label className="mb-2 block text-sm font-medium">District</label>
											<select
												value={selectedDistrictId}
												onChange={(event) => onDistrictChange(event.target.value)}
												className={getInputClassName("city")}
												disabled={!selectedDivisionId}
											>
													<option value="">{selectedDivisionId ? "Select district" : "Select zone first"}</option>
												{availableDistricts.map((district) => (
													<option key={district.id} value={district.id}>
														{district.name}
													</option>
												))}
											</select>
											{errors?.city ? <p className="mt-2 text-sm text-rose-600">{errors.city}</p> : null}
										</div>
										<div>
											<label className="mb-2 block text-sm font-medium">Thana / Upazila</label>
											<select
												value={selectedUpazilaId}
												onChange={(event) => onUpazilaChange(event.target.value)}
												className={getInputClassName("city")}
												disabled={!selectedDistrictId}
											>
												<option value="">{selectedDistrictId ? "Select thana / upazila" : "Select district first"}</option>
												{availableUpazilas.map((upazila) => (
													<option key={upazila.id} value={upazila.id}>
														{upazila.name}
													</option>
												))}
											</select>
										</div>
									</div>
									<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
										<div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
																		<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Zone</p>
											<p className="mt-2 font-medium text-primary-black">{deliverySelection.divisionName || "Not selected"}</p>
										</div>
										<div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
											<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Delivery charge</p>
											<p className="mt-2 font-medium text-primary-black">
												{deliverySelection.charge !== null ? deliverySelection.charge : "Calculated from company setup"}
											</p>
										</div>
										<div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
											<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-body">Cash on delivery</p>
											<p className="mt-2 font-medium text-primary-black">{deliverySelection.codAvailable ? "Available" : "Unavailable"}</p>
										</div>
									</div>
								</div>

								<div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-primary-body">
									Location is taken from the selected delivery area above.
								</div>
							</>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm  font-medium mb-2">City</label>
									<input
										type="text"
										value={data.city}
										onChange={(e) => handleChange("city", e.target.value)}
										className={getInputClassName("city")}
									/>
									{errors?.city ? <p className="mt-2 text-sm text-rose-600">{errors.city}</p> : null}
								</div>
								<div>
									<label className="block text-sm  font-medium mb-2">Postal Code</label>
									<input
										type="text"
										value={data.postalCode}
										onChange={(e) => handleChange("postalCode", e.target.value)}
										className={getInputClassName("postalCode")}
									/>
									{errors?.postalCode ? <p className="mt-2 text-sm text-rose-600">{errors.postalCode}</p> : null}
								</div>
							</div>
						)}
					</>
				) : null}
			</div>
		</div>
	);
}

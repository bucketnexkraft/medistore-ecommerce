import { useEffect, useMemo, useState } from "react";
import { BillingData, CheckoutDeliverySelection, CheckoutGateway, SavedShippingAddress, ShippingFormData } from "@/data/checkout-data";
import { getAuthHeaders, readStoredAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { resolveCheckoutDeliverySelection, useBangladeshGeoLocations, useCheckoutDeliverySettings } from "@/lib/checkout-delivery";
import { ShippingInformation } from "./ShippingInformation";
import { BillingInformation } from "./BillingInformation";

export type ShippingFieldErrors = Partial<Record<keyof ShippingFormData, string>>;
export type BillingFieldErrors = {
	gatewayId?: string;
};

interface BuyerInformationProps {
	onDataChange: (data: { shipping: ShippingFormData; billing: BillingData; delivery: CheckoutDeliverySelection }) => void;
	gateways: CheckoutGateway[];
	isLoadingGateways: boolean;
	defaultPaymentMethod?: BillingData["paymentMethod"];
	supportsPaymentGateway?: boolean;
	supportsLocationDelivery?: boolean;
	isAuthenticated?: boolean;
	shippingErrors?: ShippingFieldErrors;
	billingErrors?: BillingFieldErrors;
	onShippingFieldChange?: (field: keyof ShippingFormData) => void;
	onBillingFieldChange?: (field: keyof BillingFieldErrors) => void;
}

export function BuyerInformation({
	onDataChange,
	gateways,
	isLoadingGateways,
	defaultPaymentMethod = "cod",
	supportsPaymentGateway = true,
	supportsLocationDelivery = true,
	isAuthenticated = false,
	shippingErrors,
	billingErrors,
	onShippingFieldChange,
	onBillingFieldChange,
}: BuyerInformationProps) {
	const [shippingData, setShippingData] = useState<ShippingFormData>({
		firstName: "",
		lastName: "",
		email: "",
		phone: "",
		address: "",
		city: "",
		country: "Bangladesh",
		postalCode: "",
	});

	const [billingData, setBillingData] = useState<BillingData>({
		paymentMethod: defaultPaymentMethod,
		gatewayId: null,
		creditCard: {
			cardNumber: "",
			nameOnCard: "",
			expiryDate: "",
			securityCode: "",
		},
	});
	const [savedAddresses, setSavedAddresses] = useState<SavedShippingAddress[]>([]);
	const [isLoadingSavedAddresses, setIsLoadingSavedAddresses] = useState(true);
	const [selectedSavedAddress, setSelectedSavedAddress] = useState<SavedShippingAddress | null>(null);
	const [useDifferentShippingAddress, setUseDifferentShippingAddress] = useState(false);
	const [selectedDivisionId, setSelectedDivisionId] = useState("");
	const [selectedDistrictId, setSelectedDistrictId] = useState("");
	const [selectedUpazilaId, setSelectedUpazilaId] = useState("");
	const { settings: deliverySettings, isLoading: isLoadingDeliverySettings } = useCheckoutDeliverySettings(true);
	const locationDeliveryEnabled = billingData.paymentMethod === "cod"
		|| (supportsLocationDelivery && deliverySettings.deliveryChargeMode !== "free");
	const { divisions, districts, upazilas, isLoading: isLoadingGeoLocations } = useBangladeshGeoLocations(
		selectedDivisionId,
		selectedDistrictId,
		locationDeliveryEnabled,
	);

	const deliverySelection = useMemo<CheckoutDeliverySelection>(
		() => {
			const selectedDistrict = districts.find((item) => item.id === selectedDistrictId) || null;
			const selectedUpazila = upazilas.find((item) => item.id === selectedUpazilaId) || null;
			const selectedDivision = divisions.find((item) => item.id === selectedDivisionId) || null;
			const resolvedSelection = resolveCheckoutDeliverySelection(
				deliverySettings,
				selectedDistrictId,
				selectedUpazilaId,
				selectedDistrict?.name || "",
				selectedUpazila?.name || "",
				selectedDivisionId,
				selectedDivision?.name || "",
			);

			return {
				...resolvedSelection,
				divisionId: selectedDivision?.id || selectedDivisionId,
				divisionName: selectedDivision?.name || "",
				districtId: selectedDistrict?.id || resolvedSelection.districtId,
				districtName: selectedDistrict?.name || resolvedSelection.districtName,
				upazilaId: selectedUpazila?.id || resolvedSelection.upazilaId,
				upazilaName: selectedUpazila?.name || resolvedSelection.upazilaName,
			};
		},
		[deliverySettings, districts, divisions, selectedDivisionId, selectedDistrictId, selectedUpazilaId, upazilas],
	);

	useEffect(() => {
		onDataChange({ shipping: shippingData, billing: billingData, delivery: deliverySelection });
	}, [billingData, deliverySelection, onDataChange, shippingData]);

	useEffect(() => {
		setBillingData((current) => ({
			...current,
			paymentMethod: defaultPaymentMethod,
			gatewayId: defaultPaymentMethod === "cod" ? null : current.gatewayId,
		}));
	}, [defaultPaymentMethod]);

	useEffect(() => {
		if (!locationDeliveryEnabled || (divisions.length === 0 && deliverySettings.districts.length === 0)) {
			if (shippingData.country.trim() === "") {
				setShippingData((current) => ({
					...current,
					country: current.country || "Bangladesh",
				}));
			}
			return;
		}

		setShippingData((current) => ({
			...current,
			...(deliverySelection.upazilaName || deliverySelection.districtName
				? { city: deliverySelection.upazilaName || deliverySelection.districtName }
				: {}),
			country: current.country || "Bangladesh",
		}));
	}, [deliverySelection.districtName, deliverySelection.upazilaName, deliverySettings.districts.length, divisions.length, locationDeliveryEnabled, shippingData.country]);

	useEffect(() => {
		if (billingData.paymentMethod !== "cod" || deliverySelection.codAvailable) {
			return;
		}

		setBillingData((current) => ({
			...current,
			paymentMethod: current.gatewayId || gateways[0]?.id ? "gateway" : "cod",
			gatewayId: current.gatewayId || gateways[0]?.id || null,
		}));
	}, [billingData.paymentMethod, deliverySelection.codAvailable, gateways]);

	useEffect(() => {
		if (!isAuthenticated) {
			setSavedAddresses([]);
			setSelectedSavedAddress(null);
			setUseDifferentShippingAddress(false);
			setIsLoadingSavedAddresses(false);
			return;
		}

		const token = readStoredAuthToken();
		if (!token) {
			setIsLoadingSavedAddresses(false);
			return;
		}

		const controller = new AbortController();

		const loadSavedAddresses = async () => {
			try {
				const response = await apiFetch("/customer/shipping-addresses", {
					headers: getAuthHeaders(token),
					signal: controller.signal,
					cache: "no-store",
				});

				if (!response.ok) {
					setSavedAddresses([]);
					return;
				}

				const result = (await response.json()) as { data?: SavedShippingAddress[] };
				const addresses = Array.isArray(result.data) ? result.data : [];
				setSavedAddresses(addresses);

				const defaultAddress = addresses.find((address) => address.is_default) || addresses[0];
				if (defaultAddress) {
					setSelectedSavedAddress(defaultAddress);
					setShippingData((current) => {
						// Country can be populated automatically before the saved address loads.
						// Do not let that default value prevent the profile address from filling the form.
						const hasUserInput = Object.entries(current)
							.filter(([field]) => field !== "country")
							.some(([, value]) => value.trim() !== "");
						return hasUserInput ? current : mapSavedAddressToFormData(defaultAddress);
					});
				}
			} catch {
				setSavedAddresses([]);
			} finally {
				setIsLoadingSavedAddresses(false);
			}
		};

		void loadSavedAddresses();

		return () => controller.abort();
	}, [isAuthenticated]);

	const handleShippingChange = (data: ShippingFormData) => {
		setShippingData(data);
	};

	const handleBillingChange = (data: BillingData) => {
		setBillingData(data);
	};

	const handleSelectSavedAddress = (address: SavedShippingAddress) => {
		setSelectedSavedAddress(address);
		setShippingData(mapSavedAddressToFormData(address));
		setUseDifferentShippingAddress(false);
	};

	const handleToggleDifferentShippingAddress = (checked: boolean) => {
		setUseDifferentShippingAddress(checked);

		if (!checked && selectedSavedAddress) {
			setShippingData(mapSavedAddressToFormData(selectedSavedAddress));
		}
	};

	const handleDistrictChange = (districtId: string) => {
		setSelectedDistrictId(districtId);

		setSelectedUpazilaId((current) => {
			const stillValid = deliverySettings.upazilas.some((item) => item.id === current && item.districtId === districtId);
			return stillValid ? current : "";
		});
	};

	const handleDivisionChange = (divisionId: string) => {
		setSelectedDivisionId(divisionId);
		setSelectedDistrictId("");
		setSelectedUpazilaId("");
	};

	return (
		<div className="space-y-12 bg-white rounded-lg  p-6">
			<ShippingInformation
				data={shippingData}
				errors={shippingErrors}
				isAuthenticated={isAuthenticated}
				supportsLocationDelivery={locationDeliveryEnabled}
				selectedSavedAddress={selectedSavedAddress}
				savedAddresses={savedAddresses}
				isLoadingSavedAddresses={isLoadingSavedAddresses}
				useDifferentShippingAddress={useDifferentShippingAddress}
				onSelectSavedAddress={handleSelectSavedAddress}
				onToggleDifferentShippingAddress={handleToggleDifferentShippingAddress}
				deliverySelection={deliverySelection}
				isLoadingDeliverySettings={isLoadingDeliverySettings || isLoadingGeoLocations}
				divisions={divisions}
				districts={districts}
				upazilas={upazilas}
				selectedDivisionId={selectedDivisionId}
				selectedDistrictId={selectedDistrictId}
				selectedUpazilaId={selectedUpazilaId}
				onDivisionChange={handleDivisionChange}
				onDistrictChange={handleDistrictChange}
				onUpazilaChange={setSelectedUpazilaId}
				onFieldChange={onShippingFieldChange}
				onChange={handleShippingChange}
			/>
			<BillingInformation
				data={billingData}
				errors={billingErrors}
				gateways={gateways}
				isLoadingGateways={isLoadingGateways}
				supportsPaymentGateway={supportsPaymentGateway}
				isCodAvailable={deliverySelection.codAvailable}
				codMessage={
					deliverySettings.districts.length > 0 && !deliverySelection.codAvailable
						? `Cash on delivery is not available for ${deliverySelection.upazilaName || deliverySelection.districtName || "this area"}.`
						: null
				}
				onFieldChange={onBillingFieldChange}
				onChange={handleBillingChange}
			/>
		</div>
	);
}

function mapSavedAddressToFormData(address: SavedShippingAddress): ShippingFormData {
	const nameParts = address.full_name.trim().split(/\s+/).filter(Boolean);

	return {
		firstName: nameParts[0] || "",
		lastName: nameParts.slice(1).join(" "),
		email: address.email || "",
		phone: address.phone,
		address: address.address,
		city: address.city,
		country: address.country,
		postalCode: address.postal_code || "",
	};
}

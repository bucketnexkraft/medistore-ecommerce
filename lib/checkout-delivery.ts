"use client";

import { apiFetch } from "@/lib/api-client";
import { useEffect, useMemo, useState } from "react";

export type CheckoutDistrictOption = {
	id: string;
	name: string;
	divisionId?: string | null;
};

export type CheckoutUpazilaOption = {
	id: string;
	name: string;
	districtId: string;
	districtName: string;
	divisionId?: string | null;
};

export type CheckoutDivisionOption = {
	id: string;
	name: string;
};

export type CheckoutDeliveryRule = {
	id: string;
	label: string;
	type: "default" | "division" | "district" | "upazila";
	divisionId: string;
	divisionName: string;
	districtId: string;
	districtName: string;
	upazilaId: string;
	upazilaName: string;
	charge: number | null;
	codAvailable: boolean;
};

export type CheckoutDeliverySettings = {
	codMode: "global" | "zonal";
	deliveryChargeMode: "inside_outside" | "free" | "zonal";
	defaultCharge: number | null;
	insideDhakaCharge: number | null;
	outsideDhakaCharge: number | null;
	defaultCod: boolean;
	allowGuestCheckout: boolean;
	divisions: CheckoutDivisionOption[];
	districts: CheckoutDistrictOption[];
	upazilas: CheckoutUpazilaOption[];
	rules: CheckoutDeliveryRule[];
};

export type CheckoutGeoState = {
	divisions: CheckoutDivisionOption[];
	districts: CheckoutDistrictOption[];
	upazilas: CheckoutUpazilaOption[];
};

type JsonPayload = {
	status?: number;
	data?: unknown;
};

type PreferenceItem = {
	key?: unknown;
	value?: unknown;
};

const EMPTY_SETTINGS: CheckoutDeliverySettings = {
	codMode: "global",
	deliveryChargeMode: "inside_outside",
	defaultCharge: null,
	insideDhakaCharge: null,
	outsideDhakaCharge: null,
	defaultCod: true,
	allowGuestCheckout: false,
	divisions: [],
	districts: [],
	upazilas: [],
	rules: [],
};

let checkoutSettingsRequest: Promise<JsonPayload | null> | null = null;
let checkoutSettingsCache: JsonPayload | null = null;
let checkoutSettingsCacheAt = 0;

export function fetchCheckoutSettingsPayload() {
	if (checkoutSettingsCache && Date.now() - checkoutSettingsCacheAt < 30_000) {
		return Promise.resolve(checkoutSettingsCache);
	}

	if (checkoutSettingsRequest) {
		return checkoutSettingsRequest;
	}

	checkoutSettingsRequest = apiFetch("/landing/checkout-settings", { cache: "no-store" })
		.then(async (response) => {
			if (!response.ok) {
				return null;
			}

			const payload = (await response.json().catch(() => null)) as JsonPayload | null;
			if (payload) {
				checkoutSettingsCache = payload;
				checkoutSettingsCacheAt = Date.now();
			}

			return payload;
		})
		.catch(() => null)
		.finally(() => {
			checkoutSettingsRequest = null;
		});

	return checkoutSettingsRequest;
}

function normalizeGeoEntry(value: unknown) {
	const item = extractObject(value);
	if (!item) {
		return null;
	}

	const id = normalizeText(item.id || item.value || item.division_id || item.district_id || item.upazila_id);
	const name = normalizeText(item.name || item.name_en || item.label);
	const divisionId = normalizeText(item.division_id);
	const districtId = normalizeText(item.district_id);

	if (!id || !name) {
		return null;
	}

	return {
		id,
		name,
		divisionId: divisionId || null,
		districtId: districtId || null,
	};
}

function normalizeText(value: unknown) {
	return String(value ?? "").trim();
}

function normalizeBoolean(value: unknown, fallback = false) {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "number") {
		return value === 1;
	}

	const normalized = normalizeText(value).toLowerCase();

	if (["1", "true", "yes", "on"].includes(normalized)) {
		return true;
	}

	if (["0", "false", "no", "off"].includes(normalized)) {
		return false;
	}

	return fallback;
}

function normalizeNumber(value: unknown) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function normalizeArray(value: unknown) {
	return Array.isArray(value) ? value : [];
}

function extractObject(value: unknown) {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractPreferenceMap(value: unknown) {
	if (!Array.isArray(value)) {
		return null;
	}

	const mapped = value.reduce<Record<string, unknown>>((accumulator, item) => {
		const row = item as PreferenceItem | null;
		const key = normalizeText(row?.key);

		if (key) {
			accumulator[key] = row?.value;
		}

		return accumulator;
	}, {});

	return Object.keys(mapped).length > 0 ? mapped : null;
}

function collectCandidateObjects(payloads: unknown[]) {
	const candidates: Record<string, unknown>[] = [];

	for (const payload of payloads) {
		const root = extractObject(payload);
		if (!root) {
			continue;
		}

		candidates.push(root);

		const data = extractObject(root.data) || extractPreferenceMap(root.data);
		if (data) {
			candidates.push(data);
		}

		for (const key of ["shipping", "delivery", "delivery_settings", "shipping_settings", "ecommerce"]) {
			const nested = extractObject(root[key]) || (data ? extractObject(data[key]) : null);
			if (nested) {
				candidates.push(nested);
			}
		}

		for (const key of ["delivery_charge_settings", "payment_gateway_settings", "delivery_channel_settings"]) {
			const nested = extractObject(root[key]) || extractObject(data?.[key]) || extractPreferenceMap(root[key]) || extractPreferenceMap(data?.[key]);
			if (nested) {
				candidates.push(nested);
			}
		}
	}

	return candidates;
}

function findFirstNumber(candidates: Record<string, unknown>[], keys: string[]) {
	for (const candidate of candidates) {
		for (const key of keys) {
			const value = normalizeNumber(candidate[key]);
			if (value !== null) {
				return value;
			}
		}
	}

	return null;
}

function findFirstBoolean(candidates: Record<string, unknown>[], keys: string[], fallback = false) {
	for (const candidate of candidates) {
		for (const key of keys) {
			if (typeof candidate[key] !== "undefined") {
				return normalizeBoolean(candidate[key], fallback);
			}
		}
	}

	return fallback;
}

function findFirstText(candidates: Record<string, unknown>[], keys: string[]) {
	for (const candidate of candidates) {
		for (const key of keys) {
			const value = normalizeText(candidate[key]);
			if (value !== "") return value;
		}
	}

	return "";
}

function findFirstArray(candidates: Record<string, unknown>[], keys: string[]) {
	for (const candidate of candidates) {
		for (const key of keys) {
			const value = normalizeArray(candidate[key]);
			if (value.length > 0) {
				return value;
			}
		}
	}

	return [];
}

function buildDistrictOptions(rawDistricts: unknown[], rawDistrictRules: unknown[], rawUpazilaRules: unknown[]) {
	const byId = new Map<string, CheckoutDistrictOption>();

	const pushDistrict = (value: unknown) => {
		const item = extractObject(value);
		if (!item) {
			return;
		}

		const id =
			normalizeText(item.id) ||
			normalizeText(item.district_id) ||
			normalizeText(item.districtId) ||
			normalizeText(item.district) ||
			(normalizeText(item.zone) !== "" ? "__delivery_areas__" : "") ||
			normalizeText(item.value) ||
			normalizeText(item.slug) ||
			normalizeText(item.name);
		const name =
			normalizeText(item.name) ||
			normalizeText(item.district_name) ||
			normalizeText(item.districtName) ||
			normalizeText(item.district) ||
			(normalizeText(item.zone) !== "" ? "Delivery Areas" : "") ||
			normalizeText(item.label);

		if (!id || !name) {
			return;
		}

		byId.set(id, { id, name });
	};

	rawDistricts.forEach(pushDistrict);
	rawDistrictRules.forEach(pushDistrict);
	rawUpazilaRules.forEach(pushDistrict);

	return Array.from(byId.values());
}

function buildUpazilaOptions(rawUpazilas: unknown[], rawRules: unknown[], districts: CheckoutDistrictOption[]) {
	const districtNameById = new Map(districts.map((district) => [district.id, district.name]));
	const byId = new Map<string, CheckoutUpazilaOption>();

	const pushUpazila = (value: unknown) => {
		const item = extractObject(value);
		if (!item) {
			return;
		}

		const districtId =
			normalizeText(item.district_id) ||
			normalizeText(item.districtId) ||
			normalizeText(item.district) ||
			(normalizeText(item.zone) !== "" ? "__delivery_areas__" : "") ||
			normalizeText(item.parent_id);
		const districtName =
			normalizeText(item.district_name) ||
			normalizeText(item.districtName) ||
			normalizeText(item.district) ||
			(normalizeText(item.zone) !== "" ? "Delivery Areas" : "") ||
			districtNameById.get(districtId) ||
			"";
		const id =
			normalizeText(item.id) ||
			normalizeText(item.upazila_id) ||
			normalizeText(item.upazilaId) ||
			normalizeText(item.thana_id) ||
			normalizeText(item.thanaId) ||
			normalizeText(item.police_station_id) ||
			normalizeText(item.ps_id) ||
			normalizeText(item.zone) ||
			normalizeText(item.name);
		const name =
			normalizeText(item.name) ||
			normalizeText(item.upazila_name) ||
			normalizeText(item.upazilaName) ||
			normalizeText(item.thana_name) ||
			normalizeText(item.thanaName) ||
			normalizeText(item.police_station_name) ||
			normalizeText(item.ps_name) ||
			normalizeText(item.zone) ||
			normalizeText(item.label);

		if (!id || !name || !districtId) {
			return;
		}

		byId.set(id, {
			id,
			name,
			districtId,
			districtName,
			divisionId: normalizeText(item.division_id) || null,
		});
	};

	rawUpazilas.forEach(pushUpazila);
	rawRules.forEach(pushUpazila);

	return Array.from(byId.values());
}

function buildRule(value: unknown, fallbackCod: boolean, fallbackCharge: number | null): CheckoutDeliveryRule | null {
	const item = extractObject(value);
	if (!item) {
		return null;
	}

	const typeSource = normalizeText(item.type || item.rule_type || item.scope).toLowerCase();
	const hasUpazila =
		normalizeText(item.upazila_id || item.upazilaId || item.thana_id || item.thanaId || item.police_station_id || item.ps_id) !== "" ||
		normalizeText(item.upazila_name || item.upazilaName || item.thana_name || item.police_station_name || item.ps_name) !== "";
	const type = hasUpazila ? "upazila" : (typeSource === "division" || typeSource === "zone" ? "division" : "district");
	const divisionId = normalizeText(item.division_id || item.divisionId);
	const divisionName = normalizeText(item.division_name || item.divisionName || (type === "division" ? item.zone : ""));
	const districtId = normalizeText(item.district_id || item.districtId || item.parent_id);
	const districtName = normalizeText(item.district_name || item.districtName || item.district || (normalizeText(item.zone) !== "" ? "Delivery Areas" : item.name));
	const upazilaId = normalizeText(item.upazila_id || item.upazilaId || item.thana_id || item.thanaId || item.police_station_id || item.ps_id || item.zone);
	const upazilaName = normalizeText(item.upazila_name || item.upazilaName || item.thana_name || item.thanaName || item.police_station_name || item.ps_name || item.zone);
	const charge =
		normalizeNumber(item.delivery_charge) ??
		normalizeNumber(item.charge) ??
		normalizeNumber(item.price) ??
		normalizeNumber(item.shipping_charge) ??
		fallbackCharge;
	const codAvailable = normalizeBoolean(
		typeof item.cash_on_delivery !== "undefined"
			? item.cash_on_delivery
			: typeof item.cod !== "undefined"
				? item.cod
				: item.is_cod_available,
		fallbackCod,
	);
	const id =
		normalizeText(item.id) ||
		(type === "upazila"
			? `${districtId}:${upazilaId || upazilaName}`
			: `${districtId || districtName}:district`);
	const resolvedDistrictId = districtId || (upazilaName !== "" ? "__delivery_areas__" : "");
	const label = upazilaName || districtName;

	if (!label) {
		return null;
	}

	return {
		id,
		label,
		type,
		divisionId,
		divisionName,
		districtId: resolvedDistrictId,
		districtName,
		upazilaId,
		upazilaName,
		charge,
		codAvailable,
	};
}

function normalizeSettings(payloads: unknown[]): CheckoutDeliverySettings {
	const candidates = collectCandidateObjects(payloads);

	if (candidates.length === 0) {
		return EMPTY_SETTINGS;
	}

	const defaultCharge = findFirstNumber(candidates, [
		"default_charge",
		"default_delivery_charge",
		"default_shipping_charge",
		"delivery_charge",
		"shipping_charge",
		"default_delivery_fee",
		"default_shipping_fee",
		"delivery_fee",
		"shipping_fee",
	]);
	const defaultCod = findFirstBoolean(candidates, ["default_cod", "cash_on_delivery", "cod_enabled"], true);
	const configuredCodMode = findFirstText(candidates, ["cod_mode", "cod_availability"]);
	const hasLegacyLocationRules = findFirstArray(candidates, ["district_based_charges", "district_rules", "upazila_based_charges", "thana_based_charges", "upazila_rules", "specific_charges"]).length > 0;
	const codMode = ["zonal", "zone", "location", "location_based"].includes(configuredCodMode.toLowerCase())
		? "zonal"
		: configuredCodMode !== "" || !hasLegacyLocationRules ? "global" : "zonal";
	const configuredDeliveryChargeMode = findFirstText(candidates, ["delivery_charge_mode", "shipping_charge_mode"]).toLowerCase();
	const deliveryChargeMode = ["free", "free_delivery"].includes(configuredDeliveryChargeMode)
		? "free"
		: ["zonal", "zone", "location", "location_based"].includes(configuredDeliveryChargeMode)
			? "zonal"
			: configuredDeliveryChargeMode !== ""
				? "inside_outside"
				: (hasLegacyLocationRules ? "zonal" : "inside_outside");
	const insideDhakaCharge = findFirstNumber(candidates, ["inside_dhaka_charge", "dhaka_inside_charge"]);
	const outsideDhakaCharge = findFirstNumber(candidates, ["outside_dhaka_charge", "dhaka_outside_charge"]);
	const allowGuestCheckout = findFirstBoolean(candidates, ["allow_guest_checkout", "guest_checkout", "guest_order_enabled"], false);
	const hasZonalRules = deliveryChargeMode === "zonal";
	const rawDistrictRules = hasZonalRules ? findFirstArray(candidates, ["district_based_charges", "district_rules", "districts"]) : [];
	const rawUpazilaRules = hasZonalRules ? findFirstArray(candidates, ["upazila_based_charges", "thana_based_charges", "upazila_rules", "specific_charges", "upazilas"]) : [];
	const rawDistricts = findFirstArray(candidates, ["district_options", "district_list", "districts"]);
	const rawUpazilas = findFirstArray(candidates, ["upazila_options", "thana_options", "upazila_list", "upazilas"]);

	const districts = buildDistrictOptions(rawDistricts, rawDistrictRules, rawUpazilaRules);
	const upazilas = buildUpazilaOptions(rawUpazilas, rawUpazilaRules, districts);
	const rules = [
		...(defaultCharge !== null || defaultCod ? [{
			id: "default",
			label: "Default delivery",
			 type: "default" as const,
			divisionId: "",
			divisionName: "",
			districtId: "",
			districtName: "",
			upazilaId: "",
			upazilaName: "",
			charge: defaultCharge,
			codAvailable: defaultCod,
		}] : []),
		...rawDistrictRules
			.map((item) => buildRule(item, defaultCod, defaultCharge))
			.filter((item): item is CheckoutDeliveryRule => item !== null),
		...rawUpazilaRules
			.map((item) => buildRule(item, defaultCod, defaultCharge))
			.filter((item): item is CheckoutDeliveryRule => item !== null),
	];

	return {
		codMode,
		deliveryChargeMode,
		divisions: [],
		defaultCharge,
		insideDhakaCharge,
		outsideDhakaCharge,
		defaultCod,
		allowGuestCheckout,
		districts,
		upazilas,
		rules,
	};
}

export function resolveCheckoutDeliverySelection(
	settings: CheckoutDeliverySettings,
	districtId: string,
	upazilaId: string,
	districtName = "",
	upazilaName = "",
	divisionId = "",
	divisionName = "",
) {
	const selectedUpazila = settings.upazilas.find((item) => item.id === upazilaId && item.districtId === districtId) || null;
	const selectedDistrict = settings.districts.find((item) => item.id === districtId) || null;
	const normalizedDistrictName = districtName.trim().toLowerCase();
	const normalizedUpazilaName = upazilaName.trim().toLowerCase();
	const normalizedDivisionName = divisionName.trim().toLowerCase();
	const divisionRule = settings.rules.find((rule) =>
		rule.type === "division" && (
		(rule.divisionId !== "" && rule.divisionId === divisionId)
		|| (normalizedDivisionName !== "" && rule.divisionName.trim().toLowerCase() === normalizedDivisionName)
		|| (normalizedDivisionName !== "" && rule.label.trim().toLowerCase() === normalizedDivisionName)
	),
	) || null;
	const upazilaRule = settings.rules.find((rule) =>
		rule.type === "upazila" && (
			(rule.upazilaId !== "" && rule.upazilaId === upazilaId)
			|| (normalizedUpazilaName !== "" && rule.upazilaName.trim().toLowerCase() === normalizedUpazilaName)
			|| (normalizedUpazilaName !== "" && rule.label.trim().toLowerCase() === normalizedUpazilaName)
		),
	) || null;
	const districtRule = settings.rules.find((rule) =>
		rule.type === "district" && (
			(rule.districtId !== "" && rule.districtId === districtId)
			|| (normalizedDistrictName !== "" && rule.districtName.trim().toLowerCase() === normalizedDistrictName)
			|| (normalizedDistrictName !== "" && rule.label.trim().toLowerCase() === normalizedDistrictName)
		),
	) || null;
	const activeRule = upazilaRule || districtRule || divisionRule || null;
	const normalizedDistrict = normalizedDistrictName.replace(/[\u09be-\u09cc]/g, "");
	let resolvedCharge = settings.defaultCharge;

	if (settings.deliveryChargeMode === "free") {
		resolvedCharge = 0;
	} else if (activeRule) {
		resolvedCharge = activeRule.charge ?? settings.defaultCharge;
	} else if (settings.deliveryChargeMode === "inside_outside") {
		if (normalizedDistrictName === "dhaka" || normalizedDistrict.includes("dhaka")) {
			resolvedCharge = settings.insideDhakaCharge ?? settings.defaultCharge;
		} else if (normalizedDistrictName !== "") {
			resolvedCharge = settings.outsideDhakaCharge ?? settings.defaultCharge;
		}
	}

	return {
		divisionId: divisionId,
		divisionName: divisionName,
		districtId: selectedDistrict?.id || districtId,
		districtName: selectedDistrict?.name || activeRule?.districtName || "",
		upazilaId: selectedUpazila?.id || upazilaId,
		upazilaName: selectedUpazila?.name || activeRule?.upazilaName || "",
		label: activeRule?.label || selectedUpazila?.name || selectedDistrict?.name || "Default delivery",
		charge: resolvedCharge,
		codAvailable: settings.defaultCod,
	};
}

export function useBangladeshGeoLocations(selectedDivisionId: string, selectedDistrictId: string, enabled = true) {
	const [allLocations, setAllLocations] = useState<CheckoutGeoState>({
		divisions: [],
		districts: [],
		upazilas: [],
	});
	const [isLoading, setIsLoading] = useState(enabled);

	useEffect(() => {
		if (!enabled) {
			setAllLocations({
				divisions: [],
				districts: [],
				upazilas: [],
			});
			setIsLoading(false);
			return;
		}

		let ignore = false;

		const loadDivisions = async () => {
			setIsLoading(true);

			try {
				const response = await apiFetch("/landing/geo/locations?include=divisions", { cache: "force-cache" });
				const payload = response.ok ? await response.json().catch(() => null) : null;
				const data = extractObject(payload?.data);
				const divisions = normalizeArray(data?.divisions)
					.map(normalizeGeoEntry)
					.filter((item): item is NonNullable<ReturnType<typeof normalizeGeoEntry>> => item !== null)
					.map((item) => ({ id: item.id, name: item.name }));
				if (!ignore) {
					setAllLocations((current) => ({ ...current, divisions, districts: [], upazilas: [] }));
				}
			} catch {
				if (!ignore) {
					setAllLocations((current) => ({ ...current, divisions: [] }));
				}
			} finally {
				if (!ignore) {
					setIsLoading(false);
				}
			}
		};

		void loadDivisions();

		return () => {
			ignore = true;
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled || !selectedDivisionId) {
			setAllLocations((current) => ({ ...current, districts: [], upazilas: [] }));
			return;
		}

		let ignore = false;
		setIsLoading(true);

		void apiFetch(`/landing/geo/locations?include=districts&division_id=${encodeURIComponent(selectedDivisionId)}`, { cache: "force-cache" })
			.then(async (response) => (response.ok ? response.json().catch(() => null) : null))
			.then((payload) => {
				if (ignore) return;

				const data = extractObject(payload?.data);
				const districts = normalizeArray(data?.districts)
					.map(normalizeGeoEntry)
					.filter((item): item is NonNullable<ReturnType<typeof normalizeGeoEntry>> => item !== null)
					.map((item) => ({ id: item.id, name: item.name, divisionId: item.divisionId }));
				setAllLocations((current) => ({ ...current, districts, upazilas: [] }));
			})
			.catch(() => {
				if (!ignore) setAllLocations((current) => ({ ...current, districts: [] }));
			})
			.finally(() => {
				if (!ignore) setIsLoading(false);
			});

		return () => {
			ignore = true;
		};
	}, [enabled, selectedDivisionId]);

	useEffect(() => {
		if (!enabled || !selectedDistrictId) {
			setAllLocations((current) => ({ ...current, upazilas: [] }));
			return;
		}

		let ignore = false;
		setIsLoading(true);

		void apiFetch(`/landing/geo/locations?include=upazilas&district_id=${encodeURIComponent(selectedDistrictId)}`, { cache: "force-cache" })
			.then(async (response) => (response.ok ? response.json().catch(() => null) : null))
			.then((payload) => {
				if (ignore) return;

				const data = extractObject(payload?.data);
				const upazilas = normalizeArray(data?.upazilas)
					.map(normalizeGeoEntry)
					.filter((item): item is NonNullable<ReturnType<typeof normalizeGeoEntry>> => item !== null)
					.map((item) => ({ id: item.id, name: item.name, districtId: item.districtId || "", districtName: "", divisionId: item.divisionId }));
				setAllLocations((current) => ({ ...current, upazilas }));
			})
			.catch(() => {
				if (!ignore) setAllLocations((current) => ({ ...current, upazilas: [] }));
			})
			.finally(() => {
				if (!ignore) setIsLoading(false);
			});

		return () => {
			ignore = true;
		};
	}, [enabled, selectedDistrictId]);

	return useMemo(() => {
		const districts = selectedDivisionId
			? allLocations.districts.filter((item) => item.divisionId === selectedDivisionId)
			: allLocations.districts;
		const upazilas = selectedDistrictId
			? allLocations.upazilas.filter((item) => item.districtId === selectedDistrictId)
			: allLocations.upazilas;

		return {
			divisions: allLocations.divisions,
			districts,
			upazilas,
			isLoading,
		};
	}, [allLocations, isLoading, selectedDistrictId, selectedDivisionId]);
}

export function useCheckoutDeliverySettings(enabled = true) {
	const [settings, setSettings] = useState<CheckoutDeliverySettings>(EMPTY_SETTINGS);
	const [isLoading, setIsLoading] = useState(enabled);

	useEffect(() => {
		if (!enabled) {
			setSettings(EMPTY_SETTINGS);
			setIsLoading(false);
			return;
		}

		let ignore = false;

		const loadSettings = async () => {
			setIsLoading(true);

			try {
				if (ignore) {
					return;
				}

				const payload = await fetchCheckoutSettingsPayload();
				setSettings(payload ? normalizeSettings([payload]) : EMPTY_SETTINGS);
			} catch {
				if (!ignore) {
					setSettings(EMPTY_SETTINGS);
				}
			} finally {
				if (!ignore) {
					setIsLoading(false);
				}
			}
		};

		void loadSettings();

		return () => {
			ignore = true;
		};
	}, [enabled]);

	return useMemo(
		() => ({
			settings,
			isLoading,
		}),
		[settings, isLoading],
	);
}

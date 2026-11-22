import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { PiArrowLeft, PiClock, PiCreditCard, PiMapPin, PiPlus } from "react-icons/pi";
import { fetchCustomData } from "../../slice/customDataSlice";
import { getPreference } from "../../api/preference";
import { sendPathaoCourierTest, updateCompanyPreference } from "../../api/companyPreferances";
import { getBangladeshGeoLocations } from "../../api/geo";
import { isFeatureIncludedInPlan } from "../../utils/planFeatures";

const fallbackChannels = [
  "Pathao",
  "Steadfast",
  "Redx",
  "Paperfly",
  "Carrybee",
];

const blankCharge = { scope: "district", zone: "", price: "", cod_enabled: true };
const courierPaymentMethods = ["Bank Account", "bKash", "Nagad", "Rocket"];

function matchesLocationLabel(item, value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) return false;

  return [item?.label, item?.nameBn].some(
    (candidate) => String(candidate || "").trim().toLowerCase() === normalizedValue
  );
}

function getSpecificChargeKey(item) {
  return `${String(item?.scope || "district").trim().toLowerCase()}::${String(item?.zone || "")
    .trim()
    .toLowerCase()}`;
}

function getDefaultCourierSettings(defaults = {}) {
  return {
    pickup_location: {
      store_name: defaults.store_name || "",
      address: defaults.address || "",
      contact_phone: defaults.contact_phone || "",
      division_id: defaults.division_id || "",
      district_id: defaults.district_id || "",
      upazila_id: defaults.upazila_id || "",
    },
    pickup_window: {
      start_time: defaults.start_time || "",
      end_time: defaults.end_time || "",
      notes: defaults.notes || "",
    },
    payment_details: {
      method: defaults.method || "",
      account_number: defaults.account_number || "",
      account_holder_name: defaults.account_holder_name || "",
      bank_name: defaults.bank_name || "",
      branch_name: defaults.branch_name || "",
      routing_number: defaults.routing_number || "",
    },
    pathao: {
      enabled: defaults.enabled ?? false,
      base_url: defaults.base_url || "https://courier-api-sandbox.pathao.com",
      client_id: defaults.client_id || "",
      client_secret: defaults.client_secret || "",
      username: defaults.username || "",
      password: defaults.password || "",
      grant_type: defaults.grant_type || "password",
      refresh_token: defaults.refresh_token || "",
      access_token: defaults.access_token || "",
      expires_in: defaults.expires_in || "",
    },
  };
}

function normalizeCourierSettings(input, defaults = {}) {
  const next = getDefaultCourierSettings(defaults);
  const stored = input && typeof input === "object" ? input : {};

  return {
    pickup_location: {
      ...next.pickup_location,
      ...(stored.pickup_location || {}),
    },
    pickup_window: {
      ...next.pickup_window,
      ...(stored.pickup_window || {}),
    },
    payment_details: {
      ...next.payment_details,
      ...(stored.payment_details || {}),
    },
    pathao: {
      ...next.pathao,
      ...(stored.pathao || {}),
    },
  };
}

function mergeSpecificChargeEntry(entries, entry, scope) {
  if (!entry?.zone || !entry?.price) {
    return entries;
  }

  const nextEntry = { ...entry, scope };
  const existingIndex = entries.findIndex(
    (item) =>
      String(item.scope || "district") === scope &&
      String(item.zone || "").trim().toLowerCase() === String(entry.zone || "").trim().toLowerCase()
  );

  if (existingIndex >= 0) {
    return entries.map((item, index) => (index === existingIndex ? nextEntry : item));
  }

  return [...entries, nextEntry];
}

function normalizeLocationOptions(items = []) {
  return items
    .map((item) => ({
      id: String(item?.id || ""),
      label: String(item?.name || item?.name_en || "").trim(),
      nameBn: String(item?.name_bn || item?.bn_name || "").trim(),
      divisionId: item?.division_id ? String(item.division_id) : "",
      districtId: item?.district_id ? String(item.district_id) : "",
    }))
    .filter((item) => item.id && item.label);
}

function normalizeDeliveryChannels(input) {
  if (Array.isArray(input) && input.length > 0) {
    return input.map((item, index) => ({
      id: item.id || item.delivery_mode_id || item.slug || item.name || `channel-${index}`,
      name: item.name || item.title || item.slug || `Channel ${index + 1}`,
      enabled: false,
      pickup_from_store: true,
      deliver_to_customer: true,
      credentials_note: "",
    }));
  }

  return fallbackChannels.map((name) => ({
    id: name.toLowerCase(),
    name,
    enabled: false,
    pickup_from_store: true,
    deliver_to_customer: true,
    credentials_note: "",
  }));
}

function isPathaoCourierName(name) {
  return String(name || "").trim().toLowerCase() === "pathao";
}

const COURIER_BASE_URLS = {
  pathao: [
    { label: "Sandbox - courier-api-sandbox.pathao.com", value: "https://courier-api-sandbox.pathao.com" },
    { label: "Live - api-hermes.pathao.com", value: "https://api-hermes.pathao.com" },
  ],
  steadfast: [
    { label: "Merchant Panel - merchant.steadfast.com.bd", value: "https://merchant.steadfast.com.bd/" },
  ],
  redx: [
    { label: "Website - redx.com.bd", value: "https://redx.com.bd/" },
  ],
  paperfly: [
    { label: "Website - paperfly.com.bd", value: "https://paperfly.com.bd/" },
    { label: "Merchant Panel - go-app.paperfly.com.bd", value: "https://go-app.paperfly.com.bd/" },
  ],
  carrybee: [
    { label: "Merchant Panel - merchant.carrybee.com", value: "https://merchant.carrybee.com/" },
  ],
};

function getCourierBaseUrlOptions(courierName) {
  const normalizedName = String(courierName || "").trim().toLowerCase();
  return COURIER_BASE_URLS[normalizedName] || [
    { label: "Website - courier website", value: "" },
  ];
}

export default function ShopDeliverySupport() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const deliveryModes = useSelector((state) => state.customdata.course_delivery_modes || []);
  const deliverySupportAllowed = isFeatureIncludedInPlan(selectedPlanFeatures, "ftr_shop_delivery_support");

  const [channels, setChannels] = useState(() => normalizeDeliveryChannels([]));
  const [defaultCharge, setDefaultCharge] = useState("");
  const [deliveryChargeMode, setDeliveryChargeMode] = useState("inside_outside");
  const [insideDhakaCharge, setInsideDhakaCharge] = useState("");
  const [outsideDhakaCharge, setOutsideDhakaCharge] = useState("");
  const [codEnabled, setCodEnabled] = useState(true);
  const [deliveryChargeRefundable, setDeliveryChargeRefundable] = useState(true);
  const [chargeScope, setChargeScope] = useState("district");
  const [specificCharge, setSpecificCharge] = useState(blankCharge);
  const [specificCharges, setSpecificCharges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [geoOptions, setGeoOptions] = useState({
    divisions: [],
    districts: [],
    upazilas: [],
  });
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [courierSettings, setCourierSettings] = useState(() => getDefaultCourierSettings());
  const [editingChargeKey, setEditingChargeKey] = useState("");
  const [isTestingPathao, setIsTestingPathao] = useState(false);
  const [pathaoTestResult, setPathaoTestResult] = useState("");
  const [selectedCourierName, setSelectedCourierName] = useState("Pathao");

  useEffect(() => {
    if (accessToken) {
      dispatch(fetchCustomData());
    }
  }, [dispatch, accessToken]);

  useEffect(() => {
    setChannels((prev) => {
      const nextBase = normalizeDeliveryChannels(deliveryModes);
      const previousMap = new Map(prev.map((item) => [String(item.name).toLowerCase(), item]));

      return nextBase.map((item) => {
        const old = previousMap.get(String(item.name).toLowerCase());
        return old ? { ...item, ...old } : item;
      });
    });
  }, [deliveryModes]);

  useEffect(() => {
    setSelectedCourierName((prev) => {
      const nextChannels = normalizeDeliveryChannels(deliveryModes);
      const hasSelected = nextChannels.some((channel) => String(channel.name).toLowerCase() === String(prev).toLowerCase());

      if (hasSelected) {
        return prev;
      }

      return nextChannels[0]?.name || "Pathao";
    });
  }, [deliveryModes]);

  useEffect(() => {
    const options = getCourierBaseUrlOptions(selectedCourierName);

    if (options.length === 0) return;

    setCourierSettings((prev) => {
      const currentBaseUrl = String(prev.pathao.base_url || "");
      const hasMatch = options.some((option) => String(option.value || "") === currentBaseUrl);

      if (hasMatch) {
        return prev;
      }

      return {
        ...prev,
        pathao: {
          ...prev.pathao,
          base_url: options[0].value,
        },
      };
    });
  }, [selectedCourierName]);

  useEffect(() => {
    const loadDeliverySettings = async () => {
      if (!accessToken || !companyId) return;

      try {
        const response = await getPreference(companyId, accessToken);
        const preferences = Array.isArray(response?.data) ? response.data : [];

        const readValue = (key) => {
          const item = preferences.find((entry) => entry?.key === key);
          return item?.value ?? null;
        };

        const storedChannels = readValue("delivery_channel_settings");
        const storedChargeSettings = readValue("delivery_charge_settings");
        const storedCourierSettings = readValue("courier_settings");
        const companyDefaults = {
          store_name: String(readValue("application_name") || "").trim(),
          address: String(readValue("application_address") || "").trim(),
          contact_phone: String(readValue("application_phone") || "").trim(),
        };

        if (Array.isArray(storedChannels)) {
          const storedMap = new Map(storedChannels.map((item) => [String(item.name).toLowerCase(), item]));
          setChannels((prev) =>
            prev.map((item) => {
              const match = storedMap.get(String(item.name).toLowerCase());
              return match ? { ...item, ...match } : item;
            })
          );
        }

        if (storedChargeSettings && typeof storedChargeSettings === "object") {
          setDefaultCharge(String(storedChargeSettings.default_charge ?? ""));
          setDeliveryChargeMode(
            ["free", "inside_outside", "zonal"].includes(String(storedChargeSettings.delivery_charge_mode))
              ? String(storedChargeSettings.delivery_charge_mode)
              : storedChargeSettings.specific_charges?.length
                ? "zonal"
                : "inside_outside"
          );
          setInsideDhakaCharge(String(storedChargeSettings.inside_dhaka_charge ?? storedChargeSettings.default_charge ?? ""));
          setOutsideDhakaCharge(String(storedChargeSettings.outside_dhaka_charge ?? storedChargeSettings.default_charge ?? ""));
          setCodEnabled(Boolean(storedChargeSettings.cod_enabled ?? true));
          setDeliveryChargeRefundable(!(storedChargeSettings.delivery_charge_not_refundable ?? false));
          setSpecificCharges(
            Array.isArray(storedChargeSettings.specific_charges)
              ? storedChargeSettings.specific_charges.reduce((accumulator, item) => {
                  const scope = String(item?.scope || "district");
                  const zone = String(item?.zone || "").trim();

                  if (zone === "") return accumulator;

                  const existingIndex = accumulator.findIndex(
                    (entry) =>
                      String(entry.scope || "district") === scope &&
                      String(entry.zone || "").trim().toLowerCase() === zone.toLowerCase()
                  );

                  const normalizedItem = {
                    scope,
                    zone,
                    price: String(item?.price ?? ""),
                    cod_enabled: item?.cod_enabled ?? true,
                  };

                  if (existingIndex >= 0) {
                    accumulator[existingIndex] = normalizedItem;
                  } else {
                    accumulator.push(normalizedItem);
                  }

                  return accumulator;
                }, [])
              : []
          );
          setChargeScope(String(storedChargeSettings.charge_scope || "district"));
        }

        setCourierSettings(normalizeCourierSettings(storedCourierSettings, companyDefaults));
      } catch (error) {
        console.error("Failed to load delivery support settings", error);
      }
    };

    loadDeliverySettings();
  }, [accessToken, companyId]);

  useEffect(() => {
    const loadGeoLocations = async () => {
      if (!accessToken) return;

      try {
        setIsGeoLoading(true);
        const response = await getBangladeshGeoLocations(accessToken);
        const data = response?.data || {};

        setGeoOptions({
          divisions: normalizeLocationOptions(data.divisions),
          districts: normalizeLocationOptions(data.districts),
          upazilas: normalizeLocationOptions(data.upazilas),
        });
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load locations from the local location tables");
      } finally {
        setIsGeoLoading(false);
      }
    };

    loadGeoLocations();
  }, [accessToken]);

  useEffect(() => {
    setSpecificCharge((prev) => ({ ...prev, scope: chargeScope, zone: "" }));

    if (chargeScope === "zone") {
      setSelectedDistrictId("");
    }

    if (chargeScope === "district") {
      setSelectedDistrictId("");
    }

    if (chargeScope !== "upazila") {
      setSelectedDistrictId("");
    }
  }, [chargeScope]);

  const selectedScopeOptions = useMemo(() => {
    if (chargeScope === "zone") return geoOptions.divisions;

    if (chargeScope === "upazila") {
      return geoOptions.upazilas.filter(
        (item) => !selectedDistrictId || String(item.districtId) === String(selectedDistrictId)
      );
    }

    return geoOptions.districts.filter(
      (item) => !selectedDivisionId || String(item.divisionId) === String(selectedDivisionId)
    );
  }, [chargeScope, geoOptions, selectedDistrictId, selectedDivisionId]);

  const pickupDistrictOptions = useMemo(
    () =>
      geoOptions.districts.filter(
        (item) =>
          !courierSettings.pickup_location.division_id ||
          String(item.divisionId) === String(courierSettings.pickup_location.division_id)
      ),
    [geoOptions.districts, courierSettings.pickup_location.division_id]
  );

  const pickupUpazilaOptions = useMemo(
    () =>
      geoOptions.upazilas.filter(
        (item) =>
          !courierSettings.pickup_location.district_id ||
          String(item.districtId) === String(courierSettings.pickup_location.district_id)
      ),
    [geoOptions.upazilas, courierSettings.pickup_location.district_id]
  );

  const courierZoneLabel = useMemo(() => {
    const findLabel = (items, id) => items.find((item) => String(item.id) === String(id))?.label || "";
    const divisionLabel = findLabel(geoOptions.divisions, courierSettings.pickup_location.division_id);
    const districtLabel = findLabel(geoOptions.districts, courierSettings.pickup_location.district_id);
    const upazilaLabel = findLabel(geoOptions.upazilas, courierSettings.pickup_location.upazila_id);

    return [divisionLabel, districtLabel, upazilaLabel].filter(Boolean).join(" -> ");
  }, [courierSettings.pickup_location, geoOptions]);

  const scopeFieldConfig = useMemo(() => {
    if (chargeScope === "zone") {
      return {
        title: "Division-based charge",
        description: "Select one division and set a delivery charge for that division.",
        parentLabel: "",
        parentPlaceholder: "",
        itemLabel: "Division",
        itemPlaceholder: "Select division",
      };
    }

    if (chargeScope === "district") {
      return {
        title: "District-based charge",
        description: "Optionally filter by division, then select the district you want to configure.",
        parentLabel: "Division filter",
        parentPlaceholder: "All divisions",
        itemLabel: "District",
        itemPlaceholder: "Select district",
      };
    }

    return {
      title: "Upazila / P.S based charge",
      description: "First choose a district, then pick the specific upazila or police station area.",
      parentLabel: "District",
      parentPlaceholder: "Select district first",
      itemLabel: "Upazila / P.S",
      itemPlaceholder: selectedDistrictId ? "Select upazila / P.S" : "Select district first",
    };
  }, [chargeScope, selectedDistrictId]);

  const addSpecificCharge = () => {
    if (!specificCharge.zone || !specificCharge.price) return;

    setSpecificCharges((prev) => mergeSpecificChargeEntry(prev, specificCharge, chargeScope));

    setSpecificCharge({ ...blankCharge, scope: chargeScope });
    setEditingChargeKey("");
  };

  const updateCourierPickupField = (key, value) => {
    setCourierSettings((prev) => {
      const nextPickupLocation = {
        ...prev.pickup_location,
        [key]: value,
      };

      if (key === "division_id") {
        nextPickupLocation.district_id = "";
        nextPickupLocation.upazila_id = "";
      }

      if (key === "district_id") {
        nextPickupLocation.upazila_id = "";
      }

      return {
        ...prev,
        pickup_location: nextPickupLocation,
      };
    });
  };

  const updateCourierSection = (section, key, value) => {
    setCourierSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const updatePathaoField = (key, value) => {
    updateCourierSection("pathao", key, value);
  };

  const toggleChannel = (index, key = "enabled") => {
    setChannels((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: !item[key] } : item
      )
    );
  };

  const updateChannelNote = (index, value) => {
    setChannels((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, credentials_note: value } : item
      )
    );
  };

  const resetPathaoSettings = () => {
    setCourierSettings((prev) => ({
      ...prev,
      pathao: {
        ...getDefaultCourierSettings().pathao,
        enabled: prev.pathao?.enabled ?? false,
      },
    }));
    setPathaoTestResult("");
  };

  const selectedCourier = channels.find(
    (channel) => String(channel.name || "").trim().toLowerCase() === String(selectedCourierName || "").trim().toLowerCase()
  ) || channels[0];
  const selectedCourierLabel = selectedCourier?.name || selectedCourierName || "Pathao";
  const selectedCourierEnabled = !!selectedCourier?.enabled;
  const selectedCourierIsPathao = isPathaoCourierName(selectedCourierLabel);
  const selectedCourierNameValue = selectedCourierLabel;
  const selectedCourierIndex = channels.findIndex(
    (channel) => String(channel.name || "").trim().toLowerCase() === String(selectedCourierName || "").trim().toLowerCase()
  );

  const resetCourierEditor = () => {
    if (selectedCourierIsPathao) {
      resetPathaoSettings();
      return;
    }

    if (selectedCourierIndex >= 0) {
      setChannels((prev) =>
        prev.map((item, index) =>
          index === selectedCourierIndex
            ? {
                ...item,
                pickup_from_store: true,
                deliver_to_customer: true,
                credentials_note: "",
              }
            : item
        )
      );
    }
  };

  const handleTestPathaoConnection = async () => {
    try {
      setIsTestingPathao(true);
      setPathaoTestResult("");

      const response = await sendPathaoCourierTest(accessToken, {
        pathao: courierSettings.pathao,
      });

      const tokenData = response?.data && typeof response.data === "object" ? response.data : {};
      if (tokenData.access_token || tokenData.expires_in || tokenData.token_type || tokenData.merchant_identifier) {
        setCourierSettings((prev) => ({
          ...prev,
          pathao: {
            ...prev.pathao,
            ...(tokenData.access_token ? { access_token: tokenData.access_token } : {}),
            ...(tokenData.expires_in ? { expires_in: tokenData.expires_in } : {}),
          },
        }));
      }

      setPathaoTestResult(response?.message || "Pathao courier connection verified successfully.");
      Swal.fire({
        icon: "success",
        title: "Pathao connected",
        text: response?.message || "Pathao courier connection verified successfully.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to verify Pathao courier connection";
      setPathaoTestResult(message);
      toast.error(message);
    } finally {
      setIsTestingPathao(false);
    }
  };

  const persistDeliverySupport = async (nextSpecificCharges) => {
    const formData = new FormData();
    formData.append("delivery_channel_settings", JSON.stringify(channels));
    formData.append(
      "delivery_charge_settings",
      JSON.stringify({
        default_charge: defaultCharge,
        delivery_charge_mode: deliveryChargeMode,
        inside_dhaka_charge: insideDhakaCharge,
        outside_dhaka_charge: outsideDhakaCharge,
        cod_enabled: codEnabled,
        cod_mode: "global",
        delivery_charge_not_refundable: !deliveryChargeRefundable,
        specific_charges: nextSpecificCharges,
        charge_scope: chargeScope,
      })
    );
    formData.append("courier_settings", JSON.stringify(courierSettings));

    await updateCompanyPreference(accessToken, formData);
  };

  const populateSpecificChargeForEdit = (item) => {
    const nextScope = String(item?.scope || "district");
    const normalizedItem = {
      ...blankCharge,
      ...item,
      scope: nextScope,
      price: String(item?.price ?? ""),
      cod_enabled: item?.cod_enabled ?? true,
    };

    setChargeScope(nextScope);
    setSpecificCharge(normalizedItem);
    setEditingChargeKey(getSpecificChargeKey(item));

    if (nextScope === "zone") {
      setSelectedDivisionId("");
      setSelectedDistrictId("");
      return;
    }

    if (nextScope === "district") {
      const matchedDistrict = geoOptions.districts.find((entry) => matchesLocationLabel(entry, item?.zone));
      setSelectedDivisionId(matchedDistrict?.divisionId || "");
      setSelectedDistrictId("");
      return;
    }

    const matchedUpazila = geoOptions.upazilas.find((entry) => matchesLocationLabel(entry, item?.zone));
    const matchedDistrict = geoOptions.districts.find(
      (entry) => String(entry.id) === String(matchedUpazila?.districtId || "")
    );

    setSelectedDivisionId(matchedDistrict?.divisionId || "");
    setSelectedDistrictId(matchedUpazila?.districtId || "");
  };

  const deleteSpecificCharge = async (index) => {
    const target = specificCharges[index];
    const nextSpecificCharges = specificCharges.filter((_, itemIndex) => itemIndex !== index);

    try {
      setIsSaving(true);
      await persistDeliverySupport(nextSpecificCharges);
      setSpecificCharges(nextSpecificCharges);

      if (editingChargeKey && editingChargeKey === getSpecificChargeKey(target)) {
        setSpecificCharge({ ...blankCharge, scope: chargeScope });
        setEditingChargeKey("");
      }

      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: "Delivery charge rule removed successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete delivery charge rule");
    } finally {
      setIsSaving(false);
    }
  };

  const saveDeliverySupport = async () => {
    try {
      setIsSaving(true);

      const nextSpecificCharges = mergeSpecificChargeEntry(specificCharges, specificCharge, chargeScope);
      await persistDeliverySupport(nextSpecificCharges);
      setSpecificCharges(nextSpecificCharges);
      if (specificCharge.zone && specificCharge.price) {
        setSpecificCharge({ ...blankCharge, scope: chargeScope });
      }
      setEditingChargeKey("");

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Delivery settings updated successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update delivery support");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/company-preference/shop-setup")}
            className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <PiArrowLeft size={24} />
          </button>
              <div>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                  Shop Setup
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Delivery Support
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
                  Configure courier availability, default charge rules, and default COD from one place.
                </p>
              {!deliverySupportAllowed ? (
                <div className="mt-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Read only except default charge and COD
                </div>
              ) : null}
            </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Channels</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{channels.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Custom Rules</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{specificCharges.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Default COD</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{codEnabled ? "On" : "Off"}</p>
              </div>
            </div>
          </div>
        </div>

        <section
          className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${
            deliverySupportAllowed ? "" : "pointer-events-none select-none opacity-60"
          }`}
        >
          <div className="flex items-center justify-between gap-4 px-1">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">Courier Partners</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add and configure a courier here. The form below replaces the old courier list and toggle layout.
              </p>
            </div>
          </div>

          <div
            className={`mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm ${
              deliverySupportAllowed ? "" : "pointer-events-none select-none opacity-55"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                  Merchant API
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-slate-950">Add New Courier</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Select a courier from the dropdown, then fill in the API credentials and status fields below.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={resetPathaoSettings}
                  disabled={isSaving || isTestingPathao}
                  className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleTestPathaoConnection}
                  disabled={isTestingPathao || !selectedCourierIsPathao || !selectedCourierEnabled}
                  className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isTestingPathao ? "Checking..." : "Verify Connection"}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-base font-semibold text-slate-950">Courier Setup</h4>
                    <p className="mt-1 text-sm text-slate-500">Select the courier first. The fields below will match the chosen courier.</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      selectedCourierEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {selectedCourierEnabled ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Courier Name *</span>
                    <select
                      value={selectedCourierName}
                      onChange={(e) => setSelectedCourierName(e.target.value)}
                      disabled={!deliverySupportAllowed}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                    >
                      {channels.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Courier URL *</span>
                    <select
                      value={courierSettings.pathao.base_url}
                      onChange={(e) => updatePathaoField("base_url", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                    >
                      {getCourierBaseUrlOptions(selectedCourierLabel).map((option) => (
                        <option key={option.value || option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Client ID / API Key *</span>
                    <input
                      type="text"
                      value={courierSettings.pathao.client_id}
                      onChange={(e) => updatePathaoField("client_id", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="Client ID"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Client Secret Key *</span>
                    <input
                      type="password"
                      value={courierSettings.pathao.client_secret}
                      onChange={(e) => updatePathaoField("client_secret", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="Client Secret"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Token Type *</span>
                    <input
                      type="text"
                      value={courierSettings.pathao.grant_type}
                      onChange={(e) => updatePathaoField("grant_type", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="password"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedCourierEnabled ? "Enabled" : "Disabled"}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">{pathaoTestResult || "No verification has been run yet."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Base URL</p>
                      <p className="mt-2 break-all text-sm font-semibold text-slate-900">{courierSettings.pathao.base_url}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Grant Type</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{courierSettings.pathao.grant_type || "password"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                <div className="mb-4">
                  <h4 className="text-base font-semibold text-slate-950">Credentials</h4>
                  <p className="mt-1 text-sm text-slate-500">Pathao merchant login details and token values.</p>
                </div>

                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Username</span>
                    <input
                      type="text"
                      value={courierSettings.pathao.username}
                      onChange={(e) => updatePathaoField("username", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="Merchant email or username"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                    <input
                      type="password"
                      value={courierSettings.pathao.password}
                      onChange={(e) => updatePathaoField("password", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="Pathao account password"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Refresh Token</span>
                    <input
                      type="text"
                      value={courierSettings.pathao.refresh_token}
                      onChange={(e) => updatePathaoField("refresh_token", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="Refresh Token"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Access Token *</span>
                    <input
                      type="text"
                      value={courierSettings.pathao.access_token}
                      onChange={(e) => updatePathaoField("access_token", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="Access Token"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Expires In</span>
                    <input
                      type="text"
                      value={courierSettings.pathao.expires_in}
                      onChange={(e) => updatePathaoField("expires_in", e.target.value)}
                      disabled={!deliverySupportAllowed}
                      placeholder="Expires In"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedCourierEnabled ? "Enabled" : "Disabled"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Token Type</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{courierSettings.pathao.grant_type || "password"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mode</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {String(courierSettings.pathao.base_url || "").includes("sandbox") ? "Sandbox" : "Live"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      onClick={saveDeliverySupport}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center rounded-md border border-violet-500 bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="hidden"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between gap-4 px-1">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">Courier Partners</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enable simple delivery partners here. Pathao stays separate because it needs merchant API credentials,
                not just an on/off toggle.
              </p>
            </div>
          </div>
          {channels.map((channel, index) => {
            const channelName = String(channel.name || "").trim();
            const isSelected = String(selectedCourierNameValue).toLowerCase() === channelName.toLowerCase();
            const isPathaoCourier = isPathaoCourierName(channelName);

            return (
              <div key={channel.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
                      {channelName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-950">{channelName}</h2>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            channel.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {channel.enabled ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-base text-slate-500">
                        {isPathaoCourier
                          ? "Configure merchant credentials and shipment controls for Pathao."
                          : "Configure handover behavior for this courier partner."}
                      </p>

                      {isSelected ? (
                        <>
                          <div
                            className={`mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm ${
                              channel.enabled ? "" : "pointer-events-none select-none opacity-55"
                            }`}
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="max-w-2xl">
                                <div className="inline-flex rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                                  Merchant API
                                </div>
                                <h3 className="mt-3 text-2xl font-semibold text-slate-950">Add New Courier</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  Select a courier from the dropdown and the relevant fields will appear below.
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={resetCourierEditor}
                                  disabled={isSaving || isTestingPathao}
                                  className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Clear
                                </button>
                                <button
                                  type="button"
                                  onClick={handleTestPathaoConnection}
                                  disabled={isTestingPathao || !channel.enabled || !isPathaoCourier}
                                  className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isTestingPathao ? "Checking..." : "Verify Connection"}
                                </button>
                              </div>
                            </div>

                            <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                              <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                                <div className="mb-4 flex items-center justify-between gap-4">
                                  <div>
                                    <h4 className="text-base font-semibold text-slate-950">Courier Setup</h4>
                                    <p className="mt-1 text-sm text-slate-500">
                                      {isPathaoCourier
                                        ? "These are the merchant credentials that Pathao will use."
                                        : "These are the handover controls for the selected courier."}
                                    </p>
                                  </div>
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                      channel.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {channel.enabled ? "Active" : "Inactive"}
                                  </span>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="block md:col-span-2">
                                    <span className="mb-2 block text-sm font-medium text-slate-700">Courier Name *</span>
                                    <select
                                      value={selectedCourierNameValue}
                                      onChange={(e) => setSelectedCourierName(e.target.value)}
                                      disabled={!channel.enabled}
                                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                                    >
                                      {channels.map((item) => (
                                        <option key={item.id} value={item.name}>
                                          {item.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  {isPathaoCourier ? (
                                    <>
                                      <label className="block md:col-span-2">
                                        <span className="mb-2 block text-sm font-medium text-slate-700">Courier URL *</span>
                                        <select
                                          value={courierSettings.pathao.base_url}
                                          onChange={(e) => updatePathaoField("base_url", e.target.value)}
                                          disabled={!channel.enabled}
                                          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                                        >
                                          {getCourierBaseUrlOptions(selectedCourierNameValue).map((option) => (
                                            <option key={option.value || option.label} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>

                                      <label className="block">
                                        <span className="mb-2 block text-sm font-medium text-slate-700">Client ID / API Key *</span>
                                        <input
                                          type="text"
                                          value={courierSettings.pathao.client_id}
                                          onChange={(e) => updatePathaoField("client_id", e.target.value)}
                                          disabled={!channel.enabled}
                                          placeholder="Client ID"
                                          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                                        />
                                      </label>

                                      <label className="block">
                                        <span className="mb-2 block text-sm font-medium text-slate-700">Client Secret Key *</span>
                                        <input
                                          type="password"
                                          value={courierSettings.pathao.client_secret}
                                          onChange={(e) => updatePathaoField("client_secret", e.target.value)}
                                          disabled={!channel.enabled}
                                          placeholder="Client Secret"
                                          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                                        />
                                      </label>

                                      <label className="block md:col-span-2">
                                        <span className="mb-2 block text-sm font-medium text-slate-700">Token Type *</span>
                                        <input
                                          type="text"
                                          value={courierSettings.pathao.grant_type}
                                          onChange={(e) => updatePathaoField("grant_type", e.target.value)}
                                          disabled={!channel.enabled}
                                          placeholder="password"
                                          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                                        />
                                      </label>
                                    </>
                                  ) : (
                                    <>
                                      <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <span className="text-sm font-medium text-slate-700">Pickup from store</span>
                                        <input
                                          type="checkbox"
                                          className="toggle toggle-primary"
                                          checked={!!channel.pickup_from_store}
                                          onChange={() => toggleChannel(index, "pickup_from_store")}
                                        />
                                      </label>
                                      <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <span className="text-sm font-medium text-slate-700">Deliver to customer</span>
                                        <input
                                          type="checkbox"
                                          className="toggle toggle-primary"
                                          checked={!!channel.deliver_to_customer}
                                          onChange={() => toggleChannel(index, "deliver_to_customer")}
                                        />
                                      </label>
                                      <label className="md:col-span-2 block">
                                        <span className="mb-2 block text-sm font-medium text-slate-700">Pickup instruction</span>
                                        <textarea
                                          rows="3"
                                          value={channel.credentials_note || ""}
                                          onChange={(e) => updateChannelNote(index, e.target.value)}
                                          placeholder="Rider call instruction, pickup note, or handover instruction"
                                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
                                        />
                                      </label>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                                <div className="mb-4">
                                  <h4 className="text-base font-semibold text-slate-950">Credentials</h4>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {isPathaoCourier
                                      ? "Pathao merchant login details and latest verification state."
                                      : "Delivery partner settings and quick status overview."}
                                  </p>
                                </div>

                                {isPathaoCourier ? (
                                  <div className="grid gap-4">
                                    <label className="block">
                                      <span className="mb-2 block text-sm font-medium text-slate-700">Username</span>
                                      <input
                                        type="text"
                                        value={courierSettings.pathao.username}
                                        onChange={(e) => updatePathaoField("username", e.target.value)}
                                        disabled={!channel.enabled}
                                        placeholder="Merchant email or username"
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                                      />
                                    </label>

                                    <label className="block">
                                      <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                                      <input
                                        type="password"
                                        value={courierSettings.pathao.password}
                                        onChange={(e) => updatePathaoField("password", e.target.value)}
                                        disabled={!channel.enabled}
                                        placeholder="Pathao account password"
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                                      />
                                    </label>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                                      <p className="mt-2 text-sm font-semibold text-slate-900">
                                        {channel.enabled ? "Enabled" : "Disabled"}
                                      </p>
                                      <p className="mt-3 text-xs text-slate-500">
                                        {pathaoTestResult || "No verification has been run yet."}
                                      </p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Base URL</p>
                                        <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                                          {courierSettings.pathao.base_url}
                                        </p>
                                      </div>
                                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Grant Type</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900">
                                          {courierSettings.pathao.grant_type || "password"}
                                        </p>
                                      </div>
                                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mode</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900">
                                          {String(courierSettings.pathao.base_url || "").includes("sandbox") ? "Sandbox" : "Live"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid gap-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                                      <p className="mt-2 text-sm font-semibold text-slate-900">
                                        {channel.enabled ? "Enabled" : "Disabled"}
                                      </p>
                                      <p className="mt-3 text-xs text-slate-500">
                                        {channel.credentials_note || "No courier note added yet."}
                                      </p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pickup</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900">
                                          {channel.pickup_from_store ? "From store" : "Not from store"}
                                        </p>
                                      </div>
                                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Delivery</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900">
                                          {channel.deliver_to_customer ? "To customer" : "Disabled"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <label className="inline-flex items-center justify-end gap-3 self-start rounded-full border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-500">{channel.enabled ? "ON" : "OFF"}</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-lg"
                      checked={!!channel.enabled}
                      onChange={() => toggleChannel(index)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Courier Settings</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Set the pickup point, pickup timing, and settlement details your courier partners should use.
                </p>
              </div>

              <div
                className={`grid gap-4 xl:grid-cols-3 ${
                  deliverySupportAllowed ? "" : "pointer-events-none select-none opacity-60"
                }`}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                      <PiMapPin size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-950">Pickup Location</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Your store or warehouse address where parcels are prepared for courier pickup.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800 md:col-span-2">
                      This is your local pickup profile. Pathao pickup is linked through the merchant store attached to
                      your Pathao credentials; changing this address does not change that Pathao store automatically.
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Store name</span>
                      <input
                        type="text"
                        value={courierSettings.pickup_location.store_name}
                        onChange={(e) => updateCourierPickupField("store_name", e.target.value)}
                        placeholder="Enter store name"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Contact phone</span>
                      <input
                        type="text"
                        value={courierSettings.pickup_location.contact_phone}
                        onChange={(e) => updateCourierPickupField("contact_phone", e.target.value)}
                        placeholder="Enter contact phone"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Address</span>
                      <textarea
                        rows="3"
                        value={courierSettings.pickup_location.address}
                        onChange={(e) => updateCourierPickupField("address", e.target.value)}
                        placeholder="Enter pickup address"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Division</span>
                      <select
                        value={courierSettings.pickup_location.division_id}
                        onChange={(e) => updateCourierPickupField("division_id", e.target.value)}
                        disabled={isGeoLoading}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-slate-300"
                      >
                        <option value="">Select division</option>
                        {geoOptions.divisions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                            {item.nameBn ? ` (${item.nameBn})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">District</span>
                      <select
                        value={courierSettings.pickup_location.district_id}
                        onChange={(e) => updateCourierPickupField("district_id", e.target.value)}
                        disabled={isGeoLoading || !courierSettings.pickup_location.division_id}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-slate-300"
                      >
                        <option value="">
                          {courierSettings.pickup_location.division_id ? "Select district" : "Select division first"}
                        </option>
                        {pickupDistrictOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                            {item.nameBn ? ` (${item.nameBn})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Upazila / P.S</span>
                      <select
                        value={courierSettings.pickup_location.upazila_id}
                        onChange={(e) => updateCourierPickupField("upazila_id", e.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-slate-300"
                        disabled={isGeoLoading || !courierSettings.pickup_location.district_id}
                      >
                        <option value="">Select upazila / P.S</option>
                        {pickupUpazilaOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                            {item.nameBn ? ` (${item.nameBn})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-950">Pickup Summary</h3>
                  <div className="mt-5 space-y-4 text-sm">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                      <span className="text-slate-500">Store Name</span>
                      <span className="text-right font-medium text-slate-900">
                        {courierSettings.pickup_location.store_name || "Not set"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                      <span className="text-slate-500">Contact Phone</span>
                      <span className="text-right font-medium text-slate-900">
                        {courierSettings.pickup_location.contact_phone || "Not set"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                      <span className="text-slate-500">Address</span>
                      <span className="text-right font-medium text-slate-900">
                        {courierSettings.pickup_location.address || "Not set"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-slate-500">Courier Zone</span>
                      <span className="text-right font-medium text-slate-900">
                        {courierZoneLabel || "Not selected"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`grid gap-4 xl:grid-cols-2 ${
                  deliverySupportAllowed ? "" : "pointer-events-none select-none opacity-60"
                }`}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                      <PiClock size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-950">Daily Pickup Window</h3>
                      <p className="mt-1 text-sm text-slate-500">Default time window when courier can come to collect packages.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Start time</span>
                      <input
                        type="time"
                        value={courierSettings.pickup_window.start_time}
                        onChange={(e) => updateCourierSection("pickup_window", "start_time", e.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-slate-300"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">End time</span>
                      <input
                        type="time"
                        value={courierSettings.pickup_window.end_time}
                        onChange={(e) => updateCourierSection("pickup_window", "end_time", e.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-slate-300"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Pickup note</span>
                      <textarea
                        rows="3"
                        value={courierSettings.pickup_window.notes}
                        onChange={(e) => updateCourierSection("pickup_window", "notes", e.target.value)}
                        placeholder="Example: Call before arrival, pickup from rear gate, open after 10 AM"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-700">
                      <PiCreditCard size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-950">Payment Details</h3>
                      <p className="mt-1 text-sm text-slate-500">Where courier settlement or payout should be sent.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Payment method</span>
                      <select
                        value={courierSettings.payment_details.method}
                        onChange={(e) => updateCourierSection("payment_details", "method", e.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-slate-300"
                      >
                        <option value="">Select payment method</option>
                        {courierPaymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Account number</span>
                      <input
                        type="text"
                        value={courierSettings.payment_details.account_number}
                        onChange={(e) => updateCourierSection("payment_details", "account_number", e.target.value)}
                        placeholder="Enter account number"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Account holder name</span>
                      <input
                        type="text"
                        value={courierSettings.payment_details.account_holder_name}
                        onChange={(e) => updateCourierSection("payment_details", "account_holder_name", e.target.value)}
                        placeholder="Enter account holder name"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                      />
                    </label>

                    {courierSettings.payment_details.method === "Bank Account" ? (
                      <>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Bank name</span>
                          <input
                            type="text"
                            value={courierSettings.payment_details.bank_name}
                            onChange={(e) => updateCourierSection("payment_details", "bank_name", e.target.value)}
                            placeholder="Enter bank name"
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Branch name</span>
                          <input
                            type="text"
                            value={courierSettings.payment_details.branch_name}
                            onChange={(e) => updateCourierSection("payment_details", "branch_name", e.target.value)}
                            placeholder="Enter branch name"
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                          />
                        </label>

                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Routing number</span>
                          <input
                            type="text"
                            value={courierSettings.payment_details.routing_number}
                            onChange={(e) => updateCourierSection("payment_details", "routing_number", e.target.value)}
                            placeholder="Enter routing number"
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                </div>
                </div>
              </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold text-slate-950">Bangladesh delivery charge</p>
              <p className="mt-2 text-sm text-slate-500">Choose a simple Bangladesh-wide charge, free delivery, or detailed zonal pricing.</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {[
                  { id: "inside_outside", title: "Dhaka / Outside Dhaka", text: "Set separate charges for Dhaka and other districts." },
                  { id: "free", title: "Free delivery", text: "No delivery charge for any Bangladesh location." },
                  { id: "zonal", title: "Zonal pricing", text: "Set charges by division, district, or upazila." },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDeliveryChargeMode(option.id)}
                    className={`rounded-xl border p-4 text-left transition ${deliveryChargeMode === option.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <span className="block font-semibold text-slate-950">{option.title}</span>
                    <span className="mt-1 block text-sm text-slate-500">{option.text}</span>
                  </button>
                ))}
              </div>

              {deliveryChargeMode === "inside_outside" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Inside Dhaka</span>
                    <input
                      type="number"
                      min="0"
                      value={insideDhakaCharge}
                      onChange={(e) => setInsideDhakaCharge(e.target.value)}
                      placeholder="Enter Dhaka charge"
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-slate-300"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Outside Dhaka</span>
                    <input
                      type="number"
                      min="0"
                      value={outsideDhakaCharge}
                      onChange={(e) => setOutsideDhakaCharge(e.target.value)}
                      placeholder="Enter outside Dhaka charge"
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-slate-300"
                    />
                  </label>
                </div>
              ) : null}

              {deliveryChargeMode === "free" ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Delivery is free for all Bangladesh locations. COD remains free as configured below.
                </div>
              ) : null}

              {deliveryChargeMode === "zonal" ? (
                <label className="mt-4 block max-w-md">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Fallback charge</span>
                  <input
                    type="number"
                    min="0"
                    value={defaultCharge}
                    onChange={(e) => setDefaultCharge(e.target.value)}
                    placeholder="Enter fallback charge"
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-slate-300"
                  />
                </label>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <div>
                  <span className="block text-lg font-semibold text-slate-950">COD availability</span>
                  <span className="mt-1 block text-sm text-slate-500">COD is free. Choose whether it is available globally or by delivery area.</span>
                </div>
                <span className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-slate-500">{codEnabled ? "YES" : "NO"}</span>
                  <input type="checkbox" className="toggle toggle-lg toggle-primary" checked={codEnabled} onChange={() => setCodEnabled((prev) => !prev)} />
                </span>
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <div>
                  <span className="block text-lg font-semibold text-slate-950">Refund Delivery Charge</span>
                  <span className="mt-1 block text-sm text-slate-500">Turn this off if delivery fees should stay non-refundable.</span>
                </div>
                <span className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-slate-500">{deliveryChargeRefundable ? "YES" : "NO"}</span>
                <input
                  type="checkbox"
                  className="toggle toggle-lg toggle-primary"
                  checked={!deliveryChargeRefundable}
                  onChange={() => setDeliveryChargeRefundable((prev) => !prev)}
                />
                </span>
              </label>
            </div>

            {deliveryChargeMode === "zonal" ? <div className={`border-t border-slate-200 pt-8 ${deliverySupportAllowed ? "" : "pointer-events-none select-none opacity-60"}`}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-950">Location-Based Pricing</h3>
                  <p className="mt-2 text-sm text-slate-500">Create targeted delivery charges for divisions, districts, or specific upazila areas.</p>
                </div>
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {[
                    { id: "zone", label: "Zones" },
                    { id: "district", label: "Districts" },
                    { id: "upazila", label: "Upazila/P.S" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setChargeScope(item.id)}
                      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                        chargeScope === item.id
                          ? "bg-slate-900 text-white"
                          : "bg-transparent text-slate-600 hover:bg-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-950">{scopeFieldConfig.title}</h4>
                    <p className="mt-1 text-sm text-slate-500">{scopeFieldConfig.description}</p>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                    {chargeScope} rule
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-5">
                  {chargeScope !== "zone" ? (
                    <label className="block xl:col-span-1">
                      <span className="mb-2 block text-sm font-medium text-slate-700">{scopeFieldConfig.parentLabel}</span>
                      <select
                        value={chargeScope === "upazila" ? selectedDistrictId : selectedDivisionId}
                        onChange={(e) => {
                          const nextValue = e.target.value;

                          if (chargeScope === "upazila") {
                            setSelectedDistrictId(nextValue);
                            setSpecificCharge((prev) => ({ ...prev, zone: "" }));
                          } else {
                            setSelectedDivisionId(nextValue);
                            setSpecificCharge((prev) => ({ ...prev, zone: "" }));
                          }
                        }}
                        className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none shadow-sm focus:border-slate-300"
                      >
                        <option value="">{scopeFieldConfig.parentPlaceholder}</option>
                        {(chargeScope === "upazila" ? geoOptions.districts : geoOptions.divisions).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                            {item.nameBn ? ` (${item.nameBn})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className={`block ${chargeScope === "zone" ? "xl:col-span-2" : "xl:col-span-1"}`}>
                    <span className="mb-2 block text-sm font-medium text-slate-700">{scopeFieldConfig.itemLabel}</span>
                    <select
                      value={specificCharge.zone}
                      onChange={(e) => setSpecificCharge((prev) => ({ ...prev, zone: e.target.value }))}
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none shadow-sm focus:border-slate-300"
                      disabled={isGeoLoading || (chargeScope === "upazila" && !selectedDistrictId)}
                    >
                      <option value="">{scopeFieldConfig.itemPlaceholder}</option>
                      {selectedScopeOptions.map((item) => (
                        <option key={item.id} value={item.label}>
                          {item.label}
                          {item.nameBn ? ` (${item.nameBn})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block xl:col-span-1">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Delivery charge</span>
                    <input
                      type="text"
                      value={specificCharge.price}
                      onChange={(e) => setSpecificCharge((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="Enter price"
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none shadow-sm focus:border-slate-300"
                    />
                  </label>

                  <label className="block xl:col-span-1">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Cash on delivery</span>
                    <span className="flex h-14 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <span className="text-sm font-medium text-slate-700">COD</span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{specificCharge.cod_enabled ? "YES" : "NO"}</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={!!specificCharge.cod_enabled}
                          onChange={() =>
                            setSpecificCharge((prev) => ({ ...prev, cod_enabled: !prev.cod_enabled }))
                          }
                        />
                      </span>
                    </span>
                  </label>

                  <div className="flex items-end xl:col-span-1">
                    <button
                      type="button"
                      onClick={addSpecificCharge}
                      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                      {editingChargeKey ? "Update list" : "Add to list"}
                      <PiPlus size={24} />
                    </button>
                  </div>
                </div>
              </div>

              {specificCharges.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {specificCharges.map((item, index) => (
                    <div key={`${item.scope}-${item.zone}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          {item.scope}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.cod_enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          COD {item.cod_enabled ? "On" : "Off"}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-slate-950">{item.zone}</p>
                      <p className="mt-1 text-sm text-slate-500">Charge</p>
                      <p className="text-base font-semibold text-slate-900">{item.price}</p>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => populateSpecificChargeForEdit(item)}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSpecificCharge(index)}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          disabled={isSaving}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="mt-4 text-sm text-slate-500">
                `Edit` loads an existing rule back into the form. `Delete` removes a saved rule immediately. `Save Delivery Settings` still saves your current delivery form state.
              </p>
            </div> : null}

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={saveDeliverySupport}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border-0 bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Delivery Settings"}
              </button>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}

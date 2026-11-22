import axiosInstance from "../config/axiosInstance";

const FEATURE_CODE_BY_FIELD = {
  has_category: "ftr_product_categories",
  has_brand: "ftr_product_brands",
  has_variant: "ftr_product_variants",
  has_segmentation: "ftr_product_segmentation",
  has_barcode: "ftr_product_barcode",
  is_product_modal_in_step: "ftr_in_step_product_modal",
  allow_invoice_delete: "ftr_allow_invoice_delete",
  auto_delete_empty_purchase_invoice: "ftr_auto_delete_empty_purchase_invoice",
  stock_movement_timeline: "ftr_stock_movement_timeline",
  stock_visibility_control: "ftr_stock_visibility_control",
  stockguard: "ftr_stockguard",
  password_protected_routes: "ftr_password_protected_routes",
};

const SETTINGS_CACHE_TTL = 60 * 1000; // 60 seconds
const settingsCache = new Map();

export const clearProductSettingsCache = () => {
  settingsCache.clear();
};

//view
export const getproductSettings = async (accessToken, params) => {
  try {
    const cacheKey = JSON.stringify({
      token: accessToken ? String(accessToken).slice(-16) : "guest",
      params: params || {},
    });
    const now = Date.now();
    const cached = settingsCache.get(cacheKey);

    if (cached?.data && now - cached.timestamp < SETTINGS_CACHE_TTL) {
      return cached.data;
    }

    if (cached?.promise) {
      return cached.promise;
    }

    const axiosInstanceApi = axiosInstance(accessToken);
    const requestPromise = axiosInstanceApi.get("/feature-preferences", {
      params: params,
    }).then((response) => {
      if (response.data.status) {
        settingsCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now(),
        });
        return response.data;
      }
      throw new Error("Failed to fetch Product Setup: Unexpected response status");
    }).finally(() => {
      const latest = settingsCache.get(cacheKey);
      if (latest?.promise) {
        settingsCache.set(cacheKey, {
          data: latest.data,
          timestamp: latest.timestamp || Date.now(),
        });
      }
    });

    settingsCache.set(cacheKey, { promise: requestPromise, timestamp: now });
    return await requestPromise;
  } catch (error) {
    console.error("Error fetching Product Setup:", error.message || error);
    throw error;
  }
};

//update
export const updateProductSettings = async (accessToken, field, value) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const code = FEATURE_CODE_BY_FIELD[field] || field;
    const response = await axiosInstanceApi.put(`/feature-preferences/${code}`, {
      is_active: value ? 1 : 0,
    });

    if (response.data.status) {
      clearProductSettingsCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("stoqio:feature-preferences-updated", {
            detail: {
              code,
              is_active: Boolean(value),
            },
          })
        );
      }
      return response.data;
    } else {
      throw new Error(
        response.data.message || "Failed to update product settings"
      );
    }
  } catch (error) {
    console.error("Error updating product settings", error.message || error);
    throw error;
  }
};

export const updateFeaturePreferenceGroup = async (
  accessToken,
  group,
  value
) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(
      `/feature-preferences/groups/${group}`,
      { is_active: value ? 1 : 0 }
    );

    if (!response.data.status) {
      throw new Error(
        response.data.message || 'Failed to update feature group'
      );
    }

    clearProductSettingsCache();
    if (typeof window !== 'undefined') {
      (response.data?.data?.preferences || []).forEach((preference) => {
        window.dispatchEvent(
          new CustomEvent('stoqio:feature-preferences-updated', {
            detail: {
              code: preference.code,
              is_active: Boolean(preference.is_active),
            },
          })
        );
      });
    }

    return response.data;
  } catch (error) {
    console.error('Error updating feature group', error.message || error);
    throw error;
  }
};

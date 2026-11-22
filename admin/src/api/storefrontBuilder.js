import axiosInstance from "../config/axiosInstance";

export const getStorefrontHomeBuilder = async (accessToken) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/storefront/home-builder");

    if (response.data?.status) {
      return response.data;
    }

    throw new Error(response.data?.message || "Failed to load storefront builder");
  } catch (error) {
    console.error("Error loading storefront builder:", error.message || error);
    throw error;
  }
};

export const updateStorefrontHomeBuilder = async (accessToken, builder) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.put("/storefront/home-builder", { builder });

    if (response.data?.status) {
      return response.data;
    }

    throw new Error(response.data?.message || "Failed to save storefront builder");
  } catch (error) {
    console.error("Error saving storefront builder:", error.message || error);
    throw error;
  }
};

export const uploadStorefrontSectionMedia = async (accessToken, files) => {
  const api = axiosInstance(accessToken);
  const formData = new FormData();
  (Array.isArray(files) ? files : [files]).filter(Boolean).forEach((file) => formData.append("files[]", file));
  const response = await api.post("/storefront/home-builder/media", formData);

  if (response.data?.status) return response.data;
  throw new Error(response.data?.message || "Failed to upload section media");
};

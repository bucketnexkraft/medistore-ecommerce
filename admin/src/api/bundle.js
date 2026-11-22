import axiosInstance from "./../config/axiosInstance";

export const getBundles = async (accessToken, params) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/bundles", { params });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to fetch bundles: Unexpected response status");
  } catch (error) {
    console.error("Error fetching bundles:", error.message || error);
    throw error;
  }
};

export const getBundle = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get(`/bundles/${id}`);

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to fetch bundle: Unexpected response status");
  } catch (error) {
    console.error("Error fetching bundle:", error.message || error);
    throw error;
  }
};

export const storeBundle = async (accessToken, data) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post("/bundles", data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to create bundle: Unexpected response status");
  } catch (error) {
    console.error("Error creating bundle:", error.message || error);
    throw error;
  }
};

export const updateBundle = async (accessToken, id, data) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.put(`/bundles/${id}`, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to update bundle: Unexpected response status");
  } catch (error) {
    console.error("Error updating bundle:", error.message || error);
    throw error;
  }
};

export const deleteBundle = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.delete(`/bundles/${id}`);

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to delete bundle: Unexpected response status");
  } catch (error) {
    console.error("Error deleting bundle:", error.message || error);
    throw error;
  }
};

export const previewBundlePrice = async (accessToken, id, params) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get(`/bundles/${id}/price-preview`, { params });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to preview bundle price: Unexpected response status");
  } catch (error) {
    console.error("Error previewing bundle price:", error.message || error);
    throw error;
  }
};

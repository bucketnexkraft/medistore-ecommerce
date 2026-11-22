import axiosInstance from "./../config/axiosInstance";

export const getUnits = async (accessToken, params) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/units", { params });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to fetch units: Unexpected response status");
  } catch (error) {
    console.error("Error fetching units:", error.message || error);
    throw error;
  }
};

export const storeUnit = async (accessToken, data) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post("/unit/store", data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to store unit: Unexpected response status");
  } catch (error) {
    console.error("Error storing unit:", error.message || error);
    throw error;
  }
};

export const updateUnit = async (accessToken, id, data) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post(`/unit/update/${id}`, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to update unit: Unexpected response status");
  } catch (error) {
    console.error("Error updating unit:", error.message || error);
    throw error;
  }
};

export const deleteUnits = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const url = Array.isArray(id) ? "/unit/multiple-delete" : `/unit/delete/${id}`;
    const response = await api.delete(url, {
      data: Array.isArray(id) ? { ids: id } : undefined,
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to delete unit: Unexpected response status");
  } catch (error) {
    console.error("Error deleting unit:", error.message || error);
    throw error;
  }
};

export const updateUnitStatus = async (accessToken, id, data) => {
  try {
    const api = axiosInstance(accessToken);
    const url = Array.isArray(id)
      ? "/unit/status-update/multiple"
      : `/unit/update-status/${id}`;
    const payload = Array.isArray(id) ? { ids: id, is_active: data.is_active } : data;

    const response = await api.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to update unit status: Unexpected response status");
  } catch (error) {
    console.error("Error updating unit status:", error.message || error);
    throw error;
  }
};

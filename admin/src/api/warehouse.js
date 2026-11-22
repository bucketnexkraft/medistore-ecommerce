import axiosInstance from "./../config/axiosInstance";

export const getWarehouse = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/warehouses", {
      params: params,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch Variants: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching Variants:", error.message || error);
    throw error;
  }
};


export const createWarehouse = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post("warehouses/store", params);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch Variants: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching Variants:", error.message || error);
    throw error;
  }
};

export const updateWarehouse = async (accessToken, id, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post(`warehouses/update/${id}`, params);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch Variants: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching Variants:", error.message || error);
    throw error;
  }
};

export const deleteWarehouse = async (accessToken, ids) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    
    // Handle single vs multiple deletion
    if (Array.isArray(ids)) {
      // Multiple delete - use bulk endpoint if available, otherwise delete individually
      const response = await axiosInstanceApi.delete("/warehouses", {
        data: { ids },
      });
      
      if (response.data.status) {
        return response.data;
      } else {
        throw new Error("Failed to delete warehouses: Unexpected response status");
      }
    } else {
      // Single delete - use the correct route with ID parameter
      const response = await axiosInstanceApi.delete(`/warehouses/${ids}`);
      
      if (response.data.status) {
        return response.data;
      } else {
        throw new Error("Failed to delete warehouse: Unexpected response status");
      }
    }
  } catch (error) {
    console.error("Error deleting warehouses:", error.message || error);
    throw error;
  }
};

export const getPaymentMethods = async (accessToken) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/pos/settings");

    if (response.data.status) {
      return response.data.data;
    } else {
      throw new Error("Failed to fetch payment methods: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching payment methods:", error.message || error);
    throw error;
  }
};
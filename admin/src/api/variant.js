import axiosInstance from "./../config/axiosInstance";

export const getVariants = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/product-variants", {
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


export const createVariant = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post("/product-variant/store", params);

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

export const updateVariant = async (accessToken, id, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post(`/product-variant/update/${id}`, params);

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

export const updateVariantStatus = async (accessToken, ids, payload) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put("/variants/status", {
      ids: Array.isArray(ids) ? ids : [ids],
      ...payload,
    });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to update variant status");
    }
  } catch (error) {
    console.error("Error updating variant status:", error.message || error);
    throw error;
  }
};

export const deleteVariant = async (accessToken, id, params = null) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const url = Array.isArray(id) ? "/product-variant/multiple-delete" : `/product-variant/delete/${id}`;
    const response = await axiosInstanceApi.delete(url, {
      data: Array.isArray(id) ? { ids: id } : undefined,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to delete brand: Unexpected response status");
    }
  } catch (error) {
    console.error("Error deleting brand:", error.message || error);
    throw error;
  }
};

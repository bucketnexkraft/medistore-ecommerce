import axiosInstance from "../config/axiosInstance";

const parseApiError = (error, fallback) => {
  const message =
    error?.response?.data?.errors?.[0] ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;
  return new Error(message);
};

//view
export const getDiscounts = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/discounts-setup/list", {
      params: params,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch discounts: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching discounts:", error.message || error);
    throw parseApiError(error, "Failed to fetch discounts");
  }
};

//store
export const storeDiscounts = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post(
      "/discounts-setup/store",
      data
    );

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        "Failed to store discount setup: Unexpected response status"
      );
    }
  } catch (error) {
    console.error("Error storing discount setup:", error.message || error);
    throw parseApiError(error, "Failed to store discount setup");
  }
};

//update
export const updateDiscounts = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post(
      `/discounts-setup/update/${id}`,
      data
    );

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to update discount setup: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating discount setup.", error.message || error);
    throw parseApiError(error, "Failed to update discount setup");
  }
};

//delete
export const deleteDiscounts = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const idSegment = Array.isArray(id) ? id.join(",") : id;

    const response = await axiosInstanceApi.delete(`/discounts-setup/delete/${idSegment}`);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to delete discount setup: Unexpected response status");
    }
  } catch (error) {
    console.error("Error deleting discount setup.", error.message || error);
    throw parseApiError(error, "Failed to delete discount setup");
  }
};

//update status
export const updateDiscountStatus = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const url = Array.isArray(id) ? "/discounts-setup/status-update/multiple" : `/discounts-setup/update-status/${id}`;
    const payload = Array.isArray(id) ? { ids: id, status: data.status } : data;

    const response = await axiosInstanceApi.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to update discount status: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating discount status:", error.message || error);
    throw parseApiError(error, "Failed to update discount status");
  }
};


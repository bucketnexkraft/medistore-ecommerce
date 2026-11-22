import axiosInstance from "../config/axiosInstance";

const parseApiError = (error, fallback) => {
  const validationErrors = error?.response?.data?.errors;
  const validationMessage = Array.isArray(validationErrors)
    ? validationErrors[0]
    : validationErrors && typeof validationErrors === "object"
      ? Object.values(validationErrors).flat().filter(Boolean).join(", ")
      : validationErrors;

  const message =
    validationMessage ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

  return new Error(message);
};

export const getRewardsList = async (accessToken, params = {}) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/reword-setup/list", {
      params,
    });
    return response.data;
  } catch (error) {
    throw parseApiError(error, "Failed to fetch rewards");
  }
};

export const storeRewards = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/reword-setup/store", data);
    return response.data;
  } catch (error) {
    throw parseApiError(error, "Failed to store reward");
  }
};

export const getRewards = async (accessToken) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/reword-setup/single");

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch Rewards: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching Rewards:", error.message || error);
    throw parseApiError(error, "Failed to fetch Rewards");
  }
};

export const updateRewards = async (accessToken, formData, id) => {
  try {
    const api = axiosInstance(accessToken);

    const response = await api.post(`/reword-setup/update/${id}`, formData);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Update failed: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating Rewards:", error.message || error);
    throw parseApiError(error, "Failed to update reward");
  }
};

export const deleteRewards = async (accessToken, ids) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete(`/reword-setup/delete/${ids.join(",")}`);
    return response.data;
  } catch (error) {
    throw parseApiError(error, "Failed to delete rewards");
  }
};

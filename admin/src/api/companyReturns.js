import axiosInstance from "../config/axiosInstance";

export const getCompanyReturns = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/company/returns", { params });

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to fetch return requests");
  } catch (error) {
    console.error("Error fetching return requests:", error?.message || error);
    throw error;
  }
};

export const approveCompanyReturn = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.put(`/company/returns/${id}/approve`);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to approve return request");
  } catch (error) {
    console.error("Error approving return request:", error?.message || error);
    throw error;
  }
};

export const rejectCompanyReturn = async (accessToken, id, payload) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.put(`/company/returns/${id}/reject`, payload);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to reject return request");
  } catch (error) {
    console.error("Error rejecting return request:", error?.message || error);
    throw error;
  }
};

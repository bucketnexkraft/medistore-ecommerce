import axiosInstance from "../config/axiosInstance";

export const getCompanyPayouts = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/company/payout-requests", { params });

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to fetch payout requests");
  } catch (error) {
    console.error("Error fetching payout requests:", error?.message || error);
    throw error;
  }
};

export const approveCompanyPayout = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.put(`/company/payout-requests/${id}/approve`);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to approve payout request");
  } catch (error) {
    console.error("Error approving payout request:", error?.message || error);
    throw error;
  }
};

export const rejectCompanyPayout = async (accessToken, id, payload) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.put(`/company/payout-requests/${id}/reject`, payload);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to reject payout request");
  } catch (error) {
    console.error("Error rejecting payout request:", error?.message || error);
    throw error;
  }
};

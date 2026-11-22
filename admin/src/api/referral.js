import axiosInstance from "../config/axiosInstance";

export const getReferralDashboard = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/referrals/dashboard", {
      params,
    });

    if (response.data?.status) {
      return response.data;
    }

    throw new Error(response.data?.message || "Failed to load referral dashboard");
  } catch (error) {
    console.error("Error loading referral dashboard:", error.message || error);
    throw error;
  }
};

export const getReferralPayouts = async (accessToken) => {
  const response = await axiosInstance(accessToken).get("/referrals/payout-requests");
  return response.data;
};

export const createReferralPayout = async (accessToken, payload) => {
  const response = await axiosInstance(accessToken).post("/referrals/payout-requests", payload);
  return response.data;
};

import axiosInstance from "../../config/axiosInstance";

export const getBackofficeDashboard = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/dashboard");
  return response.data;
};


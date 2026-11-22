import axiosInstance from "../config/axiosInstance";

export const fetchInventoryCopilotInsights = async (accessToken, params = {}) => {
  const axiosInstanceApi = axiosInstance(accessToken);
  const response = await axiosInstanceApi.get("/inventory-copilot/insights", { params });

  return response.data;
};

export const fetchInventoryCopilotSettings = async (accessToken) => {
  const axiosInstanceApi = axiosInstance(accessToken);
  const response = await axiosInstanceApi.get("/inventory-copilot/settings");

  return response.data;
};

export const updateInventoryCopilotSettings = async (accessToken, payload) => {
  const axiosInstanceApi = axiosInstance(accessToken);
  const response = await axiosInstanceApi.put("/inventory-copilot/settings", payload);

  return response.data;
};

import axiosInstance from "../../config/axiosInstance";

export const getPlanPaymentLogs = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/plan-payment-logs", { params });
  return response.data;
};

export const updatePlanPaymentLogStatus = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/plan-payment-logs/${id}/status`, payload);
  return response.data;
};

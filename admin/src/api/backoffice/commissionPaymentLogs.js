import axiosInstance from "../../config/axiosInstance";

export const getCommissionPaymentLogs = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/commission-payment-logs", { params });
  return response.data;
};

export const updateCommissionPaymentLogStatus = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/commission-payment-logs/${id}/status`, payload);
  return response.data;
};

export const sendCommissionPaymentWarning = async (accessToken, companyId, payload = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/backoffice/commission-payment-logs/${companyId}/warning`, payload);
  return response.data;
};

export const disableCommissionCompanyStore = async (accessToken, companyId, payload = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/backoffice/commission-payment-logs/${companyId}/disable-store`, payload);
  return response.data;
};

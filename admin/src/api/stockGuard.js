import axiosInstance from "../config/axiosInstance";

export const fetchStockGuardOptions = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/stockguard/options");
  return response.data;
};

export const fetchStockGuardRequests = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/stockguard/requests", { params });
  return response.data;
};

export const createStockGuardRequest = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/stockguard/requests", payload);
  return response.data;
};

export const approveStockGuardRequest = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/stockguard/requests/${id}/approve`);
  return response.data;
};

export const rejectStockGuardRequest = async (accessToken, id, payload = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/stockguard/requests/${id}/reject`, payload);
  return response.data;
};

export const updateStockGuardRules = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put("/stockguard/rules", payload);
  return response.data;
};

import axiosInstance from "../config/axiosInstance";

export const getCommissionOverview = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/commission/overview");
  return response.data;
};

export const getCommissionGateways = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/commission/gateways");
  return response.data;
};

export const submitCommissionPayment = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/commission/payments", payload);
  return response.data;
};

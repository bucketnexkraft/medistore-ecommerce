import axiosInstance from "../../config/axiosInstance";

export const getBackofficeGateways = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/gateways", { params });
  return response.data;
};

export const getBackofficeGateway = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/gateways/${id}`);
  return response.data;
};

export const updateBackofficeGateway = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/backoffice/gateways/${id}`, payload);
  return response.data;
};

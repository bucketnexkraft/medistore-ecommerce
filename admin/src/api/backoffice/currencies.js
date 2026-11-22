import axiosInstance from "../../config/axiosInstance";

export const getCurrencies = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/currencies", { params });
  return response.data;
};

export const createCurrency = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/currencies", payload);
  return response.data;
};

export const updateCurrency = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/currencies/${id}`, payload);
  return response.data;
};

export const deleteCurrency = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/currencies/${id}`);
  return response.data;
};


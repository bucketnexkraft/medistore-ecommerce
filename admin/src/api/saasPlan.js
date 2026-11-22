import axiosInstance from "../config/axiosInstance";

export const getPlans = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/plans", { params });
  return response.data;
};

export const getPlanOptions = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/plans/options");
  return response.data;
};

export const createPlan = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/plans", payload);
  return response.data;
};

export const updatePlan = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/plans/${id}`, payload);
  return response.data;
};

export const deletePlan = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/plans/${id}`);
  return response.data;
};

export const updatePlanStatus = async (accessToken, id, status) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/plans/${id}/status`, { status });
  return response.data;
};

export const updatePlanDefault = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/plans/${id}/default`);
  return response.data;
};

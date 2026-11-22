import axiosInstance from "../config/axiosInstance";

export const fetchWaitlists = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/waitlists", { params });
  return response.data;
};

export const submitWaitlist = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/waitlists", payload);
  return response.data;
};

export const fetchWaitlistDetails = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/waitlists/${id}`);
  return response.data;
};

export const claimWaitlist = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/waitlists/${id}/claim`);
  return response.data;
};

export const releaseWaitlist = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/waitlists/${id}/release`);
  return response.data;
};

export const cancelWaitlist = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/waitlists/${id}/cancel`);
  return response.data;
};


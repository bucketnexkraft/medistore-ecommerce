import axiosInstance from "./../config/axiosInstance";

export const getUserDefinedValues = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/user-defined-values", { params });
  return response.data;
};

export const storeUserDefinedValue = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/user-defined-values", payload);
  return response.data;
};

export const updateUserDefinedValue = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/user-defined-values/${id}`, payload);
  return response.data;
};

export const deleteUserDefinedValue = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/user-defined-values/${id}`);
  return response.data;
};


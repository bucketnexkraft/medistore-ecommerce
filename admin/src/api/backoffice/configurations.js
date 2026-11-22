import axiosInstance from "../../config/axiosInstance";

export const getSettingsSections = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/settings/sections");
  return response.data;
};

export const getSettingSection = async (accessToken, key) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/settings/${key}`);
  return response.data;
};

export const updateSettingSection = async (accessToken, key, payload, isFormData = false) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/backoffice/settings/${key}`, payload, isFormData
    ? { headers: { "Content-Type": "multipart/form-data" } }
    : undefined);
  return response.data;
};

export const sendSettingsTestMail = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/settings/email/test", payload);
  return response.data;
};

// Backward-compatible wrappers
export const getBackofficeConfigurations = async (accessToken) =>
  getSettingSection(accessToken, "configurations");

export const updateBackofficeConfigurations = async (accessToken, payload) =>
  updateSettingSection(accessToken, "configurations", payload, false);

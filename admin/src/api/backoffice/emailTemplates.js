import axiosInstance from "../../config/axiosInstance";

export const getEmailTemplates = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/email-templates", { params });
  return response.data;
};

export const updateEmailTemplate = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/email-templates/${id}`, payload);
  return response.data;
};

export const updateEmailTemplateStatus = async (accessToken, id, status) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/email-templates/${id}/status`, { status });
  return response.data;
};


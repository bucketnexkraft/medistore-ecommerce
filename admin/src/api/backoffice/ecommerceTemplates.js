import axiosInstance from "../../config/axiosInstance";

export const getECategories = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/e-categories", { params });
  return response.data;
};

export const createECategory = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/e-categories", payload);
  return response.data;
};

export const updateECategory = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/e-categories/${id}`, payload);
  return response.data;
};

export const deleteECategory = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/e-categories/${id}`);
  return response.data;
};

export const getESectionPresetOptions = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/e-section-presets/options", { params });
  return response.data;
};

export const getESectionPresets = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/e-section-presets", { params });
  return response.data;
};

export const createESectionPreset = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/e-section-presets", payload);
  return response.data;
};

export const updateESectionPreset = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  let response;

  if (payload instanceof FormData) {
    payload.append("_method", "PUT");
    response = await api.post(`/backoffice/e-section-presets/${id}`, payload);
  } else {
    response = await api.put(`/backoffice/e-section-presets/${id}`, payload);
  }

  return response.data;
};

export const deleteESectionPreset = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/e-section-presets/${id}`);
  return response.data;
};

export const getETemplateOptions = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/e-templates/options", { params });
  return response.data;
};

export const getETemplates = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/e-templates", { params });
  return response.data;
};

export const getETemplateById = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/e-templates/${id}`);
  return response.data;
};

export const getETemplateBuilder = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/e-templates/${id}/builder`);
  return response.data;
};

export const createETemplate = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/e-templates", payload);
  return response.data;
};

export const updateETemplate = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  let response;

  if (payload instanceof FormData) {
    payload.append("_method", "PUT");
    response = await api.post(`/backoffice/e-templates/${id}`, payload);
  } else {
    response = await api.put(`/backoffice/e-templates/${id}`, payload);
  }

  return response.data;
};

export const deleteETemplate = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/e-templates/${id}`);
  return response.data;
};

export const updateETemplateBuilder = async (accessToken, id, builder) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/e-templates/${id}/builder`, { builder });
  return response.data;
};

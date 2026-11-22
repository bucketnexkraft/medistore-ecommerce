import axiosInstance from "../../config/axiosInstance";

export const getContentPages = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/pages");
  return response.data;
};

export const createContentPage = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/content/pages", payload);
  return response.data;
};

export const updateContentPage = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  let response;
  if (payload instanceof FormData) {
    payload.append("_method", "PUT");
    response = await api.post(`/backoffice/content/pages/${id}`, payload);
  } else {
    response = await api.put(`/backoffice/content/pages/${id}`, payload);
  }
  return response.data;
};

export const getContentPageById = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/content/pages/${id}`);
  return response.data;
};

export const deleteContentPage = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/content/pages/${id}`);
  return response.data;
};

export const syncContentPageSections = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/content/pages/${id}/sections`, payload);
  return response.data;
};

export const getSectionLibrary = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/section-library");
  return response.data;
};

export const updateSectionContentByName = async (accessToken, name, payload) => {
  const api = axiosInstance(accessToken);
  let response;
  if (payload instanceof FormData) {
    payload.append("_method", "PUT");
    response = await api.post(`/backoffice/content/sections/${name}`, payload);
  } else {
    response = await api.put(`/backoffice/content/sections/${name}`, payload);
  }
  return response.data;
};

export const getContentMenus = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/menus");
  return response.data;
};

export const createContentMenu = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/content/menus", payload);
  return response.data;
};

export const updateContentMenu = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/content/menus/${id}`, payload);
  return response.data;
};

export const deleteContentMenu = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/content/menus/${id}`);
  return response.data;
};

export const sortContentMenus = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/content/menus/sort", payload);
  return response.data;
};

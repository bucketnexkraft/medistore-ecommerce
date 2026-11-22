import axiosInstance from "../../config/axiosInstance";

export const getLocationHierarchies = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/location-hierarchies", { params });
  return response.data;
};

export const getLocationHierarchyOptions = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/location-hierarchies/options");
  return response.data;
};

export const createLocationHierarchy = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/location-hierarchies", payload);
  return response.data;
};

export const updateLocationHierarchy = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/location-hierarchies/${id}`, payload);
  return response.data;
};

export const deleteLocationHierarchy = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/location-hierarchies/${id}`);
  return response.data;
};

export const getLocations = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/locations", { params });
  return response.data;
};

export const getLocationParentOptions = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/locations/options", { params });
  return response.data;
};

export const createLocation = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/locations", payload);
  return response.data;
};

export const updateLocation = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/locations/${id}`, payload);
  return response.data;
};

export const deleteLocation = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/locations/${id}`);
  return response.data;
};

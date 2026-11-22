import axiosInstance from "../../config/axiosInstance";

export const getBackofficeAdminSettings = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/admin-settings");
  return response.data;
};

export const updateBackofficeAdminSettings = async (accessToken, formData) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/admin-settings", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};


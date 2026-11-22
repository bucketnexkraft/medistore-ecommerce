import axiosInstance from "../../config/axiosInstance";

export const getBackofficeLanguages = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/languages");
  return response.data;
};

export const createBackofficeLanguage = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const requestPayload = payload instanceof FormData ? payload : (() => {
    const formData = new FormData();
    formData.append("name", payload.name || "");
    formData.append("code", payload.code || "");
    if (payload.image instanceof File) {
      formData.append("image", payload.image);
    }
    return formData;
  })();
  const response = await api.post("/backoffice/languages", requestPayload);
  return response.data;
};

export const updateBackofficeLanguage = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const requestPayload = payload instanceof FormData ? payload : (() => {
    const formData = new FormData();
    formData.append("name", payload.name || "");
    formData.append("code", payload.code || "");
    if (payload.image instanceof File) {
      formData.append("image", payload.image);
    }
    formData.append("_method", "PUT");
    return formData;
  })();
  const response = await api.post(`/backoffice/languages/${id}`, requestPayload);
  return response.data;
};

export const deleteBackofficeLanguage = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/languages/${id}`);
  return response.data;
};

export const getPublicLanguages = async () => {
  const api = axiosInstance();
  const response = await api.get("/translation-languages");
  return response.data;
};

export const downloadEnglishTemplate = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/languages/template/en/download", {
    responseType: "blob",
  });
  return response.data;
};

export const downloadLanguageJson = async (accessToken, code) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/languages/${code}/download`, {
    responseType: "blob",
  });
  return response.data;
};

export const uploadLanguageJson = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const formData = new FormData();
  formData.append("language_id", payload.language_id);
  formData.append("file", payload.file);
  const response = await api.post("/backoffice/languages/upload-json", formData);
  return response.data;
};

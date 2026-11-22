import axiosInstance from "../config/axiosInstance";

export const getEcommerceSetupData = async (accessToken, options = {}) => {
  const api = axiosInstance(accessToken);
  const params = options.includePaid ? { include_paid: 1 } : undefined;
  const response = await api.get("/storefront/ecommerce-setup", { params });
  return response.data;
};

export const getPublicEcommerceSetupData = async () => {
  const api = axiosInstance();
  const response = await api.get("/storefront/ecommerce-setup/public-options");
  return response.data;
};

export const getPublicEcommerceTemplatePreview = async (templateId) => {
  const api = axiosInstance();
  const response = await api.get(`/storefront/ecommerce-setup/public-preview/${templateId}`);
  return response.data;
};

export const applyEcommerceTemplate = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/storefront/ecommerce-setup/apply-template", payload);
  return response.data;
};

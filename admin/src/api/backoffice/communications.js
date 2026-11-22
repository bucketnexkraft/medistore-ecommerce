import axiosInstance from "../../config/axiosInstance";

export const getContactMessages = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/contact-messages", { params });
  return response.data;
};

export const getContactMessageById = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/content/contact-messages/${id}`);
  return response.data;
};

export const deleteContactMessage = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/content/contact-messages/${id}`);
  return response.data;
};

export const sendContactMessageEmail = async (accessToken, email, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/settings/email/test", {
    receiver_email: email,
    subject: payload.subject,
    message: payload.message,
  });
  return response.data;
};

export const getNewsletters = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/newsletters", { params });
  return response.data;
};

export const deleteNewsletter = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/content/newsletters/${id}`);
  return response.data;
};

export const sendNewsletterEmail = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post(`/backoffice/content/newsletters/${id}/send-email`, payload);
  return response.data;
};

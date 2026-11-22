import axios from "axios";
import { API_URL } from "../config/constants";
import axiosInstance from "../config/axiosInstance";

export const registerCompany = async (payload) => {
  const response = await axios.post(`${API_URL}/register-company`, payload);
  return response.data;
};

export const getAvailablePlans = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/plans/available");
  return response.data;
};

export const getPlanGateways = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/plans/gateways");
  return response.data;
};

export const selectCompanyPlan = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/plans/select", payload, {
    headers: {
      Accept: "application/json",
      "X-Payment-Scope": "plan_purchase",
    },
  });
  return response.data;
};

export const getPlanPayments = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/plans/payments", { params });
  return response.data;
};

export const getPlanPaymentCheckout = async (accessToken, paymentLogId) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/plans/payment-checkout/${paymentLogId}`);
  return response.data;
};

export const getTemplateCheckoutOptions = async (accessToken, templateId) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/templates/checkout/${templateId}`);
  return response.data;
};

export const purchaseTemplate = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/templates/purchase", payload);
  return response.data;
};

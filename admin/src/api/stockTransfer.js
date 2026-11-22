import axiosInstance from "../config/axiosInstance";

const normalizeError = (error, fallback = "Request failed") => {
  const res = error?.response;
  return {
    status: false,
    httpStatus: res?.status ?? 0,
    data: res?.data,
    error: {
      message: res?.data?.message || error.message || fallback,
      errors: res?.data?.errors,
    },
  };
};

export const getStockTransfers = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/stock-transfers", { params });
    return response.data;
  } catch (error) {
    return normalizeError(error, "Failed to fetch stock transfers");
  }
};

export const getTransferSourceItems = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/stock-transfers/source-items", { params });
    return response.data;
  } catch (error) {
    return normalizeError(error, "Failed to fetch source stock");
  }
};

export const createStockTransfer = async (accessToken, payload) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post("/stock-transfers", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error) {
    return normalizeError(error, "Failed to create stock transfer");
  }
};

export const getStockTransferReport = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/report/stock-transfer", { params });
    return response.data;
  } catch (error) {
    return normalizeError(error, "Failed to fetch stock transfer report");
  }
};


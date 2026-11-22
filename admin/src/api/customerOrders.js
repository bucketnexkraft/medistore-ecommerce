import axiosInstance from "../config/axiosInstance";

export const getCompanyOrders = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/company/orders", { params });

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to fetch company orders");
  } catch (error) {
    console.error("Error fetching company orders:", error.message || error);
    throw error;
  }
};

export const getCompanyOrder = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get(`/company/orders/${id}`);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to fetch company order");
  } catch (error) {
    console.error("Error fetching company order:", error.message || error);
    throw error;
  }
};

export const createCompanyOrder = async (accessToken, payload) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post("/company/orders", payload);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to create company order");
  } catch (error) {
    console.error("Error creating company order:", error.message || error);
    throw error;
  }
};

export const updateCompanyOrderStatus = async (accessToken, id, payload) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.put(`/company/orders/${id}/status`, payload);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to update company order");
  } catch (error) {
    console.error("Error updating company order:", error.message || error);
    throw error;
  }
};

export const dispatchCompanyOrderToPathao = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post(`/company/orders/${id}/dispatch/pathao`);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to submit order to Pathao");
  } catch (error) {
    console.error("Error submitting order to Pathao:", error.message || error);
    throw error;
  }
};

export const trackCompanyOrderByNumber = async (accessToken, orderNo) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/company/orders/track/by-number", {
      params: {
        order_no: orderNo,
      },
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to track company order");
  } catch (error) {
    console.error("Error tracking company order:", error.message || error);
    throw error;
  }
};

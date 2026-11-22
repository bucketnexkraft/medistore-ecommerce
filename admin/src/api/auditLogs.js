import axiosInstance from "../config/axiosInstance";

export const getAuditLogs = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/audit-logs", { params });

    if (response.data?.status) return response.data;
    throw new Error(response.data?.message || "Failed to fetch audit logs");
  } catch (error) {
    throw error;
  }
};

export const getAuditLogById = async (accessToken, id) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get(`/audit-logs/${id}`);
    if (response.data?.status) return response.data;
    throw new Error(response.data?.message || "Failed to fetch audit log details");
  } catch (error) {
    throw error;
  }
};


// src/api/timesheet.js

import axiosInstance from "../config/axiosInstance";

/**
 * Start a new shift for the authenticated user
 */
export const startShift = async (accessToken, data) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post("/timesheet/start", data);

    // Adjust this based on your actual API response structure
    if (response.data.status !== undefined ? response.data.status : response.status === 201) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to start shift");
    }
  } catch (error) {
    console.error("Error starting shift:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

/**
 * Handover current shift to another user
 */
export const handoverShift = async (accessToken, data) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post("/timesheet/handover", data);

    if (response.data.status !== undefined ? response.data.status : response.status === 200) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Handover failed");
    }
  } catch (error) {
    console.error("Error handing over shift:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

/**
 * Get current active shift of the authenticated user (no userId needed)
 */
export const getCurrentShift = async (accessToken) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/timesheet/current");
    const payload = response?.data;

    // Wrapped shape: { status: 1, data: {...} }
    if (payload?.status !== undefined) {
      if (!payload.status) return null;
      return payload?.data ?? null;
    }

    // Direct shape: {...shift} or null
    return payload ?? null;
  } catch (error) {
    // If 404 or no active shift, treat as "no shift"
    if (error.response?.status === 404) {
      return null;
    }
    console.error("Error fetching current shift:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

/**
 * Get list of users (for handover dropdown)
 * Kept consistent with your existing style
 */
export const getUsers = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/timesheet/users", { params });

    if (response.data.status !== undefined ? response.data.status : true) {
      return response.data;
    } else {
      throw new Error("Failed to fetch users: Invalid response");
    }
  } catch (error) {
    console.error("Error fetching users:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

/**
 * Mid-shift cash handover (cash drop to manager)
 */
export const cashHandover = async (accessToken, data) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.post("/timesheet/cash-handover", data);
    if (response.data.status !== undefined ? response.data.status : response.status === 200) {
      return response.data;
    }
    throw new Error(response.data.message || "Cash handover failed");
  } catch (error) {
    console.error("Error in cash handover:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

/**
 * Get closing cash flow summary for active shift
 */
export const getShiftCloseSummary = async (accessToken) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/timesheet/close-summary");
    if (response.data?.status) {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Failed to fetch shift summary");
  } catch (error) {
    console.error("Error fetching shift close summary:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

import axiosInstance from "../config/axiosInstance";

export const getBangladeshGeoLocations = async (accessToken, params = {}) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/geo/locations", { params });

    if (response.data?.status) {
      return response.data;
    }

    throw new Error("Failed to fetch Bangladesh geo locations");
  } catch (error) {
    console.error("Error fetching Bangladesh geo locations:", error.message || error);
    throw error;
  }
};

import axiosInstance from "../config/axiosInstance";

export const getDashboardReport = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/dashboard", {
            params: params,
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch stock out: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching stock out:", error.message || error);
        throw error;
    }
};

export const getDashboardDetails = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/dashboard/details", {
            params,
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch dashboard details: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching dashboard details:", error.message || error);
        throw error;
    }
};

import axiosInstance from "./../config/axiosInstance";

export const fetchingStockOutList = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/stock/out", {
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

export const fetchStockMovements = async (accessToken, params = {}) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/stock/movements", {
            params,
        });

        return response.data;
    } catch (error) {
        const res = error?.response;
        return {
            status: false,
            httpStatus: res?.status ?? 0,
            data: res?.data,
            error: {
                message: res?.data?.message || error.message || "Request failed",
                errors: res?.data?.errors,
            },
        };
    }
};

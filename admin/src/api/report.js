import axiosInstance from "../config/axiosInstance";

export const getDailyMonthlySales = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/daily/monthly/sale/report", {
            params: params,
        });

        if (response.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch customers: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching customers:", error.message || error);
        throw error;
    }
};

export const getDailyMonthlyPurchase = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/daily/monthly/purchase/report", {
            params: params,
        });

        if (response.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch customers: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching customers:", error.message || error);
        throw error;
    }
};

export const getSupplierPurchaseReport = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/supplier/purchase/report", {
            params,
        });

        if (response.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch supplier purchase report: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching supplier purchase report:", error.message || error);
        throw error;
    }
};

export const getStockByCategory = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/categorywise/stock/report", {
            params: params,
        });

        if (response.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch customers: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching customers:", error.message || error);
        throw error;
    }
};

export const getSalesByCategory = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/categorywise/sale/report", {
            params: params,
        });

        if (response.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch customers: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching customers:", error.message || error);
        throw error;
    }
};

export const getProfitMarginReport = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/profit/margin/report", {
            params: params,
        });

        if (response.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch profit margin report: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching profit margin report:", error.message || error);
        throw error;
    }
};

export const getAccountsReport = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/accounts/report", {
            params,
        });

        if (response.data.status) {
            return response.data;
        }

        throw new Error(response.data.message || "Failed to fetch accounts report");
    } catch (error) {
        console.error("Error fetching accounts report:", error.message || error);
        throw error;
    }
};

export const fetchingDueInvoiceList = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/due/payments", {
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

export const fetchingProductLedger = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/product-ledger", {
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

export const getTimesheetReport = async (accessToken, params = {}) => {
    const api = axiosInstance(accessToken);
    const response = await api.get("/timesheet/report", { params });
    return response.data;
};

export const getCashiersForReport = async (accessToken) => {
    try {
        const api = axiosInstance(accessToken);
        const response = await api.get("/timesheet/cashiers");

        // Return the response data regardless of status
        // Let the component handle the status logic
        return response.data;
    } catch (error) {
        console.error("Error fetching cashiers for report:", error.message || error);
        throw error;
    }
};

export const verifyProductReturn = async (accessToken, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post("/verify-product-return", data);

        // Return the response data regardless of status
        // Let the component handle the status logic
        return response.data;
    } catch (error) {
        console.error("Error verifying product return:", error.message || error);
        throw error;
    }
};

export const getAccountingReport = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/accounting/report", {
            params,
        });

        if (response.data?.status) {
            return response.data;
        }
        throw new Error("Failed to fetch accounting report: Unexpected response status");
    } catch (error) {
        console.error("Error fetching accounting report:", error.message || error);
        throw error;
    }
};

export const getSellReturnLogs = async (accessToken, params = {}) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/reports/sales-returns/logs", { params });

        if (response.data?.status) {
            return response.data;
        }
        throw new Error(response.data?.message || "Failed to fetch sell return logs");
    } catch (error) {
        console.error("Error fetching sell return logs:", error.message || error);
        throw error;
    }
};

export const getExpireProductReport = async (accessToken, params = {}) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/expire/product/report", { params });

        if (response.data?.status) {
            return response.data;
        }
        throw new Error(response.data?.message || "Failed to fetch expire product report");
    } catch (error) {
        console.error("Error fetching expire product report:", error.message || error);
        throw error;
    }
};

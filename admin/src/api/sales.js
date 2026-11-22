import axiosInstance from "../config/axiosInstance";

const handleApiError = (error, defaultMsg) => {
    const res = error?.response;
    throw {
        status: false,
        httpStatus: res?.status ?? 0,
        data: res?.data,
        error: {
            message: res?.data?.message || error.message || defaultMsg,
            errors: res?.data?.errors,
        },
    };
};

export const getCustomers = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/search/customers", {
            params: params,
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw {
                status: false,
                error: {
                    message: "Failed to fetch customers: Unexpected response status",
                }
            };
        }
    } catch (error) {
        handleApiError(error, "Request failed");
    }
};

export const getDefaultCustomer = async (accessToken) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/get/default/customer");

        if (response.data.status) {
            return response.data;
        } else {
            throw {
                status: false,
                error: {
                    message: "Failed to fetch customers: Unexpected response status",
                }
            };
        }
    } catch (error) {
        handleApiError(error, "Request failed");
    }
};

export const getSearchProducts = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/product/search", {
            params: {
                search_value: params,
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw {
                status: false,
                error: {
                    message: "Failed to fetch products: Unexpected response status",
                }
            };
        }
    } catch (error) {
        handleApiError(error, "Request failed");
    }
};

// create new customer 
export const createNewCustomer = async (accessToken, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post("/customer/store", data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw {
                status: false,
                error: {
                    message: "Failed to store customer: Unexpected response status",
                }
            };
        }
    } catch (error) {
        handleApiError(error, "Request failed");
    }
}

export const storeSale = async (accessToken, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post("/sale/store", data, {
            // IMPORTANT: Change to application/json
            // Your backend expects JSON, not multipart/form-data
            headers: {
                "Content-Type": "application/json",
            },
        });

        // Success: status === 1
        return response.data;

    } catch (error) {
        // Network error or no response
        if (!error.response) {
            throw {
                status: 0,
                message: "Network error. Please check your connection.",
            };
        }

        // HTTP error (422, 500, etc.) – return exact backend response
        const backendData = error.response.data;

        // Return the full backend error object so frontend can read:
        // - backendData.errors (validation)
        // - backendData.message (e.g., "Invalid coupon", "Insufficient inventory")
        throw {
            status: backendData.status ?? 0,
            message: backendData.message ?? "An error occurred",
            errors: backendData.errors ?? null,
            error: backendData.error ?? null,
        };
    }
};

export const getDraftSales = async (accessToken, limit = 100) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/sales/drafts", {
            params: { limit },
        });

        if (response.data.status) {
            return response.data;
        }

        throw {
            status: false,
            error: {
                message: "Failed to fetch drafts: Unexpected response status",
            },
        };
    } catch (error) {
        handleApiError(error, "Request failed");
    }
};

export const deleteDraftSale = async (accessToken, draftId) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.delete(`/sale/delete/${draftId}`);

        if (response.data.status) {
            return response.data;
        }

        throw {
            status: false,
            error: {
                message: "Failed to delete draft: Unexpected response status",
            },
        };
    } catch (error) {
        handleApiError(error, "Request failed");
    }
};

export const itemReturn = async (accessToken, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post("/invoice-items/return", data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        if (response.data.status) {
            return response.data;
        } else {
            throw {
                status: false,
                error: {
                    message: "Failed to return sale: Unexpected response status",
                }
            };
        }
    } catch (error) {
        handleApiError(error, "Request failed");
    }
}

export const getSaleReturnPreview = async (accessToken, invoiceId) => {
    try {
        if (!invoiceId) {
            throw {
                status: false,
                error: {
                    message: "No matching sold invoice found.",
                },
            };
        }
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get(`/sales/${invoiceId}/return-preview`);
        return response.data;
    } catch (error) {
        if (error?.error) {
            throw error;
        }
        handleApiError(error, "Failed to fetch return preview");
    }
};

export const submitSaleReturn = async (accessToken, invoiceId, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post(`/sales/${invoiceId}/return`, data);
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to process sale return");
    }
};

// verify coupon or gift card
export const verifyCouponOrGiftCard = async (accessToken, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post("/verify/coupon-or-gift-card", data);

        // Always return the full response.data
        // Let the component decide if it's success or error based on status
        return response.data;

    } catch (error) {
        // If it's an HTTP error (4xx, 5xx), extract the response data
        if (error.response?.data) {
            return error.response.data; // e.g., { status: 0, errors: [...], message: "..." }
        }

        // Network error or no response
        return {
            status: 0,
            message: "Network error. Please check your connection and try again.",
        };
    }
};

import axiosInstance from "./../config/axiosInstance";

export const fetchingInvoiceList = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/sales", {
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

// Delete a single invoice
export const deleteInvoice = async (accessToken, invoiceId) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.delete(`/sale/delete/${invoiceId}`);

        return {
            status: response.status === 200,
            message: response.data.message || 'Invoice deleted successfully',
            data: response.data,
        };
    } catch (error) {
        console.error('Delete invoice error:', error);
        return {
            status: false,
            message: error.response?.data?.message || 'Failed to delete invoice',
        };
    }
};

// Delete multiple invoices
export const deleteMultipleInvoices = async (accessToken, invoiceIds) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.delete(`/sale/bulk/delete`, {
            data: Array.isArray(invoiceIds) ? { ids: invoiceIds } : undefined,
        });

        return {
            status: response.status === 200,
            message: response.data.message || 'Invoices deleted successfully',
            data: response.data,
        };
    } catch (error) {
        console.error('Delete multiple invoices error:', error);
        return {
            status: false,
            message: error.response?.data?.message || 'Failed to delete invoices',
        };
    }
};

// Pyment due amount 
export const makePayment = async (accessToken, id, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post(`/invoices/${id}/pay`, data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to make payment: Unexpected response status");
        }
    } catch (error) {
        console.error("Error make payment", error.message || error);
        throw error;
    }
};

export const makeInvoicePayment = async (accessToken, id, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post(`/invoices/${id}/pay-direct`, data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to make payment: Unexpected response status");
        }
    } catch (error) {
        console.error("Error make invoice payment", error.message || error);
        throw error;
    }
};

// Send invoice email
export const sendInvoiceEmail = async (accessToken, invoiceId, emailData) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post(`/invoices/${invoiceId}/send-email`, emailData);

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to send email: Unexpected response status");
        }
    } catch (error) {
        console.error("Error sending email", error.message || error);
        throw error;
    }
};

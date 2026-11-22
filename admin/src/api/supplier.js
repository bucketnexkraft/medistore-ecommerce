import axiosInstance from "./../config/axiosInstance";

// list 
export const getSuppliers = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/suppliers", {
            params: params,
        });
        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch suppliers: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching suppliers:", error.message || error);
        throw error;
    }
};

// store 
export const storeSuppliers = async (accessToken, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post("/supplier/store", data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to store supplier: Unexpected response status");
        }
    } catch (error) {
        console.error("Error storing supplier", error.message || error);
        throw error;
    }
};

// update
export const updateSuppliers = async (accessToken, id, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post(`/supplier/update/${id}`, data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to update supplier: Unexpected response status");
        }
    } catch (error) {
        console.error("Error updating supplier list.", error.message || error);
        throw error;
    }
};


export const updateSupplierStatus = async (accessToken, ids, payload) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.put("/supplier/status", {
            ids: Array.isArray(ids) ? ids : [ids],
            ...payload,
        });
        if (response.data.status) {
            return response.data;
        } else {
            throw new Error(response.data.message || "Failed to update supplier status");
        }
    } catch (error) {
        console.error("Error updating supplier status:", error.message || error);
        throw error;
    }
};
// delete
export const deleteSuppliers = async (accessToken, id, params = null) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const url = Array.isArray(id) ? "/supplier/multiple-delete" : `/supplier/delete/${id}`;
        const response = await axiosInstanceApi.delete(url, {
            data: Array.isArray(id) ? { ids: id } : undefined,
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to delete brand: Unexpected response status");
        }
    } catch (error) {
        console.error("Error deleting supplier:", error.message || error);
        throw error;
    }
};
import axiosInstance from "./../config/axiosInstance";

export const fetchingProducts = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/products", {
            params: params,
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch products: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching products:", error.message || error);
        throw error;
    }
};

export const fetchProductOptions = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/product/options");

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch optionis: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching optionis:", error.message || error);
        throw error;
    }
};


export const fetchInventory = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/fetch-combination-data", { params });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch optionis: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching optionis:", error.message || error);
        throw error;
    }
};

export const getVariantAttributes = async (accessToken, params) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/product/variant-attributes", {
            params
        });



        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch optionis: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching optionis:", error.message || error);
        throw error;
    }
};


//store
export const storeProduct = async (accessToken, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post("/product/store", data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to store product: Unexpected response status");
        }
    } catch (error) {
        
        throw error;
    }
};

//update
export const updateProduct = async (accessToken, id, data) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);

        const response = await axiosInstanceApi.post(`/product/update/${id}`, data, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to update product: Unexpected response status");
        }
    } catch (error) {
        console.error("Error updating product", error.message || error);
        throw error;
    }
};

//delete
export const deleteProduct = async (accessToken, id) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const url = Array.isArray(id) ? "/product/multiple-delete" : `/product/delete/${id}`;
        const response = await axiosInstanceApi.delete(url, {
            data: Array.isArray(id) ? { ids: id } : undefined,
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to delete product: Unexpected response status");
        }
    } catch (error) {
        console.error("Error deleting product:", error.message || error);
        throw error;
    }
};

// search 
export const searchProduct = async (accessToken, searchValue) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get(`/product/search?search_value=${encodeURIComponent(searchValue)}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        return response.data; // Assuming it's a list of products
    } catch (error) {
        console.error('Error searching product:', error);
        throw error;
    }
};

export const getAllProduct = async (accessToken) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get(`/get-all-products`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        return response.data; // Assuming it's a list of products
    } catch (error) {
        console.error('Error searching product:', error);
        throw error;
    }
};

export const fetchProductDetail = async (accessToken, id) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get(`/product/details/${id}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error searching product:', error);
        throw error;
    }
};


export const getStockGroupDetail = async (accessToken, stockGroupId) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get(`/product_stock_groups/${stockGroupId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error searching product:', error);
        throw error;
    }
};

export const generateProductDescription = async (accessToken, payload) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post("/product/generate-description", payload);

        if (response.data.status) {
            return response.data;
        }

        throw new Error(response.data.message || "Failed to generate product description");
    } catch (error) {
        console.error("Error generating product description:", error.message || error);
        throw error;
    }
};

export const updateProductStatus = async (accessToken, ids, payload) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.put("/product/status", {
        ids: Array.isArray(ids) ? ids : [ids],
        ...payload,
        });
        if (response.data.status) {
        return response.data;
        } else {
        throw new Error(response.data.message || "Failed to update product status");
        }
    } catch (error) {
        console.error("Error updating product status:", error.message || error);
        throw error;
    }
};

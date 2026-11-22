import axiosInstance from "./../config/axiosInstance";

export const getUsers = async (accessToken, params = {}) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/users", { params });

        if (response.data.status) {
            return response.data;
        }

        throw new Error(response.data.message || "Failed to fetch users");
    } catch (error) {
        console.error("Error fetching users:", error.message || error);
        throw error;
    }
};

export const updateUserStatus = async (accessToken, ids, payload) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.put("/user/status", {
        ids: Array.isArray(ids) ? ids : [ids],
        ...payload,
        });
        if (response.data.status) {
        return response.data;
        } else {
        throw new Error(response.data.message || "Failed to update user status");
        }
    } catch (error) {
        console.error("Error updating user status:", error.message || error);
        throw error;
    }
};

export const deleteUser = async (accessToken, id) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const url = Array.isArray(id) ? "/user/multiple-delete" : `/user/delete/${id}`;
        const response = await axiosInstanceApi.delete(url, {
        data: Array.isArray(id) ? { ids: id } : undefined,
        });

        if (response.data.status) {
        return response.data;
        } else {
        throw new Error("Failed to delete brand: Unexpected response status");
        }
    } catch (error) {
        console.error("Error deleting brand:", error.message || error);
        throw error;
    }
};


import axiosInstance from "./../config/axiosInstance";

const parseApiError = (error, fallback) => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0] ||
    error?.message ||
    fallback;
  return new Error(message);
};

// role api

export const getRoles = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get(`/role-list`, {
      params: params,
    });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to fetch roles");
    }
  } catch (error) {
    console.error("Error fetching roles:", error.message || error);
    throw parseApiError(error, "Failed to fetch roles");
  }
};

export const addRole = async (accessToken, payload) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/role-store", payload);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to add role");
    }
  } catch (error) {
    console.error("Error adding role:", error.message || error);
    throw parseApiError(error, "Failed to add role");
  }
};

export const updateRole = async (accessToken, id, payload) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(`/role-update/${id}`, payload);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to update role");
    }
  } catch (error) {
    console.error("Error updating role:", error.message || error);
    throw parseApiError(error, "Failed to update role");
  }
};

export const deleteRole = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    if (Array.isArray(id)) {
      const idSegment = id.join(",");
      const response = await axiosInstanceApi.delete(`/role-delete/${idSegment}`);
      if (response.data.status) {
        return response.data;
      }
      throw new Error(response.data.message || "Failed to delete one or more roles");
    }

    const response = await axiosInstanceApi.delete(`/role-delete/${id}`);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to delete role: Unexpected response status");
    }
  } catch (error) {
    console.error("Error deleting role:", error.message || error);
    throw parseApiError(error, "Failed to delete role");
  }
};


// right api

export const getRights = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get(`/right-list`, {
      params: params,
    });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to fetch rights");
    }
  } catch (error) {
    console.error("Error fetching rights:", error.message || error);
    throw error;
  }
};

export const createRight = async (accessToken, payload) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/right-store", payload);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to add right");
    }
  } catch (error) {
    console.error("Error adding right:", error.message || error);
    throw error;
  }
};

export const updateRight = async (accessToken, id, payload) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(`/right-update/${id}`, payload);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to update right");
    }
  } catch (error) {
    console.error("Error updating right:", error.message || error);
    throw error;
  }
};

export const deleteRight = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete(`/right-delete/${id}`);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to delete right: Unexpected response status");
    }
  } catch (error) {
    console.error(error.message);
    throw error;
  }
};


import axiosInstance from "./../config/axiosInstance";

//view
export const getCategories = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/categories", {
      params: params,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch categories: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching categories:", error.message || error);
    throw error;
  }
};

//store
export const storeCategories = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post("/category/store", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });


    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to store category: Unexpected response status");
    }
  } catch (error) {
    console.error("Error storing category:", error.message || error);
    throw error;
  }
};

//update
export const updateCategory = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post(
      `/category/update/${id}`,
      data,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to update category: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating category list.", error.message || error);
    throw error;
  }
};

//delete
export const deleteCategories = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const url = Array.isArray(id) ? "/category/multiple-delete" : `/category/delete/${id}`;
    const response = await axiosInstanceApi.delete(url, {
      data: Array.isArray(id) ? { ids: id } : undefined,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to delete category: Unexpected response status");
    }
  } catch (error) {
    console.error("Error deleting category:", error.message || error);
    throw error;
  }
};

export const updateCategoryStatus = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const url = Array.isArray(id) ? "/category/status-update/multiple" : `/category/update-status/${id}`;
    const payload = Array.isArray(id) ? { ids: id, status: data.status } : data;

    const response = await axiosInstanceApi.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to update category status: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating category status:", error.message || error);
    throw error;
  }
};


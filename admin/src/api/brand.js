import axiosInstance from "./../config/axiosInstance";

//view
export const getBrands = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/brands", {
      params: params,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch brands: Unexpected response status");
    }
  } catch (error) {
    console.error("Error fetching brands:", error.message || error);
    throw error;
  }
};

//store
export const storeBrands = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post("/brand/store", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to store brand: Unexpected response status");
    }
  } catch (error) {
    console.error("Error storing brand", error.message || error);
    throw error;
  }
};

//update
export const updateBrands = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post(
      `/brand/update/${id}`,
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
      throw new Error("Failed to update brand: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating brand list.", error.message || error);
    throw error;
  }
};

//delete
export const deleteBrands = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const url = Array.isArray(id) ? "/brand/multiple-delete" : `/brand/delete/${id}`;
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

export const updateBrandStatus = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const url = Array.isArray(id) ? "/brand/status-update/multiple" : `/brand/update-status/${id}`;
    const payload = Array.isArray(id) ? { ids: id, status: data.status } : data;

    const response = await axiosInstanceApi.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to update brand status: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating brand status:", error.message || error);
    throw error;
  }
};

import axiosInstance from "./../config/axiosInstance";

export const getBarcodeStoreList = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/barcode-store", { params });

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to fetch barcode list");
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

export const createBarcodeStore = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/barcode-store", data);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to store barcodes");
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

export const updateBarcodeStore = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(`/barcode-store/update/${id}`, data);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to update barcode");
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

export const deleteBarcodeStore = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete(`/barcode-store/delete/${id}`);

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to delete barcode");
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

export const deleteMultipleBarcodeStore = async (accessToken, ids) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete("/barcode-store/multiple-delete", {
      data: { ids },
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to delete selected barcodes");
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

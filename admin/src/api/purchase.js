import axiosInstance from "./../config/axiosInstance";

// View purchase orders
export const getPurchaseOrders = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/purchases", {
      params: params,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        "Failed to fetch purchase orders: Unexpected response status"
      );
    }
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

// Backward-compatible helper for screens that only need invoice list data.
export const getAllInvoices = async (accessToken, params = {}) => {
  return getPurchaseOrders(accessToken, {
    page: 1,
    perPage: 1000,
    ...params,
  });
};

// invoice items history
export const getInvoiceItemsHistory = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/stock-in-list", {
      params: params,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        "Failed to fetch invoice items history: Unexpected response status"
      );
    }
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

// Create a new purchase order
export const createPurchaseOrder = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/purchase/store", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        response.data.message || "Failed to create purchase order: Unexpected response status"
      );
    }
  } catch (error) {
    const res = error?.response;
    const errorData = res?.data || {};

    // Extract error messages from various possible formats
    let errorMessages = [];
    if (res?.status === 422 && errorData.errors) {
      // Handle Laravel validation errors
      errorMessages = Object.values(errorData.errors).flat();
    } else if (errorData.message) {
      // Handle general error messages
      errorMessages = [errorData.message];
    } else if (errorData.error) {
      // Handle custom error formats
      errorMessages = Array.isArray(errorData.error) ? errorData.error : [errorData.error];
    } else if (errorData.details) {
      // Handle error details array
      errorMessages = Array.isArray(errorData.details) ? errorData.details : [errorData.details];
    } else {
      // Fallback for unexpected error formats
      errorMessages = [error.message || "Request failed"];
    }

    return {
      status: false,
      httpStatus: res?.status ?? 0,
      data: errorData,
      error: {
        message: errorData.message || error.message || "Request failed",
        errors: errorMessages,
      },
    };
  }
};

// Update an existing purchase order
export const updatePurchaseOrder = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post(
      `/purchase/update/${id}`,
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
      throw new Error(
        "Failed to update purchase order: Unexpected response status"
      );
    }
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

// Delete a purchase order
export const deletePurchaseOrder = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete(`/purchase/delete/${id}`);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        "Failed to delete purchase order: Unexpected response status"
      );
    }
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

export const getInvoice = async (accessToken, invoice) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.get(`/get-invoice/${invoice}`);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        "Failed to fetch order: Unexpected response status"
      );
    }
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


export const createPurchaseInvoice = async (accessToken, invoice, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);

    const response = await axiosInstanceApi.post(`/store-invoice/${invoice}`, data);

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        "Failed to fetch order: Unexpected response status"
      );
    }
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

export const getProductCombinations = async (accessToken, productId) => {
  const axiosInstanceApi = axiosInstance(accessToken);
  const response = await axiosInstanceApi.get(`/product-combinations/${productId}`);
  return response;
};

export const getStockOverview = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/stock/overview", {
      params: params,
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(
        "Failed to fetch purchase orders: Unexpected response status"
      );
    }
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

export const getSalesChannels = async (accessToken) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/sales-channels");

    if (response.data.status) {
      return response.data;
    }

    throw new Error(response.data.message || "Failed to fetch sales channels");
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

export const fetchInventoryCheck = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/inventory/check", {
      params: params,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching inventory check:", error);
    throw error;
  }
};

export const updatePurchaseQuantity = async (accessToken, data) => {
  const axiosInstanceApi = axiosInstance(accessToken);
  const response = await axiosInstanceApi.post("/purchases/update-quantity", data);
  return response.data;
};

export const getPurchaseReturns = async (accessToken, params) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/purchase-returns", {
      params,
    });

    if (response.data.status) {
      return response.data;
    }

    throw new Error("Failed to fetch purchase returns: Unexpected response status");
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

export const createPurchaseReturn = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/purchase-return/store", data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    const res = error?.response;
    const errorData = res?.data || {};

    return {
      status: false,
      httpStatus: res?.status ?? 0,
      data: errorData,
      error: {
        message: errorData.message || error.message || "Request failed",
        errors: errorData.errors || errorData.error,
      },
    };
  }
};

export const addPurchaseReturnPayment = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post(`/purchase-return/${id}/payment`, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    const res = error?.response;
    const errorData = res?.data || {};

    return {
      status: false,
      httpStatus: res?.status ?? 0,
      data: errorData,
      error: {
        message: errorData.message || error.message || "Request failed",
        errors: errorData.errors || errorData.error,
      },
    };
  }
};

import axiosInstance from "../../config/axiosInstance";


// Get all companies with pagination and filters
export const getCompanies = async (accessToken, params = {}) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/backoffice/companies", { params });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to fetch companies");
    }
  } catch (error) {
    console.error("Error fetching companies:", error.message || error);
    throw error;
  }
};

// Get single company by ID
export const getCompany = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get(`/backoffice/companies/${id}`);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to fetch company");
    }
  } catch (error) {
    console.error("Error fetching company:", error.message || error);
    throw error;
  }
};

// Create new company
export const createCompany = async (accessToken, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/backoffice/companies", data);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to create company");
    }
  } catch (error) {
    console.error("Error creating company:", error.message || error);
    throw error;
  }
};

// Update company information only (partial update)
export const updateCompanyInfo = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(`/backoffice/companies/${id}/info`, data);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to update company information");
    }
  } catch (error) {
    console.error("Error updating company info:", error.message || error);
    throw error;
  }
};

export const checkCompanyDomainAvailability = async (accessToken, id, domain) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get(
      `/backoffice/companies/${id}/domain-availability`,
      {
        params: { domain },
      }
    );
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to check domain availability");
  } catch (error) {
    console.error("Error checking company domain availability:", error.message || error);
    throw error;
  }
};

export const validateCustomDomainStore = async (accessToken, id, storeDomain) => {
  const axiosInstanceApi = axiosInstance(accessToken);
  const response = await axiosInstanceApi.post(`/backoffice/companies/${id}/custom-domain/validate-store`, {
    store_domain: storeDomain,
  });
  if (response.data.status) return response.data;
  throw new Error(response.data.message || response.data.msg || "Failed to validate store domain");
};

export const connectCustomDomain = async (accessToken, id, data) => {
  const axiosInstanceApi = axiosInstance(accessToken);
  const response = await axiosInstanceApi.post(`/backoffice/companies/${id}/custom-domain/connect`, data);
  if (response.data.status) return response.data;
  throw new Error(response.data.message || response.data.msg || "Failed to connect custom domain");
};

// Update company
export const updateCompany = async (accessToken, id, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(`/backoffice/companies/${id}`, data);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to update company");
    }
  } catch (error) {
    console.error("Error updating company:", error.message || error);
    throw error;
  }
};

// Delete company
export const deleteCompany = async (accessToken, id) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete(`/backoffice/companies/${id}`);
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to delete company");
    }
  } catch (error) {
    console.error("Error deleting company:", error.message || error);
    throw error;
  }
};

// Update company status
export const updateCompanyStatus = async (accessToken, id, status) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(`/backoffice/companies/${id}/status`, { status });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to update company status");
    }
  } catch (error) {
    console.error("Error updating company status:", error.message || error);
    throw error;
  }
};

// Bulk update companies status
export const bulkUpdateCompanyStatus = async (accessToken, ids, status) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post("/backoffice/companies/status-update/multiple", {
      ids: Array.isArray(ids) ? ids : [ids],
      status
    });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to update companies status");
    }
  } catch (error) {
    console.error("Error bulk updating companies status:", error.message || error);
    throw error;
  }
};

// Bulk delete companies
export const bulkDeleteCompanies = async (accessToken, ids) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete("/backoffice/companies/multiple-delete", {
      data: { ids: Array.isArray(ids) ? ids : [ids] }
    });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to delete companies");
    }
  } catch (error) {
    console.error("Error bulk deleting companies:", error.message || error);
    throw error;
  }
};

export const getCompanyUsers = async (accessToken, companyId, params = {}) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get(`/backoffice/companies/${companyId}/users`, {
      params: {
        ...params,
      },
    });
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to fetch company users");
  } catch (error) {
    console.error("Error fetching company users:", error.message || error);
    throw error;
  }
};

export const getCompanyFeaturePreferences = async (accessToken, companyId, params = {}) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get(`/backoffice/companies/${companyId}/feature-preferences`, {
      params: {
        ...params,
      },
    });
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to fetch feature preferences");
  } catch (error) {
    console.error("Error fetching feature preferences:", error.message || error);
    throw error;
  }
};

export const syncCompanyFeaturePreferences = async (accessToken, companyId, codes = []) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(
      `/backoffice/companies/${companyId}/feature-preferences/sync`,
      {
        codes,
      }
    );
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to update feature preferences");
  } catch (error) {
    console.error("Error syncing feature preferences:", error.message || error);
    throw error;
  }
};

export const createCompanyFeaturePreference = async (accessToken, companyId, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post(`/backoffice/companies/${companyId}/feature-preferences`, data);
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to create feature preference");
  } catch (error) {
    console.error("Error creating feature preference:", error.message || error);
    throw error;
  }
};

export const updateCompanyFeaturePreference = async (accessToken, companyId, preferenceId, data) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(
      `/backoffice/companies/${companyId}/feature-preferences/${preferenceId}`,
      data
    );
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to update feature preference");
  } catch (error) {
    console.error("Error updating feature preference:", error.message || error);
    throw error;
  }
};

export const deleteCompanyFeaturePreference = async (accessToken, companyId, preferenceId) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.delete(
      `/backoffice/companies/${companyId}/feature-preferences/${preferenceId}`
    );
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to delete feature preference");
  } catch (error) {
    console.error("Error deleting feature preference:", error.message || error);
    throw error;
  }
};

export const getBackofficeFeaturePreferenceOptions = async (accessToken) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get("/backoffice/feature-preferences");
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to fetch feature preference options");
  } catch (error) {
    console.error("Error fetching feature preference options:", error.message || error);
    throw error;
  }
};

export const impersonateCompanyUser = async (accessToken, companyId, userId) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.post(
      `/backoffice/companies/${companyId}/users/${userId}/impersonate`
    );
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to login as user");
  } catch (error) {
    console.error("Error impersonating user:", error.message || error);
    throw error;
  }
};

export const getCompanyRights = async (accessToken, companyId) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.get(`/backoffice/companies/${companyId}/rights`);
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to fetch company rights");
  } catch (error) {
    console.error("Error fetching company rights:", error.message || error);
    throw error;
  }
};

export const updateCompanyRights = async (accessToken, companyId, rightIds = []) => {
  try {
    const axiosInstanceApi = axiosInstance(accessToken);
    const response = await axiosInstanceApi.put(`/backoffice/companies/${companyId}/rights`, {
      right_ids: rightIds,
    });
    if (response.data.status) {
      return response.data;
    }
    throw new Error(response.data.message || "Failed to update company rights");
  } catch (error) {
    console.error("Error updating company rights:", error.message || error);
    throw error;
  }
};

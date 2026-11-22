import axiosInstance from './../config/axiosInstance';
// get preference
export const getPreference = async (companyId = null, accessToken = null) => {
  try {
    const api = axiosInstance(accessToken);
    const response = await api.get("/preferences", {
      params: { companyId },
    });
    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Failed to fetch preferences");
    }
  } catch (error) {
    console.error("Error fetching preferences:", error.message || error);
    throw error;
  }
};

// update preference

export const updatePreference = async (accessToken, formData) => {
  try {
    const api = axiosInstance(accessToken);

    const response = await api.post("/update-preferences", formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.status) {
      return response.data;
    } else {
      throw new Error("Update failed: Unexpected response status");
    }
  } catch (error) {
    console.error("Error updating preferences:", error.message || error);
    throw error;
  }
};

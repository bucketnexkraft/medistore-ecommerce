import axiosInstance from './../config/axiosInstance';

export const getAdminData = async (accessToken, params) => {
  try {
    const api = axiosInstance(accessToken);
    
    const response = await api.get("/me");
    if (response.data.status) {
      return response;
    } else {
      throw new Error("Failed to fetch profile");
    }
  } catch (error) {
    console.error("Error fetching profile:", error.message || error);
    throw error;
  }
};

export const updateProfile = async (accessToken, formData) => {
  try {
    const api = axiosInstance(accessToken);

    const response = await api.post("/update/profile", formData, {
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
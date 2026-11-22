import axiosInstance from "../config/axiosInstance";

export const getCurrency = async (accessToken) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/get-currency");

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch currency: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching currency:", error.message || error);
        throw error;
    }
};

export const updateCompanyPreference = async (accessToken, formData) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post("/update-company-preferences", formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${accessToken}`,
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

export const sendCompanyTestSms = async (accessToken, payload) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post("/company-preferences/test-sms", payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (response.data?.status) {
            return response.data;
        }

        throw new Error("Test SMS failed: Unexpected response status");
    } catch (error) {
        console.error("Error sending test SMS:", error.message || error);
        throw error;
    }
};

export const sendPathaoCourierTest = async (accessToken, payload) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.post("/company-preferences/test-pathao-courier", payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (response.data?.status) {
            return response.data;
        }

        throw new Error(response.data?.message || "Pathao courier test failed: Unexpected response status");
    } catch (error) {
        console.error("Error testing Pathao courier:", error.message || error);
        throw error;
    }
};

export const getPosSettings = async (accessToken) => {
    try {
        const api = axiosInstance(accessToken);
        const response = await api.get('/pos/settings');

        if (response.data?.status) {
            return response.data;
        }
        throw new Error("Fetch failed: Unexpected response status");
    } catch (error) {
        console.error("Error fetching pos settings:", error.message || error);
        throw error;
    }
};


export const updatePosSettings = async (accessToken, payload) => {
    try {
        const api = axiosInstance(accessToken);
        const response = await api.post('/pos/settings/update', payload);

        if (response.data?.status) {
            return response.data;
        }
        throw new Error("Update failed: Unexpected response status");
    } catch (error) {
        console.error("Error updating pos settings:", error.message || error);
        throw error;
    }
};


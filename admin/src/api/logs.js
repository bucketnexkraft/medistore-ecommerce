import axiosInstance from "./../config/axiosInstance";

// Fetch log files list
export const fetchLogFiles = async (accessToken) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get("/logs");

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch log files: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching log files:", error.message || error);
        throw error;
    }
};

// Fetch log entries for specific file
export const fetchLogEntries = async (accessToken, filename, params = {}) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get(`/logs/${filename}`, {
            params: params,
        });

        if (response.data.status) {
            return response.data;
        } else {
            throw new Error("Failed to fetch log entries: Unexpected response status");
        }
    } catch (error) {
        console.error("Error fetching log entries:", error.message || error);
        throw error;
    }
};

// Download log file
export const downloadLogFile = async (accessToken, filename) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.get(`/logs/${filename}/download`, {
            responseType: "blob",
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        return {
            status: true,
            message: 'Log file downloaded successfully',
        };
    } catch (error) {
        console.error("Error downloading log file:", error.message || error);
        return {
            status: false,
            message: error.response?.data?.message || 'Failed to download log file',
        };
    }
};

// Delete log file
export const deleteLogFile = async (accessToken, filename) => {
    try {
        const axiosInstanceApi = axiosInstance(accessToken);
        const response = await axiosInstanceApi.delete(`/logs/${filename}`);

        return {
            status: response.status === 200,
            message: response.data.message || 'Log file deleted successfully',
            data: response.data,
        };
    } catch (error) {
        console.error('Delete log file error:', error);
        return {
            status: false,
            message: error.response?.data?.message || 'Failed to delete log file',
        };
    }
};

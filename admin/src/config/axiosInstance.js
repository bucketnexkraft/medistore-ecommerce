import axios from "axios";
import { API_URL } from "../config/constants";

const axiosInstance = (token) => {
  const instance = axios.create({
    baseURL: API_URL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.request.use(
    (config) => {
      if (config?.data instanceof FormData) {
        if (typeof config.headers?.set === "function") {
          config.headers.set("Content-Type", undefined);
        } else if (config.headers) {
          delete config.headers["Content-Type"];
          delete config.headers["content-type"];
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const redirectTarget =
          currentPath && currentPath !== "/login"
            ? `/login?redirect=${encodeURIComponent(currentPath)}`
            : "/login";

        if (window.location.pathname !== "/login") {
          window.location.replace(redirectTarget);
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export default axiosInstance;

import axiosInstance from "../config/axiosInstance";

export const getWorkSlots = (token, params) => axiosInstance(token).get("/work-slots", { params }).then(r => r.data);
export const getCashiers = (token) => axiosInstance(token).get("/users").then(r => r.data);
export const storeWorkSlot = (token, data) => axiosInstance(token).post("/work-slots", data).then(r => r.data);
export const updateWorkSlot = (token, id, data) => axiosInstance(token).put(`/work-slots/${id}`, data).then(r => r.data);
export const deleteWorkSlots = (token, ids) => axiosInstance(token).delete(`/work-slots/${ids.join(",")}`).then(r => r.data);
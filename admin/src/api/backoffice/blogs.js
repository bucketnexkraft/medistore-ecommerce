import axiosInstance from "../../config/axiosInstance";

export const getBlogCategories = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/blog-categories", { params });
  return response.data;
};

export const createBlogCategory = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/content/blog-categories", payload);
  return response.data;
};

export const updateBlogCategory = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.put(`/backoffice/content/blog-categories/${id}`, payload);
  return response.data;
};

export const deleteBlogCategory = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/content/blog-categories/${id}`);
  return response.data;
};

export const getBlogOptions = async (accessToken) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/blogs/options");
  return response.data;
};

export const getBlogs = async (accessToken, params = {}) => {
  const api = axiosInstance(accessToken);
  const response = await api.get("/backoffice/content/blogs", { params });
  return response.data;
};

export const getBlogById = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.get(`/backoffice/content/blogs/${id}`);
  return response.data;
};

export const createBlog = async (accessToken, payload) => {
  const api = axiosInstance(accessToken);
  const response = await api.post("/backoffice/content/blogs", payload);
  return response.data;
};

export const updateBlog = async (accessToken, id, payload) => {
  const api = axiosInstance(accessToken);
  let response;
  if (payload instanceof FormData) {
    payload.append("_method", "PUT");
    response = await api.post(`/backoffice/content/blogs/${id}`, payload);
  } else {
    response = await api.put(`/backoffice/content/blogs/${id}`, payload);
  }
  return response.data;
};

export const deleteBlog = async (accessToken, id) => {
  const api = axiosInstance(accessToken);
  const response = await api.delete(`/backoffice/content/blogs/${id}`);
  return response.data;
};


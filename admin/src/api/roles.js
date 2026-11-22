import axios from "axios";
import { API_URL } from "../config/constants";

export const getRoles = async (accessToken) => {
  try {
    const response = await axios.get(`${API_URL}/backoffice/roles`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

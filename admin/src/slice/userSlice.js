import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios"; // Ensure axios is imported
import { API_URL } from "../config/constants";

export const fetchingUser = createAsyncThunk(
  "user/fetch",
  async ({ accessToken, payload }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/users`, {
        params: payload,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data; // Ensure data is returned
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState: {
    loading: false,
    status: 0,
    data: [],
    message: "",
    meta: {},
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchingUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchingUser.fulfilled, (state, action) => {
        state.loading = false;
        state.status = action.payload.status;
        state.data = action.payload.data;
        state.message = action.payload.message;
        state.meta = action.payload.meta;
      })
      .addCase(fetchingUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "An unknown error occurred.";
      });
  },
});

export default userSlice.reducer;

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_URL } from "../config/constants";

export const fetchPartners = createAsyncThunk(
  "get/fetchPartnersList",
  async (_, { getState }) => {
    const state = getState();
    const accessToken = state.auth.accessToken; // Access the token from the state
    const response = await axios.get(`${API_URL}/partner-list`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  }
);

const partnerSlice = createSlice({
  name: "partners",
  initialState: {
    partners: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPartners.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPartners.fulfilled, (state, action) => {
        state.loading = false;
        state.partners = action.payload.partners; // Adjusted to match the expected structure
      })
      .addCase(fetchPartners.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default partnerSlice.reducer;

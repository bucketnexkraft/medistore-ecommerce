import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { API_URL } from "../config/constants";

// Async thunk for fetching preferences data
export const fetchPreferences = createAsyncThunk(
  "preferences/fetchPreferences",
  async (companyId = null, { getState }) => {
    const accessToken = getState()?.auth?.accessToken;
    const response = await axios.get(API_URL + "/preferences", {
      params: { companyId },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    const transformedData = response.data.data.reduce((acc, item) => {
      acc[item.key] = item.value; // Map keys to their values
      return acc;
    }, {});
    return transformedData;
  }
);

const preferencesSlice = createSlice({
  name: "preferences",
  initialState: {
    loading: false, // 'idle' | 'loading' | 'succeeded' | 'failed'
    data: [],
    error: null,
  },
  reducers: {
    setCurrency(state, action) {
      state.data = { ...state.data, currency: action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPreferences.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPreferences.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchPreferences.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { setCurrency } = preferencesSlice.actions;
export default preferencesSlice.reducer;

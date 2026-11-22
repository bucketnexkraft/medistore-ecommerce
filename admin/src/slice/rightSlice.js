import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_URL } from "../config/constants";

export const fetchRight = createAsyncThunk(
  "get/fetchRight",
  async ({ accessToken }) => {
    const response = await axios.get(API_URL + "/user/rights",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response;
  },
  {
    condition: ({ force } = {}, { getState }) => {
      if (force) {
        return true;
      }

      const rightState = getState()?.right || {};
      return !rightState.loading && !Array.isArray(rightState.rights)
        ? true
        : !rightState.loading && rightState.rights.length === 0;
    }
  }
);

const rightSlice = createSlice({
  name: "right",
  initialState: {
    rights: [],
    loading: false,
    error: null,
  },
  reducers: {
    setRights(state, action) {
      state.rights = action.payload || [];
      state.error = null;
    },
    resetRights(state) {
      state.rights = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRight.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRight.fulfilled, (state, action) => {
        state.loading = false;
        state.rights = action.payload.data.rights;
      })
      .addCase(fetchRight.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});
export const { setRights, resetRights } = rightSlice.actions;
export default rightSlice.reducer;

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_URL } from "../config/constants";

export const fetchRoleList = createAsyncThunk("get/fetchRoleList", async (_, { getState }) => {
  const state = getState();
  const accessToken = state.auth.accessToken;
  const companyId = state.auth.company_id;
  
  const response = await axios.get(API_URL + "/role-right-permissions", {
    params: companyId ? { company_id: companyId } : {},
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response;
});

const roleRightSlice = createSlice({
  name: "roleright",
  initialState: {
    roles: [],
    rights: [],
    permissions: [],
    loading: false,
    error: null,
  },
  reducers: {
    setRoleRight: (state, action) => {
      state.rights = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoleList.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRoleList.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload.data.roles;
        state.rights = action.payload.data.rights;
        state.permissions = action.payload.data.permissions;
      })
      .addCase(fetchRoleList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { setRoleRight } = roleRightSlice.actions;
export default roleRightSlice.reducer;

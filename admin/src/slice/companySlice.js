import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_URL } from "../config/constants";

export const fetchCompanyPreferences = createAsyncThunk("get/fetchCompanyPreferences", async (accessToken) => {
    const response = await axios.get(API_URL + "/get-company-preferences", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    return response;
});
const companySlice = createSlice({
    name: "company",   
    initialState: {
        companyPreferences: [],
        reward: {},
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchCompanyPreferences.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchCompanyPreferences.fulfilled, (state, action) => {
                state.loading = false;
                state.companyPreferences = action.payload.data.data.company;
                state.reward = action.payload.data.data.reword;
            })
            .addCase(fetchCompanyPreferences.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            });
    },
});
export default companySlice.reducer;

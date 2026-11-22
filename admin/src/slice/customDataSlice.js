import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_URL } from "../config/constants";

export const fetchCustomData = createAsyncThunk(
  "get/fetchCustomDataList",
  async (_, { getState }) => {
    const state = getState();
    const accessToken = state.auth.accessToken; // Access the token from the state
    const response = await axios.get(`${API_URL}/get-custom-data`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  }
);

const customDataSlice = createSlice({
    name: 'customdata',
    initialState: {
        difficulty_level: [],
        exam_purpose: [],
        media_type: [],
        question_type: [],
        segmentation: [],
        questions: [],
        qualification_types: [],
        course_delivery_modes: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
        .addCase(fetchCustomData.pending, (state) => {
            state.loading = true;
        })
        .addCase(fetchCustomData.fulfilled, (state, action) => {
            state.loading = false;
            state.difficulty_level = action.payload.data.difficulty_level ? action.payload.data.difficulty_level : []; 
            state.exam_purpose = action.payload.data.exam_purpose ? action.payload.data.exam_purpose : []; 
            state.media_type = action.payload.data.media_type ? action.payload.data.media_type : []; 
            state.question_type = action.payload.data.question_type ? action.payload.data.question_type : [];     
            state.segmentation = action.payload.data.segmentation ? action.payload.data.segmentation : [];     
            state.questions = action.payload.data.questions ? action.payload.data.questions : [];     
            state.qualification_types = action.payload.data.qualification_types ? action.payload.data.qualification_types : [];     
            state.course_delivery_modes = action.payload.data.course_delivery_modes ? action.payload.data.course_delivery_modes : [];     
        })
        .addCase(fetchCustomData.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message;
        });
    },
});

export default customDataSlice.reducer;

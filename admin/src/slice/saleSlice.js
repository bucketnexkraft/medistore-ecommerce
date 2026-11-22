import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_URL } from '../config/constants';

export const fetchSales = createAsyncThunk(
  "sales/fetch",
  async ({ accessToken, payload }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/sales`, {
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


const salesSlice = createSlice({
  name: 'sales',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
    search: '',
    filterDate: '',
  },
  reducers: {
    setSearch(state, action) {
      state.search = action.payload;
    },
    setFilterDate(state, action) {
      state.filterDate = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSales.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  },
});

export const { setSearch, setFilterDate } = salesSlice.actions;
export default salesSlice.reducer;

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import dayjs from 'dayjs';
const BASE_URL = 'http://localhost:8000/api/v2/expenses';
export const addExpenses = createAsyncThunk(
    'addExpenses/expenses', async (data, thunkApi) => {
        try {
            const formData = new FormData();
            for (const key in data) {
                if (data[key]) {
                    formData.append(key, data[key]);
                }
            }

            const response = await axios.post(`${BASE_URL}/createExpenses`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            return response.data.message;
        }
        catch (err) {
            return thunkApi.rejectWithValue(err.response?.data?.message || 'Failed to create Data');
        }
    }

)
export const getAllExpenses = createAsyncThunk(
    'getAllExpenses/expenses', async (_, thunkApi) => {
        try {
            const res = await axios.get(`${BASE_URL}/getExpenses`);
            return res.data.message;
        }
        catch (err) {
            return thunkApi.rejectWithValue(err.response?.data?.message)
        }
    }
)
const initialState = {
    list: [],
    form: {
        date: dayjs(),
        invoiceNo: '',
        title: '',
        details: '',
        amount: '',
        taxAmount: '',
        totalAmount: '',
        document: null,
    },
    status: 'idle',
    error: null,
    viewedExpenses: null,

};
const expenseSlice = createSlice(
    {
        name: 'expenses',
        initialState,
        reducers: {
            setFormField: (state, action) => {
                const { field, value } = action.payload;
                state.form[field] = value;
            },
            resetForm: (state) => {
                state.form = initialState.form;
            },
            addExpense: (state, action) => {
                state.list.push(action.payload);
            },
            setExpenses: (state, action) => {
                state.list = action.payload;
            },
            clearViewedExpenses: (state) => {
                state.viewedExpenses = null
            },
        },
        extraReducers: (builder) => {
            (builder)
                .addCase(addExpenses.pending, (state) => {
                    state.loading = true;
                    state.error = null
                })
                .addCase(addExpenses.fulfilled, (state, action) => {
                    state.status = 'succeeded';
                    state.error = null;
                })
                .addCase(addExpenses.rejected, (state, action) => {
                    state.loading = false;
                    state.error = null;
                })
                .addCase(getAllExpenses.pending, (state, action) => {
                    state.loading = true;
                    state.error = null
                })
                .addCase(getAllExpenses.fulfilled, (state, action) => {
                    state.loading = true;
                    state.list = action.payload
                })
                .addCase(getAllExpenses.rejected, (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                })
        }
    }


)
export const { setFormField, resetForm, addExpense, setExpenses, clearViewedExpenses } = expenseSlice.actions;
export default expenseSlice.reducer;
import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, TextField, Paper, Stack,
    Button,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import {useDispatch,useSelector} from 'react-'
import {fetchOverallBookingSummary} from "../../../features/booking/bookingSlice"
// Dummy API data structure placeholder


const BookingReport = () => {
    const [fromDate, setFromDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [data, setData] = useState([]);
    const dispatch = useDispatch();
    const{list3:summary} =useSelector((state) => state.bookings);
    const handleSubmit = () => {
    if (!fromDate || !endDate) {
      alert("Please select both dates");
      return;
    }
    dispatch(fetchOverallBookingSummary({
      fromDate,
      endDate
    }));
  };
    const apiData = summary
    ? [{
        id: 1,
        bookingCount: summary.totalBookings || 0,
        billAmount: summary.billTotal || 0,
        taxAmount: summary.taxAmount || 0,
        total: (summary.billTotal || 0) + (summary.taxAmount || 0)
      }]
    : [];

    return (
        <Box p={3} bgcolor="#f9fafe" minHeight="100vh">
            <Typography variant="h4" fontWeight="bold" color="primary" mb={4} display="flex" alignItems="center" gap={1}>
                <CalendarMonthIcon fontSize="large" />
                Booking Report
            </Typography>

            <Paper elevation={3} sx={{ p: 3, borderRadius: 3, mb: 4 }}>
                <Grid container spacing={2} alignItems={'center'}>
                    {[{ label: "From Date", value: fromDate, set: setFromDate }, { label: "End Date", value: endDate, set: setEndDate }].map((item, i) => (
                        <Grid size={{ xs: 12, md: 4 }} key={i}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label={item.label}
                                    value={item.value}
                                    onChange={item.set}
                                    renderInput={(params) => <TextField fullWidth {...params} />}
                                />
                            </LocalizationProvider>
                        </Grid>
                    ))}

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Button variant="contained" fullWidth onClick = {()=>handleSubmit}>Submit</Button>
                    </Grid>
                </Grid>

            </Paper>

            {apiData.map(({ id, bookingCount, billAmount, taxAmount, total }) => (
                <Paper
                    key={id}
                    elevation={3}
                    sx={{
                        p: 3,
                        mb: 3,
                        borderRadius: 3,
                        background: "linear-gradient(135deg, #e0f7fa 0%, #e3f2fd 100%)",
                    }}
                >
                    <Grid container spacing={3}>
                        {[["📦 Booking Count", totalBookings], ["🧾 Bill Amount", billAmount], ["💰 Tax Amount", taxAmount], ["🧮 Total Amount", total]].map(
                            ([label, value], idx) => (
                                <Grid size={{ xs: 12, md: 3 }} key={idx}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="body2" color="textSecondary">{label}</Typography>
                                        <Typography variant="h6" fontWeight={label.includes("Total") ? 'bold' : 'medium'} color={label.includes("Total") ? 'green' : 'black'}>
                                            ₹{value.toLocaleString()}
                                        </Typography>
                                    </Stack>
                                </Grid>
                            )
                        )}
                    </Grid>
                </Paper>
            ))}
        </Box>
    );
};

export default BookingReport;
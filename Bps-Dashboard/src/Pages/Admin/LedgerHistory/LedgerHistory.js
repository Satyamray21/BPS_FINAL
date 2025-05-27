import React, { useRef, useEffect } from 'react';
import {
    Box, Button, Typography, TableContainer, Table,
    TableHead, TableRow, TableCell, TableBody, Paper, IconButton
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { useReactToPrint } from 'react-to-print';
import { useDispatch, useSelector } from 'react-redux';
import { allLedger } from '../../../features/customerLedger/customerLedgerSlice';


const LedgerHistory = () => {
    const componentRef = useRef();
    const dispatch = useDispatch();
    const { invoices: invoiceData } = useSelector((state) => state.ledger);
    useEffect(() => {
        dispatch(allLedger());
    }, [dispatch])
    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
    });

    return (
        <Box sx={{ p: 2 }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    mb: 2,
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Customer Invoice
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{ textTransform: 'none', fontWeight: 500 }}
                >
                    Print
                </Button>
            </Box>

            <TableContainer component={Paper} ref={componentRef}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#1565c0' }}>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>S.No</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Invoice ID</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Order Amount</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Total Amount</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Remaining Amount</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Invoice</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {invoiceData.map((invoice, index) => (
                            <TableRow key={invoice.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{invoice.invoiceId}</TableCell>
                                <TableCell>{invoice.date}</TableCell>
                                <TableCell>{invoice.name}</TableCell>
                                <TableCell>{invoice.amount}</TableCell>
                                <TableCell>{invoice.paidAmount}</TableCell>
                                <TableCell>{invoice.remainingAmount}</TableCell>
                                <TableCell>
                                    <IconButton color="primary">
                                        <PrintIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default LedgerHistory;
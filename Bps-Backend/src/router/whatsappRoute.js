// src/router/whatsappRoute.js
import express from 'express';
import {
    sendMessage,
    sendBookingConfirmation,
    sendQuotationConfirmation
} from '../controller/whatsappController.js';

const router = express.Router();

router.post('/send', sendMessage);
router.post('/send-booking/:bookingId', sendBookingConfirmation);
router.post('/send-booking-Quotation/:bookingId',sendQuotationConfirmation)
export default router;

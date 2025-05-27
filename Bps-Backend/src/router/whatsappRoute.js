// src/router/whatsappRoute.js
import express from 'express';
import {
    sendMessage,
    sendBookingConfirmation,
} from '../controller/whatsappController.js';

const router = express.Router();

router.post('/send', sendMessage);
router.post('/send-booking/:bookingId', sendBookingConfirmation);

export default router;

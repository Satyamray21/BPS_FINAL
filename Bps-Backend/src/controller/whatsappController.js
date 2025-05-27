import Booking from '../model/booking.model.js';
import { sendWhatsAppMessage } from '../services/whatsappServices.js';
import {Customer} from '../model/customer.model.js'
export const sendMessage = async (req, res) => {
    try {
        const { message, to } = req.body;
        await sendWhatsAppMessage(to, message);
        res.status(200).json({ success: true, message: "Message sent successfully" });
    } catch (error) {
        console.error("Error in sendMessage:", error);
        res.status(500).json({ success: false, message: "Failed to send message" });
    }
};

const generateBookingMessage = (customer, booking) => {
  const {
    senderLocality,
    fromCity,
    fromState,
    senderPincode,
    receiverLocality,
    toCity,
    toState,
    toPincode,
    grandTotal,
    items = []
  } = booking;

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);

  return `*📦 Booking Confirmation*

Dear *${customer.firstName} ${customer.lastName}*,

Your booking with *Booking ID: ${booking.bookingId}* has been successfully created.

*From Address:*
${senderLocality}, ${fromCity}, ${fromState}, ${senderPincode}

*To Address:*
${receiverLocality}, ${toCity}, ${toState}, ${toPincode}

*Product Details:*
• Weight: ${totalWeight} kg
• Amount: ₹${grandTotal}

Thank you for choosing our service.

_BharatParcel Team_`;
};

// Express route handler
export const sendBookingConfirmation = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({ bookingId }).populate('customerId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const customer = booking.customerId;
    if (!booking || !booking.customerId) {
      return res.status(404).json({ success: false, message: 'Customer details incomplete' });
    }

    const message = generateBookingMessage(customer, booking);
    const contact = String(customer.contactNumber); 
    const formattedNumber = contact.startsWith('+') ? contact : `+91${contact}`;
    await sendWhatsAppMessage(formattedNumber, message);

    res.status(200).json({ success: true, message: 'Booking confirmation sent successfully' });
  } catch (error) {
    console.error('Error in sendBookingConfirmation:', error);
    res.status(500).json({ success: false, message: 'Failed to send booking confirmation' });
  }
};



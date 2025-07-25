import Booking from '../model/booking.model.js';
import Station from '../model/manageStation.model.js';
import { Customer } from '../model/customer.model.js';
import nodemailer from 'nodemailer';
import { User } from '../model/user.model.js'
import {sendBookingConfirmation} from './whatsappController.js'
import {sendWhatsAppMessage} from '../services/whatsappServices.js'
import {ApiResponse} from "../utils/ApiResponse.js"
import { generateInvoicePDF } from '../utils/invoiceGenerator.js'; 
async function resolveStation(name) {
  const station = await Station.findOne({ stationName: new RegExp(`^${name}$`, 'i') });
  if (!station) throw new Error(`Station "${name}" not found`);
  return station._id;
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.gmail,
    pass: process.env.app_pass
  }
});
//base condition
const getBookingFilterByType = (type, user) => {
  let baseFilter = {};

  if (type === 'active') {
    baseFilter = { activeDelivery: true };
  } else if (type === 'cancelled') {
    baseFilter = { totalCancelled: { $gt: 0 } };
  } else {
    baseFilter = {
      activeDelivery: false,
      totalCancelled: 0,
      $or: [
        { createdByRole: { $in: ['admin', 'supervisor'] } },
        { requestedByRole: 'public', isApproved: true }
      ]
    };
  }

  if (user?.role === 'supervisor') {
    return {
      $and: [
        baseFilter,
        { createdByUser: user._id }
      ]
    };
  }

  return baseFilter;
};

const formatDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};


export const viewBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({
      $or: [{ bookingId: id }]
    })
      .populate('startStation', 'stationName gst address contact')
      .populate('endStation', 'stationName')
      .lean();

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Extract only the necessary fields
    const simplifiedResponse = {
      bookingId: booking.bookingId,
      firstName: booking.firstName,
      lastName: booking.lastName,
      mobile: booking.mobile,
      email: booking.email,
      bookingDate: booking.bookingDate ? formatDate(booking.bookingDate) : null,
      deliveryDate: booking.deliveryDate ? formatDate(booking.deliveryDate) : null,

      senderName: booking.senderName,
      senderGgt: booking.senderGgt,
      fromState: booking.fromState,
      fromCity: booking.fromCity,
      senderPincode: booking.senderPincode,
      senderLocality:booking.senderLocality,
      receiverName: booking.receiverName,
      receiverGgt: booking.receiverGgt,
      receiverLocality:booking.receiverLocality,
      toState: booking.toState,
      toCity: booking.toCity,
      toPincode: booking.toPincode,
      items: booking.items,
      freight: booking.freight,
      ins_vpp: booking.ins_vpp,
      cgst: booking.cgst,
      sgst: booking.sgst,
      igst: booking.igst,
      billTotal: booking.billTotal,
      grandTotal: booking.grandTotal,
      startStation: {
        stationName: booking.startStation?.stationName,
        gst: booking.startStation?.gst ,
        address:booking.startStation?.address,
        contact:booking.startStation?.contact
      },
      endStation: {
        stationName: booking.endStation?.stationName
      }
    };

    res.json(simplifiedResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


export const createBooking = async (req, res) => {
  try {
    const user = req.user;
    const {
      startStation: startName,
      endStation: endName,
      email,
      bookingDate,
      deliveryDate,
      senderName,
      senderGgt,
      senderLocality,
      fromState,
      fromCity,
      senderPincode,
      receiverName,
      receiverGgt,
      receiverLocality,
      toState,
      toCity,
      toPincode,
      items,
      addComment,
      freight,
      ins_vpp,
      cgst,
      sgst,
      igst,
      billTotal,
      grandTotal

    } = req.body;

    if (!email || !startName || !endName || !bookingDate || !deliveryDate || !items) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find customer by email
    const customer = await Customer.findOne({ emailId: email });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found with provided email" });
    }

    // Resolve stations
    const startStation = await resolveStation(startName);
    const endStation = await resolveStation(endName);

    // Ensure resolved stations exist
    if (!startStation || !endStation) {
      return res.status(400).json({ message: "Invalid station names provided" });
    }

    // Create the booking object
    const booking = new Booking({
      customerId: customer._id,
      startStation,
      endStation,
      firstName: customer.firstName,
      middleName: customer.middleName || '',
      lastName: customer.lastName,
      mobile: customer.contactNumber,
      email: customer.emailId,
      bookingDate,
      deliveryDate,
      senderName,
      senderGgt,
      senderLocality,
      fromState,
      fromCity,
      senderPincode,
      receiverName,
      receiverGgt,
      receiverLocality,
      toState,
      toCity,
      toPincode,
      items,  // Array of items passed in request body
      addComment,
      freight,
      ins_vpp,
      cgst,
      sgst,
      igst,
      billTotal,
      grandTotal,
      createdByUser: user._id,
      createdByRole: user.role,
      requestedByRole: user.role
    });

    // Save the booking
    await booking.save();

    // Send booking confirmation email to customer
    await sendBookingEmail(customer.emailId, booking);
    // Send success response
    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server Error" });
  }
};
export const createPublicBooking = async (req, res) => {
  try {
    const {
      email,
      firstName,
      middleName,
      lastName,
      mobile,
      startStation: startName,
      endStation: endName,
      bookingDate,
      deliveryDate,
      senderName,
      senderGgt,
      senderLocality,
      fromState,
      fromCity,
      senderPincode,
      receiverName,
      receiverGgt,
      receiverLocality,
      toState,
      toCity,
      toPincode,
      items,
      addComment,
      freight,
      ins_vpp,
      cgst,
      sgst,
      igst,
      billTotal,
      grandTotal,
    } = req.body;

    if (!email || !startName || !endName || !bookingDate || !deliveryDate || !items) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Resolve stations
    const startStation = await resolveStation(startName);
    const endStation = await resolveStation(endName);
    if (!startStation || !endStation) {
      return res.status(400).json({ message: "Invalid station names" });
    }

    // Create booking without customerId
    const booking = new Booking({
      firstName,
      middleName,
      lastName,
      mobile,
      startStation,
      endStation,
      bookingDate,
      deliveryDate,
      senderName,
      senderGgt,
      senderLocality,
      fromState,
      fromCity,
      senderPincode,
      receiverName,
      receiverGgt,
      receiverLocality,
      toState,
      toCity,
      toPincode,
      items,
      addComment,
      freight,
      ins_vpp,
      cgst,
      sgst,
      igst,
      billTotal,
      grandTotal,
      mobile,
      email, // store for reference
      isApproved: false, // pending approval
      requestedByRole: "public"
    });

    await booking.save();
    await sendBookingAcknowledgementEmail(email, booking);
    res.status(201).json({ message: "Booking request submitted. Awaiting admin approval.", booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

export const sendBookingAcknowledgementEmail = async (email, booking) => {
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

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: `Booking Request Received for-${booking.bookingId}  Pending Confirmation`,
    html: `
      <h2>Booking Request Received</h2>

      <p>Dear Customer,</p>

      <p>Thank you for submitting your parcel booking request with us.</p>
      
      <p>Your request has been received and is currently <strong>awaiting admin approval</strong>.</p>

      <h3>Pickup Address:</h3>
      <p>${senderLocality}, ${fromCity}, ${fromState}, ${senderPincode}</p>

      <h3>Delivery Address:</h3>
      <p>${receiverLocality}, ${toCity}, ${toState}, ${toPincode}</p>

      <h3>Booking Summary:</h3>
      <p>Total Weight: ${totalWeight} kg</p>
      <p>Estimated Amount: ₹${grandTotal}</p>

      <p>You will receive another email with confirmation and tracking ID once your request is approved.</p>

      <p>Best regards, <br /> BharatParcel Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    
  } catch (error) {
    console.error('Error sending acknowledgement email:', error);
  }
};

export const sendBookingEmail = async (email, booking) => {
  const {
    firstName,
    lastName,
    senderLocality,
    fromCity,
    fromState,
    senderPincode,
    receiverLocality,
    toState,
    toCity,
    toPincode,
    grandTotal,
    items = []
  } = booking;

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: `Booking Confirmation - ${booking.bookingId}`,
    html: `
      <h2>Booking Confirmation</h2>

      <p>Dear <strong>${firstName} ${lastName}</strong>,</p>

      <p>Your booking with <strong>Booking ID: ${booking.bookingId}</strong> has been successfully created.</p>

      <h3>From Address:</h3>
      <p>${senderLocality}, ${fromCity}, ${fromState}, ${senderPincode}</p>

      <h3>To Address:</h3>
      <p>${receiverLocality}, ${toCity}, ${toState}, ${toPincode}</p>

      <h3>Product Details:</h3>
      <p>Weight: ${totalWeight} kg</p>
      <p>Amount: ₹${grandTotal}</p>

      <p>Thank you for choosing our service.</p>

      <p>Best regards, <br /> BharatParcel Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
   
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
  }
};

export const sendBookingEmailById = async (req, res) => {
  const { bookingId } = req.params;

  try {
    // Populate the 'customerId' field with email and name
    const booking = await Booking.findOne({ bookingId }).populate('customerId', 'emailId firstName lastName');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check populated customer data
    const customer = booking.customerId;

    if (!customer?.emailId) {
      return res.status(400).json({ message: 'Customer email not available' });
    }

    // Send the email
    await sendBookingEmail(customer.emailId, {
      ...booking.toObject(),
      firstName: customer.firstName,
      lastName: customer.lastName
    });

    res.status(200).json({ message: 'Booking confirmation email sent successfully' });
  } catch (error) {
    console.error('Error sending booking email by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};




export const updateBooking = async (req, res) => {
  
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.startStation) {
      updates.startStation = await resolveStation(updates.startStation);
    }
    if (updates.endStation) {
      updates.endStation = await resolveStation(updates.endStation);
    }

    const booking = await Booking.findOneAndUpdate(
      { bookingId: id },
      updates,
      { new: true }
    ).populate('startStation endStation', 'stationName');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};




export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBooking = await Booking.findOneAndDelete({ bookingId: id });

    if (!deletedBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      message: "Booking permanently deleted",
      deletedBooking,
    });
  } catch (err) {
    console.error("Error deleting booking:", err);
    res.status(500).json({ message: err.message });
  }
};



export const getBookingStatusList = async (req, res) => {
  try {
    const { type } = req.query;
    let filter;
    const user = req.user;
    if (type === 'active') {
      filter = { activeDelivery: true };
    } else if (type === 'cancelled') {
      filter = { totalCancelled: { $gt: 0 } };
    } else {

      filter = {
        activeDelivery: false,
        isDelivered: { $ne: true },
        totalCancelled: 0,
        $or: [
          { createdByRole: { $in: ['admin', 'supervisor'] } }, // Always include bookings created by admin/supervisor
          { requestedByRole: 'public', isApproved: true }        // Only approved bookings created by public users
        ]

      }

    }
    if (user.role === 'supervisor') {

      filter = {
        $and: [
          filter,
          { createdByUser: user._id }
        ]
      };
    }

    const bookings = await Booking.find(filter)

      .select('bookingId firstName lastName senderName receiverName bookingDate mobile startStation endStation requestedByRole')
      .populate('startStation endStation', 'stationName')
      .populate('createdByRole', ' role')
      .lean();

    // Filter out bookings with missing station references
    const validBookings = bookings.filter(b => b.startStation && b.endStation);

    const data = validBookings.map((b, i) => ({
      SNo: i + 1,
      orderBy:
  b.requestedByRole === 'public'
    ? 'Third Party'                                          
    : b.createdByRole === 'admin'
      ? 'Admin'                                               
      : b.createdByRole === 'supervisor'
        ? `Supervisor (${b.startStation?.stationName || 'N/A'})` 
        : `${b.createdByRole} ${b.startStation?.stationName || ''}`.trim() || 'N/A',

     date: b.bookingDate ? formatDate(b.bookingDate) : 'N/A',

      fromName: b.senderName || 'N/A',
      pickup: b.startStation?.stationName || 'N/A',
      toName: b.receiverName || 'N/A',
      drop: b.endStation?.stationName || 'N/A',
      contact: b.mobile || 'N/A',
      bookingId: b.bookingId,
      action: {
        view: `/bookings/${b.bookingId}`,
        edit: `/bookings/edit/${b.bookingId}`,
        delete: `/bookings/delete/${b.bookingId}`
      }
    }));

    res.json({ count: data.length, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

export const getPendingThirdPartyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      requestedByRole: "public",
      isApproved: false,
    })
      .populate('startStation endStation', 'stationName')
      .sort({ createdAt: -1 });

    res.status(200).json({ count: bookings.length, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};
export const approveThirdPartyBookingRequest = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const user = req.user;

    if (!["admin", "supervisor"].includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.isApproved) {
      return res.status(400).json({ message: "Booking already approved" });
    }

    booking.isApproved = true;
    booking.approvedBy = user.adminId;
    booking.approvedAt = new Date();

    await booking.save();
    await sendBookingEmail(booking.email, booking);
    res.status(200).json({ message: "Booking approved successfully", booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

export const rejectThirdPartyBookingRequest = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const user = req.user;

   
    

   
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    
    if (booking.isApproved) {
      return res.status(400).json({ message: "Booking already approved, cannot reject" });
    }

    

    await Booking.deleteOne({ bookingId });
    res.status(200).json({ message: "Booking rejected successfully", booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};


// PATCH /api/v2/bookings/:bookingId/cancel
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOneAndUpdate(
      { bookingId },
      { $inc: { totalCancelled: 1 }, activeDelivery: false },
      { new: true }
    ).populate('startStation endStation', 'stationName');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
const getRevenueBookingFilter = (type, user) => {
  const base = getBookingFilterByType(type, user);
  if (base.$and) {
    base.$and.unshift({ isDelivered: true });
    return base;
  }
  return { ...base, isDelivered: true };
};



export const getBookingRevenueList = async (req, res) => {
  try {
    const user = req.user;
    
    const filter = getRevenueBookingFilter(req.query.type, req.user);


    const bookings = await Booking.find(filter)
      .select('bookingId bookingDate startStation endStation grandTotal')
      .populate('startStation endStation', 'stationName')
      .lean();

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.grandTotal || 0), 0);

    const data = bookings
      .filter(b => b.startStation && b.endStation) // Filter out bookings with missing stations
      .map((b, i) => ({
        SNo: i + 1,
        bookingId: b.bookingId,
        date: b.bookingDate?.toISOString().slice(0, 10) || 'N/A',
        pickup: b.startStation?.stationName || 'Unknown',
        drop: b.endStation?.stationName || 'Unknown',
        revenue: b.grandTotal?.toFixed(2) || '0.00',
        action: {
          view: `/bookings/${b.bookingId}`,
          edit: `/bookings/edit/${b.bookingId}`,
          delete: `/bookings/delete/${b.bookingId}`
        }
      }));

    res.json({
      totalRevenue: totalRevenue.toFixed(2),
      count: data.length,
      data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};



// GET /api/v2/bookings/count/requests
export const getBookingRequestsCount = async (req, res) => {
  try {
    const user = req.user;
    const filter = getBookingFilterByType('request', user);
    const count = await Booking.countDocuments(filter);
    res.json({ bookingRequests: count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/v2/bookings/count/active
export const getActiveDeliveriesCount = async (req, res) => {
  try {
    const user = req.user;
    const filter = getBookingFilterByType('active', user);
    const count = await Booking.countDocuments(filter);
    res.json({ activeDeliveries: count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/v2/bookings/count/cancelled
export const getCancelledBookingsCount = async (req, res) => {
  try {
    const user = req.user;
    const filter = getBookingFilterByType('cancelled', user);
    const count = await Booking.countDocuments(filter);
    res.json({ cancelledCount: count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/v2/bookings/revenue/total
export const getTotalRevenue = async (req, res) => {
  try {
    const user = req.user;
    const filter = getBookingFilterByType('request', user); // request = non-active, non-cancelled
    const bookings = await Booking.find(filter).select('grandTotal').lean();

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    res.json({ totalRevenue: totalRevenue.toFixed(2) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};


// PATCH /api/v2/bookings/:id/activate
export const activateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findOneAndUpdate(
      { bookingId: id },
      { activeDelivery: true },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ message: 'Booking marked as active delivery', booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
export const customerWiseData = async (req, res) => {
  const { fromDate, endDate } = req.body;
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const summary = await Booking.aggregate([
    {
      $match: {
        bookingDate: {
          $gte: start,
          $lte: end,
        }
      }
    },
    {
      $group: {
        _id: "$customerId",
        totalBookings: { $sum: 1 },
        billTotal: { $sum: "$billTotal" }
      }
    },
    {
      $lookup: {
        from: "customers",
        localField: "_id",
        foreignField: "_id",
        as: "customerDetails"
      }
    },
    {
      $unwind: {
        path: "$customerDetails",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        taxAmount: {
          $multiply: ["$billTotal", 0.18]
        }
      }
    },
    {
      $project: {
        customerName: {
          $concat: [
            "$customerDetails.firstName", " ",
            { $ifNull: ["$customerDetails.middleName", ""] }, " ",
            "$customerDetails.lastName"
          ]
        },
        totalBookings: 1,
        billTotal: 1,
        taxAmount: 1
      }
    }
  ]);

  res.status(200).json(
    new ApiResponse(200, summary, "Customer booking successfully fetched")
  );
};
export const overallBookingSummary = async (req, res) => {
  try {
    const { fromDate, endDate } = req.body;

    const summary = await Booking.aggregate([
      {
        $match: {
          
          isDelivered: true,
          bookingDate: {
            $gte: new Date(fromDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          billTotal: { $sum: "$billTotal" }
        }
      },
      {
        $addFields: {
          taxAmount: { $multiply: ["$billTotal", 0.18] }
        }
      },
      {
        $project: {
          _id: 0,
          totalBookings: 1,
          billTotal: 1,
          taxAmount: 1
        }
      }
    ]);

    res.status(200).json(
      new ApiResponse(200, summary[0] || {}, "Overall booking summary fetched successfully")
    );
  } catch (error) {
    res.status(500).json(new ApiResponse(500, null, "Error fetching overall booking summary"));
  }
};

export const getBookingSummaryByDate = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const user = req.user;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "Both fromDate and toDate are required" });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const query = {
      bookingDate: { $gte: from, $lte: to }
    };

    if (user.role === "supervisor") {
      query.createdByUser = user._id;
    }

    const bookings = await Booking.find(query).sort({ bookingDate: -1 });

    // Transform bookings to include detailed payment breakdown
    const transformedBookings = bookings.map(booking => {
      const paidItems = booking.items.filter(item => item.toPay === "paid");
      const toPayItems = booking.items.filter(item => item.toPay === "pay");
      
      const paidAmount = paidItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      const toPayAmount = toPayItems.reduce((sum, item) => sum + (item.amount || 0), 0);

      return {
        ...booking.toObject(),
        // New payment fields
        paid: paidAmount,
        toPay: toPayAmount,
        // Existing fields
        paidAmount, // Keeping for backward compatibility
        toPayAmount, // Keeping for backward compatibility
        itemsCount: booking.items?.length || 0,
        // Additional calculated fields
        paymentStatus: paidAmount > 0 ? (toPayAmount > 0 ? "Partial" : "Paid") : "Unpaid"
      };
    });

    // Calculate comprehensive summary
    const summary = {
      totalPaid: transformedBookings.reduce((sum, b) => sum + b.paid, 0),
      totalToPay: transformedBookings.reduce((sum, b) => sum + b.toPay, 0),
      totalBookings: transformedBookings.length,
      paidBookings: transformedBookings.filter(b => b.paid > 0 && b.toPay === 0).length,
      unpaidBookings: transformedBookings.filter(b => b.paid === 0).length,
      partialBookings: transformedBookings.filter(b => b.paid > 0 && b.toPay > 0).length
    };

    res.status(200).json({
      message: `Bookings from ${fromDate} to ${toDate}`,
      summary: {
        ...summary,
        grandTotal: summary.totalPaid + summary.totalToPay,
        paymentBreakdown: {
          fullyPaid: summary.paidBookings,
          partiallyPaid: summary.partialBookings,
          unpaid: summary.unpaidBookings
        }
      },
      bookings: transformedBookings
    });
  } catch (error) {
    console.error("Error fetching bookings by date:", error);
    res.status(500).json({ 
      message: "Server Error",
      error: error.message 
    });
  }
};




// Helper to return empty totals object
function getEmptyTotals() {
  return {
    particulars: "Total",
    gst: "",
    startStation: "",
    endStation: "",
    voucherCount: 0,
    taxableValue: 0,
    integratedTax: 0,
    centralTax: 0,
    stateTax: 0,
    cessAmount: 0,
    invoiceAmount: 0
  };
}

export const getCADetailsSummary = async (req, res) => {
  try {
    const { pickup, drop, fromDate, toDate } = req.body;

    if (!pickup && !drop && !fromDate && !toDate) {
      return res.status(400).json({
        message: "At least one filter (pickup, drop, or date range) is required"
      });
    }

    const baseQuery = { isDelivered: true };

    // Resolve pickup (startStation)
    if (pickup) {
      const startStationDoc = await Station.findOne({
        stationName: new RegExp(`^${pickup}$`, 'i')
      });
      if (!startStationDoc) {
        return res.status(404).json({ message: `Pickup station '${pickup}' not found` });
      }
      baseQuery.startStation = startStationDoc._id;
    }

    // Resolve drop (endStation)
    if (drop) {
      const endStationDoc = await Station.findOne({
        stationName: new RegExp(`^${drop}$`, 'i')
      });
      if (!endStationDoc) {
        return res.status(404).json({ message: `Drop station '${drop}' not found` });
      }
      baseQuery.endStation = endStationDoc._id;
    }

    // Date range
    const dateFilter = {};
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      dateFilter.$gte = from;
    }
    if (toDate) {
      const toD = new Date(toDate);
      toD.setHours(23, 59, 59, 999);
      dateFilter.$lte = toD;
    }
    if (Object.keys(dateFilter).length > 0) {
      baseQuery.bookingDate = dateFilter;
    }

    console.log("👉 Final baseQuery:", JSON.stringify(baseQuery, null, 2));

    // First check if any matching delivered bookings exist
    const anyDeliveries = await Booking.find(baseQuery).limit(1);
    if (anyDeliveries.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, {
          summary: [],
          totals: getEmptyTotals(),
          filters: { pickup, drop, fromDate, toDate },
          diagnostics: {
            message: "No delivered bookings found matching pickup/drop/date criteria",
            potentialIssues: [
              "Bookings may not be marked as delivered",
              "Station names may not match exactly",
              "No bookings exist for the date range"
            ]
          }
        }, "No matching deliveries found")
      );
    }

    // Add tax condition
    const taxQuery = {
      ...baseQuery,
      $or: [
        { cgst: { $gt: 0 } },
        { sgst: { $gt: 0 } },
        { igst: { $gt: 0 } }
      ]
    };

    const taxEligible = await Booking.find(taxQuery).limit(1);
    if (taxEligible.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, {
          summary: [],
          totals: getEmptyTotals(),
          filters: { pickup, drop, fromDate, toDate },
          diagnostics: {
            message: "Deliveries found but no tax data present",
            suggestion: "Check if CGST/SGST/IGST values are being recorded properly"
          }
        }, "No tax-eligible deliveries found")
      );
    }

    // Aggregation placeholder (update as per your needs)
 const summary = await Booking.aggregate([
  { $match: taxQuery },
  {
    $group: {
      _id: null,
      voucherCount: { $sum: 1 },
      taxableValue: { $sum: "$billTotal" },
      totalCgstPercent: { $sum: "$cgst" },
      totalSgstPercent: { $sum: "$sgst" },
      totalIgstPercent: { $sum: "$igst" },
      senderNames: { $addToSet: "$senderName" },
      customerNames: {
        $addToSet: {
          $concat: [
            "$firstName",
            { $cond: [{ $gt: [{ $strLenCP: "$middleName" }, 0] }, { $concat: [" ", "$middleName"] }, ""] },
            " ",
            "$lastName"
          ]
        }
      }
    }
  },
  {
    $addFields: {
      centralTax: {
        $round: [{ $divide: [{ $multiply: ["$taxableValue", "$totalCgstPercent"] }, 100] }, 2]
      },
      stateTax: {
        $round: [{ $divide: [{ $multiply: ["$taxableValue", "$totalSgstPercent"] }, 100] }, 2]
      },
      integratedTax: {
        $round: [{ $divide: [{ $multiply: ["$taxableValue", "$totalIgstPercent"] }, 100] }, 2]
      }
    }
  },
  {
    $addFields: {
      invoiceAmount: {
        $add: ["$taxableValue", "$centralTax", "$stateTax", "$integratedTax"]
      },
      cessAmount: { $literal: 0 }
    }
  },
  {
    $project: {
      _id: 1,
      voucherCount: 1,
      taxableValue: 1,
      centralTax: 1,
      stateTax: 1,
      integratedTax: 1,
      invoiceAmount: 1,
      senderNames: 1,
      customerNames: 1,
      particulars: { $literal: "Total" },
      gst: { $literal: "" },
      startStation: { $literal: pickup || "" },
      endStation: { $literal: drop || "" },
      cessAmount: 1
    }
  }
]);



    const result = {
      summary,
      totals: summary[0] || getEmptyTotals(),
      filters: { pickup, drop, fromDate, toDate }
    };

    res.status(200).json(new ApiResponse(200, result, "CA Details summary fetched successfully"));
  } catch (error) {
    console.error("❌ Error in getCADetailsSummary:", error);
    res.status(500).json(
      new ApiResponse(500, null, "Server error while generating summary")
    );
  }
};




export const generateInvoiceByCustomer = async (req, res) => {
  try {
    const { customerName, fromDate, toDate } = req.body;

    if (!customerName || !fromDate || !toDate) {
      return res.status(400).json({
        message: "customerName, fromDate, and toDate are required",
        data: { customerName, fromDate, toDate }
      });
    }

    // Step 1: Find Customer
    const customer = await Customer.findOne({
  $or: [
    {
      $expr: {
        $regexMatch: {
          input: { $concat: ["$firstName", "$middleName", "$lastName"] },
          regex: customerName,
          options: "i"
        }
      }
    }
  ]
});


    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
        customerSearchTerm: customerName,
      });
    }

    // Step 2: Find Bookings
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999); // end of day

    const bookings = await Booking.find({
      customerId: customer._id,
      bookingDate: { $gte: from, $lte: to },
    }).sort({ bookingDate: 1 });

    if (!bookings.length) {
      // Fetch all bookings for debugging in API response
      const allBookings = await Booking.find({ customerId: customer._id }).sort({ bookingDate: 1 });

      return res.status(404).json({
        message: "No bookings found in the given date range",
        customer: {
          id: customer._id,
          name: `${customer.firstName} ${customer.lastName}`,
        },
        requestedDateRange: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
        availableBookingsDates: allBookings.map(b => ({
          id: b._id,
          date: b.bookingDate,
          billTotal: b.billTotal,
          receiverName: b.receiverName
        })),
      });
    }

    // Step 3: Generate PDF
    const pdfBuffer = await generateInvoicePDF(customer, bookings);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${customer.firstName}_Invoice.pdf"`,
    });

    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({
      message: err.message || "Server Error",
      error: true
    });
  }
};






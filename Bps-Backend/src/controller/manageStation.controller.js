import manageStation from "../model/manageStation.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create Station
const createManageStation = asyncHandler(async (req, res) => {
  const { stationName, contact, emailId, address, state, city, pincode, gst } = req.body;

  // Validate each field
  if (!stationName || stationName.trim() === "") {
    throw new ApiError(400, "Station name is required");
  }
  if (!contact || contact.trim() === "") {
    throw new ApiError(400, "Contact number is required");
  }
  if (!emailId || emailId.trim() === "") {
    throw new ApiError(400, "Email ID is required");
  }
  if (!address || address.trim() === "") {
    throw new ApiError(400, "Address is required");
  }
  if (!state || state.trim() === "") {
    throw new ApiError(400, "State is required");
  }
  if (!city || city.trim() === "") {
    throw new ApiError(400, "City is required");
  }
  if (!pincode || pincode.trim() === "") {
    throw new ApiError(400, "Pincode is required");
  }
  if (!gst || gst.trim() === "") {
    throw new ApiError(400, "GST number is required");
  }

  // Check for duplicates
  const existedStation = await manageStation.findOne({
    $or: [{ stationName }, { emailId }, { gst }, { contact }]
  });

  if (existedStation) {
    let conflictField = '';
    if (existedStation.stationName === stationName) conflictField = "Station name already exists";
    else if (existedStation.emailId === emailId) conflictField = "Email ID already registered";
    else if (existedStation.gst === gst) conflictField = "GST number already registered";
    else if (existedStation.contact === contact) conflictField = "Contact number already registered";

    throw new ApiError(409, conflictField || "Duplicate station entry");
  }

  // Create station
  const station = await manageStation.create({
    stationName,
    emailId,
    contact,
    address,
    state,
    city,
    pincode,
    gst
  });

  const createdStation = await manageStation.findById(station._id);
  if (!createdStation) {
    throw new ApiError(500, "Something went wrong, please try again");
  }

  return res.status(200).json(
    new ApiResponse(201, "Station created successfully", createdStation)
  );
});


// Get All Stations
const getAllStations = asyncHandler(async (req, res) => {
  const stations = await manageStation.find().select("stationId stationName contact");

  const formattedStations = stations.map((station, index) => ({
    sNo: index + 1,
    stationId: station.stationId,
    stationName: station.stationName,
    contactNumber: station.contact
  }));

  res.status(200).json(new ApiResponse(200, "Stations fetched successfully", formattedStations));
});

// Get Total Stations
const getTotalStations = asyncHandler(async (req, res) => {
  const total = await manageStation.countDocuments(); // count all stations
  res.status(200).json(new ApiResponse(200, { totalStations: total }));
});

// Search by Station ID
const searchStationById = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;

  if (!stationId) {
    return next(new ApiError(400, "Station ID is required"));
  }

  const station = await manageStation.findOne({ stationId });

  if (!station) {
    return next(new ApiError(404, "Station not found with the provided Station ID"));
  }

  res.status(200).json(new ApiResponse(200, station));
});

// Update Station
const updateStation = asyncHandler(async (req, res) => {
  const stationId = req.params.id;

  const updatedStation = await manageStation.findOneAndUpdate(
    {stationId: stationId},
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedStation) {
    console.log("Station not found in DB for ID:", stationId);
    throw new ApiError(404, "Station not found");
  }

  return res.status(200).json(new ApiResponse(200, "Station updated successfully", updatedStation));
});

// Delete Station
const deleteStation = asyncHandler(async (req, res) => {
  const stationId = req.params.id;

  const deletedStation = await manageStation.findOneAndDelete({stationId});

  if (!deletedStation) {
    throw new ApiError(404, "Station not found");
  }

  return res.status(200).json(new ApiResponse(200, "Station deleted successfully"));
});

const searchStationByName = asyncHandler(async (req, res, next) => {
  const { stationName } = req.params;

  if (!stationName || stationName.trim() === "") {
    return next(new ApiError(400, "Station name is required"));
  }

  const station = await manageStation.findOne({ stationName });

  if (!station) {
    return next(new ApiError(404, "Station not found with the provided name"));
  }

  res.status(200).json(new ApiResponse(200, station));
});




export {
  createManageStation,
  getAllStations,
  getTotalStations,
  searchStationById,
  updateStation,
  deleteStation,
  searchStationByName
};

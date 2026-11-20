import express from "express";

import {
  createBooking,
  getMyBookings,
  getTechnicianBookings,
  updateBookingStatus,
  cancelBooking,
  getAllBookings,
} from "../controllers/bookingController.js";

import { verifyToken } from "../middleware/verifyToken.js";
import { verifyRole } from "../middleware/verifyRole.js";

const router = express.Router();

// Customer Routes
router.post(
  "/",
  verifyToken,
  verifyRole("customer"),
  createBooking
);

router.get(
  "/my-bookings",
  verifyToken,
  verifyRole("customer"),
  getMyBookings
);

router.patch(
  "/:id/cancel",
  verifyToken,
  verifyRole("customer"),
  cancelBooking
);

// Technician Routes
router.get(
  "/technician",
  verifyToken,
  verifyRole("technician"),
  getTechnicianBookings
);

router.patch(
  "/:id/status",
  verifyToken,
  verifyRole("technician"),
  updateBookingStatus
);

// Admin Routes
router.get(
  "/admin/all",
  verifyToken,
  verifyRole("admin"),
  getAllBookings
);

export default router;
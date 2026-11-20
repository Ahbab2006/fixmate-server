import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Create Repair Request
export async function createBooking(req, res) {
  try {
    const {
      serviceId,
      customerPhone,
      address,
      preferredDate,
      problemDescription,
    } = req.body;

    if (
      !serviceId ||
      !/^[0-9a-fA-F]{24}$/.test(serviceId) ||
      !customerPhone?.trim() ||
      !address?.trim() ||
      !preferredDate ||
      !problemDescription?.trim()
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    if (problemDescription.trim().length < 20) {
      return res.status(400).json({
        message: "Problem description must be at least 20 characters.",
      });
    }

    const date = new Date(`${preferredDate}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (
      Number.isNaN(date.getTime()) ||
      date < today
    ) {
      return res.status(400).json({
        message: "Preferred date must be today or a future date.",
      });
    }

    const db = getDB();

    // Find approved and available service
    const service = await db.collection("services").findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found or unavailable.",
      });
    }

    // Prevent technicians from requesting their own service
    if (service.technicianEmail === req.user.email) {
      return res.status(403).json({
        message: "You cannot request your own service.",
      });
    }

    // Find customer information
    const customer = await db.collection("user").findOne({
      email: req.user.email,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer account not found.",
      });
    }

    // Prevent duplicate active requests
    const existingBooking = await db.collection("bookings").findOne({
      serviceId,
      customerEmail: req.user.email,
      status: {
        $in: ["requested", "accepted", "in-progress"],
      },
    });

    if (existingBooking) {
      return res.status(409).json({
        message: "You already have an active request for this service.",
      });
    }

    const bookingData = {
      serviceId,

      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,

      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,

      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customerPhone.trim(),

      address: address.trim(),
      preferredDate: date,
      problemDescription: problemDescription.trim(),

      status: "requested",
      paymentStatus: "unpaid",

      createdAt: new Date(),
    };

    const result = await db.collection("bookings").insertOne(bookingData);

    return res.status(201).json({
      success: true,
      message: "Repair request submitted successfully.",
      bookingId: result.insertedId,
    });
  } catch (error) {
    console.error("Create Booking Error:", error);

    return res.status(500).json({
      message: "Failed to create repair request.",
    });
  }
}


// Get Customer's Bookings
export async function getMyBookings(req, res) {
  try {
    const db = getDB();

    const bookings = await db.collection("bookings")
      .find({
        customerEmail: req.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get My Bookings Error:", error);

    return res.status(500).json({
      message: "Failed to fetch your bookings.",
    });
  }
}


// Get Technician's Received Requests
export async function getTechnicianBookings(req, res) {
  try {
    const db = getDB();

    const bookings = await db.collection("bookings")
      .find({
        technicianEmail: req.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get Technician Bookings Error:", error);

    return res.status(500).json({
      message: "Failed to fetch received requests.",
    });
  }
}


// Update Booking Status (Technician)
export async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, finalAmount } = req.body;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid booking ID.",
      });
    }

    const previousStatus = {
      accepted: "requested",
      rejected: "requested",
      "in-progress": "accepted",
      completed: "in-progress",
    };

    if (!Object.prototype.hasOwnProperty.call(previousStatus, status)) {
      return res.status(400).json({
        message: "Invalid booking status.",
      });
    }

    const db = getDB();

    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(id),
      technicianEmail: req.user.email,
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found or you do not have permission.",
      });
    }

    if (booking.status !== previousStatus[status]) {
      return res.status(400).json({
        message: `Cannot change booking from ${booking.status} to ${status}.`,
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "completed") {
      const amount = Number(finalAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          message: "Final amount must be a positive number.",
        });
      }

      updateData.finalAmount = amount;
    }

    // Match previous status to prevent invalid concurrent updates
    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        technicianEmail: req.user.email,
        status: previousStatus[status],
      },
      {
        $set: updateData,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(409).json({
        message: "Booking status has changed. Please refresh and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Booking ${status} successfully.`,
    });
  } catch (error) {
    console.error("Update Booking Status Error:", error);

    return res.status(500).json({
      message: "Failed to update booking status.",
    });
  }
}


// Cancel Booking (Customer)
export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid booking ID.",
      });
    }

    const db = getDB();

    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        customerEmail: req.user.email,
        status: "requested",
      },
      {
        $set: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Requested booking not found or cannot be cancelled.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel Booking Error:", error);

    return res.status(500).json({
      message: "Failed to cancel booking.",
    });
  }
}


// Get All Bookings (Admin)
export async function getAllBookings(req, res) {
  try {
    const db = getDB();

    const bookings = await db.collection("bookings")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get All Bookings Error:", error);

    return res.status(500).json({
      message: "Failed to fetch all bookings.",
    });
  }
}
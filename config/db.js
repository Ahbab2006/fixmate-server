

import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

let db;

export async function connectToMongoDB() {
  try {
    await client.connect();

    db = client.db("fix-mate");

    console.log("MongoDB Connected Successfully!");

    return db;
  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
    throw error;
  }
}

// Database Index Initialization
export async function initializeDatabase() {
  try {
    if (!db) {
      throw new Error("Database is not connected!");
    }

    // Users Collection
    // BetterAuth uses "user" as its default collection name.
    await db.collection("user").createIndex(
      { email: 1 },
      { unique: true, name: "user_email_unique" }
    );

    // Services Collection
    await db.collection("services").createIndex(
      { technicianEmail: 1 },
      { name: "service_technician_email" }
    );

    await db.collection("services").createIndex(
      { category: 1 },
      { name: "service_category" }
    );

    await db.collection("services").createIndex(
      { approvalStatus: 1 },
      { name: "service_approval_status" }
    );

    // Bookings Collection
    await db.collection("bookings").createIndex(
      { customerEmail: 1 },
      { name: "booking_customer_email" }
    );

    await db.collection("bookings").createIndex(
      { technicianEmail: 1 },
      { name: "booking_technician_email" }
    );

    await db.collection("bookings").createIndex(
      { serviceId: 1 },
      { name: "booking_service_id" }
    );

    await db.collection("bookings").createIndex(
      { status: 1 },
      { name: "booking_status" }
    );

    // Payments Collection
    await db.collection("payments").createIndex(
      { bookingId: 1 },
      { unique: true, name: "payment_booking_unique" }
    );

    await db.collection("payments").createIndex(
      { stripeSessionId: 1 },
      { unique: true, name: "payment_stripe_session_unique" }
    );

    console.log("Database Indexes Created Successfully!");

  } catch (error) {
    console.error("Database Index Initialization Failed:", error);
    throw error;
  }
}

// Get Database Instance
export function getDB() {
  if (!db) {
    throw new Error("Database is not connected!");
  }

  return db;
}


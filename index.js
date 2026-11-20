
import express from "express";
import cors from "cors";
import "dotenv/config";
import { verifyToken } from "./middleware/verifyToken.js";
import { verifyRole } from "./middleware/verifyRole.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { getAllPayments } from "./controllers/paymentController.js";

import {
  connectToMongoDB,
  getDB,
  initializeDatabase
} from "./config/db.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);

// Admin Payments Route Alias (Assignment Challenge 2)
app.get(
  "/api/admin/payments",
  verifyToken,
  verifyRole("admin"),
  getAllPayments
);


// Home Route
app.get("/", (req, res) => {
  res.send("FixMate Server is Running!");
});

// Service Routes
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);

// Protected Test Route


// Customer Only Route
app.get(
  "/api/test/customer",
  verifyToken,
  verifyRole("customer"),
  (req, res) => {
    res.status(200).json({
      message: "Customer access granted!",
    });
  }
);

// Admin Only Route
app.get(
  "/api/test/admin",
  verifyToken,
  verifyRole("admin"),
  (req, res) => {
    res.status(200).json({
      message: "Admin access granted!",
    });
  }
);

// Start Server after DB connection
async function startServer() {
  try {
    await connectToMongoDB();

    await initializeDatabase();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`FixMate Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}
startServer();






// Test MongoDB Route
// app.get("/users", async (req, res) => {
//   try {
//     const db = getDB();

//     const users = await db.collection("users").find().toArray();

//     res.status(200).json(users);
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to fetch users",
//       error: error.message,
//     });
//   }
// });
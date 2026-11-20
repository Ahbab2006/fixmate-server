
import express from "express";

import {
  createService,
  getAllServices,
  getSingleService,
  getMyServices,
  updateService,
  deleteService,
  getAdminServices,
  getPendingServices,
  updateServiceApproval,
  toggleServiceAvailability,
  getAdminServiceStats,
} from "../controllers/serviceController.js";

import { verifyToken } from "../middleware/verifyToken.js";
import { verifyRole } from "../middleware/verifyRole.js";

const router = express.Router();

// Get All Approved and Available Services - Public
router.get("/", getAllServices);

// Get Technician's Own Services - Technician Only
router.get(
  "/my-services",
  verifyToken,
  verifyRole("technician"),
  getMyServices
);


// Get Admin Services with approvalStatus filter - Admin Only
router.get(
  "/admin/services",
  verifyToken,
  verifyRole("admin"),
  getAdminServices
);

// Get All Pending Services (legacy / backward compatibility) - Admin Only
router.get(
  "/admin/pending",
  verifyToken,
  verifyRole("admin"),
  getAdminServices
);

// Get Admin Service Statistics - Admin Only
router.get(
  "/admin/stats",
  verifyToken,
  verifyRole("admin"),
  getAdminServiceStats
);

// Approve or Reject Service - Admin Only
router.patch(
  "/admin/:id/approval",
  verifyToken,
  verifyRole("admin"),
  updateServiceApproval
);

router.patch(
  "/:id/availability",
  verifyToken,
  verifyRole("technician"),
  toggleServiceAvailability
);
router.get("/:id", getSingleService);

// Create Service - Technician Only
router.post(
  "/",
  verifyToken,
  verifyRole("technician"),
  createService
);

// Update Service - Technician Only
router.put(
  "/:id",
  verifyToken,
  verifyRole("technician"),
  updateService
);
// Delete Service - Technician Only
router.delete(
  "/:id",
  verifyToken,
  verifyRole("technician"),
  deleteService
);

export default router;

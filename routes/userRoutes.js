
import express from "express";

import {
  getMyProfile,
  updateUserProfile,
  getAllUsers,
  updateUserRole,
} from "../controllers/userController.js";

import { verifyToken } from "../middleware/verifyToken.js";
import { verifyRole } from "../middleware/verifyRole.js";

const router = express.Router();

// Get Own Profile (Authenticated User)
router.get(
  "/profile",
  verifyToken,
  getMyProfile
);

// Update Own Profile (Authenticated User)
router.patch(
  "/profile",
  verifyToken,
  updateUserProfile
);

// Get All Users (Admin Only)
router.get(
  "/",
  verifyToken,
  verifyRole("admin"),
  getAllUsers
);

// Update User Role (Admin Only)
router.patch(
  "/:id/role",
  verifyToken,
  verifyRole("admin"),
  updateUserRole
);

export default router;

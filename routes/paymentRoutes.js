
import express from "express";

import {
  createCheckoutSession,
    verifyCheckoutSession,
     getMyPayments,
  getAllPayments,
} from "../controllers/paymentController.js";

import { verifyToken } from "../middleware/verifyToken.js";
import { verifyRole } from "../middleware/verifyRole.js";

const router = express.Router();

// Customer Payment
router.post(
  "/create-checkout-session",
  verifyToken,
  verifyRole("customer"),
  createCheckoutSession
);

// Customer Payment History
router.get(
  "/my-payments",
  verifyToken,
  verifyRole("customer"),
  getMyPayments
);

// Verify Stripe Payment (Customer Only)
router.post(
  "/verify-checkout-session",
  verifyToken,
  verifyRole("customer"),
  verifyCheckoutSession
);

// Admin Payment History
router.get(
  "/admin/all",
  verifyToken,
  verifyRole("admin"),
  getAllPayments
);

router.get(
  "/admin/payments",
  verifyToken,
  verifyRole("admin"),
  getAllPayments
);

export default router;

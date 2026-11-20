
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import stripe from "../config/stripe.js";

// Create Stripe Checkout Session (Customer Only)
export async function createCheckoutSession(req, res) {
  try {
    const { bookingId } = req.body;

    if (!bookingId || !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID.",
      });
    }

    const db = getDB();

    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found.",
      });
    }

    // Check booking ownership
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        message: "You cannot pay for another customer's booking.",
      });
    }

    // Payment only for completed bookings
    if (booking.status !== "completed") {
      return res.status(400).json({
        message: "Payment is only available for completed bookings.",
      });
    }

    // Prevent duplicate payment
    if (booking.paymentStatus === "paid") {
      return res.status(409).json({
        message: "This booking has already been paid.",
      });
    }

    const existingPayment = await db.collection("payments").findOne({
      bookingId: bookingId,
    });

    if (existingPayment) {
      return res.status(409).json({
        message: "Payment already exists for this booking.",
      });
    }

    const amount = Number(booking.finalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Invalid payment amount.",
      });
    }

    const clientBaseUrl = process.env.CLIENT_URL
      ? process.env.CLIENT_URL.replace(/\/+$/, "")
      : "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

    //   payment_method_types: ["card"],

      customer_email: booking.customerEmail,

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: booking.serviceTitle,
              description: `FixMate Booking: ${bookingId}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],

      metadata: {
        bookingId: bookingId,
        customerEmail: booking.customerEmail,
      },

      success_url: `${clientBaseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${clientBaseUrl}/payment/cancel`,
    });

    return res.status(200).json({
      success: true,
      message: "Checkout session created successfully.",
      checkoutUrl: session.url,
    });
  } catch (error) {
    console.error("Create Checkout Session Error:", error);

    return res.status(500).json({
      message: "Failed to create checkout session.",
    });
  }
}


// Verify Stripe Checkout Session (Customer Only)
export async function verifyCheckoutSession(req, res) {
  try {
    const { sessionId } = req.body;

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({
        message: "Invalid Stripe session ID.",
      });
    }

    const db = getDB();

    // Retrieve session directly from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify successful payment
    if (
      session.payment_status !== "paid" ||
      session.mode !== "payment"
    ) {
      return res.status(400).json({
        message: "Payment has not been completed.",
      });
    }

    const bookingId = session.metadata?.bookingId;
    const customerEmail = session.metadata?.customerEmail;

    if (!bookingId || !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking information.",
      });
    }

    // Find booking
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found.",
      });
    }

    // Verify customer ownership
    if (
      booking.customerEmail !== req.user.email ||
      customerEmail !== req.user.email ||
      customerEmail !== booking.customerEmail
    ) {
      return res.status(403).json({
        message: "You cannot verify another customer's payment.",
      });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        message: "Booking is not completed.",
      });
    }

    // Verify payment amount and currency
const expectedAmount = Math.round(Number(booking.finalAmount) * 100);

if (
  session.amount_total !== expectedAmount ||
  session.currency !== "usd"
) {
  return res.status(400).json({
    success: false,
    message: "Payment amount or currency mismatch.",
  });
}

    // Check whether payment was already saved
    const existingPayment = await db.collection("payments").findOne({
      $or: [
        { bookingId },
        { stripeSessionId: sessionId },
      ],
    });

    if (existingPayment) {
      // Restore paid status if a previous request was interrupted
      await db.collection("bookings").updateOne(
        { _id: new ObjectId(bookingId) },
        {
          $set: {
            paymentStatus: "paid",
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Payment already verified.",
        payment: existingPayment,
      });
    }

    const now = new Date();
    const payment = {
      bookingId,
      stripeSessionId: sessionId,
      transactionId: session.payment_intent,
      paymentIntentId: session.payment_intent,
      customerName: booking.customerName || "",
      customerEmail: booking.customerEmail,
      technicianName: booking.technicianName || "",
      technicianEmail: booking.technicianEmail || "",
      serviceTitle: booking.serviceTitle,
      amount: session.amount_total / 100,
      currency: session.currency,
      paymentStatus: "paid",
      paidAt: now,
      createdAt: now,
    };

    // Save payment
    await db.collection("payments").insertOne(payment);

    // Update booking
    await db.collection("bookings").updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          paymentStatus: "paid",
          paidAt: now,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified and saved successfully.",
      payment,
    });
  } catch (error) {
    console.error("Verify Checkout Session Error:", error);

    return res.status(500).json({
      message: "Failed to verify payment.",
    });
  }
}


// Get My Payments (Customer Only)
export async function getMyPayments(req, res) {
  try {
    const db = getDB();

    const payments = await db.collection("payments")
      .find({
        customerEmail: req.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    const totalAmount = payments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

    return res.status(200).json({
      success: true,
      totalPayments: payments.length,
      totalAmount,
      payments,
    });
  } catch (error) {
    console.error("Get My Payments Error:", error);

    return res.status(500).json({
      message: "Failed to fetch payment history.",
    });
  }
}


// Get All Payments (Admin Only)
export async function getAllPayments(req, res) {
  try {
    const db = getDB();

    const payments = await db.collection("payments")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const totalRevenue = payments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

    return res.status(200).json({
      success: true,
      totalPayments: payments.length,
      totalRevenue,
      payments,
    });
  } catch (error) {
    console.error("Get All Payments Error:", error);

    return res.status(500).json({
      message: "Failed to fetch payments.",
    });
  }
}

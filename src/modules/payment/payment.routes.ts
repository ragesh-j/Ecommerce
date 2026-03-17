import { Router } from "express";
import express from "express";
import authenticate from "../../middlewares/authenticate";
import {
  createPaymentController,
  verifyPaymentController,
  getPaymentController,
  webhookController,
} from "./payment.controller";

const router = Router();

// ─── webhook (raw body needed for signature verification) ─────────────────────
// must be before express.json() middleware
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookController
);

// ─── other routes need parsed JSON ───────────────────────────────────────────
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
// ─── authenticated routes ─────────────────────────────────────────────────────
router.use(authenticate);

router.post("/create", createPaymentController);
router.post("/verify", verifyPaymentController);
router.get("/:orderId", getPaymentController);

export default router;
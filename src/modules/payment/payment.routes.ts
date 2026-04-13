import { Router } from "express";
import express from "express";
import authenticate from "../../middlewares/authenticate";
import {
  initiatePaymentController,
  verifyPaymentController,
  getPaymentController,
  webhookController,
} from "./payment.controller";

const router = Router();

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookController
);

router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(authenticate);

router.post("/initiate", initiatePaymentController);  // ← new
router.post("/verify", verifyPaymentController);
router.get("/:orderId", getPaymentController);

export default router;
import { z } from "zod";

export const initiatePaymentSchema = z.object({
  addressId: z.string().min(1, "Address ID is required"),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, "Razorpay order ID is required"),
  razorpayPaymentId: z.string().min(1, "Razorpay payment ID is required"),
  razorpaySignature: z.string().min(1, "Razorpay signature is required"),
  addressId: z.string().min(1, "Address ID is required"),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
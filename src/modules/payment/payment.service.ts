import crypto from "crypto";
import prisma from "../../config/db";
import razorpay from "../../config/razorpay";
import { ApiError } from "../../utils/ApiError";
import { CreatePaymentInput, VerifyPaymentInput } from "./payment.validator";

// ─── create razorpay order ────────────────────────────────────────────────────
export const createPayment = async (userId: string, data: CreatePaymentInput) => {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { payment: true },
  });

  if (!order) throw new ApiError(404, "Order not found");
  if (order.userId !== userId) throw new ApiError(403, "Forbidden");
  if (order.status !== "PENDING") throw new ApiError(400, "Order is not pending");
  if (order.payment) throw new ApiError(409, "Payment already initiated for this order");

  // create razorpay order (amount in paise → multiply by 100)
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(Number(order.totalAmount) * 100),
    currency: "INR",
    receipt: order.id,
  });

  // save pending payment to DB
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      userId,
      amount: order.totalAmount,
      currency: "INR",
      provider: "razorpay",
      status: "PENDING",
      providerMetadata: { razorpayOrderId: razorpayOrder.id },
    },
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    paymentId: payment.id,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

// ─── verify payment ───────────────────────────────────────────────────────────
export const verifyPayment = async (userId: string, data: VerifyPaymentInput) => {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { payment: true },
  });

  if (!order) throw new ApiError(404, "Order not found");
  if (order.userId !== userId) throw new ApiError(403, "Forbidden");
  if (!order.payment) throw new ApiError(404, "Payment not found");
  if (order.payment.status === "COMPLETED") throw new ApiError(409, "Payment already completed");

  // verify signature
  const body = `${data.razorpayOrderId}|${data.razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (expectedSignature !== data.razorpaySignature) {
    throw new ApiError(400, "Invalid payment signature");
  }

  // update payment + order status in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: order.payment!.id },
      data: {
        status: "COMPLETED",
        providerTxId: data.razorpayPaymentId,
        providerMetadata: {
          razorpayOrderId: data.razorpayOrderId,
          razorpayPaymentId: data.razorpayPaymentId,
          razorpaySignature: data.razorpaySignature,
        },
      },
    });

    await tx.order.update({
      where: { id: data.orderId },
      data: { status: "PAID" },
    });
  });

  return { success: true, message: "Payment verified successfully" };
};

// ─── get payment by order id ──────────────────────────────────────────────────
export const getPaymentByOrderId = async (userId: string, orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.userId !== userId) throw new ApiError(403, "Forbidden");

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) throw new ApiError(404, "Payment not found");

  return payment;
};

// ─── webhook handler ──────────────────────────────────────────────────────────
export const handleWebhook = async (body: string, signature: string) => {
  // verify webhook signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new ApiError(400, "Invalid webhook signature");
  }

  const event = JSON.parse(body);

  switch (event.event) {
    case "payment.captured": {
      const razorpayPaymentId = event.payload.payment.entity.id;
      const razorpayOrderId = event.payload.payment.entity.order_id;

      const payment = await prisma.payment.findFirst({
        where: {
          providerMetadata: { path: ["razorpayOrderId"], equals: razorpayOrderId },
        },
      });

      if (payment && payment.status !== "COMPLETED") {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: "COMPLETED", providerTxId: razorpayPaymentId },
          });
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: "PAID" },
          });
        });
      }
      break;
    }

    case "payment.failed": {
      const razorpayOrderId = event.payload.payment.entity.order_id;

      const payment = await prisma.payment.findFirst({
        where: {
          providerMetadata: { path: ["razorpayOrderId"], equals: razorpayOrderId },
        },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
      }
      break;
    }
  }
};
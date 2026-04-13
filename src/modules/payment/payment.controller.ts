import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as paymentService from "./payment.service";
import { initiatePaymentSchema, verifyPaymentSchema } from "./payment.validator";

export const initiatePaymentController = catchAsync(async (req: Request, res: Response) => {
  const data = initiatePaymentSchema.parse(req.body);
  const result = await paymentService.initiatePayment(req.user!.userId, data);

  res.status(200).json({
    success: true,
    message: "Payment initiated",
    data: result,
  });
});

export const verifyPaymentController = catchAsync(async (req: Request, res: Response) => {
  const data = verifyPaymentSchema.parse(req.body);
  const result = await paymentService.verifyPayment(req.user!.userId, data);

  res.status(200).json({
    success: true,
    message: result.message,
    data: { orderId: result.orderId },
  });
});

export const getPaymentController = catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentService.getPaymentByOrderId(req.user!.userId, req.params.orderId as string);

  res.status(200).json({
    success: true,
    data: { payment },
  });
});

export const webhookController = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    if (!signature) return res.status(400).json({ success: false, message: "Missing signature" });

    await paymentService.handleWebhook(req.body, signature);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};
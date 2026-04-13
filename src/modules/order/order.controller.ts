import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as orderService from "./order.service";
import { updateOrderStatusSchema } from "./order.validator";


export const getMyOrdersController = catchAsync(async (req: Request, res: Response) => {
  const orders = await orderService.getMyOrders(req.user!.userId);
  res.status(200).json({ success: true, data: { orders } });
});

export const getOrderByIdController = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, data: { order } });
});

export const cancelOrderController = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.cancelOrder(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, message: "Order cancelled", data: { order } });
});

export const getSellerOrdersController = catchAsync(async (req: Request, res: Response) => {
  const orders = await orderService.getSellerOrders(req.user!.userId);
  res.status(200).json({ success: true, data: { orders } });
});

export const updateOrderStatusController = catchAsync(async (req: Request, res: Response) => {
  const data = updateOrderStatusSchema.parse(req.body);
  const order = await orderService.updateOrderStatus(req.user!.userId, req.params.id as string, data);
  res.status(200).json({ success: true, message: "Order status updated", data: { order } });
});


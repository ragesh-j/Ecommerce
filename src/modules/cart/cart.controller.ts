import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as cartService from "./cart.service";
import { addCartItemSchema, updateCartItemSchema } from "./cart.validator";

export const getCartController = catchAsync(async (req: Request, res: Response) => {
  const cart = await cartService.getCart(req.user!.userId);
  res.status(200).json({ success: true, data: { cart } });
});

export const addCartItemController = catchAsync(async (req: Request, res: Response) => {
  const data = addCartItemSchema.parse(req.body);
  const item = await cartService.addCartItem(req.user!.userId, data);
  res.status(201).json({ success: true, message: "Item added to cart", data: { item } });
});

export const updateCartItemController = catchAsync(async (req: Request, res: Response) => {
  const data = updateCartItemSchema.parse(req.body);
  const item = await cartService.updateCartItem(req.user!.userId, req.params.id as string, data);
  res.status(200).json({ success: true, message: "Cart item updated", data: { item } });
});

export const removeCartItemController = catchAsync(async (req: Request, res: Response) => {
  await cartService.removeCartItem(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, message: "Item removed from cart" });
});

export const clearCartController = catchAsync(async (req: Request, res: Response) => {
  await cartService.clearCart(req.user!.userId);
  res.status(200).json({ success: true, message: "Cart cleared" });
});
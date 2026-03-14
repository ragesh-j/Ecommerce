import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as userService from "./user.service";
import {
  updateProfileSchema,
  changePasswordSchema,
  setPasswordSchema,
  addAddressSchema,
  updateAddressSchema,
} from "./user.validator";

// ─── profile ──────────────────────────────────────────────────────────────────
export const getProfileController = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getProfile(req.user!.userId);
  res.status(200).json({ success: true, data: { user } });
});

export const updateProfileController = catchAsync(async (req: Request, res: Response) => {
  const data = updateProfileSchema.parse(req.body);
  const user = await userService.updateProfile(req.user!.userId, data);
  res.status(200).json({ success: true, message: "Profile updated", data: { user } });
});

// ─── password ─────────────────────────────────────────────────────────────────
export const changePasswordController = catchAsync(async (req: Request, res: Response) => {
  const data = changePasswordSchema.parse(req.body);
  await userService.changePassword(req.user!.userId, data);
  res.status(200).json({ success: true, message: "Password changed successfully" });
});

export const setPasswordController = catchAsync(async (req: Request, res: Response) => {
  const data = setPasswordSchema.parse(req.body);
  await userService.setPassword(req.user!.userId, data);
  res.status(200).json({ success: true, message: "Password set successfully" });
});

// ─── addresses ────────────────────────────────────────────────────────────────
export const getAddressesController = catchAsync(async (req: Request, res: Response) => {
  const addresses = await userService.getAddresses(req.user!.userId);
  res.status(200).json({ success: true, data: { addresses } });
});

export const addAddressController = catchAsync(async (req: Request, res: Response) => {
  const data = addAddressSchema.parse(req.body);
  const address = await userService.addAddress(req.user!.userId, data);
  res.status(201).json({ success: true, message: "Address added", data: { address } });
});

export const updateAddressController = catchAsync(async (req: Request, res: Response) => {
  const data = updateAddressSchema.parse(req.body);
  const address = await userService.updateAddress(req.user!.userId, req.params.id as string, data);
  res.status(200).json({ success: true, message: "Address updated", data: { address } });
});

export const deleteAddressController = catchAsync(async (req: Request, res: Response) => {
  await userService.deleteAddress(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, message: "Address deleted" });
});

// ─── orders ───────────────────────────────────────────────────────────────────
export const getMyOrdersController = catchAsync(async (req: Request, res: Response) => {
  const orders = await userService.getMyOrders(req.user!.userId);
  res.status(200).json({ success: true, data: { orders } });
});

// ─── reviews ──────────────────────────────────────────────────────────────────
export const getMyReviewsController = catchAsync(async (req: Request, res: Response) => {
  const reviews = await userService.getMyReviews(req.user!.userId);
  res.status(200).json({ success: true, data: { reviews } });
});
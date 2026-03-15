import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as sellerService from "./seller.service";
import { createSellerProfileSchema, updateSellerProfileSchema } from "./seller.validator";

export const createSellerProfileController = catchAsync(async (req: Request, res: Response) => {
  const data = createSellerProfileSchema.parse(req.body);
  const logoFile = req.file; // from multer

  const profile = await sellerService.createSellerProfile(req.user!.userId, data, logoFile);

  res.status(201).json({
    success: true,
    message: "Seller profile created successfully",
    data: { profile },
  });
});

export const getMySellerProfileController = catchAsync(async (req: Request, res: Response) => {
  const profile = await sellerService.getMySellerProfile(req.user!.userId);

  res.status(200).json({
    success: true,
    data: { profile },
  });
});

export const updateSellerProfileController = catchAsync(async (req: Request, res: Response) => {
  const data = updateSellerProfileSchema.parse(req.body);
  const logoFile = req.file;

  const profile = await sellerService.updateSellerProfile(req.user!.userId, data, logoFile);

  res.status(200).json({
    success: true,
    message: "Seller profile updated successfully",
    data: { profile },
  });
});

export const getPublicSellerProfileController = catchAsync(async (req: Request, res: Response) => {
  const profile = await sellerService.getPublicSellerProfile(req.params.id as string);

  res.status(200).json({
    success: true,
    data: { profile },
  });
});
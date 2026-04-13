import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as bannerService from "./banner.service";
import { createBannerSchema, updateBannerSchema } from "./banner.validator";

// ─── public ───────────────────────────────────────────────────────────────────
export const getActiveBannersController = catchAsync(async (_req: Request, res: Response) => {
  const banners = await bannerService.getActiveBanners();

  res.status(200).json({
    success: true,
    data: { banners },
  });
});

// ─── admin ────────────────────────────────────────────────────────────────────
export const getAllBannersController = catchAsync(async (_req: Request, res: Response) => {
  const banners = await bannerService.getAllBanners();

  res.status(200).json({
    success: true,
    data: { banners },
  });
});

export const createBannerController = catchAsync(async (req: Request, res: Response) => {
  const data = createBannerSchema.parse(req.body);
  const banner = await bannerService.createBanner(data);

  res.status(201).json({
    success: true,
    message: "Banner created",
    data: { banner },
  });
});

export const updateBannerController = catchAsync(async (req: Request, res: Response) => {
  const data = updateBannerSchema.parse(req.body);
  const banner = await bannerService.updateBanner(req.params.id as string, data);

  res.status(200).json({
    success: true,
    message: "Banner updated",
    data: { banner },
  });
});

export const toggleBannerController = catchAsync(async (req: Request, res: Response) => {
  const banner = await bannerService.toggleBanner(req.params.id as string);

  res.status(200).json({
    success: true,
    message: banner.isActive ? "Banner activated" : "Banner deactivated",
    data: { banner },
  });
});

export const uploadBannerImageController = catchAsync(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  const banner = await bannerService.uploadBannerImage(req.params.id as string, file);

  res.status(200).json({ success: true, message: "Banner image uploaded", data: { banner } });
});

export const deleteBannerController = catchAsync(async (req: Request, res: Response) => {
  await bannerService.deleteBanner(req.params.id as string);

  res.status(200).json({
    success: true,
    message: "Banner deleted",
  });
});
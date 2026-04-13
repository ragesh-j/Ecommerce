import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { CreateBannerInput, UpdateBannerInput } from "./banner.validator";
import { uploadToR2, deleteFromR2 } from "../../utils/upload";
// ─── create banner ────────────────────────────────────────────────────────────
export const createBanner = async (data: CreateBannerInput) => {
  return prisma.banner.create({ data });
};

// ─── get all banners (public - active only) ───────────────────────────────────
export const getActiveBanners = async () => {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
};

// ─── get all banners (admin - all) ───────────────────────────────────────────
export const getAllBanners = async () => {
  return prisma.banner.findMany({
    orderBy: { order: "asc" },
  });
};

// ─── update banner ────────────────────────────────────────────────────────────
export const updateBanner = async (id: string, data: UpdateBannerInput) => {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new ApiError(404, "Banner not found");

  return prisma.banner.update({ where: { id }, data });
};

// ─── toggle active ────────────────────────────────────────────────────────────
export const toggleBanner = async (id: string) => {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new ApiError(404, "Banner not found");

  return prisma.banner.update({
    where: { id },
    data: { isActive: !banner.isActive },
  });
};


export const uploadBannerImage = async (id: string, file: Express.Multer.File | undefined) => {
  if (!file) throw new ApiError(400, "No file uploaded");
  
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new ApiError(404, "Banner not found");

  if (banner.imageKey) await deleteFromR2(banner.imageKey);

  const { url, key } = await uploadToR2(file, "banners");

  return prisma.banner.update({
    where: { id },
    data: { imageUrl: url, imageKey: key },
  });
};

export const deleteBanner = async (id: string) => {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new ApiError(404, "Banner not found");

  // delete image from R2 if present
  if (banner.imageKey) await deleteFromR2(banner.imageKey);

  await prisma.banner.delete({ where: { id } });
};
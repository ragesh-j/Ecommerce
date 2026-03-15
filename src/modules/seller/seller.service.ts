import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { uploadToR2, deleteFromR2 } from "../../utils/upload";
import { CreateSellerProfileInput, UpdateSellerProfileInput } from "./seller.validator";

// ─── create seller profile ────────────────────────────────────────────────────
export const createSellerProfile = async (
  userId: string,
  data: CreateSellerProfileInput,
  logoFile?: Express.Multer.File
) => {
  // check if seller profile already exists
  const existing = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (existing) throw new ApiError(409, "Seller profile already exists");

  // upload logo to S3 if provided
  let logoUrl: string | undefined;
  let logoKey: string | undefined;

  if (logoFile) {
    const uploaded = await uploadToR2(logoFile, "logos");
    logoUrl = uploaded.url;
    logoKey = uploaded.key;
  }

  // create seller profile + update user role to SELLER in a transaction
  const [sellerProfile] = await prisma.$transaction([
    prisma.sellerProfile.create({
      data: {
        userId,
        storeName: data.storeName,
        description: data.description,
        logoUrl,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { role: "SELLER" },
    }),
  ]);

  // store logo in Media table if uploaded
  if (logoFile && logoUrl && logoKey) {
    await prisma.media.create({
      data: {
        uploaderId: userId,
        type: "IMAGE",
        url: logoUrl,
        key: logoKey,
        mimeType: logoFile.mimetype,
        size: logoFile.size,
      },
    });
  }

  return sellerProfile;
};

// ─── get own seller profile ───────────────────────────────────────────────────
export const getMySellerProfile = async (userId: string) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: { name: true, email: true },
      },
      _count: {
        select: { products: true },
      },
    },
  });

  if (!profile) throw new ApiError(404, "Seller profile not found");
  return profile;
};

// ─── update seller profile ────────────────────────────────────────────────────
export const updateSellerProfile = async (
  userId: string,
  data: UpdateSellerProfileInput,
  logoFile?: Express.Multer.File
) => {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError(404, "Seller profile not found");

  let logoUrl = profile.logoUrl;
  let logoKey: string | undefined;

  if (logoFile) {
    // delete old logo from Cloudinary if exists
    if (profile.logoUrl) {
      const oldMedia = await prisma.media.findFirst({
        where: { url: profile.logoUrl },
        select: { key: true },
      });
      if (oldMedia) await deleteFromR2(oldMedia.key);
    }

    const uploaded = await uploadToR2(logoFile, "logos");
    logoUrl = uploaded.url;
    logoKey = uploaded.key;

    // store new logo in Media table
    await prisma.media.create({
      data: {
        uploaderId: userId,
        type: "IMAGE",
        url: logoUrl,
        key: logoKey,
        mimeType: logoFile.mimetype,
        size: logoFile.size,
      },
    });
  }

  return prisma.sellerProfile.update({
    where: { userId },
    data: { ...data, logoUrl },
  });
};

// ─── get public seller profile ────────────────────────────────────────────────
export const getPublicSellerProfile = async (sellerId: string) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      storeName: true,
      description: true,
      logoUrl: true,
      isVerified: true,
      createdAt: true,
      user: {
        select: { name: true },
      },
      _count: {
        select: { products: true, },
      },
    },
  });

  if (!profile) throw new ApiError(404, "Seller not found");
  return profile;
};
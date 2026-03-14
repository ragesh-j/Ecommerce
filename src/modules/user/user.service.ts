import prisma from "../../config/db";
import { hashPassword, comparePassword } from "../../utils/hash";
import { ApiError } from "../../utils/ApiError";
import {
  UpdateProfileInput,
  ChangePasswordInput,
  SetPasswordInput,
  AddAddressInput,
  UpdateAddressInput,
} from "./user.validator";

// ─── get profile ──────────────────────────────────────────────────────────────
export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      accounts: {
        select: { provider: true }, // shows which providers are linked e.g. google
      },
    },
  });

  if (!user) throw new ApiError(404, "User not found");
  return user;
};

// ─── update profile ───────────────────────────────────────────────────────────
export const updateProfile = async (userId: string, data: UpdateProfileInput) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
  });

  return user;
};

// ─── change password (for users who already have a password) ──────────────────
export const changePassword = async (userId: string, data: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  if (!user.passwordHash) throw new ApiError(400, "No password set, use set password instead");

  const isMatch = await comparePassword(data.currentPassword, user.passwordHash);
  if (!isMatch) throw new ApiError(401, "Current password is incorrect");

  if (data.currentPassword === data.newPassword)
    throw new ApiError(400, "New password must be different from current password");

  const passwordHash = await hashPassword(data.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
};

// ─── set password (for Google OAuth users who have no password yet) ───────────
export const setPassword = async (userId: string, data: SetPasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  if (user.passwordHash) throw new ApiError(400, "Password already set, use change password instead");

  const passwordHash = await hashPassword(data.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
};

// ─── get addresses ────────────────────────────────────────────────────────────
export const getAddresses = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      },
    },
  });

  if (!user) throw new ApiError(404, "User not found");
  return user.addresses;
};

// ─── add address ──────────────────────────────────────────────────────────────
export const addAddress = async (userId: string, data: AddAddressInput) => {
  // if new address is default → unset all other defaults first
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  return prisma.address.create({ data: { ...data, userId } });
};

// ─── update address ───────────────────────────────────────────────────────────
export const updateAddress = async (userId: string, addressId: string, data: UpdateAddressInput) => {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) throw new ApiError(404, "Address not found");
  if (address.userId !== userId) throw new ApiError(403, "Forbidden");

  // if updating to default → unset all other defaults first
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId, NOT: { id: addressId } },
      data: { isDefault: false },
    });
  }

  return prisma.address.update({ where: { id: addressId }, data });
};

// ─── delete address ───────────────────────────────────────────────────────────
export const deleteAddress = async (userId: string, addressId: string) => {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) throw new ApiError(404, "Address not found");
  if (address.userId !== userId) throw new ApiError(403, "Forbidden");

  await prisma.address.delete({ where: { id: addressId } });
};

// ─── get my orders ────────────────────────────────────────────────────────────
export const getMyOrders = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          address: {
            select: { line1: true, city: true, country: true },
          },
          items: {
            select: {
              quantity: true,
              unitPrice: true,
              variant: {
                select: {
                  name: true,
                  sku: true,
                  product: {
                    select: { name: true, slug: true },
                  },
                },
              },
            },
          },
          payment: {
            select: { status: true, provider: true },
          },
        },
      },
    },
  });

  if (!user) throw new ApiError(404, "User not found");
  return user.orders;
};

// ─── get my reviews ───────────────────────────────────────────────────────────
export const getMyReviews = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          body: true,
          createdAt: true,
          product: {
            select: { name: true, slug: true },
          },
        },
      },
    },
  });

  if (!user) throw new ApiError(404, "User not found");
  return user.reviews;
};
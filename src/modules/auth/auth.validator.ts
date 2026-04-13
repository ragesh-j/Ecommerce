
import { z } from "zod";
import { Role } from "../../generated/prisma/client";
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),

});

export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
export const sellerRegisterSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  storeName: z.string().min(2, "Store name must be at least 2 characters"),
  description: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SellerRegisterInput = z.infer<typeof sellerRegisterSchema>;
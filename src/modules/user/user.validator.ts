import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  avatarUrl: z.string().url("Invalid URL").optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const addAddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = addAddressSchema.partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type AddAddressInput = z.infer<typeof addAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
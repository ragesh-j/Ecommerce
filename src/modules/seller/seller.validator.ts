import { z } from "zod";

export const createSellerProfileSchema = z.object({
  storeName: z.string().min(2, "Store name must be at least 2 characters"),
  description: z.string().optional(),
});

export const updateSellerProfileSchema = z.object({
  storeName: z.string().min(2, "Store name must be at least 2 characters").optional(),
  description: z.string().optional(),
});

export type CreateSellerProfileInput = z.infer<typeof createSellerProfileSchema>;
export type UpdateSellerProfileInput = z.infer<typeof updateSellerProfileSchema>;
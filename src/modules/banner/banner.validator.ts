import { z } from "zod";

export const createBannerSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  subtitle: z.string().optional(),
  linkUrl: z.string().url("Must be a valid URL").optional(),
  order: z.number().int().min(0).default(0),
});

export const updateBannerSchema = createBannerSchema.partial();

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
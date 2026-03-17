import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
});

export const updateProductSchema = createProductSchema.partial();

export const createVariantSchema = z.object({
  name: z.string().min(1, "Variant name is required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().min(0, "Stock cannot be negative").default(0),
});

export const updateVariantSchema = createVariantSchema.partial();

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  search: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
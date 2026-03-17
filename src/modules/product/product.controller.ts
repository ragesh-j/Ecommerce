import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as productService from "./product.service";
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  listProductsSchema,
} from "./product.validator";

// ─── public ───────────────────────────────────────────────────────────────────
export const listProductsController = catchAsync(async (req: Request, res: Response) => {
  const query = listProductsSchema.parse(req.query);
  const result = await productService.listProducts(query);

  res.status(200).json({ success: true, data: result });
});

export const getProductBySlugController = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.getProductBySlug(req.params.slug as string);
  res.status(200).json({ success: true, data: { product } });
});

// ─── seller ───────────────────────────────────────────────────────────────────
export const createProductController = catchAsync(async (req: Request, res: Response) => {
  const data = createProductSchema.parse(req.body);
  const product = await productService.createProduct(req.user!.userId, data);
  res.status(201).json({ success: true, message: "Product created", data: { product } });
});

export const updateProductController = catchAsync(async (req: Request, res: Response) => {
  const data = updateProductSchema.parse(req.body);
  const product = await productService.updateProduct(req.user!.userId, req.params.id as string, data);
  res.status(200).json({ success: true, message: "Product updated", data: { product } });
});

export const deleteProductController = catchAsync(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, message: "Product deleted" });
});

export const togglePublishController = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.togglePublish(req.user!.userId, req.params.id as string);
  res.status(200).json({
    success: true,
    message: product.isPublished ? "Product published" : "Product unpublished",
    data: { product },
  });
});

// ─── variants ─────────────────────────────────────────────────────────────────
export const addVariantController = catchAsync(async (req: Request, res: Response) => {
  const data = createVariantSchema.parse(req.body);
  const variant = await productService.addVariant(req.user!.userId, req.params.id as string, data);
  res.status(201).json({ success: true, message: "Variant added", data: { variant } });
});

export const updateVariantController = catchAsync(async (req: Request, res: Response) => {
  const data = updateVariantSchema.parse(req.body);
  const variant = await productService.updateVariant(
    req.user!.userId,
    req.params.id as string,
    req.params.vid as string,
    data
  );
  res.status(200).json({ success: true, message: "Variant updated", data: { variant } });
});

export const deleteVariantController = catchAsync(async (req: Request, res: Response) => {
  await productService.deleteVariant(
    req.user!.userId,
    req.params.id as string,
    req.params.vid as string
  );
  res.status(200).json({ success: true, message: "Variant deleted" });
});

// ─── media ────────────────────────────────────────────────────────────────────
export const uploadProductMediaController = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const media = await productService.uploadProductMedia(
    req.user!.userId,
    req.params.id as string,
    files
  );
  res.status(201).json({ success: true, message: "Media uploaded", data: { media } });
});

export const deleteProductMediaController = catchAsync(async (req: Request, res: Response) => {
  await productService.deleteProductMedia(
    req.user!.userId,
    req.params.id as string,
    req.params.mid as string
  );
  res.status(200).json({ success: true, message: "Media deleted" });
});
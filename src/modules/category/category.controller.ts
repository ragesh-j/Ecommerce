import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as categoryService from "./category.service";
import { createCategorySchema, updateCategorySchema } from "./category.validator";

export const createCategoryController = catchAsync(async (req: Request, res: Response) => {
  const data = createCategorySchema.parse(req.body);
  const category = await categoryService.createCategory(data);

  res.status(201).json({
    success: true,
    message: "Category created",
    data: { category },
  });
});

export const getAllCategoriesController = catchAsync(async (_req: Request, res: Response) => {
  const categories = await categoryService.getAllCategories();

  res.status(200).json({
    success: true,
    data: { categories },
  });
});

export const getCategoryBySlugController = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryBySlug(req.params.slug as string);

  res.status(200).json({
    success: true,
    data: { category },
  });
});

export const updateCategoryController = catchAsync(async (req: Request, res: Response) => {
  const data = updateCategorySchema.parse(req.body);
  const category = await categoryService.updateCategory(req.params.id as string, data);

  res.status(200).json({
    success: true,
    message: "Category updated",
    data: { category },
  });
});

export const deleteCategoryController = catchAsync(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(req.params.id as string);

  res.status(200).json({
    success: true,
    message: "Category deleted",
  });
});
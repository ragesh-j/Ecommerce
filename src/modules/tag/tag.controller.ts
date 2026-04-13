import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as tagService from "./tag.service";
import { createTagSchema, updateTagSchema } from "./tag.validator";

export const getAllTagsController = catchAsync(async (_req: Request, res: Response) => {
  const tags = await tagService.getAllTags();

  res.status(200).json({
    success: true,
    data: { tags },
  });
});

export const createTagController = catchAsync(async (req: Request, res: Response) => {
  const data = createTagSchema.parse(req.body);
  const tag = await tagService.createTag(data);

  res.status(201).json({
    success: true,
    message: "Tag created",
    data: { tag },
  });
});

export const updateTagController = catchAsync(async (req: Request, res: Response) => {
  const data = updateTagSchema.parse(req.body);
  const tag = await tagService.updateTag(req.params.id as string, data);

  res.status(200).json({
    success: true,
    message: "Tag updated",
    data: { tag },
  });
});

export const deleteTagController = catchAsync(async (req: Request, res: Response) => {
  await tagService.deleteTag(req.params.id as string);

  res.status(200).json({
    success: true,
    message: "Tag deleted",
  });
});

export const assignTagController = catchAsync(async (req: Request, res: Response) => {
  await tagService.assignTagToProduct(req.params.productId as string, req.params.tagId as string);

  res.status(200).json({
    success: true,
    message: "Tag assigned to product",
  });
});

export const removeTagController = catchAsync(async (req: Request, res: Response) => {
  await tagService.removeTagFromProduct(req.params.productId as string, req.params.tagId as string);

  res.status(200).json({
    success: true,
    message: "Tag removed from product",
  });
});
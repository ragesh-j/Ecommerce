import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import * as reviewService from "./review.service";
import { createReviewSchema, updateReviewSchema } from "./review.validator";

export const getProductReviewsController = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.getProductReviews(req.params.productId as string);
  res.status(200).json({ success: true, data: result });
});

export const createReviewController = catchAsync(async (req: Request, res: Response) => {
  const data = createReviewSchema.parse(req.body);
  const review = await reviewService.createReview(
    req.user!.userId,
    req.params.productId as string,
    data
  );
  res.status(201).json({ success: true, message: "Review created", data: { review } });
});

export const updateReviewController = catchAsync(async (req: Request, res: Response) => {
  const data = updateReviewSchema.parse(req.body);
  const review = await reviewService.updateReview(
    req.user!.userId,
    req.params.id as string,
    data
  );
  res.status(200).json({ success: true, message: "Review updated", data: { review } });
});

export const deleteReviewController = catchAsync(async (req: Request, res: Response) => {
  await reviewService.deleteReview(
    req.user!.userId,
    req.params.id as string,
    req.user!.role
  );
  res.status(200).json({ success: true, message: "Review deleted" });
});
import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { CreateReviewInput, UpdateReviewInput } from "./review.validator";

// ─── get product reviews (public) ────────────────────────────────────────────
export const getProductReviews = async (productId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, "Product not found");

  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, avatarUrl: true } },
    },
  });

  // calculate average rating
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return { reviews, avgRating: Math.round(avgRating * 10) / 10, total: reviews.length };
};

// ─── create review ────────────────────────────────────────────────────────────
export const createReview = async (userId: string, productId: string, data: CreateReviewInput) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, "Product not found");

  // check if buyer has a delivered order containing this product
  const delivered = await prisma.order.findFirst({
    where: {
      userId,
      status: "DELIVERED",
      items: {
        some: {
          variant: { productId },
        },
      },
    },
  });

  if (!delivered) throw new ApiError(403, "You can only review products you have received");

  // check if already reviewed
  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (existing) throw new ApiError(409, "You have already reviewed this product");

  return prisma.review.create({
    data: { productId, userId, ...data },
    include: { user: { select: { name: true, avatarUrl: true } } },
  });
};

// ─── update review ────────────────────────────────────────────────────────────
export const updateReview = async (userId: string, reviewId: string, data: UpdateReviewInput) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new ApiError(404, "Review not found");
  if (review.userId !== userId) throw new ApiError(403, "Forbidden");

  return prisma.review.update({
    where: { id: reviewId },
    data,
    include: { user: { select: { name: true, avatarUrl: true } } },
  });
};

// ─── delete review ────────────────────────────────────────────────────────────
export const deleteReview = async (userId: string, reviewId: string, role: string) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new ApiError(404, "Review not found");

  // only owner or admin can delete
  if (review.userId !== userId && role !== "ADMIN") throw new ApiError(403, "Forbidden");

  await prisma.review.delete({ where: { id: reviewId } });
};
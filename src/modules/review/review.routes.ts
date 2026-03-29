import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import {
  getProductReviewsController,
  createReviewController,
  updateReviewController,
  deleteReviewController,
} from "./review.controller";

const router = Router();

// ─── public ───────────────────────────────────────────────────────────────────
router.get("/products/:productId", getProductReviewsController);

// ─── authenticated ────────────────────────────────────────────────────────────
router.post("/products/:productId", authenticate, createReviewController);
router.put("/:id", authenticate, updateReviewController);
router.delete("/:id", authenticate, deleteReviewController);

export default router;
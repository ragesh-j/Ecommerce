import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import authorize from "../../middlewares/authorize";
import {
  createCategoryController,
  getAllCategoriesController,
  getCategoryBySlugController,
  updateCategoryController,
  deleteCategoryController,
} from "./category.controller";

const router = Router();

// ─── public routes ────────────────────────────────────────────────────────────
router.get("/", getAllCategoriesController);
router.get("/:slug", getCategoryBySlugController);

// ─── admin only ───────────────────────────────────────────────────────────────
router.post("/", authenticate, authorize("ADMIN"), createCategoryController);
router.put("/:id", authenticate, authorize("ADMIN"), updateCategoryController);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteCategoryController);

export default router;
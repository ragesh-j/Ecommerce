import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import authorize from "../../middlewares/authorize";
import { upload } from "../../utils/upload";
import {
  listProductsController,
  getProductBySlugController,
  createProductController,
  updateProductController,
  deleteProductController,
  togglePublishController,
  addVariantController,
  updateVariantController,
  deleteVariantController,
  uploadProductMediaController,
  deleteProductMediaController,
} from "./product.controller";

const router = Router();

// ─── public routes ────────────────────────────────────────────────────────────
router.get("/", listProductsController);
router.get("/:slug", getProductBySlugController);

// ─── seller only routes ───────────────────────────────────────────────────────
router.post("/", authenticate, authorize("SELLER"), createProductController);
router.put("/:id", authenticate, authorize("SELLER"), updateProductController);
router.delete("/:id", authenticate, authorize("SELLER"), deleteProductController);
router.patch("/:id/publish", authenticate, authorize("SELLER"), togglePublishController);

// ─── variants ─────────────────────────────────────────────────────────────────
router.post("/:id/variants", authenticate, authorize("SELLER"), addVariantController);
router.put("/:id/variants/:vid", authenticate, authorize("SELLER"), updateVariantController);
router.delete("/:id/variants/:vid", authenticate, authorize("SELLER"), deleteVariantController);

// ─── media ────────────────────────────────────────────────────────────────────
router.post("/:id/media", authenticate, authorize("SELLER"), upload.array("images", 5), uploadProductMediaController);
router.delete("/:id/media/:mid", authenticate, authorize("SELLER"), deleteProductMediaController);

export default router;
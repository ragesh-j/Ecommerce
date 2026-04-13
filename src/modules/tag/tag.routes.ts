import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import authorize from "../../middlewares/authorize";
import {
  getAllTagsController,
  createTagController,
  updateTagController,
  deleteTagController,
  assignTagController,
  removeTagController,
} from "./tag.controller";

const router = Router();

// ─── public ───────────────────────────────────────────────────────────────────
router.get("/", getAllTagsController);

// ─── admin only ───────────────────────────────────────────────────────────────
router.post("/", authenticate, authorize("ADMIN"), createTagController);
router.put("/:id", authenticate, authorize("ADMIN"), updateTagController);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteTagController);

// ─── assign / remove tag on product (admin only) ──────────────────────────────
router.post("/products/:productId/tags/:tagId", authenticate, authorize("ADMIN"), assignTagController);
router.delete("/products/:productId/tags/:tagId", authenticate, authorize("ADMIN"), removeTagController);

export default router;
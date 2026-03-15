import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import authorize from "../../middlewares/authorize";
import { upload } from "../../utils/upload";
import {
  createSellerProfileController,
  getMySellerProfileController,
  updateSellerProfileController,
  getPublicSellerProfileController,
} from "./seller.controller";

const router = Router();

// ─── /profile routes first (before /:id) ─────────────────────────────────────
router.post("/profile", authenticate, upload.single("logo"), createSellerProfileController);
router.get("/profile", authenticate, authorize("SELLER"), getMySellerProfileController);
router.put("/profile", authenticate, authorize("SELLER"), upload.single("logo"), updateSellerProfileController);

// ─── public /:id must be last ─────────────────────────────────────────────────
router.get("/:id", getPublicSellerProfileController);

export default router;
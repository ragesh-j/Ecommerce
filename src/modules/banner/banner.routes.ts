import { Router } from "express";
import { upload } from "../../utils/upload";
import authenticate from "../../middlewares/authenticate";
import authorize from "../../middlewares/authorize";
import {
  getActiveBannersController,
  getAllBannersController,
  createBannerController,
  updateBannerController,
  toggleBannerController,
  deleteBannerController,
  uploadBannerImageController,
} from "./banner.controller";

const router = Router();

// ─── public ───────────────────────────────────────────────────────────────────
router.get("/", getActiveBannersController);

// ─── admin only ───────────────────────────────────────────────────────────────
router.get("/all", authenticate, authorize("ADMIN"), getAllBannersController);
router.post("/", authenticate, authorize("ADMIN"), createBannerController);
router.put("/:id", authenticate, authorize("ADMIN"), updateBannerController);
router.patch("/:id/toggle", authenticate, authorize("ADMIN"), toggleBannerController);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteBannerController);
router.post("/:id/image", authenticate, authorize("ADMIN"), upload.single("image"), uploadBannerImageController);

export default router;
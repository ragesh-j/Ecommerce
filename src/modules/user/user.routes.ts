import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import {
  getProfileController,
  updateProfileController,
  changePasswordController,
  setPasswordController,
  getAddressesController,
  addAddressController,
  updateAddressController,
  deleteAddressController,
  getMyOrdersController,
  getMyReviewsController,
} from "./user.controller";

const router = Router();

// all routes require authentication
router.use(authenticate);

// ─── profile ──────────────────────────────────────────────────────────────────
router.get("/me", getProfileController);
router.put("/me", updateProfileController);

// ─── password ─────────────────────────────────────────────────────────────────
router.put("/me/password", changePasswordController);       // existing password users
router.post("/me/password", setPasswordController);         // google oauth users (no password yet)

// ─── addresses ────────────────────────────────────────────────────────────────
router.get("/me/addresses", getAddressesController);
router.post("/me/addresses", addAddressController);
router.put("/me/addresses/:id", updateAddressController);
router.delete("/me/addresses/:id", deleteAddressController);

// ─── orders & reviews ─────────────────────────────────────────────────────────
router.get("/me/orders", getMyOrdersController);
router.get("/me/reviews", getMyReviewsController);

export default router;
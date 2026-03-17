import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import authorize from "../../middlewares/authorize";
import {
  checkoutController,
  getMyOrdersController,
  getOrderByIdController,
  cancelOrderController,
  getSellerOrdersController,
  updateOrderStatusController,
} from "./order.controller";

const router = Router();

router.use(authenticate);

// ─── buyer routes ─────────────────────────────────────────────────────────────
router.post("/checkout", checkoutController);
router.get("/", getMyOrdersController);
router.get("/:id", getOrderByIdController);
router.patch("/:id/cancel", cancelOrderController);

// ─── seller routes ────────────────────────────────────────────────────────────
router.get("/seller/list", authorize("SELLER"), getSellerOrdersController);
router.patch("/:id/status", authorize("SELLER"), updateOrderStatusController);

export default router;
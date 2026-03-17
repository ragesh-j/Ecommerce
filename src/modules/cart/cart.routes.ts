import { Router } from "express";
import authenticate from "../../middlewares/authenticate";
import {
  getCartController,
  addCartItemController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
} from "./cart.controller";

const router = Router();

// all cart routes require authentication
router.use(authenticate);

router.get("/", getCartController);
router.post("/items", addCartItemController);
router.put("/items/:id", updateCartItemController);
router.delete("/items/:id", removeCartItemController);
router.delete("/", clearCartController);

export default router;
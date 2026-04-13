
import { Router } from "express";
import passport from "./google.strategy";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  exchangeController,
  sellerRegisterController
} from "./auth.controller";
import { authLimiter } from "../../config/rateLimiter";

const router = Router();
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // ← always true in production
  sameSite: "none" as const, // ← change from "strict" to "none" for cross-origin
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/register", authLimiter, registerController);
router.post("/login", authLimiter, loginController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);


// ─── google oauth ─────────────────────────────────────────────────────────────
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
  }),
  (req, res) => {
    const { session, refreshToken } = req.user as any;

    // set refreshToken as httpOnly cookie (same as normal login)
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    // redirect to frontend with session.id as the code
    // code is a random cuid — not a token, useless without the cookie
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?code=${session.id}`);
  }
);

// ─── exchange code for accessToken ───────────────────────────────────────────
router.post("/oauth/exchange", exchangeController);

router.post("/seller/register", authLimiter, sellerRegisterController);

export default router;
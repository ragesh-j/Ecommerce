
import { Router } from "express";
import passport from "./google.strategy";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  exchangeController
} from "./auth.controller";

const router = Router();
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
router.post("/register", registerController);
router.post("/login", loginController);
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

export default router;
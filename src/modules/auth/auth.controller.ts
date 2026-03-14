
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { ApiError } from "../../utils/ApiError";
import * as authService from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validator";

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const registerController = catchAsync(async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);
  const result = await authService.register(data);

  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(201).json({
    success: true,
    message: "Registered successfully",
    data: { user: result.user, accessToken: result.accessToken },
  });
});

export const loginController = catchAsync(async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);
  const result = await authService.login(data);

  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: { user: result.user, accessToken: result.accessToken },
  });
});



export const refreshController = catchAsync(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw new ApiError(401, "No refresh token");

  const result = await authService.refresh(refreshToken);
  res.status(200).json({
    success: true,
    data: { accessToken: result.accessToken },
  });
});

export const logoutController = catchAsync(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) await authService.logout(refreshToken);

  res.clearCookie("refreshToken");
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
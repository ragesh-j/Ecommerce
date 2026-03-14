
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token";
import { ApiError } from "../utils/ApiError";
import catchAsync from "../utils/catchAsync";

const authenticate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // get token from header → "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "No token provided");
  }

  const token = authHeader.split(" ")[1];

  // verify token → throws if invalid or expired
  const payload = verifyAccessToken(token);

  // attach user to req → available in all route handlers
  req.user = {
    userId: payload.userId,
    role: payload.role,
  };

  next();
});

export default authenticate;
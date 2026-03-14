
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "Forbidden - insufficient permissions");
    }

    next();
  };
};

export default authorize;
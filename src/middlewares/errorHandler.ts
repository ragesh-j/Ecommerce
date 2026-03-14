
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
  return res.status(400).json({
    success: false,
    message: "Validation error",
    errors: err.issues.map(e => ({ 
      field: e.path.join("."),
      message: e.message,
    })),
  });
}
  // expected errors → thrown by us using ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // prisma unique constraint violation → P2002
  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "Already exists",
    });
  }

  // prisma record not found → P2025
  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Record not found",
    });
  }

  // jwt errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // unexpected errors → log + send 500
  console.error("Unexpected error:", err);
  return res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
};

export default errorHandler;

import jwt from "jsonwebtoken";
import crypto from "crypto";
interface TokenPayload {
  userId: string;
  role: string;
}

export const generateAccessToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role,jti: crypto.randomUUID() }, process.env.JWT_SECRET!, { expiresIn: "15m" });
};

export const generateRefreshToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role,jti: crypto.randomUUID() }, process.env.REFRESH_SECRET!, { expiresIn: "7d" });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.REFRESH_SECRET!) as TokenPayload;
};
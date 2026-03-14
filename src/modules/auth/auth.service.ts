
import prisma from "../../config/db";
import { hashPassword, comparePassword } from "../../utils/hash";
import { generateAccessToken, generateRefreshToken } from "../../utils/token";
import { ApiError } from "../../utils/ApiError";
import { RegisterInput, LoginInput } from "./auth.validator";


// ─── helper: create session and return tokens ─────────────────────────────────
const createSession = async (userId: string, role: string) => {
  const accessToken = generateAccessToken(userId, role);
  const refreshToken = generateRefreshToken(userId, role);

  await prisma.session.create({
    data: {
      userId,
      accessToken,
      refreshToken,
      accessTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),           // 15 mins
      refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { accessToken, refreshToken };
};

// ─── register ─────────────────────────────────────────────────────────────────
export const register = async (data: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, "Email already in use");

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
    },
  });

  const tokens = await createSession(user.id, user.role);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens };
};

// ─── login ────────────────────────────────────────────────────────────────────
export const login = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) throw new ApiError(401, "Invalid credentials");

  const isMatch = await comparePassword(data.password, user.passwordHash);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  const tokens = await createSession(user.id, user.role);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens };
};



// ─── refresh token ────────────────────────────────────────────────────────────
export const refresh = async (refreshToken: string) => {
  const session = await prisma.session.findUnique({ where: { refreshToken } });

  if (!session) throw new ApiError(401, "Invalid refresh token");
  if (session.refreshTokenExpiry < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    throw new ApiError(401, "Refresh token expired, please login again");
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new ApiError(401, "User not found");

  // generate new access token
  const newAccessToken = generateAccessToken(user.id, user.role);
  const newAccessTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      accessToken: newAccessToken,
      accessTokenExpiry: newAccessTokenExpiry,
    },
  });

  return { accessToken: newAccessToken };
};

// ─── logout ───────────────────────────────────────────────────────────────────
export const logout = async (refreshToken: string) => {
  await prisma.session.deleteMany({ where: { refreshToken } });
};
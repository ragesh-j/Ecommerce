import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from "../../src/utils/token";

describe("token utils", () => {
  const userId = "user_123";
  const role = "BUYER";

  it("should generate an access token", () => {
    const token = generateAccessToken(userId, role);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("should verify a valid access token", () => {
    const token = generateAccessToken(userId, role);
    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe(userId);
    expect(payload.role).toBe(role);
  });

  it("should generate a refresh token", () => {
    const token = generateRefreshToken(userId, role);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("should verify a valid refresh token", () => {
    const token = generateRefreshToken(userId, role);
    const payload = verifyRefreshToken(token);
    expect(payload.userId).toBe(userId);
    expect(payload.role).toBe(role);
  });

  it("should throw on invalid token", () => {
    expect(() => verifyAccessToken("invalidtoken")).toThrow();
  });
});
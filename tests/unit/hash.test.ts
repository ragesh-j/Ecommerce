import { hashPassword, comparePassword } from "../../src/utils/hash";

describe("hash utils", () => {
  it("should hash a password", async () => {
    const hash = await hashPassword("password123");
    expect(hash).not.toBe("password123"); // should not be plain text
  });

  it("should return true for correct password", async () => {
    const hash = await hashPassword("password123");
    const match = await comparePassword("password123", hash);
    expect(match).toBe(true);
  });

  it("should return false for wrong password", async () => {
    const hash = await hashPassword("password123");
    const match = await comparePassword("wrongpassword", hash);
    expect(match).toBe(false);
  });
});
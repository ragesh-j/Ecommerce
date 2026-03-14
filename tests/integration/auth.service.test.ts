
import prisma from "../../src/config/db";
import { register, login, refresh, logout } from "../../src/modules/auth/auth.service";

// clean up after each test so tests don't affect each other
afterEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

// ─── register ─────────────────────────────────────────────────────────────────

describe("register", () => {
  it("should create a user and return tokens", async () => {
    const result = await register({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
    });

    expect(result.user.email).toBe("john@test.com");
    expect(result.user.role).toBe("BUYER");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("should save user to DB", async () => {
    await register({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
    });

    const user = await prisma.user.findUnique({ where: { email: "john@test.com" } });
    expect(user).not.toBeNull();
    expect(user?.name).toBe("John Doe");
  });

  it("should hash the password", async () => {
    await register({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
    });

    const user = await prisma.user.findUnique({ where: { email: "john@test.com" } });
    expect(user?.passwordHash).not.toBe("password123"); // should not be plain text
  });

  it("should throw 409 if email already exists", async () => {
    await register({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
    });

    await expect(
      register({
        name: "John Doe",
        email: "john@test.com", // same email
        password: "password123",
        role: "BUYER",
      })
    ).rejects.toThrow("Email already in use");
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("login", () => {
  beforeEach(async () => {
    // create a user before each login test
    await register({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
    });
  });

  it("should return tokens on valid credentials", async () => {
    const result = await login({
      email: "john@test.com",
      password: "password123",
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe("john@test.com");
  });

  it("should create a session in DB", async () => {
    await login({ email: "john@test.com", password: "password123" });

    const user = await prisma.user.findUnique({ where: { email: "john@test.com" } });
    const session = await prisma.session.findFirst({ where: { userId: user!.id } });
    expect(session).not.toBeNull();
  });

  it("should throw 401 on wrong password", async () => {
    await expect(
      login({ email: "john@test.com", password: "wrongpassword" })
    ).rejects.toThrow("Invalid credentials");
  });

  it("should throw 401 on wrong email", async () => {
    await expect(
      login({ email: "wrong@test.com", password: "password123" })
    ).rejects.toThrow("Invalid credentials");
  });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe("refresh", () => {
  it("should return new accessToken on valid refreshToken", async () => {
    const { refreshToken, accessToken } = await register({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
    });

    const result = await refresh(refreshToken);
    expect(result.accessToken).toBeDefined();
    expect(result.accessToken).not.toBe(accessToken); // should be a new token
  });

  it("should throw 401 on invalid refreshToken", async () => {
    await expect(refresh("invalidtoken")).rejects.toThrow("Invalid refresh token");
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe("logout", () => {
  it("should delete session from DB", async () => {
    const { refreshToken } = await register({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
    });

    await logout(refreshToken);

    const session = await prisma.session.findUnique({ where: { refreshToken } });
    expect(session).toBeNull(); // session should be gone
  });
});
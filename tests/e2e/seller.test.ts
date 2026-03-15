import request from "supertest";
import prisma from "../../src/config/db";
import app from "../../src/app";
import path from "path";
import fs from "fs";

// ─── mock R2 uploads ──────────────────────────────────────────────────────────
jest.mock("../../src/utils/upload", () => ({
  upload: { single: () => (_req: any, _res: any, next: any) => next() },
  uploadToR2: jest.fn().mockImplementation(() =>
    Promise.resolve({
      url: "https://r2.example.com/logos/test.jpg",
      key: `logos/test-${Date.now()}.jpg`, // unique key each time
    })
  ),
  deleteFromR2: jest.fn().mockResolvedValue(undefined),
}));

afterEach(async () => {
  await prisma.media.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const registerAndLogin = async (overrides = {}) => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
      ...overrides,
    });
  return {
    accessToken: res.body.data.accessToken,
    user: res.body.data.user,
  };
};

const createSeller = async (accessToken: string) => {
  return request(app)
    .post("/api/v1/sellers/profile")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ storeName: "Test Store", description: "Best store" });
};

// ─── POST /sellers/profile ────────────────────────────────────────────────────
describe("POST /api/v1/sellers/profile", () => {
  it("should create seller profile", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await createSeller(accessToken);

    expect(res.status).toBe(201);
    expect(res.body.data.profile.storeName).toBe("Test Store");
  });

  it("should return 401 with no token", async () => {
    const res = await request(app)
      .post("/api/v1/sellers/profile")
      .send({ storeName: "Test Store" });

    expect(res.status).toBe(401);
  });

  it("should return 409 if profile already exists", async () => {
    const { accessToken } = await registerAndLogin();
    await createSeller(accessToken);
    const res = await createSeller(accessToken);

    expect(res.status).toBe(409);
  });

  it("should return 400 if storeName is too short", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/sellers/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ storeName: "A" });

    expect(res.status).toBe(400);
  });
});

// ─── GET /sellers/profile ─────────────────────────────────────────────────────
describe("GET /api/v1/sellers/profile", () => {
  it("should return seller profile", async () => {
    const { accessToken: buyerToken } = await registerAndLogin();
    await createSeller(buyerToken);

    // re-login to get fresh token with role: SELLER
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "john@test.com", password: "password123" });
    const sellerToken = loginRes.body.data.accessToken;

    const res = await request(app)
      .get("/api/v1/sellers/profile")
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.storeName).toBe("Test Store");
    expect(res.body.data.profile._count.products).toBe(0);
  });

  it("should return 401 with no token", async () => {
    const res = await request(app).get("/api/v1/sellers/profile");
    expect(res.status).toBe(401);
  });

  it("should return 403 if user is not a seller", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get("/api/v1/sellers/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── PUT /sellers/profile ─────────────────────────────────────────────────────
describe("PUT /api/v1/sellers/profile", () => {
  it("should update seller profile", async () => {
    const { accessToken: buyerToken } = await registerAndLogin();
    await createSeller(buyerToken);

    // re-login to get fresh token with role: SELLER
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "john@test.com", password: "password123" });
    const sellerToken = loginRes.body.data.accessToken;

    const res = await request(app)
      .put("/api/v1/sellers/profile")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ storeName: "Updated Store" });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.storeName).toBe("Updated Store");
  });

  it("should return 403 if user is not a seller", async () => {
    const { accessToken } = await registerAndLogin({ email: "buyer@test.com" });
    const res = await request(app)
      .put("/api/v1/sellers/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ storeName: "Updated Store" });

    expect(res.status).toBe(403);
  });
});

// ─── GET /sellers/:id (public) ────────────────────────────────────────────────
describe("GET /api/v1/sellers/:id", () => {
  it("should return public seller profile without auth", async () => {
    const { accessToken } = await registerAndLogin();
    const createRes = await createSeller(accessToken);
    const sellerId = createRes.body.data.profile.id;

    const res = await request(app).get(`/api/v1/sellers/${sellerId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.storeName).toBe("Test Store");
  });

  it("should return 404 for non-existent seller", async () => {
    const res = await request(app).get("/api/v1/sellers/non-existent-id");
    expect(res.status).toBe(404);
  });
});
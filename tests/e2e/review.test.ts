import request from "supertest";
import prisma from "../../src/config/db";
import app from "../../src/app";

jest.mock("../../src/utils/upload", () => ({
  upload: {
    single: () => (_req: any, _res: any, next: any) => next(),
    array: () => (_req: any, _res: any, next: any) => next(),
  },
  uploadToR2: jest.fn().mockResolvedValue({ url: "https://r2.example.com/test.jpg", key: "test.jpg" }),
  deleteFromR2: jest.fn().mockResolvedValue(undefined),
}));

afterEach(async () => {
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const registerAndLogin = async (email = "buyer@test.com", role = "BUYER") => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "User", email, password: "password123", role });
  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const setupSeller = async () => {
  const { accessToken: buyerToken } = await registerAndLogin("seller@test.com");
  await request(app).post("/api/v1/sellers/profile").set("Authorization", `Bearer ${buyerToken}`).send({ storeName: "Test Store" });
  const loginRes = await request(app).post("/api/v1/auth/login").send({ email: "seller@test.com", password: "password123" });
  return { accessToken: loginRes.body.data.accessToken };
};

const setupProduct = async (sellerToken: string) => {
  const { hashPassword } = await import("../../src/utils/hash");
  const { generateAccessToken } = await import("../../src/utils/token");
  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@test.com", passwordHash: await hashPassword("password123"), role: "ADMIN" },
  });
  const adminToken = generateAccessToken(admin.id, admin.role);

  const catRes = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${adminToken}`).send({ name: "Electronics", slug: "electronics" });
  const categoryId = catRes.body.data.category.id;

  const productRes = await request(app).post("/api/v1/products").set("Authorization", `Bearer ${sellerToken}`).send({ name: "Test Product", slug: "test-product", categoryId });
  const productId = productRes.body.data.product.id;

  const variantRes = await request(app).post(`/api/v1/products/${productId}/variants`).set("Authorization", `Bearer ${sellerToken}`).send({ name: "Default", sku: "SKU-1", price: 99.99, stock: 10 });
  const variantId = variantRes.body.data.variant.id;

  await request(app).patch(`/api/v1/products/${productId}/publish`).set("Authorization", `Bearer ${sellerToken}`);

  return { productId, variantId };
};

const setupDeliveredOrder = async (userId: string, variantId: string) => {
  const address = await prisma.address.create({
    data: { userId, line1: "123 Main St", city: "New York", postalCode: "10001", country: "US" },
  });

  return prisma.order.create({
    data: {
      userId,
      addressId: address.id,
      totalAmount: 99.99,
      status: "DELIVERED",
      items: { create: { variantId, quantity: 1, unitPrice: 99.99 } },
    },
  });
};

// ─── GET /reviews/products/:productId ─────────────────────────────────────────
describe("GET /api/v1/reviews/products/:productId", () => {
  it("should return product reviews publicly", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId } = await setupProduct(sellerToken);

    const res = await request(app).get(`/api/v1/reviews/products/${productId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toHaveLength(0);
    expect(res.body.data.avgRating).toBe(0);
  });
});

// ─── POST /reviews/products/:productId ────────────────────────────────────────
describe("POST /api/v1/reviews/products/:productId", () => {
  it("should create review for delivered order", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId, variantId } = await setupProduct(sellerToken);
    const { accessToken: buyerToken, userId } = await registerAndLogin();
    await setupDeliveredOrder(userId, variantId);

    const res = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 5, body: "Great product!" });

    expect(res.status).toBe(201);
    expect(res.body.data.review.rating).toBe(5);
  });

  it("should return 403 if no delivered order", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId } = await setupProduct(sellerToken);
    const { accessToken: buyerToken } = await registerAndLogin();

    const res = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 5 });

    expect(res.status).toBe(403);
  });

  it("should return 409 if already reviewed", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId, variantId } = await setupProduct(sellerToken);
    const { accessToken: buyerToken, userId } = await registerAndLogin();
    await setupDeliveredOrder(userId, variantId);

    await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 5 });

    const res = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 4 });

    expect(res.status).toBe(409);
  });

  it("should return 401 with no token", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId } = await setupProduct(sellerToken);

    const res = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .send({ rating: 5 });

    expect(res.status).toBe(401);
  });
});

// ─── PUT /reviews/:id ─────────────────────────────────────────────────────────
describe("PUT /api/v1/reviews/:id", () => {
  it("should update own review", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId, variantId } = await setupProduct(sellerToken);
    const { accessToken: buyerToken, userId } = await registerAndLogin();
    await setupDeliveredOrder(userId, variantId);

    const createRes = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 3, body: "OK" });

    const reviewId = createRes.body.data.review.id;

    const res = await request(app)
      .put(`/api/v1/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 5, body: "Updated review" });

    expect(res.status).toBe(200);
    expect(res.body.data.review.rating).toBe(5);
  });

  it("should return 403 if not own review", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId, variantId } = await setupProduct(sellerToken);
    const { accessToken: buyer1Token, userId: userId1 } = await registerAndLogin("buyer1@test.com");
    const { accessToken: buyer2Token } = await registerAndLogin("buyer2@test.com");
    await setupDeliveredOrder(userId1, variantId);

    const createRes = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({ rating: 5 });

    const reviewId = createRes.body.data.review.id;

    const res = await request(app)
      .put(`/api/v1/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${buyer2Token}`)
      .send({ rating: 1 });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /reviews/:id ──────────────────────────────────────────────────────
describe("DELETE /api/v1/reviews/:id", () => {
  it("should delete own review", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId, variantId } = await setupProduct(sellerToken);
    const { accessToken: buyerToken, userId } = await registerAndLogin();
    await setupDeliveredOrder(userId, variantId);

    const createRes = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 5 });

    const reviewId = createRes.body.data.review.id;

    const res = await request(app)
      .delete(`/api/v1/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
  });

  it("should return 403 if not own review", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { productId, variantId } = await setupProduct(sellerToken);
    const { accessToken: buyer1Token, userId: userId1 } = await registerAndLogin("buyer1@test.com");
    const { accessToken: buyer2Token } = await registerAndLogin("buyer2@test.com");
    await setupDeliveredOrder(userId1, variantId);

    const createRes = await request(app)
      .post(`/api/v1/reviews/products/${productId}`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({ rating: 5 });

    const reviewId = createRes.body.data.review.id;

    const res = await request(app)
      .delete(`/api/v1/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${buyer2Token}`);

    expect(res.status).toBe(403);
  });
});
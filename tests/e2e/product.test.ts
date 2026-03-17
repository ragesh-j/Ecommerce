import request from "supertest";
import prisma from "../../src/config/db";
import app from "../../src/app";

// ─── mock R2 ──────────────────────────────────────────────────────────────────
jest.mock("../../src/utils/upload", () => ({
  upload: {
    single: () => (_req: any, _res: any, next: any) => next(),
    array: () => (_req: any, _res: any, next: any) => next(),
  },
  uploadToR2: jest.fn().mockImplementation(() =>
    Promise.resolve({
      url: "https://r2.example.com/products/test.jpg",
      key: `products/test-${Date.now()}.jpg`,
    })
  ),
  deleteFromR2: jest.fn().mockResolvedValue(undefined),
}));

afterEach(async () => {
  await prisma.media.deleteMany();
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
  return { accessToken: res.body.data.accessToken, user: res.body.data.user };
};

const setupSeller = async (email = "seller@test.com") => {
  const { accessToken: buyerToken } = await registerAndLogin(email);

  await request(app)
    .post("/api/v1/sellers/profile")
    .set("Authorization", `Bearer ${buyerToken}`)
    .send({ storeName: "Test Store" });

  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: "password123" });

  return { accessToken: loginRes.body.data.accessToken };
};

const setupCategory = async () => {
  const { hashPassword } = await import("../../src/utils/hash");
  const { generateAccessToken } = await import("../../src/utils/token");

  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@test.com", passwordHash: await hashPassword("password123"), role: "ADMIN" },
  });
  const adminToken = generateAccessToken(admin.id, admin.role);

  const res = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Electronics", slug: "electronics" });

  return { categoryId: res.body.data.category.id };
};

const createProduct = async (accessToken: string, categoryId: string, overrides = {}) => {
  return request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Test Product", slug: "test-product", categoryId, ...overrides });
};

// ─── GET /products ─────────────────────────────────────────────────────────────
describe("GET /api/v1/products", () => {
  it("should return published products", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const productId = productRes.body.data.product.id;

    await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Default", sku: "SKU-1", price: 100, stock: 10 });

    await request(app)
      .patch(`/api/v1/products/${productId}/publish`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.pagination).toBeDefined();
  });

  it("should filter by search", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const productId = productRes.body.data.product.id;

    await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Default", sku: "SKU-1", price: 100, stock: 10 });

    await request(app)
      .patch(`/api/v1/products/${productId}/publish`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app).get("/api/v1/products?search=test");
    expect(res.body.data.products).toHaveLength(1);

    const res2 = await request(app).get("/api/v1/products?search=nonexistent");
    expect(res2.body.data.products).toHaveLength(0);
  });
});

// ─── POST /products ────────────────────────────────────────────────────────────
describe("POST /api/v1/products", () => {
  it("should create product as seller", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();

    const res = await createProduct(accessToken, categoryId);
    expect(res.status).toBe(201);
    expect(res.body.data.product.name).toBe("Test Product");
    expect(res.body.data.product.isPublished).toBe(false);
  });

  it("should return 403 if not seller", async () => {
    const { accessToken } = await registerAndLogin();
    const { categoryId } = await setupCategory();

    const res = await createProduct(accessToken, categoryId);
    expect(res.status).toBe(403);
  });

  it("should return 401 if not authenticated", async () => {
    const { categoryId } = await setupCategory();
    const res = await request(app)
      .post("/api/v1/products")
      .send({ name: "Test", slug: "test", categoryId });

    expect(res.status).toBe(401);
  });

  it("should return 409 if slug already in use", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    await createProduct(accessToken, categoryId);

    const res = await createProduct(accessToken, categoryId);
    expect(res.status).toBe(409);
  });
});

// ─── PUT /products/:id ─────────────────────────────────────────────────────────
describe("PUT /api/v1/products/:id", () => {
  it("should update product", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const id = productRes.body.data.product.id;

    const res = await request(app)
      .put(`/api/v1/products/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Product" });

    expect(res.status).toBe(200);
    expect(res.body.data.product.name).toBe("Updated Product");
  });

  it("should return 403 if not own product", async () => {
    const { accessToken: seller1Token } = await setupSeller("seller1@test.com");
    const { accessToken: seller2Token } = await setupSeller("seller2@test.com");
    const { categoryId } = await setupCategory();

    const productRes = await createProduct(seller1Token, categoryId);
    const id = productRes.body.data.product.id;

    const res = await request(app)
      .put(`/api/v1/products/${id}`)
      .set("Authorization", `Bearer ${seller2Token}`)
      .send({ name: "Hacked" });

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /products/:id/publish ──────────────────────────────────────────────
describe("PATCH /api/v1/products/:id/publish", () => {
  it("should publish product with variants", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const id = productRes.body.data.product.id;

    await request(app)
      .post(`/api/v1/products/${id}/variants`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Default", sku: "SKU-1", price: 100, stock: 10 });

    const res = await request(app)
      .patch(`/api/v1/products/${id}/publish`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.product.isPublished).toBe(true);
  });

  it("should return 400 if no variants", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const id = productRes.body.data.product.id;

    const res = await request(app)
      .patch(`/api/v1/products/${id}/publish`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});

// ─── variants ─────────────────────────────────────────────────────────────────
describe("POST /api/v1/products/:id/variants", () => {
  it("should add variant", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const id = productRes.body.data.product.id;

    const res = await request(app)
      .post(`/api/v1/products/${id}/variants`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Large", sku: "SKU-L", price: 99.99, stock: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.variant.sku).toBe("SKU-L");
  });

  it("should return 409 if SKU already in use", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const id = productRes.body.data.product.id;

    await request(app)
      .post(`/api/v1/products/${id}/variants`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Large", sku: "SKU-L", price: 99.99, stock: 10 });

    const res = await request(app)
      .post(`/api/v1/products/${id}/variants`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Small", sku: "SKU-L", price: 49.99, stock: 5 });

    expect(res.status).toBe(409);
  });
});

// ─── DELETE /products/:id ──────────────────────────────────────────────────────
describe("DELETE /api/v1/products/:id", () => {
  it("should delete product", async () => {
    const { accessToken } = await setupSeller();
    const { categoryId } = await setupCategory();
    const productRes = await createProduct(accessToken, categoryId);
    const id = productRes.body.data.product.id;

    const res = await request(app)
      .delete(`/api/v1/products/${id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("should return 403 if not own product", async () => {
    const { accessToken: seller1Token } = await setupSeller("seller1@test.com");
    const { accessToken: seller2Token } = await setupSeller("seller2@test.com");
    const { categoryId } = await setupCategory();

    const productRes = await createProduct(seller1Token, categoryId);
    const id = productRes.body.data.product.id;

    const res = await request(app)
      .delete(`/api/v1/products/${id}`)
      .set("Authorization", `Bearer ${seller2Token}`);

    expect(res.status).toBe(403);
  });
});
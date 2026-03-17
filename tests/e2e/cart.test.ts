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
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
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
  return { accessToken: res.body.data.accessToken };
};

const setupSellerAndProduct = async () => {
  const { accessToken: buyerToken } = await registerAndLogin("seller@test.com");

  await request(app)
    .post("/api/v1/sellers/profile")
    .set("Authorization", `Bearer ${buyerToken}`)
    .send({ storeName: "Test Store" });

  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "seller@test.com", password: "password123" });
  const sellerToken = loginRes.body.data.accessToken;

  const { hashPassword } = await import("../../src/utils/hash");
  const { generateAccessToken } = await import("../../src/utils/token");
  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@test.com", passwordHash: await hashPassword("password123"), role: "ADMIN" },
  });
  const adminToken = generateAccessToken(admin.id, admin.role);

  const catRes = await request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Electronics", slug: "electronics" });
  const categoryId = catRes.body.data.category.id;

  const productRes = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${sellerToken}`)
    .send({ name: "Test Product", slug: "test-product", categoryId });
  const productId = productRes.body.data.product.id;

  const variantRes = await request(app)
    .post(`/api/v1/products/${productId}/variants`)
    .set("Authorization", `Bearer ${sellerToken}`)
    .send({ name: "Default", sku: "SKU-1", price: 99.99, stock: 10 });
  const variantId = variantRes.body.data.variant.id;

  await request(app)
    .patch(`/api/v1/products/${productId}/publish`)
    .set("Authorization", `Bearer ${sellerToken}`);

  return { variantId };
};

// ─── GET /cart ─────────────────────────────────────────────────────────────────
describe("GET /api/v1/cart", () => {
  it("should return empty cart", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.items).toHaveLength(0);
    expect(res.body.data.cart.total).toBe(0);
  });

  it("should return 401 with no token", async () => {
    const res = await request(app).get("/api/v1/cart");
    expect(res.status).toBe(401);
  });
});

// ─── POST /cart/items ──────────────────────────────────────────────────────────
describe("POST /api/v1/cart/items", () => {
  it("should add item to cart", async () => {
    const { accessToken } = await registerAndLogin();
    const { variantId } = await setupSellerAndProduct();

    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ variantId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.item.quantity).toBe(2);
  });

  it("should return 400 if not enough stock", async () => {
    const { accessToken } = await registerAndLogin();
    const { variantId } = await setupSellerAndProduct();

    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ variantId, quantity: 99 });

    expect(res.status).toBe(400);
  });

  it("should return 401 with no token", async () => {
    const { variantId } = await setupSellerAndProduct();
    const res = await request(app)
      .post("/api/v1/cart/items")
      .send({ variantId, quantity: 1 });

    expect(res.status).toBe(401);
  });
});

// ─── PUT /cart/items/:id ───────────────────────────────────────────────────────
describe("PUT /api/v1/cart/items/:id", () => {
  it("should update item quantity", async () => {
    const { accessToken } = await registerAndLogin();
    const { variantId } = await setupSellerAndProduct();

    const addRes = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ variantId, quantity: 1 });

    const itemId = addRes.body.data.item.id;

    const res = await request(app)
      .put(`/api/v1/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.item.quantity).toBe(5);
  });
});

// ─── DELETE /cart/items/:id ────────────────────────────────────────────────────
describe("DELETE /api/v1/cart/items/:id", () => {
  it("should remove item from cart", async () => {
    const { accessToken } = await registerAndLogin();
    const { variantId } = await setupSellerAndProduct();

    const addRes = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ variantId, quantity: 1 });

    const itemId = addRes.body.data.item.id;

    const res = await request(app)
      .delete(`/api/v1/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const cartRes = await request(app)
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(cartRes.body.data.cart.items).toHaveLength(0);
  });
});

// ─── DELETE /cart ──────────────────────────────────────────────────────────────
describe("DELETE /api/v1/cart", () => {
  it("should clear cart", async () => {
    const { accessToken } = await registerAndLogin();
    const { variantId } = await setupSellerAndProduct();

    await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ variantId, quantity: 2 });

    const res = await request(app)
      .delete("/api/v1/cart")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const cartRes = await request(app)
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(cartRes.body.data.cart.items).toHaveLength(0);
  });
});
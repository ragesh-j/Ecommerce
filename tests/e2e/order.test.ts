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
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
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

  return { variantId };
};

const setupBuyerWithAddress = async () => {
  const { accessToken, userId } = await registerAndLogin();
  const addressRes = await request(app)
    .post("/api/v1/users/me/addresses")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ line1: "123 Main St", city: "New York", postalCode: "10001", country: "US" });
  return { accessToken, userId, addressId: addressRes.body.data.address.id };
};

const setupAndCheckout = async () => {
  const { accessToken: sellerToken } = await setupSeller();
  const { variantId } = await setupProduct(sellerToken);
  const { accessToken: buyerToken, addressId } = await setupBuyerWithAddress();

  await request(app).post("/api/v1/cart/items").set("Authorization", `Bearer ${buyerToken}`).send({ variantId, quantity: 2 });
  const orderRes = await request(app).post("/api/v1/orders/checkout").set("Authorization", `Bearer ${buyerToken}`).send({ addressId });

  return { buyerToken, sellerToken, orderId: orderRes.body.data.order.id };
};

// ─── POST /orders/checkout ────────────────────────────────────────────────────
describe("POST /api/v1/orders/checkout", () => {
  it("should create order from cart", async () => {
    const { accessToken: sellerToken } = await setupSeller();
    const { variantId } = await setupProduct(sellerToken);
    const { accessToken: buyerToken, addressId } = await setupBuyerWithAddress();

    await request(app).post("/api/v1/cart/items").set("Authorization", `Bearer ${buyerToken}`).send({ variantId, quantity: 2 });

    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ addressId });

    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe("PENDING");
    expect(res.body.data.order.items).toHaveLength(1);
  });

  it("should return 400 if cart is empty", async () => {
    const { accessToken, addressId } = await setupBuyerWithAddress();
    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ addressId });

    expect(res.status).toBe(400);
  });

  it("should return 401 with no token", async () => {
    const res = await request(app).post("/api/v1/orders/checkout").send({ addressId: "xxx" });
    expect(res.status).toBe(401);
  });
});

// ─── GET /orders ──────────────────────────────────────────────────────────────
describe("GET /api/v1/orders", () => {
  it("should return my orders", async () => {
    const { buyerToken } = await setupAndCheckout();
    const res = await request(app).get("/api/v1/orders").set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
  });

  it("should return 401 with no token", async () => {
    const res = await request(app).get("/api/v1/orders");
    expect(res.status).toBe(401);
  });
});

// ─── GET /orders/:id ──────────────────────────────────────────────────────────
describe("GET /api/v1/orders/:id", () => {
  it("should return order by id", async () => {
    const { buyerToken, orderId } = await setupAndCheckout();
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.order.id).toBe(orderId);
  });

  it("should return 403 for another user's order", async () => {
    const { orderId } = await setupAndCheckout();
    const { accessToken: otherToken } = await registerAndLogin("other@test.com");

    const res = await request(app).get(`/api/v1/orders/${orderId}`).set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /orders/:id/cancel ─────────────────────────────────────────────────
describe("PATCH /api/v1/orders/:id/cancel", () => {
  it("should cancel pending order", async () => {
    const { buyerToken, orderId } = await setupAndCheckout();
    const res = await request(app).patch(`/api/v1/orders/${orderId}/cancel`).set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe("CANCELLED");
  });

  it("should return 400 if order is not pending", async () => {
    const { buyerToken, orderId } = await setupAndCheckout();
    await prisma.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });

    const res = await request(app).patch(`/api/v1/orders/${orderId}/cancel`).set("Authorization", `Bearer ${buyerToken}`);
    expect(res.status).toBe(400);
  });
});

// ─── GET /orders/seller/list ──────────────────────────────────────────────────
describe("GET /api/v1/orders/seller/list", () => {
  it("should return seller orders", async () => {
    const { sellerToken } = await setupAndCheckout();
    const res = await request(app).get("/api/v1/orders/seller/list").set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
  });

  it("should return 403 if not seller", async () => {
    const { accessToken } = await registerAndLogin("buyer2@test.com");
    const res = await request(app).get("/api/v1/orders/seller/list").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /orders/:id/status ─────────────────────────────────────────────────
describe("PATCH /api/v1/orders/:id/status", () => {
  it("should update order status", async () => {
    const { sellerToken, orderId } = await setupAndCheckout();
    await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "SHIPPED" });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe("SHIPPED");
  });

  it("should return 400 on invalid transition", async () => {
    const { sellerToken, orderId } = await setupAndCheckout();

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "DELIVERED" });

    expect(res.status).toBe(400);
  });
});
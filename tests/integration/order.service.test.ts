import prisma from "../../src/config/db";
import { register } from "../../src/modules/auth/auth.service";
import { createSellerProfile } from "../../src/modules/seller/seller.service";
import { createCategory } from "../../src/modules/category/category.service";
import { createProduct, addVariant, togglePublish } from "../../src/modules/product/product.service";
import { addCartItem } from "../../src/modules/cart/cart.service";
import { checkout, getMyOrders, getOrderById, cancelOrder, getSellerOrders, updateOrderStatus } from "../../src/modules/order/order.service";

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
const setupBuyer = async () => {
  const result = await register({ name: "Buyer", email: "buyer@test.com", password: "password123", role: "BUYER" });
  const address = await prisma.address.create({
    data: { userId: result.user.id, line1: "123 Main St", city: "New York", postalCode: "10001", country: "US" },
  });
  return { user: result.user, address };
};

const setupSeller = async () => {
  const result = await register({ name: "Seller", email: "seller@test.com", password: "password123", role: "BUYER" });
  await createSellerProfile(result.user.id, { storeName: "Test Store" });
  return result.user;
};

const setupProduct = async (sellerId: string, stock = 10) => {
  const category = await createCategory({ name: "Electronics", slug: "electronics" });
  const product = await createProduct(sellerId, { name: "Test Product", slug: "test-product", categoryId: category.id });
  const variant = await addVariant(sellerId, product.id, { name: "Default", sku: "SKU-1", price: 99.99, stock });
  await togglePublish(sellerId, product.id);
  return { product, variant };
};

// ─── checkout ─────────────────────────────────────────────────────────────────
describe("checkout", () => {
  it("should create order from cart and clear cart", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 2 });
    const order = await checkout(user.id, { addressId: address.id });

    expect(order.status).toBe("PENDING");
    expect(order.items).toHaveLength(1);
    expect(Number(order.totalAmount)).toBe(99.99 * 2);

    // cart should be cleared
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart?.items).toHaveLength(0);
  });

  it("should deduct stock after checkout", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id, 10);

    await addCartItem(user.id, { variantId: variant.id, quantity: 3 });
    await checkout(user.id, { addressId: address.id });

    const updated = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(updated?.stock).toBe(7); // 10 - 3
  });

  it("should throw 400 if cart is empty", async () => {
    const { user, address } = await setupBuyer();
    await expect(checkout(user.id, { addressId: address.id })).rejects.toThrow("Cart is empty");
  });

  it("should throw 404 if address not found", async () => {
    const { user } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    await expect(checkout(user.id, { addressId: "non-existent" })).rejects.toThrow("Address not found");
  });

  it("should throw 400 if not enough stock at checkout", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id, 2);

    await addCartItem(user.id, { variantId: variant.id, quantity: 2 });

    // manually reduce stock to simulate race condition
    await prisma.productVariant.update({ where: { id: variant.id }, data: { stock: 1 } });

    await expect(checkout(user.id, { addressId: address.id })).rejects.toThrow("Not enough stock");
  });
});

// ─── getMyOrders ──────────────────────────────────────────────────────────────
describe("getMyOrders", () => {
  it("should return buyer orders", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    await checkout(user.id, { addressId: address.id });

    const orders = await getMyOrders(user.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("PENDING");
  });

  it("should return empty array if no orders", async () => {
    const { user } = await setupBuyer();
    const orders = await getMyOrders(user.id);
    expect(orders).toHaveLength(0);
  });
});

// ─── getOrderById ─────────────────────────────────────────────────────────────
describe("getOrderById", () => {
  it("should return order by id", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    const order = await checkout(user.id, { addressId: address.id });

    const found = await getOrderById(user.id, order.id);
    expect(found.id).toBe(order.id);
  });

  it("should throw 403 if order belongs to another user", async () => {
    const { user, address } = await setupBuyer();
    const buyer2 = await register({ name: "Buyer2", email: "buyer2@test.com", password: "password123", role: "BUYER" });
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    const order = await checkout(user.id, { addressId: address.id });

    await expect(getOrderById(buyer2.user.id, order.id)).rejects.toThrow("Forbidden");
  });
});

// ─── cancelOrder ─────────────────────────────────────────────────────────────
describe("cancelOrder", () => {
  it("should cancel pending order and restore stock", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id, 10);

    await addCartItem(user.id, { variantId: variant.id, quantity: 3 });
    const order = await checkout(user.id, { addressId: address.id });

    await cancelOrder(user.id, order.id);

    const updated = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(updated?.stock).toBe(10); // restored

    const cancelled = await prisma.order.findUnique({ where: { id: order.id } });
    expect(cancelled?.status).toBe("CANCELLED");
  });

  it("should throw 400 if order is not pending", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    const order = await checkout(user.id, { addressId: address.id });

    // manually set to SHIPPED
    await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });

    await expect(cancelOrder(user.id, order.id)).rejects.toThrow("Only pending orders can be cancelled");
  });
});

// ─── getSellerOrders ──────────────────────────────────────────────────────────
describe("getSellerOrders", () => {
  it("should return orders containing seller items", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    await checkout(user.id, { addressId: address.id });

    const orders = await getSellerOrders(seller.id);
    expect(orders).toHaveLength(1);
  });
});

// ─── updateOrderStatus ────────────────────────────────────────────────────────
describe("updateOrderStatus", () => {
  it("should update order status", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    const order = await checkout(user.id, { addressId: address.id });

    // manually set to PAID first
    await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });

    const updated = await updateOrderStatus(seller.id, order.id, { status: "SHIPPED" });
    expect(updated.status).toBe("SHIPPED");
  });

  it("should throw 400 on invalid status transition", async () => {
    const { user, address } = await setupBuyer();
    const seller = await setupSeller();
    const { variant } = await setupProduct(seller.id);

    await addCartItem(user.id, { variantId: variant.id, quantity: 1 });
    const order = await checkout(user.id, { addressId: address.id });

    await expect(
      updateOrderStatus(seller.id, order.id, { status: "DELIVERED" })
    ).rejects.toThrow("Cannot transition from PENDING to DELIVERED");
  });
});
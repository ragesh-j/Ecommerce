import prisma from "../../src/config/db";
import { register } from "../../src/modules/auth/auth.service";
import { createSellerProfile } from "../../src/modules/seller/seller.service";
import { createCategory } from "../../src/modules/category/category.service";
import { createProduct, addVariant, togglePublish } from "../../src/modules/product/product.service";
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../../src/modules/cart/cart.service";

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
const setupBuyer = async () => {
  const result = await register({
    name: "Buyer",
    email: "buyer@test.com",
    password: "password123",
    role: "BUYER",
  });
  return result.user;
};

const setupPublishedVariant = async () => {
  const seller = await register({ name: "Seller", email: "seller@test.com", password: "password123", role: "BUYER" });
  await createSellerProfile(seller.user.id, { storeName: "Test Store" });
  const category = await createCategory({ name: "Electronics", slug: "electronics" });
  const product = await createProduct(seller.user.id, { name: "Test Product", slug: "test-product", categoryId: category.id });
  const variant = await addVariant(seller.user.id, product.id, { name: "Default", sku: "SKU-1", price: 99.99, stock: 10 });
  await togglePublish(seller.user.id, product.id);
  return { variant, product };
};

// ─── getCart ──────────────────────────────────────────────────────────────────
describe("getCart", () => {
  it("should return empty cart if no cart exists", async () => {
    const buyer = await setupBuyer();
    const cart = await getCart(buyer.id);

    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
  });

  it("should return cart with items and total", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant();

    await addCartItem(buyer.id, { variantId: variant.id, quantity: 2 });

    const cart = await getCart(buyer.id);
    expect(cart.items).toHaveLength(1);
    expect(cart.total).toBe(99.99 * 2);
  });
});

// ─── addCartItem ──────────────────────────────────────────────────────────────
describe("addCartItem", () => {
  it("should add item to cart", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant();

    const item = await addCartItem(buyer.id, { variantId: variant.id, quantity: 1 });
    expect(item.quantity).toBe(1);
    expect(item.variantId).toBe(variant.id);
  });

  it("should increment quantity if item already in cart", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant();

    await addCartItem(buyer.id, { variantId: variant.id, quantity: 2 });
    await addCartItem(buyer.id, { variantId: variant.id, quantity: 3 });

    const cart = await getCart(buyer.id);
    expect(cart.items[0].quantity).toBe(5); // 2 + 3
  });

  it("should throw 400 if not enough stock", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant(); // stock: 10

    await expect(
      addCartItem(buyer.id, { variantId: variant.id, quantity: 11 })
    ).rejects.toThrow("Only 10 items in stock");
  });

  it("should throw 404 if variant not found", async () => {
    const buyer = await setupBuyer();

    await expect(
      addCartItem(buyer.id, { variantId: "non-existent", quantity: 1 })
    ).rejects.toThrow("Variant not found");
  });

  it("should throw 400 if product is not published", async () => {
    const buyer = await setupBuyer();
    const seller = await register({ name: "Seller2", email: "seller2@test.com", password: "password123", role: "BUYER" });
    await createSellerProfile(seller.user.id, { storeName: "Store 2" });
    const category = await createCategory({ name: "Clothing", slug: "clothing" });
    const product = await createProduct(seller.user.id, { name: "Unpublished", slug: "unpublished", categoryId: category.id });
    const variant = await addVariant(seller.user.id, product.id, { name: "Default", sku: "SKU-2", price: 50, stock: 5 });

    await expect(
      addCartItem(buyer.id, { variantId: variant.id, quantity: 1 })
    ).rejects.toThrow("Product is not available");
  });
});

// ─── updateCartItem ───────────────────────────────────────────────────────────
describe("updateCartItem", () => {
  it("should update item quantity", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant();

    const item = await addCartItem(buyer.id, { variantId: variant.id, quantity: 1 });
    const updated = await updateCartItem(buyer.id, item.id, { quantity: 5 });

    expect(updated.quantity).toBe(5);
  });

  it("should throw 400 if not enough stock", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant(); // stock: 10

    const item = await addCartItem(buyer.id, { variantId: variant.id, quantity: 1 });

    await expect(
      updateCartItem(buyer.id, item.id, { quantity: 11 })
    ).rejects.toThrow("Only 10 items in stock");
  });

  it("should throw 404 if cart not found for user", async () => {
    const buyer1 = await setupBuyer();
    const buyer2 = await register({ name: "Buyer2", email: "buyer2@test.com", password: "password123", role: "BUYER" });
    const { variant } = await setupPublishedVariant();

    const item = await addCartItem(buyer1.id, { variantId: variant.id, quantity: 1 });

    await expect(
      updateCartItem(buyer2.user.id, item.id, { quantity: 2 })
    ).rejects.toThrow("Cart not found");
  });
});

// ─── removeCartItem ───────────────────────────────────────────────────────────
describe("removeCartItem", () => {
  it("should remove item from cart", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant();

    const item = await addCartItem(buyer.id, { variantId: variant.id, quantity: 1 });
    await removeCartItem(buyer.id, item.id);

    const cart = await getCart(buyer.id);
    expect(cart.items).toHaveLength(0);
  });

  it("should throw 404 if cart not found for user", async () => {
    const buyer1 = await setupBuyer();
    const buyer2 = await register({ name: "Buyer2", email: "buyer2@test.com", password: "password123", role: "BUYER" });
    const { variant } = await setupPublishedVariant();

    const item = await addCartItem(buyer1.id, { variantId: variant.id, quantity: 1 });

    await expect(
      removeCartItem(buyer2.user.id, item.id)
    ).rejects.toThrow("Cart not found");
  });
});

// ─── clearCart ────────────────────────────────────────────────────────────────
describe("clearCart", () => {
  it("should clear all items from cart", async () => {
    const buyer = await setupBuyer();
    const { variant } = await setupPublishedVariant();

    await addCartItem(buyer.id, { variantId: variant.id, quantity: 1 });
    await clearCart(buyer.id);

    const cart = await getCart(buyer.id);
    expect(cart.items).toHaveLength(0);
  });

  it("should not throw if cart does not exist", async () => {
    const buyer = await setupBuyer();
    await expect(clearCart(buyer.id)).resolves.not.toThrow();
  });
});
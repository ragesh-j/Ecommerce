import prisma from "../../src/config/db";
import { register } from "../../src/modules/auth/auth.service";
import { createSellerProfile } from "../../src/modules/seller/seller.service";
import { createCategory } from "../../src/modules/category/category.service";
import { createProduct, addVariant, togglePublish } from "../../src/modules/product/product.service";
import { createReview, updateReview, deleteReview, getProductReviews } from "../../src/modules/review/review.service";

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
const setupBuyer = async (email = "buyer@test.com") => {
  const result = await register({ name: "Buyer", email, password: "password123", role: "BUYER" });
  return result.user;
};

const setupProduct = async () => {
  const seller = await register({ name: "Seller", email: "seller@test.com", password: "password123", role: "BUYER" });
  await createSellerProfile(seller.user.id, { storeName: "Test Store" });
  const category = await createCategory({ name: "Electronics", slug: "electronics" });
  const product = await createProduct(seller.user.id, { name: "Test Product", slug: "test-product", categoryId: category.id });
  const variant = await addVariant(seller.user.id, product.id, { name: "Default", sku: "SKU-1", price: 99.99, stock: 10 });
  await togglePublish(seller.user.id, product.id);
  return { product, variant };
};

const setupDeliveredOrder = async (userId: string, variantId: string, productId: string) => {
  const address = await prisma.address.create({
    data: { userId, line1: "123 Main St", city: "New York", postalCode: "10001", country: "US" },
  });

  return prisma.order.create({
    data: {
      userId,
      addressId: address.id,
      totalAmount: 99.99,
      status: "DELIVERED",
      items: {
        create: { variantId, quantity: 1, unitPrice: 99.99 },
      },
    },
  });
};

// ─── getProductReviews ────────────────────────────────────────────────────────
describe("getProductReviews", () => {
  it("should return empty reviews with 0 average", async () => {
    const { product } = await setupProduct();
    const result = await getProductReviews(product.id);

    expect(result.reviews).toHaveLength(0);
    expect(result.avgRating).toBe(0);
    expect(result.total).toBe(0);
  });

  it("should return reviews with correct average rating", async () => {
    const buyer1 = await setupBuyer("buyer1@test.com");
    const buyer2 = await setupBuyer("buyer2@test.com");
    const { product, variant } = await setupProduct();

    await setupDeliveredOrder(buyer1.id, variant.id, product.id);
    await setupDeliveredOrder(buyer2.id, variant.id, product.id);

    await createReview(buyer1.id, product.id, { rating: 4 });
    await createReview(buyer2.id, product.id, { rating: 2 });

    const result = await getProductReviews(product.id);
    expect(result.reviews).toHaveLength(2);
    expect(result.avgRating).toBe(3); // (4 + 2) / 2
  });

  it("should throw 404 for non-existent product", async () => {
    await expect(getProductReviews("non-existent")).rejects.toThrow("Product not found");
  });
});

// ─── createReview ─────────────────────────────────────────────────────────────
describe("createReview", () => {
  it("should create review for delivered order", async () => {
    const buyer = await setupBuyer();
    const { product, variant } = await setupProduct();
    await setupDeliveredOrder(buyer.id, variant.id, product.id);

    const review = await createReview(buyer.id, product.id, { rating: 5, body: "Great product!" });

    expect(review.rating).toBe(5);
    expect(review.body).toBe("Great product!");
    expect(review.userId).toBe(buyer.id);
  });

  it("should throw 403 if no delivered order", async () => {
    const buyer = await setupBuyer();
    const { product } = await setupProduct();

    await expect(
      createReview(buyer.id, product.id, { rating: 5 })
    ).rejects.toThrow("You can only review products you have received");
  });

  it("should throw 409 if already reviewed", async () => {
    const buyer = await setupBuyer();
    const { product, variant } = await setupProduct();
    await setupDeliveredOrder(buyer.id, variant.id, product.id);

    await createReview(buyer.id, product.id, { rating: 5 });

    await expect(
      createReview(buyer.id, product.id, { rating: 4 })
    ).rejects.toThrow("You have already reviewed this product");
  });

  it("should throw 404 for non-existent product", async () => {
    const buyer = await setupBuyer();
    await expect(
      createReview(buyer.id, "non-existent", { rating: 5 })
    ).rejects.toThrow("Product not found");
  });
});

// ─── updateReview ─────────────────────────────────────────────────────────────
describe("updateReview", () => {
  it("should update own review", async () => {
    const buyer = await setupBuyer();
    const { product, variant } = await setupProduct();
    await setupDeliveredOrder(buyer.id, variant.id, product.id);

    const review = await createReview(buyer.id, product.id, { rating: 3, body: "OK product" });
    const updated = await updateReview(buyer.id, review.id, { rating: 5, body: "Great product!" });

    expect(updated.rating).toBe(5);
    expect(updated.body).toBe("Great product!");
  });

  it("should throw 403 if not own review", async () => {
    const buyer1 = await setupBuyer("buyer1@test.com");
    const buyer2 = await setupBuyer("buyer2@test.com");
    const { product, variant } = await setupProduct();
    await setupDeliveredOrder(buyer1.id, variant.id, product.id);

    const review = await createReview(buyer1.id, product.id, { rating: 5 });

    await expect(
      updateReview(buyer2.id, review.id, { rating: 1 })
    ).rejects.toThrow("Forbidden");
  });

  it("should throw 404 if review not found", async () => {
    const buyer = await setupBuyer();
    await expect(
      updateReview(buyer.id, "non-existent", { rating: 5 })
    ).rejects.toThrow("Review not found");
  });
});

// ─── deleteReview ─────────────────────────────────────────────────────────────
describe("deleteReview", () => {
  it("should delete own review", async () => {
    const buyer = await setupBuyer();
    const { product, variant } = await setupProduct();
    await setupDeliveredOrder(buyer.id, variant.id, product.id);

    const review = await createReview(buyer.id, product.id, { rating: 5 });
    await deleteReview(buyer.id, review.id, "BUYER");

    const found = await prisma.review.findUnique({ where: { id: review.id } });
    expect(found).toBeNull();
  });

  it("should allow admin to delete any review", async () => {
    const buyer = await setupBuyer();
    const admin = await register({ name: "Admin", email: "admin@test.com", password: "password123", role: "BUYER" });
    const { product, variant } = await setupProduct();
    await setupDeliveredOrder(buyer.id, variant.id, product.id);

    const review = await createReview(buyer.id, product.id, { rating: 5 });
    await deleteReview(admin.user.id, review.id, "ADMIN");

    const found = await prisma.review.findUnique({ where: { id: review.id } });
    expect(found).toBeNull();
  });

  it("should throw 403 if not own review and not admin", async () => {
    const buyer1 = await setupBuyer("buyer1@test.com");
    const buyer2 = await setupBuyer("buyer2@test.com");
    const { product, variant } = await setupProduct();
    await setupDeliveredOrder(buyer1.id, variant.id, product.id);

    const review = await createReview(buyer1.id, product.id, { rating: 5 });

    await expect(
      deleteReview(buyer2.id, review.id, "BUYER")
    ).rejects.toThrow("Forbidden");
  });
});
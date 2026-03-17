import prisma from "../../src/config/db";
import { register } from "../../src/modules/auth/auth.service";
import { createSellerProfile } from "../../src/modules/seller/seller.service";
import { createCategory } from "../../src/modules/category/category.service";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  togglePublish,
  listProducts,
  getProductBySlug,
  addVariant,
  updateVariant,
  deleteVariant,
  uploadProductMedia,
  deleteProductMedia,
} from "../../src/modules/product/product.service";

// ─── mock R2 ──────────────────────────────────────────────────────────────────
jest.mock("../../src/utils/upload", () => ({
  upload: {
    single: () => (_req: any, _res: any, next: any) => next(),
    array: () => (_req: any, _res: any, next: any) => next(),
  },
  uploadToR2: jest.fn().mockImplementation(() =>
    Promise.resolve({
      url: "https://r2.example.com/products/test.jpg",
      key: `products/test-${Date.now()}-${Math.random()}.jpg`, // unique each time
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
const setupSeller = async (email = "seller@test.com") => {
  const result = await register({
    name: "Seller",
    email,
    password: "password123",
    role: "BUYER",
  });
  await createSellerProfile(result.user.id, { storeName: "Test Store" });
  return result.user;
};

const setupCategory = async () => {
  return createCategory({ name: "Electronics", slug: "electronics" });
};

const setupProduct = async (userId: string, categoryId: string, overrides = {}) => {
  return createProduct(userId, {
    name: "Test Product",
    slug: "test-product",
    categoryId,
    ...overrides,
  });
};

const mockFile = {
  buffer: Buffer.from("fake image"),
  mimetype: "image/jpeg",
  originalname: "test.jpg",
  size: 1024,
} as Express.Multer.File;

// ─── createProduct ────────────────────────────────────────────────────────────
describe("createProduct", () => {
  it("should create a product", async () => {
    const user = await setupSeller();
    const category = await setupCategory();

    const product = await createProduct(user.id, {
      name: "Test Product",
      slug: "test-product",
      categoryId: category.id,
    });

    expect(product.name).toBe("Test Product");
    expect(product.isPublished).toBe(false);
  });

  it("should throw 404 if category not found", async () => {
    const user = await setupSeller();
    await expect(
      createProduct(user.id, { name: "Test", slug: "test", categoryId: "non-existent" })
    ).rejects.toThrow("Category not found");
  });

  it("should throw 409 if slug already in use", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    await setupProduct(user.id, category.id);

    await expect(
      createProduct(user.id, { name: "Another Product", slug: "test-product", categoryId: category.id })
    ).rejects.toThrow("Slug already in use");
  });

  it("should throw 403 if user has no seller profile", async () => {
    const result = await register({ name: "Buyer", email: "buyer@test.com", password: "password123", role: "BUYER" });
    const category = await setupCategory();

    await expect(
      createProduct(result.user.id, { name: "Test", slug: "test", categoryId: category.id })
    ).rejects.toThrow("Seller profile not found");
  });
});

// ─── listProducts ─────────────────────────────────────────────────────────────
describe("listProducts", () => {
  it("should return only published products", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);

    // add variant and publish
    await addVariant(user.id, product.id, { name: "Default", sku: "SKU-1", price: 100, stock: 10 });
    await togglePublish(user.id, product.id);

    // create unpublished product
    await setupProduct(user.id, category.id, { name: "Unpublished", slug: "unpublished" });

    const result = await listProducts({ page: 1, limit: 10 });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("Test Product");
  });

  it("should filter by category", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    await addVariant(user.id, product.id, { name: "Default", sku: "SKU-1", price: 100, stock: 10 });
    await togglePublish(user.id, product.id);

    const result = await listProducts({ page: 1, limit: 10, categoryId: category.id });
    expect(result.products).toHaveLength(1);

    const result2 = await listProducts({ page: 1, limit: 10, categoryId: "other-id" });
    expect(result2.products).toHaveLength(0);
  });

  it("should search by name", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    await addVariant(user.id, product.id, { name: "Default", sku: "SKU-1", price: 100, stock: 10 });
    await togglePublish(user.id, product.id);

    const result = await listProducts({ page: 1, limit: 10, search: "test" });
    expect(result.products).toHaveLength(1);

    const result2 = await listProducts({ page: 1, limit: 10, search: "nonexistent" });
    expect(result2.products).toHaveLength(0);
  });

  it("should paginate correctly", async () => {
    const user = await setupSeller();
    const category = await setupCategory();

    // create 3 products
    for (let i = 1; i <= 3; i++) {
      const p = await setupProduct(user.id, category.id, { name: `Product ${i}`, slug: `product-${i}` });
      await addVariant(user.id, p.id, { name: "Default", sku: `SKU-${i}`, price: 100, stock: 10 });
      await togglePublish(user.id, p.id);
    }

    const result = await listProducts({ page: 1, limit: 2 });
    expect(result.products).toHaveLength(2);
    expect(result.pagination.total).toBe(3);
    expect(result.pagination.totalPages).toBe(2);
  });
});

// ─── getProductBySlug ─────────────────────────────────────────────────────────
describe("getProductBySlug", () => {
  it("should return published product", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    await addVariant(user.id, product.id, { name: "Default", sku: "SKU-1", price: 100, stock: 10 });
    await togglePublish(user.id, product.id);

    const found = await getProductBySlug("test-product");
    expect(found.name).toBe("Test Product");
    expect(found.variants).toHaveLength(1);
  });

  it("should throw 404 for unpublished product", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    await setupProduct(user.id, category.id);

    await expect(getProductBySlug("test-product")).rejects.toThrow("Product not found");
  });

  it("should throw 404 for non-existent slug", async () => {
    await expect(getProductBySlug("non-existent")).rejects.toThrow("Product not found");
  });
});

// ─── togglePublish ────────────────────────────────────────────────────────────
describe("togglePublish", () => {
  it("should publish a product with variants", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    await addVariant(user.id, product.id, { name: "Default", sku: "SKU-1", price: 100, stock: 10 });

    const updated = await togglePublish(user.id, product.id);
    expect(updated.isPublished).toBe(true);
  });

  it("should throw 400 if no variants", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);

    await expect(togglePublish(user.id, product.id)).rejects.toThrow(
      "Add at least one variant before publishing"
    );
  });

  it("should unpublish a published product", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    await addVariant(user.id, product.id, { name: "Default", sku: "SKU-1", price: 100, stock: 10 });
    await togglePublish(user.id, product.id); // publish

    const updated = await togglePublish(user.id, product.id); // unpublish
    expect(updated.isPublished).toBe(false);
  });
});

// ─── variants ─────────────────────────────────────────────────────────────────
describe("addVariant", () => {
  it("should add a variant", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);

    const variant = await addVariant(user.id, product.id, {
      name: "Large",
      sku: "SKU-L",
      price: 99.99,
      stock: 10,
    });

    expect(variant.name).toBe("Large");
    expect(variant.sku).toBe("SKU-L");
  });

  it("should throw 409 if SKU already in use", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    await addVariant(user.id, product.id, { name: "Large", sku: "SKU-L", price: 99.99, stock: 10 });

    await expect(
      addVariant(user.id, product.id, { name: "Small", sku: "SKU-L", price: 49.99, stock: 5 })
    ).rejects.toThrow("SKU already in use");
  });
});

describe("updateVariant", () => {
  it("should update a variant", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    const variant = await addVariant(user.id, product.id, { name: "Large", sku: "SKU-L", price: 99.99, stock: 10 });

    const updated = await updateVariant(user.id, product.id, variant.id, { price: 79.99 });
    expect(Number(updated.price)).toBe(79.99);
  });
});

describe("deleteVariant", () => {
  it("should delete a variant", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    const variant = await addVariant(user.id, product.id, { name: "Large", sku: "SKU-L", price: 99.99, stock: 10 });

    await deleteVariant(user.id, product.id, variant.id);

    const found = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(found).toBeNull();
  });
});

// ─── media ────────────────────────────────────────────────────────────────────
describe("uploadProductMedia", () => {
  it("should upload media files", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);

    await uploadProductMedia(user.id, product.id, [mockFile, mockFile]);

    const media = await prisma.media.findMany({ where: { productId: product.id } });
    expect(media).toHaveLength(2);
  });

  it("should throw 400 if no files", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);

    await expect(uploadProductMedia(user.id, product.id, [])).rejects.toThrow("No files uploaded");
  });
});

describe("deleteProductMedia", () => {
  it("should delete media", async () => {
    const user = await setupSeller();
    const category = await setupCategory();
    const product = await setupProduct(user.id, category.id);
    await uploadProductMedia(user.id, product.id, [mockFile]);

    const media = await prisma.media.findFirst({ where: { productId: product.id } });
    await deleteProductMedia(user.id, product.id, media!.id);

    const found = await prisma.media.findUnique({ where: { id: media!.id } });
    expect(found).toBeNull();
  });
});
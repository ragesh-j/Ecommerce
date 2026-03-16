import prisma from "../../src/config/db";
import {
  createCategory,
  getAllCategories,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
} from "../../src/modules/category/category.service";

afterEach(async () => {
  await prisma.category.deleteMany();
});

// ─── createCategory ───────────────────────────────────────────────────────────
describe("createCategory", () => {
  it("should create a top level category", async () => {
    const category = await createCategory({
      name: "Electronics",
      slug: "electronics",
    });

    expect(category.name).toBe("Electronics");
    expect(category.slug).toBe("electronics");
    expect(category.parentId).toBeNull();
  });

  it("should create a subcategory with valid parentId", async () => {
    const parent = await createCategory({ name: "Electronics", slug: "electronics" });
    const child = await createCategory({
      name: "Phones",
      slug: "phones",
      parentId: parent.id,
    });

    expect(child.parentId).toBe(parent.id);
  });

  it("should throw 404 if parentId does not exist", async () => {
    await expect(
      createCategory({ name: "Phones", slug: "phones", parentId: "non-existent-id" })
    ).rejects.toThrow("Parent category not found");
  });
});

// ─── getAllCategories ─────────────────────────────────────────────────────────
describe("getAllCategories", () => {
  it("should return only top level categories with children", async () => {
    const parent = await createCategory({ name: "Electronics", slug: "electronics" });
    await createCategory({ name: "Phones", slug: "phones", parentId: parent.id });

    const categories = await getAllCategories();

    expect(categories).toHaveLength(1); // only Electronics at top level
    expect(categories[0].name).toBe("Electronics");
    expect(categories[0].children).toHaveLength(1);
    expect(categories[0].children[0].name).toBe("Phones");
  });

  it("should return empty array if no categories", async () => {
    const categories = await getAllCategories();
    expect(categories).toHaveLength(0);
  });
});

// ─── getCategoryBySlug ────────────────────────────────────────────────────────
describe("getCategoryBySlug", () => {
  it("should return category with parent and children", async () => {
    const parent = await createCategory({ name: "Electronics", slug: "electronics" });
    await createCategory({ name: "Phones", slug: "phones", parentId: parent.id });

    const category = await getCategoryBySlug("electronics");

    expect(category.name).toBe("Electronics");
    expect(category.children).toHaveLength(1);
    expect(category._count.products).toBe(0);
  });

  it("should throw 404 for non-existent slug", async () => {
    await expect(getCategoryBySlug("non-existent")).rejects.toThrow("Category not found");
  });
});

// ─── updateCategory ───────────────────────────────────────────────────────────
describe("updateCategory", () => {
  it("should update category name", async () => {
    const category = await createCategory({ name: "Electronics", slug: "electronics" });
    const updated = await updateCategory(category.id, { name: "Updated Electronics" });

    expect(updated.name).toBe("Updated Electronics");
  });

  it("should throw 400 if category sets itself as parent", async () => {
    const category = await createCategory({ name: "Electronics", slug: "electronics" });

    await expect(
      updateCategory(category.id, { parentId: category.id })
    ).rejects.toThrow("Category cannot be its own parent");
  });

  it("should throw 404 if category not found", async () => {
    await expect(
      updateCategory("non-existent-id", { name: "Updated" })
    ).rejects.toThrow("Category not found");
  });

  it("should throw 404 if parentId does not exist", async () => {
    const category = await createCategory({ name: "Electronics", slug: "electronics" });

    await expect(
      updateCategory(category.id, { parentId: "non-existent-id" })
    ).rejects.toThrow("Parent category not found");
  });
});

// ─── deleteCategory ───────────────────────────────────────────────────────────
describe("deleteCategory", () => {
  it("should delete a category", async () => {
    const category = await createCategory({ name: "Electronics", slug: "electronics" });
    await deleteCategory(category.id);

    const found = await prisma.category.findUnique({ where: { id: category.id } });
    expect(found).toBeNull();
  });

  it("should throw 400 if category has subcategories", async () => {
    const parent = await createCategory({ name: "Electronics", slug: "electronics" });
    await createCategory({ name: "Phones", slug: "phones", parentId: parent.id });

    await expect(deleteCategory(parent.id)).rejects.toThrow(
      "Cannot delete category with subcategories"
    );
  });

  it("should throw 404 if category not found", async () => {
    await expect(deleteCategory("non-existent-id")).rejects.toThrow("Category not found");
  });
});
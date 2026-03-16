import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { CreateCategoryInput, UpdateCategoryInput } from "./category.validator";

// ─── create category ──────────────────────────────────────────────────────────
export const createCategory = async (data: CreateCategoryInput) => {
  // check if parent exists
  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new ApiError(404, "Parent category not found");
  }

  return prisma.category.create({ data });
};

// ─── get all categories (tree structure) ─────────────────────────────────────
export const getAllCategories = async () => {
  // only fetch top level categories with their children
  return prisma.category.findMany({
    where: { parentId: null }, // top level only
    include: {
      children: {
        include: {
          children: true, // one more level deep
        },
      },
    },
    orderBy: { name: "asc" },
  });
};

// ─── get single category by slug ─────────────────────────────────────────────
export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: true,
      _count: { select: { products: true } },
    },
  });

  if (!category) throw new ApiError(404, "Category not found");
  return category;
};

// ─── update category ──────────────────────────────────────────────────────────
export const updateCategory = async (id: string, data: UpdateCategoryInput) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new ApiError(404, "Category not found");

  // prevent setting itself as parent
  if (data.parentId === id) throw new ApiError(400, "Category cannot be its own parent");

  // check if parent exists
  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new ApiError(404, "Parent category not found");
  }

  return prisma.category.update({ where: { id }, data });
};

// ─── delete category ──────────────────────────────────────────────────────────
export const deleteCategory = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true, products: true } } },
  });

  if (!category) throw new ApiError(404, "Category not found");
  if (category._count.children > 0) throw new ApiError(400, "Cannot delete category with subcategories");
  if (category._count.products > 0) throw new ApiError(400, "Cannot delete category with products");

  await prisma.category.delete({ where: { id } });
};
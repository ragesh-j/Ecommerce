import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { CreateTagInput, UpdateTagInput } from "./tag.validator";

// ─── create tag ───────────────────────────────────────────────────────────────
export const createTag = async (data: CreateTagInput) => {
  const existing = await prisma.tag.findUnique({ where: { slug: data.slug } });
  if (existing) throw new ApiError(409, "Tag with this slug already exists");

  return prisma.tag.create({ data });
};

// ─── get all tags ─────────────────────────────────────────────────────────────
export const getAllTags = async () => {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } }, // how many products per tag
    },
  });
};

// ─── update tag ───────────────────────────────────────────────────────────────
export const updateTag = async (id: string, data: UpdateTagInput) => {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new ApiError(404, "Tag not found");

  // check slug uniqueness if changing
  if (data.slug) {
    const existing = await prisma.tag.findUnique({ where: { slug: data.slug } });
    if (existing && existing.id !== id) throw new ApiError(409, "Slug already in use");
  }

  return prisma.tag.update({ where: { id }, data });
};

// ─── delete tag ───────────────────────────────────────────────────────────────
export const deleteTag = async (id: string) => {
  const tag = await prisma.tag.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!tag) throw new ApiError(404, "Tag not found");

  // warn if tag has products assigned
  if (tag._count.products > 0)
    throw new ApiError(400, `Cannot delete tag assigned to ${tag._count.products} products`);

  await prisma.tag.delete({ where: { id } });
};

// ─── assign tag to product ────────────────────────────────────────────────────
export const assignTagToProduct = async (productId: string, tagId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, "Product not found");

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw new ApiError(404, "Tag not found");

  // check if already assigned
  const existing = await prisma.productTag.findUnique({
    where: { productId_tagId: { productId, tagId } },
  });
  if (existing) throw new ApiError(409, "Tag already assigned to this product");

  return prisma.productTag.create({ data: { productId, tagId } });
};

// ─── remove tag from product ──────────────────────────────────────────────────
export const removeTagFromProduct = async (productId: string, tagId: string) => {
  const existing = await prisma.productTag.findUnique({
    where: { productId_tagId: { productId, tagId } },
  });
  if (!existing) throw new ApiError(404, "Tag not assigned to this product");

  await prisma.productTag.delete({
    where: { productId_tagId: { productId, tagId } },
  });
};
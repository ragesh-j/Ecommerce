import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { uploadToR2, deleteFromR2 } from "../../utils/upload";
import {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  ListProductsInput,
} from "./product.validator";

// ─── helper: get seller profile or throw ─────────────────────────────────────
const getSellerProfile = async (userId: string) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw new ApiError(403, "Seller profile not found");
  return seller;
};

// ─── helper: get product and verify ownership ─────────────────────────────────
const getOwnProduct = async (productId: string, sellerId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, "Product not found");
  if (product.sellerId !== sellerId) throw new ApiError(403, "Forbidden");
  return product;
};

// ─── list products (public) ───────────────────────────────────────────────────
export const listProducts = async (query: ListProductsInput) => {
  const { page, limit, categoryId, minPrice, maxPrice, search } = query;
  const skip = (page - 1) * limit;

  const where: any = {
    isPublished: true,
    ...(categoryId && { categoryId }),
    ...(search && { name: { contains: search, mode: "insensitive" } }),
    ...(minPrice || maxPrice
      ? {
          variants: {
            some: {
              price: {
                ...(minPrice && { gte: minPrice }),
                ...(maxPrice && { lte: maxPrice }),
              },
            },
          },
        }
      : {}),
  };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        category: { select: { name: true, slug: true } },
        seller: { select: { id: true, storeName: true, logoUrl: true } },
        variants: {
          select: { price: true, stock: true },
          orderBy: { price: "asc" },
          take: 1, // cheapest variant for listing
        },
        media: {
          select: { url: true },
          take: 1, // first image as thumbnail
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ─── get single product (public) ─────────────────────────────────────────────
export const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug, isPublished: true },
    include: {
      category: { select: { name: true, slug: true } },
      seller: { select: { id: true, storeName: true, logoUrl: true, isVerified: true } },
      variants: { orderBy: { price: "asc" } },
      media: { select: { id: true, url: true, key: true } },
      _count: { select: { reviews: true } },
    },
  });

  if (!product) throw new ApiError(404, "Product not found");
  return product;
};

// ─── create product ───────────────────────────────────────────────────────────
export const createProduct = async (userId: string, data: CreateProductInput) => {
  const seller = await getSellerProfile(userId);

  // check category exists
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) throw new ApiError(404, "Category not found");

  // check slug is unique
  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) throw new ApiError(409, "Slug already in use");

  return prisma.product.create({
    data: { ...data, sellerId: seller.id },
  });
};

// ─── update product ───────────────────────────────────────────────────────────
export const updateProduct = async (userId: string, productId: string, data: UpdateProductInput) => {
  const seller = await getSellerProfile(userId);
  await getOwnProduct(productId, seller.id);

  // check category exists if changing
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new ApiError(404, "Category not found");
  }

  // check slug is unique if changing
  if (data.slug) {
    const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (existing && existing.id !== productId) throw new ApiError(409, "Slug already in use");
  }

  return prisma.product.update({ where: { id: productId }, data });
};

// ─── delete product ───────────────────────────────────────────────────────────
export const deleteProduct = async (userId: string, productId: string) => {
  const seller = await getSellerProfile(userId);
  await getOwnProduct(productId, seller.id);

  // delete all media from R2 first
  const media = await prisma.media.findMany({ where: { productId } });
  await Promise.all(media.map(m => deleteFromR2(m.key)));

  await prisma.product.delete({ where: { id: productId } });
};

// ─── toggle publish ───────────────────────────────────────────────────────────
export const togglePublish = async (userId: string, productId: string) => {
  const seller = await getSellerProfile(userId);
  const product = await getOwnProduct(productId, seller.id);

  // must have at least one variant to publish
  if (!product.isPublished) {
    const variantCount = await prisma.productVariant.count({ where: { productId } });
    if (variantCount === 0) throw new ApiError(400, "Add at least one variant before publishing");
  }

  return prisma.product.update({
    where: { id: productId },
    data: { isPublished: !product.isPublished },
  });
};

// ─── add variant ─────────────────────────────────────────────────────────────
export const addVariant = async (userId: string, productId: string, data: CreateVariantInput) => {
  const seller = await getSellerProfile(userId);
  await getOwnProduct(productId, seller.id);

  // check SKU is unique
  const existing = await prisma.productVariant.findUnique({ where: { sku: data.sku } });
  if (existing) throw new ApiError(409, "SKU already in use");

  return prisma.productVariant.create({ data: { ...data, productId } });
};

// ─── update variant ───────────────────────────────────────────────────────────
export const updateVariant = async (
  userId: string,
  productId: string,
  variantId: string,
  data: UpdateVariantInput
) => {
  const seller = await getSellerProfile(userId);
  await getOwnProduct(productId, seller.id);

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new ApiError(404, "Variant not found");
  if (variant.productId !== productId) throw new ApiError(403, "Forbidden");

  // check SKU uniqueness if changing
  if (data.sku) {
    const existing = await prisma.productVariant.findUnique({ where: { sku: data.sku } });
    if (existing && existing.id !== variantId) throw new ApiError(409, "SKU already in use");
  }

  return prisma.productVariant.update({ where: { id: variantId }, data });
};

// ─── delete variant ───────────────────────────────────────────────────────────
export const deleteVariant = async (userId: string, productId: string, variantId: string) => {
  const seller = await getSellerProfile(userId);
  await getOwnProduct(productId, seller.id);

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new ApiError(404, "Variant not found");
  if (variant.productId !== productId) throw new ApiError(403, "Forbidden");

  await prisma.productVariant.delete({ where: { id: variantId } });
};

// ─── upload product media ─────────────────────────────────────────────────────
export const uploadProductMedia = async (
  userId: string,
  productId: string,
  files: Express.Multer.File[]
) => {
  const seller = await getSellerProfile(userId);
  await getOwnProduct(productId, seller.id);

  if (!files || files.length === 0) throw new ApiError(400, "No files uploaded");

  const uploaded = await Promise.all(
    files.map(file => uploadToR2(file, "products"))
  );

  const media = await prisma.media.createMany({
    data: uploaded.map(({ url, key }, i) => ({
      uploaderId: userId,
      productId,
      type: "IMAGE" as const,
      url,
      key,
      mimeType: files[i].mimetype,
      size: files[i].size,
    })),
  });

  return media;
};

// ─── delete product media ─────────────────────────────────────────────────────
export const deleteProductMedia = async (
  userId: string,
  productId: string,
  mediaId: string
) => {
  const seller = await getSellerProfile(userId);
  await getOwnProduct(productId, seller.id);

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new ApiError(404, "Media not found");
  if (media.productId !== productId) throw new ApiError(403, "Forbidden");

  await deleteFromR2(media.key);
  await prisma.media.delete({ where: { id: mediaId } });
};
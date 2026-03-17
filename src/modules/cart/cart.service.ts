import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { AddCartItemInput, UpdateCartItemInput } from "./cart.validator";

// ─── helper: get or create cart ───────────────────────────────────────────────
const getOrCreateCart = async (userId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }

  return cart;
};

// ─── get cart ─────────────────────────────────────────────────────────────────
export const getCart = async (userId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                select: {
                  name: true,
                  slug: true,
                  media: {
                    take: 1,
                    select: { url: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!cart) return { items: [], total: 0 };

  // calculate total
  const total = cart.items.reduce((sum, item) => {
    return sum + Number(item.variant.price) * item.quantity;
  }, 0);

  return { ...cart, total };
};

// ─── add item to cart ─────────────────────────────────────────────────────────
export const addCartItem = async (userId: string, data: AddCartItemInput) => {
  // check variant exists and is in stock
  const variant = await prisma.productVariant.findUnique({
    where: { id: data.variantId },
    include: { product: { select: { isPublished: true } } },
  });

  if (!variant) throw new ApiError(404, "Variant not found");
  if (!variant.product.isPublished) throw new ApiError(400, "Product is not available");
  if (variant.stock < data.quantity) throw new ApiError(400, `Only ${variant.stock} items in stock`);

  const cart = await getOrCreateCart(userId);

  // if item already in cart → update quantity
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: data.variantId } },
  });

  if (existing) {
    const newQuantity = existing.quantity + data.quantity;
    if (variant.stock < newQuantity) throw new ApiError(400, `Only ${variant.stock} items in stock`);

    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
    });
  }

  return prisma.cartItem.create({
    data: { cartId: cart.id, variantId: data.variantId, quantity: data.quantity },
  });
};

// ─── update cart item quantity ────────────────────────────────────────────────
export const updateCartItem = async (userId: string, itemId: string, data: UpdateCartItemInput) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new ApiError(404, "Cart not found");

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { variant: true },
  });

  if (!item) throw new ApiError(404, "Cart item not found");
  if (item.cartId !== cart.id) throw new ApiError(403, "Forbidden");
  if (item.variant.stock < data.quantity) throw new ApiError(400, `Only ${item.variant.stock} items in stock`);

  return prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity: data.quantity },
  });
};

// ─── remove item from cart ────────────────────────────────────────────────────
export const removeCartItem = async (userId: string, itemId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new ApiError(404, "Cart not found");

  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item) throw new ApiError(404, "Cart item not found");
  if (item.cartId !== cart.id) throw new ApiError(403, "Forbidden");

  await prisma.cartItem.delete({ where: { id: itemId } });
};

// ─── clear cart ───────────────────────────────────────────────────────────────
export const clearCart = async (userId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
};
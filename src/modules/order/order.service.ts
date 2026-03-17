import prisma from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { CheckoutInput, UpdateOrderStatusInput } from "./order.validator";

// ─── checkout ─────────────────────────────────────────────────────────────────
export const checkout = async (userId: string, data: CheckoutInput) => {
  // get cart with items
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          variant: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) throw new ApiError(400, "Cart is empty");

  // verify address belongs to user
  const address = await prisma.address.findUnique({ where: { id: data.addressId } });
  if (!address) throw new ApiError(404, "Address not found");
  if (address.userId !== userId) throw new ApiError(403, "Forbidden");

  // verify stock for all items
  for (const item of cart.items) {
    if (item.variant.stock < item.quantity) {
      throw new ApiError(400, `Not enough stock for ${item.variant.name}`);
    }
  }

  // calculate total
  const totalAmount = cart.items.reduce((sum, item) => {
    return sum + Number(item.variant.price) * item.quantity;
  }, 0);

  // create order + order items + deduct stock in a transaction
  const order = await prisma.$transaction(async (tx) => {
    // create order
    const order = await tx.order.create({
      data: {
        userId,
        addressId: data.addressId,
        totalAmount,
        status: "PENDING",
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.variant.price,
          })),
        },
      },
      include: {
        items: true,
        address: true,
      },
    });

    // deduct stock for each variant
    for (const item of cart.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  });

  return order;
};

// ─── get my orders ────────────────────────────────────────────────────────────
export const getMyOrders = async (userId: string) => {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      address: { select: { line1: true, city: true, country: true } },
      items: {
        include: {
          variant: {
            select: {
              name: true,
              sku: true,
              product: { select: { name: true, slug: true } },
            },
          },
        },
      },
      payment: { select: { status: true, provider: true } },
    },
  });
};

// ─── get single order ─────────────────────────────────────────────────────────
export const getOrderById = async (userId: string, orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      address: true,
      items: {
        include: {
          variant: {
            include: {
              product: { select: { name: true, slug: true } },
            },
          },
        },
      },
      payment: true,
    },
  });

  if (!order) throw new ApiError(404, "Order not found");
  if (order.userId !== userId) throw new ApiError(403, "Forbidden");

  return order;
};

// ─── cancel order ─────────────────────────────────────────────────────────────
export const cancelOrder = async (userId: string, orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new ApiError(404, "Order not found");
  if (order.userId !== userId) throw new ApiError(403, "Forbidden");
  if (order.status !== "PENDING") throw new ApiError(400, "Only pending orders can be cancelled");

  // restore stock + update status in a transaction
  return prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });
  });
};

// ─── get seller orders ────────────────────────────────────────────────────────
export const getSellerOrders = async (userId: string) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw new ApiError(403, "Seller profile not found");

  // get orders that contain items from this seller's products
  return prisma.order.findMany({
    where: {
      items: {
        some: {
          variant: {
            product: { sellerId: seller.id },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      address: { select: { line1: true, city: true, country: true } },
      items: {
        where: {
          variant: {
            product: { sellerId: seller.id }, // only show this seller's items
          },
        },
        include: {
          variant: {
            include: {
              product: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });
};

// ─── update order status (seller) ────────────────────────────────────────────
export const updateOrderStatus = async (
  userId: string,
  orderId: string,
  data: UpdateOrderStatusInput
) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) throw new ApiError(403, "Seller profile not found");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: {
            include: { product: true },
          },
        },
      },
    },
  });

  if (!order) throw new ApiError(404, "Order not found");

  // verify order contains at least one item from this seller
  const hasSellerItem = order.items.some(
    (item) => item.variant.product.sellerId === seller.id
  );
  if (!hasSellerItem) throw new ApiError(403, "Forbidden");

  // status transition rules
  const validTransitions: Record<string, string[]> = {
    PENDING: ["CANCELLED"],
    PAID: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
  };

  const allowed = validTransitions[order.status] ?? [];
  if (!allowed.includes(data.status)) {
    throw new ApiError(400, `Cannot transition from ${order.status} to ${data.status}`);
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: data.status },
  });
};
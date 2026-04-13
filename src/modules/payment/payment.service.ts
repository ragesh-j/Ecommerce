import crypto from "crypto";
import prisma from "../../config/db";
import razorpay from "../../config/razorpay";
import { ApiError } from "../../utils/ApiError";
import { InitiatePaymentInput, VerifyPaymentInput } from "./payment.validator";

// ─── initiate payment ─────────────────────────────────────────────────────────
export const initiatePayment = async (userId: string, data: InitiatePaymentInput) => {
  // get cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { variant: true } } },
  });

  if (!cart || cart.items.length === 0) throw new ApiError(400, "Cart is empty");

  // verify address
  const address = await prisma.address.findUnique({ where: { id: data.addressId } });
  if (!address) throw new ApiError(404, "Address not found");
  if (address.userId !== userId) throw new ApiError(403, "Forbidden");

  // verify stock
  for (const item of cart.items) {
    if (item.variant.stock < item.quantity) {
      throw new ApiError(400, `Not enough stock for ${item.variant.name}`);
    }
  }

  // calculate total
  const totalAmount = cart.items.reduce((sum, item) => {
    return sum + Number(item.variant.price) * item.quantity;
  }, 0);

  // create razorpay order only — no DB order yet
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100),
    currency: "INR",
    receipt: `${userId}-${Date.now()}`,
    notes: {
      userId,
      addressId: data.addressId,
    },
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

// ─── verify payment + create order ───────────────────────────────────────────
export const verifyPayment = async (userId: string, data: VerifyPaymentInput) => {
  // verify signature
  const body = `${data.razorpayOrderId}|${data.razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (expectedSignature !== data.razorpaySignature) {
    throw new ApiError(400, "Invalid payment signature");
  }

  // get cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { variant: true } } },
  });

  if (!cart || cart.items.length === 0) throw new ApiError(400, "Cart is empty");

  // verify address
  const address = await prisma.address.findUnique({ where: { id: data.addressId } });
  if (!address) throw new ApiError(404, "Address not found");
  if (address.userId !== userId) throw new ApiError(403, "Forbidden");

  // verify stock again (might have changed)
  for (const item of cart.items) {
    if (item.variant.stock < item.quantity) {
      throw new ApiError(400, `Not enough stock for ${item.variant.name}`);
    }
  }

  const totalAmount = cart.items.reduce((sum, item) => {
    return sum + Number(item.variant.price) * item.quantity;
  }, 0);

  // create order + payment + deduct stock + clear cart in one transaction
  const order = await prisma.$transaction(async (tx) => {
    // create order
    const order = await tx.order.create({
      data: {
        userId,
        addressId: data.addressId,
        totalAmount,
        status: "PAID",
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.variant.price,
          })),
        },
      },
    });

    // create payment record
    await tx.payment.create({
      data: {
        orderId: order.id,
        userId,
        amount: totalAmount,
        currency: "INR",
        provider: "razorpay",
        status: "COMPLETED",
        providerTxId: data.razorpayPaymentId,
        providerMetadata: {
          razorpayOrderId: data.razorpayOrderId,
          razorpayPaymentId: data.razorpayPaymentId,
          razorpaySignature: data.razorpaySignature,
        },
      },
    });

    // deduct stock
    for (const item of cart.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // increment salesCount
    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.variant.productId },
        data: { salesCount: { increment: item.quantity } },
      });
    }

    // clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  });

  return { success: true, message: "Payment verified successfully", orderId: order.id };
};

// ─── get payment by order id ──────────────────────────────────────────────────
export const getPaymentByOrderId = async (userId: string, orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.userId !== userId) throw new ApiError(403, "Forbidden");

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) throw new ApiError(404, "Payment not found");

  return payment;
};

// ─── webhook handler ──────────────────────────────────────────────────────────
export const handleWebhook = async (body: string, signature: string) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new ApiError(400, "Invalid webhook signature");
  }

  const event = JSON.parse(body);

  // webhook is now just a safety net — verifyPayment handles the main flow
  switch (event.event) {
    case "payment.captured": {
      const razorpayPaymentId = event.payload.payment.entity.id;
      const razorpayOrderId = event.payload.payment.entity.order_id;

      // check if payment already processed via verifyPayment
      const payment = await prisma.payment.findFirst({
        where: { providerTxId: razorpayPaymentId },
      });

      // already handled by verifyPayment → skip
      if (payment) break;

      // fallback — if verifyPayment didn't fire (network issue etc)
      // find the razorpay order notes to get userId and addressId
      const razorpayOrderDetails = await razorpay.orders.fetch(razorpayOrderId);
      const userId = razorpayOrderDetails.notes?.userId as string;
      const addressId = razorpayOrderDetails.notes?.addressId as string;

      if (!userId || !addressId) break;

      // get cart and create order
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: { include: { variant: true } } },
      });

      if (!cart || cart.items.length === 0) break;

      const totalAmount = cart.items.reduce((sum, item) => {
        return sum + Number(item.variant.price) * item.quantity;
      }, 0);

      await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId,
            addressId,
            totalAmount,
            status: "PAID",
            items: {
              create: cart.items.map((item) => ({
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: item.variant.price,
              })),
            },
          },
        });

        await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            amount: totalAmount,
            currency: "INR",
            provider: "razorpay",
            status: "COMPLETED",
            providerTxId: razorpayPaymentId,
            providerMetadata: { razorpayOrderId, razorpayPaymentId },
          },
        });

        for (const item of cart.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      });

      break;
    }

    case "payment.failed": {
      // nothing to do — no order was created
      break;
    }
  }
};
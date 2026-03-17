import { z } from "zod";

export const checkoutSchema = z.object({
  addressId: z.string().min(1, "Address is required"),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["SHIPPED", "DELIVERED", "CANCELLED"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
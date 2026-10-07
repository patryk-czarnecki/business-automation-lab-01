import { z } from "zod";

export const orderSchema = z.object({
  externalId: z.string().trim().min(1, {
    error: "External ID is required",
  }),
  customerName: z.string().trim().min(1, {
    error: "Customer name is required",
  }),
  customerEmail: z.email({
    error: "Invalid email address",
  }),
  amount: z.number().positive({
    error: "Amount must be greater than 0",
  }),
  currency: z.enum(["PLN", "EUR", "USD"], {
    error: "Currency must be PLN, EUR, or USD",
  }),
});

import { z } from "zod";

export const orderSchema = z.object({
  externalId: z.string().trim().min(1),
  customerName: z.string().trim().min(1),
  customerEmail: z.email(),
  amount: z.number().positive(),
  currency: z.enum(["PLN", "EUR", "USD"]),
});

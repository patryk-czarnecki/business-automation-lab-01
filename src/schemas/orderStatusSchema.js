import { z } from "zod";

export const orderStatusSchema = z.object({
  status: z.enum(["RECEIVED", "PROCESSING", "COMPLETED", "FAILED"], {
    error: "Status must be RECEIVED, PROCESSING, COMPLETED, or FAILED",
  }),
});

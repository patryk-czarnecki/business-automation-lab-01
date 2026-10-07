import express from "express";
import { z } from "zod";
import { orderSchema } from "../schemas/orderSchema.js";

const router = express.Router();

router.post("/", (req, res) => {
  const result = orderSchema.safeParse(req.body);

  if (!result.success) {
    const validationErrors = z.flattenError(result.error);

    return res.status(400).json({
      message: "Invalid order data",
      errors: validationErrors.fieldErrors,
    });
  }

  const order = result.data;

  return res.status(201).json({
    message: "Order received",
    order: order,
  });
});

export default router;

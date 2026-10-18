import { z } from "zod";
import { orderSchema } from "../schemas/orderSchema.js";
import { createOrder as createOrderService } from "../services/orderService.js";

export const createOrder = async (req, res) => {
  const result = orderSchema.safeParse(req.body);

  if (!result.success) {
    const validationErrors = z.flattenError(result.error);

    return res.status(400).json({
      message: "Invalid order data",
      errors: validationErrors.fieldErrors,
    });
  }

  const order = await createOrderService(result.data);

  return res.status(201).json({
    message: "Order created",
    order,
  });
};

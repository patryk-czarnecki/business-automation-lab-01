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

  try {
    const order = await createOrderService(result.data);

    return res.status(201).json({
      message: "Order created",
      order,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        message: "Order with this externalId already exists",
        externalId: result.data.externalId,
      });
    }

    throw error;
  }
};

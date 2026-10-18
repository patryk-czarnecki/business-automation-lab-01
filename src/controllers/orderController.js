import { z } from "zod";
import { orderSchema } from "../schemas/orderSchema.js";
import {
  createOrder as createOrderService,
  getOrders as getOrdersService,
  getOrderById as getOrderByIdService,
} from "../services/orderService.js";

export const createOrder = async (req, res) => {
  const result = orderSchema.safeParse(req.body);

  if (!result.success) {
    const validationErrors = z.flattenError(result.error);

    return res.status(400).json({
      message: "Invalid order data",
      errors: validationErrors.fieldErrors,
    });
  }

  const resultFromService = await createOrderService(result.data);

  if (resultFromService.outcome === "existing") {
    return res.status(200).json({
      message: "Order already exists; existing order returned",
      order: resultFromService.order,
    });
  }

  if (resultFromService.outcome === "conflict") {
    return res.status(409).json({
      message: "Order with this externalId already exists with different data",
      externalId: result.data.externalId,
    });
  }

  return res.status(201).json({
    message: "Order created",
    order: resultFromService.order,
  });
};

export const getOrders = async (req, res) => {
  const orders = await getOrdersService();

  return res.status(200).json({
    orders,
  });
};

export const getOrderById = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid order ID",
    });
  }

  const order = await getOrderByIdService(id);

  if (!order) {
    return res.status(404).json({
      message: "Order not found",
    });
  }

  return res.status(200).json({
    order,
  });
};

import express from "express";
import { orderSchema } from "./schemas/orderSchema.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

app.post("/api/orders", (req, res) => {
  const result = orderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid order data",
      errors: result.error.issues,
    });
  }

  const order = result.data;

  return res.status(201).json({
    message: "Order received",
    order: order,
  });
});

export default app;

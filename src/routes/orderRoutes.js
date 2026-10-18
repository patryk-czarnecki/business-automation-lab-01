import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/", getOrders);
router.get("/:id", getOrderById);
router.post("/", createOrder);

export default router;

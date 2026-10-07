import express from "express";
import orderRouter from "./routes/orderRoutes.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

app.use("/api/orders", orderRouter);

export default app;

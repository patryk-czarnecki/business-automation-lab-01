import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

app.post("/api/orders", (req, res) => {
  const order = req.body;

  res.status(201).json({
    message: "Order received",
    order: order,
  });
});

export default app;

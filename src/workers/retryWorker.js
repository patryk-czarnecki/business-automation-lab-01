import prisma from "../lib/prisma.js";
import { processOrder } from "../services/orderService.js";

const BATCH_SIZE = 10;

export const runRetryCycle = async () => {
  const dueOrders = await prisma.order.findMany({
    where: {
      status: "FAILED",
      nextRetryAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      nextRetryAt: "asc",
    },
    take: BATCH_SIZE,
    select: {
      id: true,
    },
  });

  for (const order of dueOrders) {
    try {
      const result = await processOrder(order.id, {
        scheduled: true,
      });

      console.log(`[RetryWorker] Order ${order.id}: ${result.outcome}`);
    } catch (error) {
      console.error(
        `[RetryWorker] Unexpected error for order ${order.id}:`,
        error,
      );
    }
  }
};

const POLL_INTERVAL_MS = 10_000;

let cycleRunning = false;

export const startRetryWorker = () => {
  const tick = async () => {
    if (cycleRunning) {
      return;
    }

    cycleRunning = true;

    try {
      await runRetryCycle();
    } catch (error) {
      console.error("[RetryWorker] Cycle failed:", error);
    } finally {
      cycleRunning = false;
    }
  };

  void tick();

  return setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
};
